// ============================================================================
// FILE: modules/flatTireUI.js
// PURPOSE: Player-side Flat Tire (Tow Time) overlay + interactions
// ============================================================================

import {
  subscribeFlatTireAssignments,
  updateFlatTireAssignment,
  releaseFlatTireTeam,
  CAPTURE_RADIUS_METERS,
  isWithinCaptureRadius,
  getDistanceMetersToDepot
} from './flatTireManager.js';
import {
  showFlatTireOverlay,
  hideFlatTireOverlay,
  clearFlatTireOverlay,
  showTireCelebration
} from './playerUI/overlays.js';
import { getRandomTaunt } from './messages/taunts.js';
import { sendPrivateMessage } from './chatManager/messageService.js';
import { broadcastEvent } from './zonesFirestore.js';

const FLAT_TIRE_CHIRP_COOLDOWN_MS = 60_000;
const flatTireChirpCooldowns = new Map();

function parseGpsString(gps = '') {
  if (typeof gps !== 'string') return null;
  const [latStr, lngStr] = gps.split(',');
  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function buildChirpKey(victimTeam, aggressorTeam, kind) {
  const sender = (victimTeam || '').trim().toLowerCase();
  const recipient = (aggressorTeam || '').trim().toLowerCase();
  const category = (kind || 'flatTire').trim().toLowerCase();
  return `${sender}->${recipient}:${category}`;
}

async function sendFlatTireChirp({ victimTeam, aggressorTeam, message, kind = 'flatTire' }) {
  const sender = typeof victimTeam === 'string' ? victimTeam.trim() : '';
  let recipient = typeof aggressorTeam === 'string' ? aggressorTeam.trim() : '';
  if (!sender) return { ok: false, reason: 'missing_sender' };
  if (!recipient || recipient === sender) {
    recipient = 'Game Control';
  }

  const key = buildChirpKey(sender, recipient, kind);
  const now = Date.now();
  const last = flatTireChirpCooldowns.get(key) || 0;
  if (now - last < FLAT_TIRE_CHIRP_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'rate_limited',
      retryInMs: FLAT_TIRE_CHIRP_COOLDOWN_MS - (now - last)
    };
  }

  const trimmed = typeof message === 'string' ? message.trim() : '';
  const text = trimmed || getRandomTaunt(kind);

  try {
    const result = await sendPrivateMessage(sender, recipient, text);
    if (!result?.ok) {
      return { ok: false, reason: result?.reason || 'send_failed' };
    }
    flatTireChirpCooldowns.set(key, now);
    return { ok: true };
  } catch (err) {
    console.error('❌ Failed to send Flat Tire chirp:', err);
    return { ok: false, reason: err?.message || 'send_failed' };
  }
}

export function initializeFlatTireUI(teamName) {
  if (!teamName) return () => {};

  let unsubscribe = null;

  const handleSnapshot = (entries = []) => {
    const assignment = entries.find(entry => entry?.teamName === teamName);
    if (!assignment) {
      hideFlatTireOverlay();
      return;
    }

    const {
      zoneName,
      gps,
      status,
      distanceRemainingKm,
      autoReleaseAtMs,
      assignedAtMs
    } = assignment;
    const coordsFromAssignment = (Number.isFinite(assignment.lat) && Number.isFinite(assignment.lng))
      ? { lat: Number(assignment.lat), lng: Number(assignment.lng) }
      : null;
    const parsedGps = parseGpsString(gps);
    const lat = coordsFromAssignment?.lat ?? parsedGps?.lat ?? null;
    const lng = coordsFromAssignment?.lng ?? parsedGps?.lng ?? null;
    const diameterMeters = Number.isFinite(assignment.diameterMeters) && assignment.diameterMeters > 0
      ? assignment.diameterMeters
      : (Number.isFinite(assignment.diameter) && assignment.diameter > 0
          ? assignment.diameter * 1000
          : 200);
    const assignedBy = typeof assignment.assignedBy === 'string' && assignment.assignedBy.trim()
      ? assignment.assignedBy.trim()
      : (typeof assignment.fromTeam === 'string' && assignment.fromTeam.trim()
          ? assignment.fromTeam.trim()
          : 'Game Control');
    const depotId = assignment.depotId || assignment.zoneKey || '';

    const onCheckIn = async () => {
      if (!gps) {
        alert('Tow zone GPS is missing. Contact Control.');
        return;
      }

      if (!('geolocation' in navigator)) {
        alert('Geolocation is not supported in this browser.');
        return;
      }

      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
          });
        });

        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const distanceMeters = getDistanceMetersToDepot(gps, coords);
        if (!Number.isFinite(distanceMeters)) {
          throw new Error('Unable to calculate distance to tow zone.');
        }

        const distanceKm = distanceMeters / 1000;
        if (!isWithinCaptureRadius(gps, coords)) {
          alert(`You're ${Math.round(distanceMeters)}m away. Move within ${CAPTURE_RADIUS_METERS}m before checking in.`);
          await updateFlatTireAssignment(teamName, {
            status: 'enroute',
            distanceRemainingKm: distanceKm
          });
          return;
        }

        await updateFlatTireAssignment(teamName, {
          status: 'arrived',
          distanceRemainingKm: 0,
          arrivalLat: coords.lat,
          arrivalLng: coords.lng,
          arrivedAt: Date.now()
        });

        clearFlatTireOverlay();
        showTireCelebration();

        try {
          await broadcastEvent('Game Master', `🛞 ${teamName} repaired their Flat Tire and is back in the race!`, true);
        } catch (broadcastErr) {
          console.warn('⚠️ Flat Tire celebration broadcast failed:', broadcastErr);
        }

        await releaseTeam();
        alert('✅ Tow crew confirmed! You are inside the capture radius.');
        return;
      } catch (err) {
        console.error('❌ Failed to submit Flat Tire check-in:', err);
        const message = err?.message || 'Unable to capture your location. Please enable GPS and try again.';
        alert(message);
      }
    };

    const releaseTeam = async () => {
      try {
        await releaseFlatTireTeam(teamName);
      } catch (err) {
        console.error('❌ Failed to release Flat Tire assignment:', err);
        alert('Unable to release your Flat Tire assignment right now.');
      }
    };

    const handleChirp = (value) => sendFlatTireChirp({
      victimTeam: teamName,
      aggressorTeam: assignedBy,
      message: value,
      kind: 'flatTire'
    });

    showFlatTireOverlay({
      zoneName,
      depotId,
      gps,
      lat,
      lng,
      diameterMeters,
      status,
      distanceRemainingKm,
      autoReleaseAtMs,
      assignedAtMs,
      assignedBy,
      onCheckIn,
      onChirp: handleChirp,
      onManualRelease: releaseTeam,
      onAutoRelease: releaseTeam
    });
  };

  unsubscribe = subscribeFlatTireAssignments(handleSnapshot);

  return (reason = 'manual') => {
    unsubscribe?.();
    unsubscribe = null;
    hideFlatTireOverlay();
    console.info(`🧹 [flatTireUI] cleaned up (${reason})`);
  };
}
