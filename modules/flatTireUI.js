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
  hideFlatTireOverlay
} from './playerUI/overlays.js';

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
        alert('✅ Tow crew confirmed! You are inside the capture radius.');
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
      gps,
      status,
      distanceRemainingKm,
      autoReleaseAtMs,
      assignedAtMs,
      onCheckIn,
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
