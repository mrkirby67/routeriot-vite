// ============================================================================
// FILE: /modules/scoreboardManager.js (EVENT-DRIVEN)
// PURPOSE: Manage all score and zone updates for the scoreboard + publish state
// ============================================================================

import { publish, subscribe } from '/core/eventBus.js';
import { db } from '/core/config.js';
import { allTeams } from '../data.js';
import { scoresCollectionRef } from '../services/firestoreRefs.js';
import {
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  collection,
  getDocs,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import ChatServiceV2 from '../services/ChatServiceV2.js';

// ---------------------------------------------------------------------------
// 📊 Internal state + caches
// ---------------------------------------------------------------------------
const teamStatusCollection = collection(db, 'teamStatus');
const activeTeamsRef = doc(db, 'game', 'activeTeams');
const zoneCaptureLogTag = '[scoreboardManager] zone:capture';
const topThreeUiEvent = 'ui:topThree';

let scoreboardState = [];
let scoresCache = new Map(); // team -> { score, zonesControlled, updatedAt }
let teamStatusCache = new Map(); // team -> { lastKnownLocation, timestamp }
let activeTeamsList = [];
let unsubscribeScores = null;
let unsubscribeTeamStatus = null;
let unsubscribeActiveTeams = null;
let listenersInitialized = false;

function normalizeTeamName(name = '') {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return '';
  const team = allTeams.find((t) => t.name === trimmed);
  return team ? team.name : trimmed;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function dedupe(list = []) {
  const seen = new Set();
  const ordered = [];
  list.forEach((item) => {
    const normalized = normalizeTeamName(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  });
  return ordered;
}

function ensureScoreboardListeners() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  unsubscribeScores = onSnapshot(
    scoresCollectionRef,
    (snapshot) => {
      const next = new Map();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        next.set(docSnap.id, {
          score: toNumber(data.score, 0),
          zonesControlled: data.zonesControlled || '—',
          updatedAt: data.updatedAt || null,
        });
      });
      scoresCache = next;
      rebuildScoreboardState();
    },
    (err) => console.error('❌ scores snapshot failed:', err)
  );

  unsubscribeTeamStatus = onSnapshot(
    teamStatusCollection,
    (snapshot) => {
      const next = new Map();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        next.set(docSnap.id, {
          lastKnownLocation: data.lastKnownLocation || '',
          timestamp: data.timestamp || null,
        });
      });
      teamStatusCache = next;
      rebuildScoreboardState();
    },
    (err) => console.error('❌ teamStatus snapshot failed:', err)
  );

  unsubscribeActiveTeams = onSnapshot(
    activeTeamsRef,
    (docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : null;
      const list = Array.isArray(data?.list) ? data.list : [];
      activeTeamsList = dedupe(list);
      rebuildScoreboardState();
    },
    (err) => console.error('❌ activeTeams snapshot failed:', err)
  );
}

function rebuildScoreboardState() {
  const hasScores = scoresCache.size > 0;
  const hasStatus = teamStatusCache.size > 0;

  if (!activeTeamsList.length && !hasScores && !hasStatus) {
    scoreboardState = [];
    refreshScoreboard();
    return;
  }

  const preferredOrder = dedupe(activeTeamsList);
  const cacheNames = dedupe([
    ...scoresCache.keys(),
    ...teamStatusCache.keys(),
  ]);

  let orderedNames;
  if (preferredOrder.length) {
    orderedNames = [...preferredOrder];
    cacheNames.forEach((name) => {
      if (!orderedNames.includes(name)) orderedNames.push(name);
    });
  } else if (hasScores) {
    orderedNames = [...scoresCache.entries()]
      .sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0))
      .map(([name]) => name);
    cacheNames.forEach((name) => {
      if (!orderedNames.includes(name)) orderedNames.push(name);
    });
  } else {
    orderedNames = cacheNames;
  }

  scoreboardState = orderedNames.map(buildTeamEntry);
  refreshScoreboard();
}

function buildTeamEntry(teamName) {
  const key = normalizeTeamName(teamName) || teamName || 'Unknown Team';
  const scoreInfo = scoresCache.get(key) || {};
  const statusInfo = teamStatusCache.get(key) || {};

  return {
    teamName: key,
    score: scoreInfo.score ?? 0,
    zonesControlled: scoreInfo.zonesControlled || '—',
    lastKnownLocation: statusInfo.lastKnownLocation || '',
    timestamp: statusInfo.timestamp || scoreInfo.updatedAt || null,
  };
}

export function getScoreboardState() {
  return scoreboardState.map((entry) => ({ ...entry }));
}

export function refreshScoreboard() {
  publish('scoreboard:update', getScoreboardState());
}

