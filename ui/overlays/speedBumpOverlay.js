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
  requestSpeedBumpRelease,
  sendSpeedBumpChirp,
  SPEEDBUMP_STATUS,
  SPEEDBUMP_CHIRP_LIMIT
} from '../../services/speed-bump/speedBumpService.js';
import { isShieldActive } from '../../features/team-surprise/teamSurpriseState.js';

let activeTeam = null;
let unsubscribe = null;
let overlayEl = null;
let currentAssignment = null;
let countdownTimer = null;

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

function resolveGameId() {
  if (typeof window === 'undefined') return 'global';
  const candidates = [
    window.__rrGameId,
    window.__routeRiotGameId,
    window.sessionStorage?.getItem?.('activeGameId'),
    window.localStorage?.getItem?.('activeGameId')
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return 'global';
}

function isPlayerPage() {
  if (typeof document === 'undefined') return false;
  const path = typeof window !== 'undefined' && window.location?.pathname
    ? window.location.pathname.toLowerCase()
    : '';
  if (path.includes('control')) return false;
  const hasPlayerMarkers =
    document.getElementById('player-scoreboard-table') ||
    document.getElementById('team-chat-log') ||
    document.querySelector('#game-status');
  return !!hasPlayerMarkers;
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
      <div class="speedbump-overlay__card">
        <label>Attacker</label>
        <p data-role="attacker">Unknown</p>
        <p data-role="contact" class="speedbump-overlay__contact"></p>
      </div>
      <div class="speedbump-overlay__timer">
        <p data-role="timer-label">Time Remaining</p>
        <p data-role="timer-value">--:--</p>
      </div>
      <div class="speedbump-overlay__actions" data-role="victim-actions">
        <button type="button" data-role="complete">Challenge Complete (Proof sent)</button>
        <button type="button" data-role="chirp">Chirp</button>
      </div>
      <p class="speedbump-overlay__status" data-role="status"></p>
      <p class="speedbump-overlay__status" data-role="error" data-tone="error"></p>
    </div>
  `;

  const chirpBtn = el.querySelector('[data-role="chirp"]');
  const completeBtn = el.querySelector('[data-role="complete"]');

  chirpBtn?.addEventListener('click', handleChirp);
  completeBtn?.addEventListener('click', handleComplete);

  document.body.appendChild(el);
  overlayEl = el;
  return el;
}

function setError(text) {
  const el = overlayEl?.querySelector('[data-role="error"]');
  if (!el) return;
  el.textContent = text || '';
}

function clearTimer() {
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
}

function formatRemainingMs(ms) {
  if (!Number.isFinite(ms)) return '--:--';
  const clamped = Math.max(0, ms);
  const mins = Math.floor(clamped / 60000);
  const secs = Math.floor((clamped % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

async function handleRequestRelease() {
  if (!currentAssignment) return;
  const btn = overlayEl?.querySelector('[data-role="complete"]');
  if (btn) btn.disabled = true;
  setError('');
  try {
    await requestSpeedBumpRelease({
      gameId: currentAssignment.gameId || 'global',
      assignmentId: currentAssignment.id,
      attackerId: currentAssignment.attackerId,
      victimId: currentAssignment.victimId
    });
  } catch (err) {
    setError(err?.message || 'Failed to request release.');
    if (btn) btn.disabled = false;
  }
}

async function handleChirp() {
  if (!currentAssignment) return;
  const btn = overlayEl?.querySelector('[data-role="chirp"]');
  if (btn) btn.disabled = true;
  setError('');
  try {
    const message = 'We are on it—release us soon!';
    const result = await sendSpeedBumpChirp({
      assignmentId: currentAssignment.id,
      attackerId: currentAssignment.attackerId,
      victimId: currentAssignment.victimId,
      message
    });
    if (result?.reason === 'limit_reached') {
      setError('Chirp limit reached.');
    }
  } catch (err) {
    setError(err?.message || 'Failed to chirp attacker.');
  } finally {
    if (btn) {
      const chirpsUsed = Number(currentAssignment?.chirpCount || 0);
      btn.disabled = chirpsUsed >= 3;
    }
  }
}

async function handleComplete() {
  if (!currentAssignment) return;
  return handleRequestRelease();
}

function renderOverlay(assignments = []) {
  if (!overlayEl) return;
  const normalized = Array.isArray(assignments) ? assignments : [];
  const live = normalized
    .filter(a => ['active', 'waiting_release'].includes(String(a.status).toLowerCase()))
    .sort((a, b) => {
      const aCreated = a.createdAt?.toMillis?.() || 0;
      const bCreated = b.createdAt?.toMillis?.() || 0;
      return bCreated - aCreated;
    });

  const victimEntry = live.find(a => a.role === 'victim') || null;
  currentAssignment = victimEntry || null;

  if (!victimEntry) {
    hideOverlay();
    clearTimer();
    return;
  }

  if (victimEntry.victimId && isShieldActive(victimEntry.victimId)) {
    hideOverlay();
    clearTimer();
    return;
  }

  const promptEl = overlayEl.querySelector('[data-role="prompt"]');
  const statusEl = overlayEl.querySelector('[data-role="status"]');
  const attackerEl = overlayEl.querySelector('[data-role="attacker"]');
  const contactEl = overlayEl.querySelector('[data-role="contact"]');
  const subtitleEl = overlayEl.querySelector('[data-role="subtitle"]');
  const timerValEl = overlayEl.querySelector('[data-role="timer-value"]');
  const timerLabelEl = overlayEl.querySelector('[data-role="timer-label"]');
  const chirpBtn = overlayEl.querySelector('[data-role="chirp"]');
  const completeBtn = overlayEl.querySelector('[data-role="complete"]');

  promptEl.textContent = victimEntry.promptText || victimEntry.prompt || 'Complete the assigned challenge to continue.';
  attackerEl.textContent = victimEntry.attackerId || 'Unknown';
  const contactParts = [];
  if (victimEntry.attackerContactPhone) contactParts.push(`Phone: ${victimEntry.attackerContactPhone}`);
  if (victimEntry.attackerContactEmail) contactParts.push(`Email: ${victimEntry.attackerContactEmail}`);
  contactEl.textContent = contactParts.length ? contactParts.join(' | ') : 'No contact provided.';

  const statusLower = String(victimEntry.status).toLowerCase();
  const isActive = statusLower === SPEEDBUMP_STATUS.ACTIVE;
  const isWaiting = statusLower === SPEEDBUMP_STATUS.WAITING_RELEASE;
  subtitleEl.textContent = isActive
    ? `You have been slowed by ${victimEntry.attackerId || 'another team'}.`
    : `Waiting for release from ${victimEntry.attackerId || 'another team'}.`;
  statusEl.textContent = isActive
    ? 'Complete the challenge and ask for release.'
    : 'Release timer running. You will be freed soon.';

  completeBtn.disabled = !isActive;
  completeBtn.dataset.assignmentId = victimEntry.id;

  const chirpsUsed = Number(victimEntry.chirpCount || 0);
  chirpBtn.disabled = chirpsUsed >= SPEEDBUMP_CHIRP_LIMIT;
  chirpBtn.dataset.assignmentId = victimEntry.id;
  const remainingChirps = Math.max(0, SPEEDBUMP_CHIRP_LIMIT - chirpsUsed);
  chirpBtn.textContent = remainingChirps === 0 ? 'Chirp (0 left)' : `Chirp (${remainingChirps} left)`;

  const targetTs = isWaiting
    ? (victimEntry.releaseEndsAtMs ?? victimEntry.releaseEndsAt?.toMillis?.() ?? victimEntry.releaseEndsAt ?? null)
    : (victimEntry.blockEndsAtMs ?? victimEntry.blockEndsAt?.toMillis?.() ?? victimEntry.blockEndsAt ?? null);

  timerLabelEl.textContent = isWaiting ? 'Release timer' : 'Time remaining';
  const updateTimer = () => {
    const remaining = Number.isFinite(targetTs) ? targetTs - Date.now() : null;
    timerValEl.textContent = formatRemainingMs(remaining);
    if (remaining !== null && remaining > 0) {
      countdownTimer = setTimeout(updateTimer, 1000);
    } else if (remaining !== null && remaining <= 0) {
      hideOverlay();
    }
  };

  clearTimer();
  updateTimer();
  setError('');
  showOverlay();
}

export function ensureSpeedBumpOverlayListeners(options = {}) {
  if (!isPlayerPage()) {
    return () => {};
  }
  const teamName = resolveTeamName(options.teamName);
  const gameId = resolveGameId();
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
  }, { statuses: [SPEEDBUMP_STATUS.ACTIVE, SPEEDBUMP_STATUS.WAITING_RELEASE], gameId });

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
