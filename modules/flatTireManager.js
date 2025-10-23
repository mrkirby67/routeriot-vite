// ============================================================================
// FILE: modules/flatTireManager.js
// PURPOSE: Shared helpers for Flat Tire — Tow Time assignments and config
// ============================================================================

import { db } from './config.js';
import { calculateDistance } from './zonesUtils.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');
const CONFIG_DOCUMENT = doc(db, 'settings', 'flatTireConfig');

export const CAPTURE_RADIUS_METERS = 100;

const DEFAULT_DIAMETER_KM = 0.2; // 200 meters
const DEFAULT_ZONES = {
  north: { name: 'North Repair Depot', gps: '', diameter: DEFAULT_DIAMETER_KM },
  south: { name: 'South Repair Depot', gps: '', diameter: DEFAULT_DIAMETER_KM },
  east: { name: 'East Repair Depot', gps: '', diameter: DEFAULT_DIAMETER_KM },
  west: { name: 'West Repair Depot', gps: '', diameter: DEFAULT_DIAMETER_KM }
};

function encodeTeamId(teamName = '') {
  return teamName.replace(/[^\w\d]+/g, '_').toLowerCase();
}

function parseGpsString(gps = '') {
  if (typeof gps !== 'string') return null;
  const [latStr, lngStr] = gps.split(',');
  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function getDistanceMetersToDepot(gps = '', position = {}) {
  const center = parseGpsString(gps);
  if (!center || !Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
    return Number.POSITIVE_INFINITY;
  }
  const distanceKm = calculateDistance(center.lat, center.lng, position.lat, position.lng);
  return distanceKm * 1000;
}

export function isWithinCaptureRadius(gps = '', position = {}) {
  const distanceMeters = getDistanceMetersToDepot(gps, position);
  return Number.isFinite(distanceMeters) && distanceMeters <= CAPTURE_RADIUS_METERS;
}

function toTimestamp(value, fallback = Date.now()) {
  if (value instanceof Timestamp) return value;
  const numeric = typeof value === 'number' ? value : Date.parse(value);
  const millis = Number.isFinite(numeric) ? numeric : fallback;
  return Timestamp.fromMillis(millis);
}

function serializeAssignmentInput(teamName, options = {}) {
  const assignedMs = options.assignedAt ?? Date.now();
  const autoReleaseMs = options.autoReleaseAt ?? (assignedMs + (options.autoReleaseMinutes ?? 20) * 60_000);
  return {
    teamName,
    zoneKey: options.zoneKey || null,
    zoneName: options.zoneName || '',
    gps: options.gps || '',
    captureRadiusMeters: options.captureRadiusMeters || CAPTURE_RADIUS_METERS,
    status: options.status || 'assigned',
    notes: options.notes || '',
    distanceRemainingKm: typeof options.distanceRemainingKm === 'number'
      ? Math.max(0, options.distanceRemainingKm)
      : null,
    assignedAt: toTimestamp(assignedMs, Date.now()),
    autoReleaseAt: toTimestamp(autoReleaseMs, assignedMs + 20 * 60_000),
    updatedAt: serverTimestamp()
  };
}

function normalizeConfig(raw = {}) {
  const zones = { ...DEFAULT_ZONES, ...(raw.zones || {}) };
  Object.keys(zones).forEach((key) => {
    const zone = zones[key] || {};
    zones[key] = {
      name: typeof zone.name === 'string' && zone.name.trim() ? zone.name.trim() : DEFAULT_ZONES[key]?.name || `Zone ${key.toUpperCase()}`,
      gps: typeof zone.gps === 'string' ? zone.gps.trim() : '',
      diameter: typeof zone.diameter === 'number' && zone.diameter > 0 ? zone.diameter : DEFAULT_DIAMETER_KM
    };
  });

  const autoIntervalMinutes =
    typeof raw.autoIntervalMinutes === 'number' && raw.autoIntervalMinutes > 0
      ? Math.round(raw.autoIntervalMinutes)
      : 15;

  return { zones, autoIntervalMinutes };
}

export function subscribeFlatTireAssignments(callback) {
  return onSnapshot(ASSIGNMENTS_COLLECTION, (snapshot) => {
    const list = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        assignedAtMs: data.assignedAt?.toMillis?.() ?? null,
        autoReleaseAtMs: data.autoReleaseAt?.toMillis?.() ?? null,
        updatedAtMs: data.updatedAt?.toMillis?.() ?? null
      };
    });
    callback?.(list);
  });
}

export function subscribeFlatTireConfig(callback) {
  return onSnapshot(CONFIG_DOCUMENT, (docSnap) => {
    const data = docSnap.exists() ? docSnap.data() : {};
    callback?.(normalizeConfig(data));
  });
}

export async function loadFlatTireConfig() {
  const snap = await getDoc(CONFIG_DOCUMENT);
  return normalizeConfig(snap.exists() ? snap.data() : {});
}

export async function saveFlatTireConfig(partial = {}) {
  const payload = {
    ...partial,
    updatedAt: serverTimestamp()
  };
  await setDoc(CONFIG_DOCUMENT, payload, { merge: true });
  return loadFlatTireConfig();
}

export async function assignFlatTireTeam(teamName, options = {}) {
  if (!teamName) throw new Error('teamName is required to assign Flat Tire.');
  const docRef = doc(ASSIGNMENTS_COLLECTION, encodeTeamId(teamName));
  const payload = serializeAssignmentInput(teamName, options);
  await setDoc(docRef, payload);
  return payload;
}

export async function updateFlatTireAssignment(teamName, patch = {}) {
  if (!teamName) throw new Error('teamName is required to update Flat Tire assignment.');
  const docRef = doc(ASSIGNMENTS_COLLECTION, encodeTeamId(teamName));
  const payload = { ...patch, updatedAt: serverTimestamp() };

  if (payload.autoReleaseAt) {
    payload.autoReleaseAt = toTimestamp(payload.autoReleaseAt);
  }
  if (payload.assignedAt) {
    payload.assignedAt = toTimestamp(payload.assignedAt);
  }

  await setDoc(docRef, payload, { merge: true });
}

export async function releaseFlatTireTeam(teamName) {
  if (!teamName) return;
  const docRef = doc(ASSIGNMENTS_COLLECTION, encodeTeamId(teamName));
  await deleteDoc(docRef);
}

export const __flatTireDefaults = Object.freeze({
  DEFAULT_ZONES,
  DEFAULT_AUTO_INTERVAL_MINUTES: 15
});
