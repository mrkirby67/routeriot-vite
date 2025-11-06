// ============================================================================
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// sanitized metadata line
// AUTHOR: James Kirby / Route Riot Project
// sanitized metadata line
// AICP_VERSION: 1.0
// ============================================================================

import { db } from '../modules/config.js';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const CHAT_COLLECTION = 'communications';
const BATCH_DELAY_MS = 120;
const DEFAULT_GAME_ID = 'global';
const CHIRP_COLLECTION = 'chirps';
const CHIRP_TASKS_COLLECTION = 'tasks';

let _gameId = null;
const ensuredChirpRoots = new Set();
const subscriptionRegistry = new Map();

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function trimString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function coerceKind(kind, recipient) {
  const normalized = typeof kind === 'string' ? kind.trim().toLowerCase() : '';
  if (normalized) return normalized;
  return recipient && recipient.toUpperCase() === 'ALL' ? 'broadcast' : 'chat';
}

function readWindowGameId() {
  if (typeof window === 'undefined') return null;
  const candidates = [
    window.__rrGameId,
    window.__routeRiotGameId,
    window.routeRiotGameId,
    window.sessionStorage?.getItem?.('activeGameId'),
    window.localStorage?.getItem?.('activeGameId')
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function recordGameId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!_gameId) {
    _gameId = trimmed;
  }
  return _gameId;
}

export function setChirpGameId(gameId) {
  if (_gameId && _gameId !== gameId) {
    console.warn(`[ChatServiceV2] Attempted to change gameId from "${_gameId}" to "${gameId}". Change ignored.`);
    return;
  }
  recordGameId(gameId);
}

function resolveGameId(override) {
  if (typeof override === 'string' && override.trim()) return recordGameId(override) || DEFAULT_GAME_ID;
  if (_gameId) return _gameId;
  const fromWindow = readWindowGameId();
  if (fromWindow) return recordGameId(fromWindow) || DEFAULT_GAME_ID;
  return DEFAULT_GAME_ID;
}

async function ensureChirpRoot(gameId) {
  const resolved = resolveGameId(gameId);
  if (ensuredChirpRoots.has(resolved)) return doc(db, CHAT_COLLECTION, resolved);
  const rootRef = doc(db, CHAT_COLLECTION, resolved);
  try {
    const rootDoc = await getDoc(rootRef);
    if (!rootDoc.exists()) {
      await setDoc(rootRef, { chirpEnabledAt: serverTimestamp(), gameId: resolved }, { merge: true });
    }
  } catch (err) {
    console.warn('[ChatServiceV2] Failed to ensure CHIRP root document:', err);
  }
  ensuredChirpRoots.add(resolved);
  return rootRef;
}

function chirpTasksCollection(gameId) {
  const resolved = resolveGameId(gameId);
  return collection(doc(db, CHAT_COLLECTION, resolved), CHIRP_TASKS_COLLECTION);
}

function chirpResponsesCollection(gameId) {
  const resolved = resolveGameId(gameId);
  return collection(doc(db, CHAT_COLLECTION, resolved), CHIRP_COLLECTION);
}

function toFirestoreTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return Timestamp.fromMillis(value.getTime());
  if (typeof value === 'number' && Number.isFinite(value)) return Timestamp.fromMillis(value);
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Timestamp.fromMillis(parsed);
  }
  if (value instanceof Timestamp) return value;
  return null;
}

function toMillis(ts) {
  if (!ts) return Date.now();
  if (typeof ts === 'number') return ts;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
  return Date.now();
}

function isTaskExpired(taskData) {
  if (!taskData) return true;
  if (taskData.status && String(taskData.status).toLowerCase() !== 'active') return true;
  const expiryTs = taskData.expiresAt || taskData.expiresAtMs || taskData.deadline;
  if (!expiryTs) return false;
  const expiresMs = toMillis(expiryTs);
  return Date.now() > expiresMs;
}

