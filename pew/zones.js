// ============================================================================
// Pew Pursuit zone helpers + lightweight proximity detection.
// Uses only the zones_pew collection and Pew Pursuit game state updater.
// ============================================================================

import { db } from '/core/config.js';
import {
  collection,
  getDocs,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  PEW_COLLECTIONS,
  getZoneRadiusMeters,
} from './config.js';
import { updateVisitedZones } from './state.js';

const zonesCollectionRef = collection(db, PEW_COLLECTIONS.zones);

export function watchZones(callback) {
  return onSnapshot(
    zonesCollectionRef,
    (snapshot) => {
      const zones = snapshot.docs.map((zoneDoc) => ({
        id: zoneDoc.id,
        ...zoneDoc.data(),
      }));
      callback?.(zones);
    },
    (error) => console.error('❌ Pew Pursuit zones listener failed.', error),
  );
}

export async function fetchZonesOnce() {
  const snapshot = await getDocs(zonesCollectionRef);
  return snapshot.docs.map((zoneDoc) => ({
    id: zoneDoc.id,
    ...zoneDoc.data(),
  }));
}

export function isWithinZoneRadius(zone, position, radiusMeters) {
  if (!zone || !position) return false;
  const zoneLat = zone.lat ?? zone.latitude;
  const zoneLng = zone.lng ?? zone.longitude;
  if (typeof zoneLat !== 'number' || typeof zoneLng !== 'number') return false;
  const targetRadius = getZoneRadiusMeters(radiusMeters || zone.radiusMeters);

  const distance = computeDistanceMeters(
    zoneLat,
    zoneLng,
    position.lat,
    position.lng,
  );

  return distance <= targetRadius;
}

export function startZoneProximityWatcher(zones, options = {}) {
  if (!navigator?.geolocation) {
    console.warn('⚠️ Pew Pursuit proximity requires navigator.geolocation support.');
    return () => {};
  }
  let lastWithin = new Set();
  const radiusMeters = options.radiusMeters;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      zones.forEach((zone) => {
        const inside = isWithinZoneRadius(zone, coords, radiusMeters);
        const wasInside = lastWithin.has(zone.id);
        if (inside && !wasInside) {
          lastWithin.add(zone.id);
          options.onEnterZone?.(zone, coords);
        } else if (!inside && wasInside) {
          lastWithin.delete(zone.id);
          options.onExitZone?.(zone, coords);
        }
      });
      options.onPosition?.(coords);
    },
    (error) => {
      console.error('❌ Pew Pursuit GPS watcher failed.', error);
      options.onError?.(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    },
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
    lastWithin = new Set();
  };
}

export async function recordZoneVisit(teamName, zoneId, metadata = {}) {
  await updateVisitedZones(teamName, zoneId);
  console.log('🟢 Pew Pursuit visit recorded (placeholder).', {
    teamName,
    zoneId,
    metadata,
  });
  // TODO: Persist visit timestamps to a dedicated subcollection if needed.
}

function computeDistanceMeters(lat1, lng1, lat2, lng2) {
  if (
    typeof window !== 'undefined' &&
    window.google?.maps?.geometry?.spherical
  ) {
    const p1 = new window.google.maps.LatLng(lat1, lng1);
    const p2 = new window.google.maps.LatLng(lat2, lng2);
    return window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
  }
  // Fallback Haversine calculation.
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

// TODO: Add zone cooldown + clue text helpers once gameplay rules are locked.
