// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/overlays/speedBumpOverlay.js
// PURPOSE: Player-side Speed Bump overlay (victim blocking + attacker release)
// DEPENDS_ON: ./speedBumpOverlay.css
// USED_BY: features/team-surprise/teamSurprise.bridge.js, modules/speedBumpPlayer.js
// AUTHOR: Route Riot – Speed Bump Restoration
// CREATED: 2025-11-07
// AICP_VERSION: 3.3
// ============================================================================
// === END AICP UI HEADER ===

import './speedBumpOverlay.css';
import {
  subscribeToTeamSpeedBumps,
  completeSpeedBumpByTeamContext
} from '../../services/speed-bump/speedBumpService.js';
import { isShieldActive } from '../../features/team-surprise/teamSurpriseState.js';

let activeTeam = null;
let unsubscribe = null;
let overlayEl = null;

function resolveTeamName(candidate) {
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  if (typeof window !== 'undefined') {
    const opts = [
      window.currentPlayerTeam,
      window.localStorage?.getItem?.('teamName')
    ];
    const found = opts.find(v => typeof v === 'string' && v.trim());
    if (found) return found.trim();
  }
  return '';
}

function ensureOverlay() {
  if (overlayEl) return overlayEl;
  const el = document.createElement('div');
  el.id = 'speedbump-overlay';
  el.className = 'speedbump-overlay';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="speedbump-overlay__panel">
      <header class="speedbump-overlay__header">
        <p class="speedbump-overlay__headline">🚧 Speed Bump!</p>
        <p class="speedbump-overlay__flavor" data-role="subtitle">You’ve been slowed.</p>
      </header>
      <section class="speedbump-overlay__challenge">
        <label>Challenge</label>
        <p data-role="prompt">Waiting for challenge…</p>
      </section>
      <p class="speedbump-overlay__status" data-role="status"></p>
      <div class="speedbump-overlay__card">
        <label>Attacker</label>
        <input type="text" data-role="attacker" readonly value="Unknown" />
      </div>
      <div class="speedbump-overlay__actions" data-role="attacker-actions" hidden>
        <button type="button" data-role="release">Release Team</button>
      </div>
      <p class="speedbump-overlay__status" data-role="error" data-tone="error"></p>
    </div>
  `;

  const releaseBtn = el.querySelector('[data-role="release"]');
  releaseBtn?.addEventListener('click', async () => {
    const entryId = releaseBtn.dataset.entryId;
    if (!entryId || !activeTeam) return;
    releaseBtn.disabled = true;
    releaseBtn.textContent = 'Releasing…';
    setError('');
    try {
      await completeSpeedBumpByTeamContext(activeTeam, entryId);
    } catch (err) {
      setError(err?.message || 'Failed to release team.');
      releaseBtn.disabled = false;
      releaseBtn.textContent = 'Release Team';
    }
  });

  document.body.appendChild(el);
  overlayEl = el;
  return el;
}

function setError(text) {
  const el = overlayEl?.querySelector('[data-role="error"]');
  if (!el) return;
  el.textContent = text || '';
}

function hideOverlay() {
  if (overlayEl) {
    overlayEl.style.display = 'none';
  }
}

function showOverlay() {
  if (overlayEl) {
    overlayEl.style.display = 'flex';
  }
}

function renderOverlay(assignments = []) {
  if (!overlayEl) return;
  const normalized = Array.isArray(assignments) ? assignments : [];

  const victimActive = normalized.find(a => a.role === 'victim' && String(a.status).toLowerCase() === 'active');
  const victimPending = normalized.find(a => a.role === 'victim' && String(a.status).toLowerCase() === 'pending');
  const victimEntry = victimActive || victimPending || null;

  const attackerActive = normalized.find(a => a.role === 'attacker' && String(a.status).toLowerCase() === 'active');

  if (!victimEntry && !attackerActive) {
    hideOverlay();
    return;
  }

  const promptEl = overlayEl.querySelector('[data-role="prompt"]');
  const statusEl = overlayEl.querySelector('[data-role="status"]');
  const attackerEl = overlayEl.querySelector('[data-role="attacker"]');
  const subtitleEl = overlayEl.querySelector('[data-role="subtitle"]');
  const actionsEl = overlayEl.querySelector('[data-role="attacker-actions"]');
  const releaseBtn = overlayEl.querySelector('[data-role="release"]');

  if (victimEntry) {
    if (victimEntry.victimId && isShieldActive(victimEntry.victimId)) {
      console.warn('[speedBumpOverlay] Victim is shielded; hiding overlay.');
      hideOverlay();
      return;
    }
    const isActive = String(victimEntry.status).toLowerCase() === 'active';
    promptEl.textContent = victimEntry.prompt || 'Complete the assigned challenge to continue.';
    attackerEl.value = victimEntry.attackerId || 'Unknown';
    statusEl.textContent = isActive
      ? 'Complete this challenge before you can race on!'
      : 'Get ready… your challenge is about to begin!';
    subtitleEl.textContent = isActive
      ? `You have been slowed by ${victimEntry.attackerId || 'another team'}.`
      : `A challenge from ${victimEntry.attackerId || 'another team'} is coming in hot.`;
  } else {
    promptEl.textContent = attackerActive?.prompt || 'You have an active Speed Bump out.';
    attackerEl.value = attackerActive?.victimId || 'Unknown';
    statusEl.textContent = 'You have slowed another team. Release them when they finish.';
    subtitleEl.textContent = 'Attacker view';
  }

  if (attackerActive) {
    actionsEl.hidden = false;
    releaseBtn.disabled = false;
    releaseBtn.textContent = 'Release Team';
    releaseBtn.dataset.entryId = attackerActive.id;
    statusEl.textContent = `${statusEl.textContent || ''} You are protected while executing a SpeedBump attack.`.trim();
  } else {
    actionsEl.hidden = true;
    releaseBtn.dataset.entryId = '';
  }

  setError('');
  showOverlay();
}

export function ensureSpeedBumpOverlayListeners(options = {}) {
  const teamName = resolveTeamName(options.teamName);
  if (!teamName) {
    console.warn('[speedBumpOverlay] Unable to resolve team; overlay disabled.');
    return () => {};
  }

  activeTeam = teamName;
  ensureOverlay();

  unsubscribe?.();
  unsubscribe = subscribeToTeamSpeedBumps(teamName, (assignments) => {
    try {
      renderOverlay(assignments);
    } catch (err) {
      console.warn('[speedBumpOverlay] render failed:', err);
    }
  });

  return (reason = 'manual') => {
    try { unsubscribe?.(reason); } catch {}
    unsubscribe = null;
    hideOverlay();
  };
}

export default { ensureSpeedBumpOverlayListeners };

// === AICP UI FOOTER ===
// ai_origin: ui/overlays/speedBumpOverlay.js
// ai_role: UI Layer
// aicp_category: ui
// aicp_version: 3.3
// codex_phase: legacy_restore_phase2
// export_bridge: player
// exports: ensureSpeedBumpOverlayListeners
// linked_files: []
// owner: Route Riot-AICP
// phase: legacy_restore_phase2
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: services
// === END AICP UI FOOTER ===
