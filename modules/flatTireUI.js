// ============================================================================
// FILE: modules/flatTireUI.js
// PURPOSE: Player-side Flat Tire (Tow Time) overlay + interactions
// ============================================================================

import {
  subscribeFlatTireAssignments,
  updateFlatTireAssignment,
  releaseFlatTireTeam
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
      const defaultValue = typeof distanceRemainingKm === 'number' ? distanceRemainingKm.toFixed(1) : '';
      const response = window.prompt(
        'Approximate kilometers remaining before you reach the tow zone (e.g. 1.5):',
        defaultValue
      );
      if (response === null) return;
      const numeric = parseFloat(response);
      if (!Number.isFinite(numeric) || numeric < 0) {
        alert('Enter a valid non-negative number.');
        return;
      }

      try {
        await updateFlatTireAssignment(teamName, {
          status: 'enroute',
          distanceRemainingKm: numeric
        });
      } catch (err) {
        console.error('❌ Failed to submit Flat Tire check-in:', err);
        alert('Failed to submit your check-in. Try again.');
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
