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
  getDistanceMetersToDepot,
  loadFlatTireConfig
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
import { isShieldActive, isUnderWildCard } from './teamSurpriseManager.js';

function parseGpsString(gps = '') {
  if (typeof gps !== 'string') return null;
  const [latStr, lngStr] = gps.split(',');
  const lat = Number.parseFloat(latStr);
  const lng = Number.parseFloat(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function waitForValidFlatTireConfig({ maxAttempts = 20, delayMs = 500 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const config = await loadFlatTireConfig();
      const zones = config?.zones || {};
      const hasGps = Object.values(zones).some(zone => typeof zone?.gps === 'string' && zone.gps.trim());
      if (hasGps) {
        return config;
      }
      if (attempt === 0) {
        console.warn('⚠️ Waiting for Flat Tire GPS configuration to sync...');
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch Flat Tire configuration:', err);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Flat Tire configuration missing GPS data for all depots.');
}

export function initializeFlatTireUI(teamName) {
  if (!teamName) return () => {};

  let unsubscribe = null;
  let cancelled = false;

  const handleSnapshot = (entries = []) => {
    const assignment = entries.find(entry => entry?.teamName === teamName);

    if (isUnderWildCard(teamName) || isShieldActive(teamName)) {
        if (assignment) {
            hideFlatTireOverlay();
        }
        return;
    }

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
          const timeoutId = setTimeout(() => {
            reject(new Error('GPS location request timed out. Please ensure you have granted permission and have a clear view of the sky.'));
          }, 15000); // 15 second timeout

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeoutId);
              resolve(pos);
            },
            (err) => {
              clearTimeout(timeoutId);
              reject(err);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000
            }
          );
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
      onChirp: () => sendPrivateMessage(teamName, assignedBy, getRandomTaunt('flatTire')),
      onManualRelease: releaseTeam,
      onAutoRelease: releaseTeam
    });
  };

  (async () => {
    try {
      await waitForValidFlatTireConfig();
      if (cancelled) return;
      unsubscribe = subscribeFlatTireAssignments(handleSnapshot);
      console.log('✅ Flat Tire UI ready — listening for assignments.');
    } catch (err) {
      console.error('❌ Flat Tire UI aborted — configuration incomplete:', err);
      alert('Flat Tire depots are not configured yet. Please try again once control has GPS values.');
    }
  })();

  return (reason = 'manual') => {
    cancelled = true;
    unsubscribe?.();
    unsubscribe = null;
    hideFlatTireOverlay();
    console.info(`🧹 [flatTireUI] cleaned up (${reason})`);
  };
}