async function assertActiveTask(taskId, gameId) {
  const trimmed = trimString(taskId);
  if (!trimmed) throw new Error('A taskId is required to send a CHIRP response.');
  const ref = doc(chirpTasksCollection(gameId), trimmed);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Task "${trimmed}" is no longer available.`);
  const data = snap.data() || {};
  if (isTaskExpired(data)) throw new Error(`Task "${trimmed}" has expired or been closed.`);
  return { taskRef: ref, data, taskId: trimmed };
}

// ──────────────────────────────────────────────────────────────
// Normalizers
// ──────────────────────────────────────────────────────────────
function normalizeDoc(docSnap) {
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data || {};
  const sender = trimString(
    data.senderDisplay ?? data.fromTeam ?? data.from ?? data.sender ?? data.author,
    'UNKNOWN'
  );
  const recipient = trimString(data.toTeam ?? data.to ?? data.recipient ?? data.channel ?? 'ALL', 'ALL');
  const text = trimString(data.text ?? data.message, '');
  const kind = coerceKind(data.kind, recipient);
  const timestampSource = data.timestamp ?? data.createdAt ?? data.timestampMs ?? null;
  const senderDisplay = trimString(data.senderDisplay ?? data.sender ?? data.fromTeam ?? data.teamName, sender);
  const teamName = trimString(data.teamName ?? data.fromTeam ?? data.sender, sender);

  return {
    ...data,
    id: docSnap.id,
    text,
    message: text,
    sender,
    fromTeam: sender,
    senderDisplay,
    teamName,
    recipient,
    toTeam: recipient,
    kind,
    timestampMs: toMillis(timestampSource)
  };
}

function normalizeTaskDoc(docSnap) {
  const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data || {};
  const title = trimString(data.title, 'Untitled Task');
  const description = trimString(data.description, '');
  const status = trimString(data.status, 'active').toLowerCase();
  const createdAt = data.createdAt ?? null;
  const updatedAt = data.updatedAt ?? null;
  const expiresAt = data.expiresAt ?? data.deadline ?? null;
  const expiresAtMs = data.expiresAtMs ?? toMillis(expiresAt);
  const assignedTeams = Array.isArray(data.assignedTeams) ? data.assignedTeams : [];

  return { ...data, id: docSnap.id, title, description, status, createdAt, updatedAt, expiresAt, expiresAtMs, assignedTeams };
}

function normalizeChirpResponseDoc(docSnap) {
  return { ...normalizeDoc(docSnap), kind: 'chirp-response' };
}

// ──────────────────────────────────────────────────────────────
// Core Actions
// ──────────────────────────────────────────────────────────────
export async function send({ fromTeam, toTeam = 'ALL', text, kind = 'chat', meta = {}, extra = {} } = {}) {
  const sender = trimString(fromTeam, 'UNKNOWN');
  const recipient = trimString(toTeam ?? 'ALL', 'ALL') || 'ALL';
  const body = trimString(text, '');
  if (!body) return null;
  const normalizedKind = coerceKind(kind, recipient);


  const payload = {
    text: body,
    message: body,
    fromTeam: sender,
    sender,
    toTeam: recipient,
    recipient,
    kind: normalizedKind,
    senderDisplay: sender,
    teamName: sender,
    isBroadcast: recipient.toUpperCase() === 'ALL' || normalizedKind === 'broadcast',
    meta,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    ...extra
  };
  await addDoc(collection(db, CHAT_COLLECTION), payload);
  return payload;
}

export async function issueChirpTask({
  title,
  description,
  createdBy = 'Control',
  expiresAt,
  expiresInMinutes,
  assignedTeams = [],
  meta = {},
  gameId
} = {}) {
  const resolvedGameId = resolveGameId(gameId);
  await ensureChirpRoot(resolvedGameId);
  const now = serverTimestamp();
  let expiresTimestamp = toFirestoreTimestamp(expiresAt);
  if (!expiresTimestamp && typeof expiresInMinutes === 'number' && Number.isFinite(expiresInMinutes)) {
    expiresTimestamp = Timestamp.fromMillis(Date.now() + Math.max(0, expiresInMinutes) * 60000);
  }
  const payload = {
    title: trimString(title, 'Untitled Task'),
    description: trimString(description, ''),
    status: 'active',
    createdBy: trimString(createdBy, 'Control'),
    senderDisplay: trimString(createdBy, 'Control'),
    teamName: trimString(createdBy, 'Control'),
    assignedTeams,
    meta,
    createdAt: now,
    updatedAt: now
  };
  if (expiresTimestamp) {
    payload.expiresAt = expiresTimestamp;
    payload.expiresAtMs = expiresTimestamp.toMillis();
  }
  const docRef = await addDoc(chirpTasksCollection(resolvedGameId), payload);
  return { id: docRef.id, ...payload };
}

export async function closeChirpTask(taskId, { closedBy = 'Control', resolution = '', gameId, meta = {} } = {}) {
  const trimmedId = trimString(taskId);
  if (!trimmedId) throw new Error('A valid taskId is required to close a CHIRP task.');
  const resolvedGameId = resolveGameId(gameId);
  await ensureChirpRoot(resolvedGameId);
  const payload = {
    status: 'closed',
    closedBy: trimString(closedBy, 'Control'),
    resolution: trimString(resolution, ''),
    updatedAt: serverTimestamp(),
    meta
  };
  await updateDoc(doc(chirpTasksCollection(resolvedGameId), trimmedId), payload);
  return { taskId: trimmedId, ...payload };
}

export async function sendChirpResponse({ taskId, responseText, senderDisplay, teamName, meta = {}, gameId } = {}) {
  const body = trimString(responseText);
  if (!body) throw new Error('Response text cannot be empty.');
  const team = trimString(teamName, 'UNKNOWN');
  const display = trimString(senderDisplay, team);
  const resolvedGameId = resolveGameId(gameId);
  await ensureChirpRoot(resolvedGameId);
  const { taskId: validatedTaskId, data: taskData } = await assertActiveTask(taskId, resolvedGameId);
  const taskTitle = trimString(taskData?.title, validatedTaskId);
  const payload = {
    taskId: validatedTaskId,
    taskTitle,
    responseText: body,
    text: body,
    message: body,
    sender: team,
    senderDisplay: display,
    fromTeam: team,
    teamName: team,
    recipient: 'CONTROL',
    toTeam: 'CONTROL',
    kind: 'chirp-response',
    status: 'sent',
    meta: { ...meta, taskId: validatedTaskId, taskTitle },
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp()
  };
  const docRef = await addDoc(chirpResponsesCollection(resolvedGameId), payload);
  return { id: docRef.id, ...payload };
}

// ──────────────────────────────────────────────────────────────
// Listeners
// ──────────────────────────────────────────────────────────────
function registerListener(key, listener) {
    if (subscriptionRegistry.has(key)) {
        const existing = subscriptionRegistry.get(key);
        if (typeof existing === 'function') {
            existing();
        }
    }
    subscriptionRegistry.set(key, listener);
}

function createListener({ teamKey, filter, cb }) {
  const q = query(collection(db, CHAT_COLLECTION), orderBy('timestamp', 'asc'));
  const delivered = new Set();
  const pending = [];
  let timer = null;
  const flush = () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    timer = null;
    cb(batch);
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
  };
  const listener = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== 'added') return;
      const msg = normalizeDoc(ch.doc);
      if (typeof filter === 'function' && !filter(msg)) return;
      if (teamKey && msg.sender.toLowerCase() !== teamKey && msg.recipient.toLowerCase() !== teamKey && msg.recipient.toLowerCase() !== 'all') return;
      if (delivered.has(ch.doc.id)) return;
      delivered.add(ch.doc.id);
      pending.push(msg);
    });
    if (pending.length) schedule();
  });

  const listenerKey = teamKey ? `team:${teamKey}` : 'all';
  registerListener(listenerKey, listener);
  return listener;
}

export const listenForTeam = (teamName, cb) =>
  typeof cb === 'function' ? createListener({ teamKey: trimString(teamName).toLowerCase(), cb }) : () => {};

export const listenAll = (cb) =>
  typeof cb === 'function' ? createListener({ teamKey: '', cb }) : () => {};

export const listenBroadcasts = (cb) => {
  if (typeof cb !== 'function') return () => {};
  const q = query(collection(db, CHAT_COLLECTION), orderBy('timestamp', 'asc'));
  const delivered = new Set();
  const pending = [];
  let timer = null;
  const flush = () => {
    if (!pending.length) return;
    cb(pending.splice(0));
    timer = null;
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
  };
  const listener = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== 'added') return;
      const msg = normalizeDoc(ch.doc);
      if (msg.recipient.toUpperCase() === 'ALL' || msg.kind === 'broadcast') {
        if (!delivered.has(ch.doc.id)) {
          delivered.add(ch.doc.id);
          pending.push(msg);
        }
      }
    });
    if (pending.length) schedule();
  });

  registerListener('broadcast', listener);
  return listener;
};

// aliases
export const listenForMyMessages = listenForTeam;
export const listenForBroadcasts = listenBroadcasts;
export const sendMessage = send;

// CHIRP listeners
export function listenChirpResponses({ cb, gameId, taskId, teamName } = {}) {
  if (typeof cb !== 'function') return () => {};
  const resolved = resolveGameId(gameId);
  const q = query(chirpResponsesCollection(resolved), orderBy('timestamp', 'asc'));
  const pending = [];
  let timer = null;
  const flush = () => {
    if (!pending.length) return;
    cb(pending.splice(0));
    timer = null;
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, BATCH_DELAY_MS);
  };
  const listener = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((ch) => {
      if (ch.type !== 'added') return;
      const rec = normalizeChirpResponseDoc(ch.doc);
      if (taskId && trimString(rec.taskId) !== trimString(taskId)) return;
      if (teamName && trimString(rec.teamName).toLowerCase() !== trimString(teamName).toLowerCase()) return;
      pending.push(rec);
    });
    if (pending.length) schedule();
  });

  const key = `chirp:responses:${resolved}` + (taskId ? `:${taskId}` : '') + (teamName ? `:${teamName}` : '');
  registerListener(key, listener);
  return listener;
}

export function listenChirpTasks({ cb, gameId, includeClosed = false } = {}) {
  if (typeof cb !== 'function') return () => {};
  const resolved = resolveGameId(gameId);
  const q = query(chirpTasksCollection(resolved), orderBy('createdAt', 'asc'));
  const listener = onSnapshot(q, (snap) => {
    const tasks = [];
    snap.forEach((docSnap) => {
      const t = normalizeTaskDoc(docSnap);
      if (!includeClosed && isTaskExpired(t)) return;
      tasks.push(t);
    });
    cb(tasks);
  });

  const key = `chirp:tasks:${resolved}`;
  registerListener(key, listener);
  return listener;
}

// ──────────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────────
const ChatServiceV2 = {
  send,
  sendMessage,
  listenForTeam,
  listenForMyMessages,
  listenAll,
  listenBroadcasts,
  listenForBroadcasts,
  normalizeDoc,
  setChirpGameId,
  issueChirpTask,
  closeChirpTask,
  sendChirpResponse,
  listenChirpResponses,
  listenChirpTasks
};

export default ChatServiceV2;

console.info(
    '[ChatServiceV2] Diagnostics',
    {
        activeListeners: () => Array.from(subscriptionRegistry.keys()),
        cachedGameId: () => _gameId,
    }
);
