// ============================================================================
// FILE: modules/chatManager/playerChat.surprises.js
// PURPOSE: Handles surprise usage (Flat Tire, Bug Splat, Shield Wax)
// ============================================================================

import { db } from '../config.js';
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { assignFlatTireTeam } from '../flatTireManager.js';
import {
  SurpriseTypes,
  consumeSurprise,
  activateShield,
  getShieldDurationMs,
  checkShieldBeforeAttack,
  auditUse,
  startCooldown,
  isTeamOnCooldown,
  getCooldownTimeRemaining,
  sendSurpriseToTeam
} from '../teamSurpriseManager.js';
import { sendPrivateSystemMessage } from './messageService.js';

const COMMUNICATIONS_REF = collection(db, 'communications');

const SURPRISE_LABELS = {
  [SurpriseTypes.FLAT_TIRE]: 'Flat Tire',
  [SurpriseTypes.BUG_SPLAT]: 'Bug Splat',
  [SurpriseTypes.WILD_CARD]: 'Super Shield Wax'
};

function normalizeTeamName(team = '') {
  return typeof team === 'string' ? team.trim() : '';
}

function normalizeSurpriseType(type = '') {
  const key = String(type || '').toLowerCase();
  if (key.includes('flat')) return SurpriseTypes.FLAT_TIRE;
  if (key.includes('bug')) return SurpriseTypes.BUG_SPLAT;
  if (key.includes('shield') || key.includes('wild')) return SurpriseTypes.WILD_CARD;
  return null;
}

async function broadcast(messagePayload = {}) {
  try {
    await addDoc(COMMUNICATIONS_REF, {
      teamName: messagePayload.teamName || 'Game Master',
      sender: messagePayload.sender || messagePayload.teamName || 'Game Master',
      senderDisplay: messagePayload.senderDisplay || messagePayload.sender || 'Game Master',
      message: messagePayload.message || '',
      isBroadcast: messagePayload.isBroadcast ?? true,
      timestamp: serverTimestamp(),
      type: messagePayload.type || 'teamSurprise',
      toTeam: messagePayload.toTeam || null
    });
  } catch (err) {
    console.warn('⚠️ Unable to broadcast surprise message:', err);
  }
}

async function handleFlatTireAttack(attacker, defender) {
  const fromTeam = normalizeTeamName(attacker);
  const targetTeam = normalizeTeamName(defender);

  if (!fromTeam) throw new Error('Missing attacking team.');
  if (!targetTeam || targetTeam === fromTeam) {
    throw new Error('Choose a different team to receive the Flat Tire.');
  }
  if (await isTeamOnCooldown(fromTeam)) {
    const remaining = await getCooldownTimeRemaining(fromTeam);
    const seconds = Math.ceil(remaining / 1000);
    throw new Error(`On cooldown! Try again in ${seconds}s.`);
  }

  const result = await checkShieldBeforeAttack(fromTeam, async () => {
    const sendResult = await sendSurpriseToTeam(fromTeam, targetTeam, SurpriseTypes.FLAT_TIRE, {
      message: `🚗 ${fromTeam} sent a FLAT TIRE to ${targetTeam}!`
    });
    if (!sendResult?.ok) {
      return { ok: false, message: sendResult?.message || 'No Flat Tire surprises remaining.' };
    }

    await assignFlatTireTeam(targetTeam, { fromTeam });
    await startCooldown(fromTeam);

    await auditUse(fromTeam, SurpriseTypes.FLAT_TIRE, { targetTeam });

    await sendPrivateSystemMessage(fromTeam, `🚗 Flat Tire dispatched to ${targetTeam}.`);
    await sendPrivateSystemMessage(targetTeam, `🚗 ${fromTeam} just sent your team a Flat Tire!`);

    return { ok: true, message: `Sent to ${targetTeam}!` };
  });

  if (result?.ok === false) {
    throw new Error(result.message || 'Attack cancelled.');
  }

  return result;
}

