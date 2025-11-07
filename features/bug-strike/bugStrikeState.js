// ============================================================================
// Bug Strike State
// Keeps track of player bug-strike tokens (mapped to Bug Splat inventory)
// and exposes helpers for controller logic.
// ============================================================================

import {
  subscribeSurprisesForTeam,
  consumeSurprise,
  incrementSurprise
} from "../../services/team-surprise/teamSurpriseService.js";
import { SurpriseTypes } from "../team-surprise/teamSurpriseTypes.js";
import { db } from "../../modules/config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const SETTINGS_DOC = doc(db, "settings", "bugStrikeSettings");

const bugStrikeState = {
  teamName: null,
  available: 0,
  lastKnownInventory: 0,
  settings: {
    bugs: 20,
    durationMinutes: 3
  }
};

let inventoryUnsub = null;
let settingsUnsub = null;

function ensureSettingsSubscription() {
  if (settingsUnsub || typeof window === "undefined") {
    return;
  }
  settingsUnsub = onSnapshot(
    SETTINGS_DOC,
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() || {};
      bugStrikeState.settings = {
        bugs: Number(data.bugs) || bugStrikeState.settings.bugs,
        durationMinutes: Number(data.durationMinutes) || bugStrikeState.settings.durationMinutes
      };
    },
    (error) => {
      console.warn("⚠️ [bugStrike.state] Failed to watch settings:", error);
    }
  );
}

export function initializeBugStrikeState(teamName) {
  const normalized =
    typeof teamName === "string" && teamName.trim()
      ? teamName.trim()
      : "";

  if (!normalized) {
    console.warn("[bugStrike.state] Missing team name; state not initialized.");
    return () => {};
  }

  bugStrikeState.teamName = normalized;
  ensureSettingsSubscription();

  inventoryUnsub?.();
  inventoryUnsub = subscribeSurprisesForTeam(normalized, (counts = {}) => {
    const available = Number(counts.bugSplat || 0);
    bugStrikeState.available = available;
    bugStrikeState.lastKnownInventory = available;
  });

  return (reason = "bug-strike-state") => {
    try {
      inventoryUnsub?.(reason);
    } catch (err) {
      console.debug("[bugStrike.state] inventory cleanup failed:", err);
    }
    inventoryUnsub = null;
  };
}

export function hasBugStrikeToken(teamName = bugStrikeState.teamName) {
  if (!teamName || teamName !== bugStrikeState.teamName) {
    return false;
  }
  return bugStrikeState.available > 0;
}

export async function consumeBugStrikeToken(teamName = bugStrikeState.teamName) {
  if (!teamName || teamName !== bugStrikeState.teamName) {
    throw new Error("Bug Strike team not initialized.");
  }

  const success = await consumeSurprise(teamName, SurpriseTypes.BUG_SPLAT);
  if (!success) {
    throw new Error("No Bug Strike tokens remaining.");
  }

  bugStrikeState.available = Math.max(0, bugStrikeState.available - 1);
}

export async function refundBugStrikeToken(teamName = bugStrikeState.teamName) {
  if (!teamName) return;
  try {
    await incrementSurprise(teamName, SurpriseTypes.BUG_SPLAT);
    bugStrikeState.available += 1;
  } catch (err) {
    console.warn("[bugStrike.state] Failed to refund bug strike token:", err);
  }
}

export function getBugStrikeSettings() {
  return {
    bugs: bugStrikeState.settings.bugs,
    durationMinutes: bugStrikeState.settings.durationMinutes
  };
}
