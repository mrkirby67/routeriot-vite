// ============================================================================
// FILE: components/SpeedBumpControl/controller/actions.js
// PURPOSE: Bridge control dashboard interactions with unified Speed Bump flow
// ============================================================================

import { attemptSurpriseAttack } from '../../../modules/teamSurpriseManager.js';
import {
  assignSpeedBumpToTeam,
  clearSpeedBumpForTeam
} from '../../../modules/speedBump/interactions.js';

/**
 * Called when control clicks “Send” beside a team row.
 * Handles shield logic, token consumption, and Firestore write.
 */
export async function handleSendSpeedBump(
  victimTeam,
  {
    attackerTeam = 'Game Master',
    task = 'Send a goofy selfie with your team mascot!',
    contactInfo = 'game.master@route-riot.local',
    durationMs = 5 * 60 * 1000
  } = {}
) {
  if (!victimTeam) return;

  console.log(`🚀 Attempting Speed Bump from ${attackerTeam} → ${victimTeam}`);

  try {
    const result = await attemptSurpriseAttack({
      fromTeam: attackerTeam,
      toTeam: victimTeam,
      type: 'speedBump',
      async onSuccess() {
        await assignSpeedBumpToTeam(victimTeam, {
          fromTeam: attackerTeam,
          task,
          contactInfo,
          expiresAt: Date.now() + Math.max(0, Number(durationMs) || 0)
        });
      }
    });

    if (result?.ok) {
      alert(`✅ Speed Bump deployed to ${victimTeam}!`);
    } else {
      alert(`🛡️ ${victimTeam} was protected. Attack blocked.`);
    }
    return result;
  } catch (err) {
    console.error('❌ handleSendSpeedBump failed:', err);
    alert('⚠️ Could not send Speed Bump. See console.');
    return { ok: false, error: err };
  }
}

/**
 * Called when control clicks “Release” beside a team row.
 * Clears the victim’s assignment immediately.
 */
export async function handleReleaseSpeedBump(victimTeam) {
  if (!victimTeam) return;
  try {
    await clearSpeedBumpForTeam(victimTeam);
    alert(`🧹 Speed Bump released for ${victimTeam}`);
    return { ok: true };
  } catch (err) {
    console.error('❌ handleReleaseSpeedBump failed:', err);
    alert('⚠️ Could not release Speed Bump. See console.');
    return { ok: false, error: err };
  }
}
