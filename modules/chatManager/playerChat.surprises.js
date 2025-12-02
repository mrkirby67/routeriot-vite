// ============================================================================
// FILE: modules/chatManager/playerChat.surprises.js
// PURPOSE: Handles surprise usage (Flat Tire, Bug Splat, Shield Wax)
// ============================================================================

import { assignFlatTireTeam, loadFlatTireConfig } from '../flatTireManager.js';
import {
  SurpriseTypes,
  consumeSurprise,
  activateShield,
  getShieldDurationMs,
  auditUse,
  sendSurpriseToTeam
} from '../teamSurpriseManager.js';
import { sendPrivateSystemMessage } from './messageService.js';
import ChatServiceV2 from '../../services/ChatServiceV2.js';

const SURPRISE_LABELS = {
  [SurpriseTypes.FLAT_TIRE]: 'Flat Tire',
  [SurpriseTypes.BUG_SPLAT]: 'Bug Splat',
  [SurpriseTypes.WILD_CARD]: 'Super Shield Wax',
  [SurpriseTypes.SPEED_BUMP]: 'Speed Bump'
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
    const senderName =
      messagePayload.sender ||
      messagePayload.teamName ||
      'Game Master';
    const targetTeam =
      typeof messagePayload.toTeam === 'string' && messagePayload.toTeam.trim()
        ? messagePayload.toTeam.trim()
        : 'ALL';
    const isBroadcast = messagePayload.isBroadcast !== false;
    const text = messagePayload.message || '';

    await ChatServiceV2.send({
      fromTeam: senderName,
      toTeam: isBroadcast ? 'ALL' : targetTeam,
      text,
      kind: 'system',
      meta: {
        surpriseType: messagePayload.type || 'teamSurprise',
        targetTeam,
        origin: 'playerChat.surprises'
      },
      extra: {
        type: messagePayload.type || 'teamSurprise',
        from: senderName,
        to: targetTeam,
        senderDisplay: messagePayload.senderDisplay || senderName
      }
    });
  } catch (err) {
    console.warn('⚠️ Unable to broadcast surprise message:', err);
  }
}

export async function dispatchFlatTireAttack(attacker, defender) {
  const fromTeam = normalizeTeamName(attacker);
  const targetTeam = normalizeTeamName(defender);

  if (!fromTeam) throw new Error('Missing attacking team.');
  if (!targetTeam || targetTeam === fromTeam) {
    throw new Error('Choose a different team to receive the Flat Tire.');
  }

  const result = await sendSurpriseToTeam(fromTeam, targetTeam, SurpriseTypes.FLAT_TIRE);
  if (result?.blocked) {
    return;
  }
  if (!result?.ok) {
    throw new Error(result?.message || 'No Flat Tire surprises remaining.');
  }

  const flatTireConfig = await loadFlatTireConfig();
  const zones = Object.values(flatTireConfig.zones).filter(z => z.gps);
  if (!zones.length) {
    throw new Error('No Flat Tire zones are configured by Game Control.');
  }
  const randomZone = zones[Math.floor(Math.random() * zones.length)];

  await assignFlatTireTeam(targetTeam, { 
    fromTeam,
    gps: randomZone.gps,
    zoneName: randomZone.name,
    diameterMeters: randomZone.diameterMeters
  });
  await auditUse(fromTeam, SurpriseTypes.FLAT_TIRE, { targetTeam });

  return { ok: true, message: `Sent to ${targetTeam}!` };
}

async function handleBugSplatAttack(attacker, defender) {
  const fromTeam = normalizeTeamName(attacker);
  const targetTeam = normalizeTeamName(defender);

  if (!fromTeam) throw new Error('Missing attacking team.');
  if (!targetTeam || targetTeam === fromTeam) {
    throw new Error('Choose a different team to splat.');
  }

  const result = await sendSurpriseToTeam(fromTeam, targetTeam, SurpriseTypes.BUG_SPLAT);
  if (result?.blocked) {
    return;
  }
  if (!result?.ok) {
    throw new Error(result?.message || 'No Bug Splat surprises remaining.');
  }

  await auditUse(fromTeam, SurpriseTypes.BUG_SPLAT, { targetTeam });

  return { ok: true, message: `Splatted ${targetTeam}!` };
}
async function handleShieldActivation(teamName) {
  const normalizedTeam = normalizeTeamName(teamName);
  if (!normalizedTeam) throw new Error('Missing team name.');

  const consumed = await consumeSurprise(normalizedTeam, SurpriseTypes.WILD_CARD);
  if (!consumed) {
    throw new Error('No Super Shield Wax remaining.');
  }

  const expiresAt = Date.now() + getShieldDurationMs();
  await activateShield(normalizedTeam, expiresAt);
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
      return dispatchFlatTireAttack(normalizedTeam, targetTeam);
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
