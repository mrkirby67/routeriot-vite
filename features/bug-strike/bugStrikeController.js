// ============================================================================
// Bug Strike Controller
// Bridges player UI triggers to ChatService + bug strike Firestore docs.
// ============================================================================

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import ChatServiceV2 from "../../services/ChatServiceV2.js";
import { db } from "/core/config.js";
import { isTeamAttackable } from "../team-surprise/teamSurpriseController.js";
import { canTeamBeAttacked } from '../../services/gameRulesManager.js';
import {
  ensureBugStrikeEventListeners,
  registerBugStrikeHandler
} from "./bugStrike.bridge.js";
import {
  initializeBugStrikeState,
  hasBugStrikeToken,
  consumeBugStrikeToken,
  refundBugStrikeToken,
  getBugStrikeSettings
} from "./bugStrikeState.js";

const BUG_STRIKES_COLLECTION = 'bugStrikes';

let activeTeamName = null;
let teardownState = null;

export async function initializeBugStrikeController(teamName) {
  const normalized =
    typeof teamName === 'string' && teamName.trim()
      ? teamName.trim()
      : '';

  if (!normalized) {
    console.warn('[bugStrike.controller] Missing team name; controller not initialized.');
    return () => {};
  }

  activeTeamName = normalized;
  teardownState?.();
  teardownState = initializeBugStrikeState(normalized);

  ensureBugStrikeEventListeners();
  registerBugStrikeHandler(async (targetTeam) => performBugStrike(targetTeam));

  return (reason = 'bug-strike-controller') => {
    if (reason === 'teardown') {
      registerBugStrikeHandler(null);
    }
    try {
      teardownState?.(reason);
    } catch (err) {
      console.debug('[bugStrike.controller] state cleanup failed:', err);
    }
    teardownState = null;
    activeTeamName = null;
  };
}

async function performBugStrike(rawTargetTeam) {
  const attacker = activeTeamName;
  const targetTeam =
    typeof rawTargetTeam === 'string' && rawTargetTeam.trim()
      ? rawTargetTeam.trim()
      : '';

  if (!attacker) {
    throw new Error('Bug Strike not initialized.');
  }
  if (!targetTeam || targetTeam === attacker) {
    throw new Error('Choose a different team to splat.');
  }

  const attackable = await isTeamAttackable(targetTeam);
  if (!attackable) {
    throw new Error(`${targetTeam} is protected. Try again later.`);
  }

  const rule = await canTeamBeAttacked(attacker, targetTeam, 'bugstrike');
  if (!rule.allowed) {
    switch (rule.reason) {
      case 'SHIELD':
        throw new Error('This team is shielded and cannot be attacked.');
      case 'ATTACKER_PROTECTED':
        throw new Error('This team is currently attacking with a SpeedBump and cannot be targeted.');
      case 'VICTIM_BUSY':
        throw new Error('Victim is currently slowed by a SpeedBump.');
      default:
        throw new Error(rule.reason || 'Target cannot be attacked.');
    }
  }

  if (!hasBugStrikeToken(attacker)) {
    throw new Error('No Bug Strike tokens available.');
  }

  await consumeBugStrikeToken(attacker);
  const settings = getBugStrikeSettings();
  const bugs = Number(settings?.bugs) || 20;
  const durationMinutes = Number(settings?.durationMinutes) || 3;
  const durationMs = durationMinutes * 60 * 1000;
  const expiresAt = Date.now() + durationMs;

  try {
    await launchBugStrikeDoc({
      attacker,
      targetTeam,
      bugs,
      durationMs,
      expiresAt
    });
  } catch (err) {
    await refundBugStrikeToken(attacker);
    throw err instanceof Error
      ? err
      : new Error('Bug Strike dispatch failed.');
  }

  await announceBugStrike(attacker, targetTeam);
  return { ok: true };
}

async function launchBugStrikeDoc({
  attacker,
  targetTeam,
  bugs,
  durationMs,
  expiresAt
}) {
  const strikeRef = doc(db, BUG_STRIKES_COLLECTION, targetTeam);
  await setDoc(
    strikeRef,
    {
      active: true,
      victim: targetTeam,
      attacker,
      bugs,
      durationMs,
      startedAt: serverTimestamp(),
      expiresAt,
      cancelled: false,
      message: `🪰 ${attacker} splatted ${targetTeam} with a Bug Strike!`
    },
    { merge: true }
  );
}

async function announceBugStrike(attacker, targetTeam) {
  await ChatServiceV2.send({
    fromTeam: attacker,
    toTeam: 'ALL',
    text: `🪰 ${attacker} splatted ${targetTeam} with a Bug Strike!`,
    kind: 'system',
    meta: {
      effect: 'bugStrike',
      targetTeam,
      origin: 'player'
    },
    extra: {
      type: 'bugStrike',
      from: attacker,
      to: targetTeam
    }
  });
}