ensureScoreboardListeners();
refreshScoreboard();
subscribe('zone:capture', (payload) => {
  handleZoneCapture(payload);
});
async function handleZoneCapture({ teamName, zoneId, points } = {}) {
  const cleanTeam = normalizeTeamName(teamName);
  if (!cleanTeam || !zoneId) return;

  try {
    if (Number.isFinite(points)) {
      await addPointsToTeam(cleanTeam, points);
    }
    await updateControlledZones(cleanTeam, zoneId);
  } catch (err) {
    console.error(`${zoneCaptureLogTag} failed:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧮 ADD POINTS TO TEAM (Transaction Safe + Standardized)
 * ------------------------------------------------------------------------ */
export async function addPointsToTeam(teamName, points) {
  if (!teamName || typeof points !== 'number') return;

  const cleanName = normalizeTeamName(teamName);
  if (!cleanName) return;
  const scoreRef = doc(db, 'scores', cleanName);

  try {
    await runTransaction(db, async (tx) => {
      const docSnap = await tx.get(scoreRef);
      const prevScore = docSnap.exists() ? (docSnap.data().score || 0) : 0;
      const newScore = prevScore + points;
      tx.set(
        scoreRef,
        { score: newScore, updatedAt: serverTimestamp() },
        { merge: true }
      );
    });
    console.log(`✅ Score updated: ${cleanName} → ${points >= 0 ? '+' : ''}${points}`);
  } catch (err) {
    console.error(`❌ Failed to update score for ${cleanName}:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🔢 DIRECT SCORE SETTER (manual overrides)
 * ------------------------------------------------------------------------ */
export async function setTeamScore(teamName, score) {
  const cleanName = normalizeTeamName(teamName);
  if (!cleanName || !Number.isFinite(Number(score))) return;

  try {
    await setDoc(
      doc(db, 'scores', cleanName),
      {
        score: toNumber(score, 0),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`❌ Failed to set score for ${cleanName}:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧭 UPDATE CONTROLLED ZONES (Standardized)
 * ------------------------------------------------------------------------ */
export async function updateControlledZones(teamName, zoneName) {
  if (!teamName || !zoneName) return;

  const cleanName = normalizeTeamName(teamName);
  if (!cleanName) return;
  const scoreRef = doc(db, 'scores', cleanName);

  try {
    await setDoc(
      scoreRef,
      {
        zonesControlled: zoneName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`📍 ${cleanName} now controls zone: ${zoneName}`);
  } catch (err) {
    console.error(`❌ Failed to update controlled zones for ${cleanName}:`, err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧹 RESET ALL SCORES & ZONES (Batch Operation)
 * ------------------------------------------------------------------------ */
export async function resetScores() {
  console.warn(
    '⚠️ resetScores() is deprecated. Use resetAllScores() for unified clearing.'
  );
  await resetAllScores();
}

export async function resetAllScores() {
  try {
    const standings = getScoreboardState();
    if (!standings.length) {
      console.log('ℹ️ No scores to reset.');
      return;
    }

    for (const entry of standings) {
      const teamName = entry.teamName;
      if (!teamName) continue;
      await setTeamScore(teamName, 0);
      await updateControlledZones(teamName, '—');
    }

    refreshScoreboard();
    console.log('✅ All scoreboard entries reset via resetAllScores().');
  } catch (err) {
    console.error('❌ resetAllScores failed:', err);
  }
}

/* ---------------------------------------------------------------------------
 * 🧾 PLAYER SCOREBOARD INITIALIZER (deprecated helper)
 * ------------------------------------------------------------------------ */
export function initializePlayerScoreboard() {
  ensureScoreboardListeners();
  return () => {};
}

export async function getTopThree() {
  let standings = getScoreboardState();
  if (!standings.length) {
    const scoresSnap = await getDocs(scoresCollectionRef);
    standings = [];
    scoresSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      standings.push({ teamName: docSnap.id, score: toNumber(data.score, 0) });
    });
  }

  if (!standings.length) return [];

  return standings
    .map((entry) => ({
      team: entry.teamName,
      score: toNumber(entry.score, 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export async function broadcastTopThree(standings = null) {
  try {
    const data = standings ?? (await getTopThree());
    if (!data.length) {
      console.warn('⚠️ No scores found to broadcast.');
      return;
    }

    const spacer = '\n'.repeat(10);
    let message = `${spacer}🏁🏁🏁  FINAL RESULTS  🏁🏁🏁\n\n`;
    data.forEach((t, i) => {
      const medals = ['🥇', '🥈', '🥉'][i] || '🏅';
      message += `${medals}  ${t.team} — ${t.score} pts\n`;
    });
    message += `\n🎉 Congratulations to all teams! 🎉`;

    await ChatServiceV2.send({
      fromTeam: 'Game Master',
      toTeam: 'ALL',
      text: message,
      kind: 'system',
      meta: { source: 'scoreboard:broadcastTopThree' },
    });

    console.log('✅ Top 3 broadcast sent successfully.');
  } catch (err) {
    console.error('❌ Error broadcasting top 3:', err);
  }
}

export async function announceTopThree(options = {}) {
  const { ui = false, chat = false } = options || {};
  const standings = await getTopThree();
  if (!standings.length) {
    console.warn('⚠️ announceTopThree skipped — no standings available.');
    return;
  }

  if (chat) {
    await broadcastTopThree(standings);
  }

  if (ui) {
    publish(topThreeUiEvent, standings);
  }
}
