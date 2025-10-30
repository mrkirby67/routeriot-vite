// ============================================================================
// FILE: modules/playerBugStrike.js
// PURPOSE: Player-side Bug Swarm listener & popup spawner
// ============================================================================

import { db } from './config.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import '../styles/playerBugStrike.css';

let swarmInterval = null;
let activeBugData = null;
let activeSignature = null;

export function initializePlayerBugStrike(teamName) {
  if (!teamName) {
    console.warn('⚠️ [bugStrike] Missing team name for swarm listener.');
    return () => {};
  }

  const strikeRef = doc(db, 'bugStrikes', teamName);
  const unsubscribe = onSnapshot(strikeRef, (snapshot) => {
    if (!snapshot.exists()) {
      stopBugStrike('doc-removed');
      return;
    }

    const data = snapshot.data() || {};
    const expiresAt = normalizeTimestampMs(data.expiresAt);
    const now = Date.now();

    if (data.cancelled || data.active === false) {
      stopBugStrike('cancelled');
      return;
    }

    if (expiresAt && expiresAt <= now) {
      stopBugStrike('expired');
      return;
    }

    const normalized = {
      ...data,
      victim: data.victim || teamName,
      attacker: data.attacker || 'Unknown Team',
      bugs: Math.max(1, Number(data.bugs) || 1),
      expiresAt: expiresAt ?? (now + Number(data.durationMs || 0)),
      startedAt: normalizeTimestampMs(data.startedAt) || now,
      durationMs: Number(data.durationMs) || Math.max(1, (expiresAt ?? now) - now)
    };

    startBugStrike(normalized);
  }, (error) => {
    console.error('❌ Bug Strike listener error:', error);
  });

  return (reason = 'manual') => {
    try { unsubscribe?.(); } catch (err) {
      console.warn('⚠️ Failed to detach bug strike listener:', err);
    }
    stopBugStrike(reason);
  };
}

function startBugStrike(data) {
  const signature = `${data.victim}-${data.startedAt}-${data.expiresAt}`;
  if (signature === activeSignature) {
    return;
  }

  stopBugStrike('restart');
  activeSignature = signature;
  activeBugData = data;

  console.log(`🐞 BUG STRIKE INCOMING from ${data.attacker}`);
  spawnBugPopup(data);

  const spawnIntervalMs = Math.max(300, Math.floor(5000 / Math.max(1, data.bugs)));
  swarmInterval = window.setInterval(() => {
    if (!activeBugData) return;
    if (Date.now() >= activeBugData.expiresAt) {
      stopBugStrike('expired');
      return;
    }
    spawnBugPopup(activeBugData);
  }, spawnIntervalMs);
}

function spawnBugPopup(data) {
  if (!data || Date.now() >= data.expiresAt) {
    stopBugStrike('expired');
    return;
  }

  const currentPopups = document.querySelectorAll('.bug-popup').length;
  if (currentPopups >= data.bugs) {
    return;
  }

  const popup = document.createElement('div');
  popup.className = 'bug-popup';
  popup.style.top = `${Math.random() * 80}%`;
  popup.style.left = `${Math.random() * 80}%`;
  popup.innerHTML = `
    <div class="bug-content">
      <h3>🐞 BUG STRIKE!</h3>
      <p>Attacked by <b>${sanitize(data.attacker)}</b></p>
      <p data-role="bug-remaining">⏳ ${formatSecondsRemaining(data.expiresAt)}</p>
      <button class="squash-bug" type="button">🖐 Squash Bug</button>
    </div>
  `;

  document.body.appendChild(popup);

  const remainingLabel = popup.querySelector('[data-role="bug-remaining"]');
  const updateCountdown = () => {
    if (!activeBugData) return;
    if (Date.now() >= activeBugData.expiresAt) {
      stopBugStrike('expired');
      return;
    }
    if (remainingLabel) {
      remainingLabel.textContent = `⏳ ${formatSecondsRemaining(activeBugData.expiresAt)}`;
    }
    window.setTimeout(updateCountdown, 1000);
  };
  updateCountdown();

  const squashBtn = popup.querySelector('.squash-bug');
  squashBtn?.addEventListener('click', () => {
    popup.remove();
    if (activeBugData && Date.now() < activeBugData.expiresAt) {
      spawnBugPopup(activeBugData);
    }
  }, { once: true });

  window.setTimeout(() => {
    if (!document.body.contains(popup)) return;
    popup.remove();
    if (activeBugData && Date.now() < activeBugData.expiresAt) {
      spawnBugPopup(activeBugData);
    }
  }, Math.max(4000, Math.min(10000, data.durationMs / Math.max(1, data.bugs))));
}

function stopBugStrike(reason = 'manual') {
  if (swarmInterval) {
    window.clearInterval(swarmInterval);
    swarmInterval = null;
  }
  if (activeSignature || activeBugData) {
    console.log(`🧹 Bug Strike ended (${reason}).`);
  }
  activeBugData = null;
  activeSignature = null;
  document.querySelectorAll('.bug-popup').forEach((el) => el.remove());
}

function normalizeTimestampMs(value) {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds !== undefined) {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function formatSecondsRemaining(expiresAt) {
  const diff = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  return mins > 0 ? `${mins}m ${secs}s remaining` : `${secs}s remaining`;
}

function sanitize(value) {
  return String(value || '').replace(/[<>&"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
  }[char] || char));
}
