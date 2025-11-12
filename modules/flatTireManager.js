// ============================================================================
// FILE: modules/flatTireManager.js
// PURPOSE: Shared helpers for Flat Tire — Tow Time assignments and config
// ============================================================================

import { db } from '/core/config.js';
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
import {
  isUnderWildCard,
  isOnCooldown as isTeamOnCooldown
} from './teamSurpriseManager.js';

const ASSIGNMENTS_COLLECTION = collection(db, 'flatTireAssignments');
const CONFIG_DOCUMENT = doc(db, 'settings', 'flatTireConfig');

export const CAPTURE_RADIUS_METERS = 100;

const DEFAULT_DIAMETER_METERS = 200;
const DEFAULT_ZONES = {
  north: { name: 'North Repair Depot', gps: '', diameterMeters: DEFAULT_DIAMETER_METERS },
  south: { name: 'South Repair Depot', gps: '', diameterMeters: DEFAULT_DIAMETER_METERS },
  east: { name: 'East Repair Depot', gps: '', diameterMeters: DEFAULT_DIAMETER_METERS },
  west: { name: 'West Repair Depot', gps: '', diameterMeters: DEFAULT_DIAMETER_METERS }
};

export function canSendFlatTire(attacker, victim) {
  const attackerName = typeof attacker === 'string' ? attacker.trim() : '';
  const victimName = typeof victim === 'string' ? victim.trim() : '';
  if (!attackerName || !victimName) return false;
  if (isTeamOnCooldown(attackerName)) return false;
  if (isUnderWildCard(attackerName) || isUnderWildCard(victimName)) return false;
  return true;
}

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
  const preferredLat = Number.isFinite(options.lat) ? Number(options.lat) : null;
  const preferredLng = Number.isFinite(options.lng) ? Number(options.lng) : null;
  const parsedGps = parseGpsString(options.gps);
  const lat = Number.isFinite(preferredLat) ? preferredLat : (parsedGps?.lat ?? null);
  const lng = Number.isFinite(preferredLng) ? preferredLng : (parsedGps?.lng ?? null);
  let diameterMeters = Number(options.diameterMeters);
  if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) {
    const legacyKm = Number(options.diameter);
    if (Number.isFinite(legacyKm) && legacyKm > 0) {
      diameterMeters = legacyKm * 1000;
    }
  }
  if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) {
    diameterMeters = DEFAULT_DIAMETER_METERS;
  }
  const assignedBy = typeof options.assignedBy === 'string' && options.assignedBy.trim()
    ? options.assignedBy.trim()
    : (typeof options.fromTeam === 'string' && options.fromTeam.trim()
        ? options.fromTeam.trim()
        : 'Game Control');
  const depotId = options.depotId || options.zoneKey || null;

  return {
    teamName,
    zoneKey: options.zoneKey || null,
    depotId,
    zoneName: options.zoneName || '',
    gps: options.gps || '',
    lat,
    lng,
    diameterMeters,
    captureRadiusMeters: options.captureRadiusMeters || CAPTURE_RADIUS_METERS,
    status: options.status || 'assigned',
    notes: options.notes || '',
    distanceRemainingKm: typeof options.distanceRemainingKm === 'number'
      ? Math.max(0, options.distanceRemainingKm)
      : null,
    assignedBy,
    diameter: diameterMeters / 1000,
    assignedAt: toTimestamp(assignedMs, Date.now()),
    autoReleaseAt: toTimestamp(autoReleaseMs, assignedMs + 20 * 60_000),
    updatedAt: serverTimestamp()
  };
}

function normalizeConfig(raw = {}) {
  const zones = { ...DEFAULT_ZONES, ...(raw.zones || {}) };
  Object.keys(zones).forEach((key) => {
    const zone = zones[key] || {};
    const safeName = typeof zone.name === 'string' && zone.name.trim()
      ? zone.name.trim()
      : DEFAULT_ZONES[key]?.name || `Zone ${key.toUpperCase()}`;
    const safeGps = typeof zone.gps === 'string' ? zone.gps.trim() : '';
    let diameterMeters = Number(zone.diameterMeters);
    if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) {
      const legacyKm = Number(zone.diameter);
      if (Number.isFinite(legacyKm) && legacyKm > 0) {
        diameterMeters = legacyKm * 1000;
      }
    }
    if (!Number.isFinite(diameterMeters) || diameterMeters <= 0) {
      diameterMeters = DEFAULT_DIAMETER_METERS;
    }
    const normalized = {
      name: safeName,
      gps: safeGps,
      diameterMeters,
      diameter: diameterMeters / 1000
    };
    if (Number.isFinite(zone.lat)) normalized.lat = Number(zone.lat);
    if (Number.isFinite(zone.lng)) normalized.lng = Number(zone.lng);
    zones[key] = normalized;
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
  console.log(`[flatTireManager] Attempting to release flat tire for team: ${teamName}`);
  if (!teamName) {
    console.warn('[flatTireManager] releaseFlatTireTeam called with empty teamName. Aborting.');
    return;
  }
  const docRef = doc(ASSIGNMENTS_COLLECTION, encodeTeamId(teamName));
  console.log(`[flatTireManager] Deleting document for team: ${teamName}, docRef path: ${docRef.path}`);
  await deleteDoc(docRef);
}

export const __flatTireDefaults = Object.freeze({
  DEFAULT_ZONES,
  DEFAULT_AUTO_INTERVAL_MINUTES: 15
});