async function handleBugSplatAttack(attacker, defender) {
  const fromTeam = normalizeTeamName(attacker);
  const targetTeam = normalizeTeamName(defender);

  if (!fromTeam) throw new Error('Missing attacking team.');
  if (!targetTeam || targetTeam === fromTeam) {
    throw new Error('Choose a different team to splat.');
  }
  if (await isTeamOnCooldown(fromTeam)) {
    const remaining = await getCooldownTimeRemaining(fromTeam);
    const seconds = Math.ceil(remaining / 1000);
    throw new Error(`On cooldown! Try again in ${seconds}s.`);
  }

  // New shield check logic
  if (await isShieldActive(targetTeam)) {
    console.log(`🛡️ Attack from ${fromTeam} blocked — ${targetTeam} is shielded.`);
    await consumeSurprise(fromTeam, SurpriseTypes.BUG_SPLAT);
    await sendPrivateSystemMessage(targetTeam, `✨ Shiny wax protected you from a Bug Splat from ${fromTeam}!`);
    throw new Error(`${targetTeam} was protected by a shield! Your attack failed.`);
  }

  const result = await checkShieldBeforeAttack(fromTeam, async () => {
    const sendResult = await sendSurpriseToTeam(fromTeam, targetTeam, SurpriseTypes.BUG_SPLAT, {
      message: `🐞 ${fromTeam} launched a BUG SPLAT on ${targetTeam}!`
    });
    if (!sendResult?.ok) {
      return { ok: false, message: sendResult?.message || 'No Bug Splat surprises remaining.' };
    }

    await startCooldown(fromTeam);
    await auditUse(fromTeam, SurpriseTypes.BUG_SPLAT, { targetTeam });

    await sendPrivateSystemMessage(fromTeam, `🐞 Bug Splat launched at ${targetTeam}!`);
    await sendPrivateSystemMessage(targetTeam, `🐞 ${fromTeam} just splatted your windshield!`);

    return { ok: true, message: `Splatted ${targetTeam}!` };
  });

  if (result?.ok === false) {
    throw new Error(result.message || 'Attack cancelled.');
  }

  return result;
}
async function handleShieldActivation(teamName) {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) throw new Error('Missing team name.');

  const consumed = await consumeSurprise(normalizedTeam, SurpriseTypes.WILD_CARD);
  if (!consumed) {
    throw new Error('No Super Shield Wax remaining.');
  }

  const expiresAt = Date.now() + getShieldDurationMs();
  activateShield(normalizedTeam, expiresAt);
  await auditUse(normalizedTeam, SurpriseTypes.WILD_CARD, { expiresAt });

  await sendPrivateSystemMessage(normalizedTeam, '🛡️ Shield active! You are protected for a short time.');
  await broadcast({
    teamName: normalizedTeam,
    sender: normalizedTeam,
    senderDisplay: normalizedTeam,
    message: `🛡️ ${normalizedTeam} activated Super Shield Wax.`,
    isBroadcast: false
  });

  return { ok: true, message: 'Shield activated!' };
}

export async function handleUseSurprise({
  teamName,
  surpriseType,
  targetTeam
} = {}) {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) {
    throw new Error('Unable to identify your team.');
  }

  const normalizedType = normalizeSurpriseType(surpriseType);
  if (!normalizedType) {
    throw new Error('Unknown surprise selected.');
  }

  console.info('🎯 Using surprise', {
    type: SURPRISE_LABELS[normalizedType] || normalizedType,
    from: normalizedTeam,
    target: targetTeam || null
  });

  switch (normalizedType) {
    case SurpriseTypes.FLAT_TIRE:
      return handleFlatTireAttack(normalizedTeam, targetTeam);
    case SurpriseTypes.BUG_SPLAT:
      return handleBugSplatAttack(normalizedTeam, targetTeam);
    case SurpriseTypes.WILD_CARD:
      return handleShieldActivation(normalizedTeam);
    default:
      throw new Error('Unsupported surprise type.');
  }
}

export function sendSurprise(fromTeam, toTeam, surpriseType) {
  return handleUseSurprise({
    teamName: fromTeam,
    surpriseType,
    targetTeam: toTeam
  });
}
