// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/BugStrikeControl/BugStrikeControl.js
// PURPOSE: 🧱 COMPONENT MARKUP
// DEPENDS_ON: /core/config.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../features/team-surprise/teamSurpriseController.js, ../../data.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import { db } from '/core/config.js';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { isTeamAttackable } from '../../features/team-surprise/teamSurpriseController.js';
import { allTeams } from '../../data.js';
import styles from './BugStrikeControl.module.css';

const DEFAULT_SETTINGS = Object.freeze({
  bugs: 25,
  durationMinutes: 5
});

const BUG_SETTINGS_DOC = doc(db, 'settings', 'bugStrikeSettings');
const lastLaunchByTeam = new Map(); // { teamName -> { startedAtMs, attacker } }

// ============================================================================
// 🧱 COMPONENT MARKUP
// ============================================================================
export function BugStrikeControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>🪰 Bug Strike Control</h2>

      <div class="${styles.settingsRow}">
        <label>
          🪲 Bugs in the Strike:
          <input id="bugstrike-bugcount" type="number" min="1" value="${DEFAULT_SETTINGS.bugs}" class="${styles.numberInput}">
        </label>

        <label>
          ⏳ Duration (minutes):
          <input id="bugstrike-duration" type="number" min="1" value="${DEFAULT_SETTINGS.durationMinutes}" class="${styles.numberInput}">
        </label>

        <button id="apply-bugstrike-settings" class="${styles.launchButton}">
          💾 Apply Settings
        </button>
      </div>

      <table id="bugstrike-table" class="${styles.table}">
        <thead>
          <tr>
            <th>Team</th>
            <th>Status</th>
            <th>Last Launch</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="bugstrike-tbody"></tbody>
      </table>
    </div>
  `;
}

// ============================================================================
// 🚀 INITIALIZER
// ============================================================================
export async function initializeBugStrikeControl(controlTeamName = 'Game Master') {
  const tbody = document.getElementById('bugstrike-tbody');
  const bugInput = document.getElementById('bugstrike-bugcount');
  const durationInput = document.getElementById('bugstrike-duration');
  const applyBtn = document.getElementById('apply-bugstrike-settings');
  if (!tbody || !bugInput || !durationInput || !applyBtn) return;

  const cleanupFns = [];
  const rowRegistry = new Map();

  let currentSettings = { ...DEFAULT_SETTINGS };
  try {
    const snap = await getDoc(BUG_SETTINGS_DOC);
    if (snap.exists()) {
      const data = snap.data();
      currentSettings = {
        bugs: Number(data.bugs) || DEFAULT_SETTINGS.bugs,
        durationMinutes: Number(data.durationMinutes) || DEFAULT_SETTINGS.durationMinutes
      };
    }
  } catch (err) {
    console.error('⚠️ Error loading Bug Strike settings:', err);
  }

  bugInput.value = currentSettings.bugs;
  durationInput.value = currentSettings.durationMinutes;

  applyBtn.addEventListener('click', async () => {
    const bugs = sanitizeNumber(bugInput.value, currentSettings.bugs, 1);
    const duration = sanitizeNumber(durationInput.value, currentSettings.durationMinutes, 1);
    try {
      await setDoc(BUG_SETTINGS_DOC, {
        bugs,
        durationMinutes: duration,
        updatedAt: serverTimestamp()
      }, { merge: true });
      currentSettings = { bugs, durationMinutes: duration };
      bugInput.value = bugs;
      durationInput.value = duration;
      alert('✅ Bug Strike settings saved!');
    } catch (err) {
      console.error('❌ Failed to save Bug Strike settings:', err);
      alert('⚠️ Could not save settings. Check console for details.');
    }
  });

  tbody.innerHTML = '';
  allTeams.forEach((team) => {
    const row = buildTeamRow(team.name, tbody);
    rowRegistry.set(team.name, row);
  });

  const strikesRef = collection(db, 'bugStrikes');
  const unsubscribeStrikes = onSnapshot(strikesRef, (snapshot) => {
    const seenVictims = new Set();
    snapshot.forEach((docSnap) => {
      const victim = docSnap.id;
      seenVictims.add(victim);
      const row = rowRegistry.get(victim);
      if (!row) return;
      applyStrikeState(row, docSnap.data());
    });

    rowRegistry.forEach((row, teamName) => {
      if (!seenVictims.has(teamName)) {
        applyStrikeState(row, null);
      }
    });
  }, (error) => {
    console.error('❌ Bug Strike snapshot error:', error);
    alert('⚠️ Live Bug Strike updates unavailable. Check console for details.');
  });
  cleanupFns.push(unsubscribeStrikes);

  rowRegistry.forEach((row, teamName) => {
    row.launchBtn.addEventListener('click', () => {
      handleLaunch({
        row,
        teamName,
        bugInput,
        durationInput,
        controlTeamName,
        currentSettings
      });
    });

    row.cancelBtn.addEventListener('click', () => {
      handleCancel({ row, teamName });
    });
  });

  return (reason = 'manual') => {
    cleanupFns.forEach((fn) => {
      try { fn?.(reason); } catch (err) {
        console.warn('⚠️ BugStrike cleanup failed:', err);
      }
    });
    rowRegistry.forEach((row) => {
      if (row.timerId) {
        window.clearInterval(row.timerId);
        row.timerId = null;
      }
    });
  };
}

// ============================================================================
// 🧩 HELPERS
// ============================================================================
function sanitizeNumber(value, fallback, min = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min) return fallback;
  return Math.floor(num);
}

function buildTeamRow(teamName, tbody) {
  const tr = document.createElement('tr');
  tr.dataset.team = teamName;

  const teamCell = document.createElement('td');
  teamCell.textContent = teamName;

  const statusCell = document.createElement('td');
  statusCell.className = styles.statusCell;
  const statusText = document.createElement('span');
  statusText.textContent = 'No active attack';
  const badge = document.createElement('span');
  badge.className = styles.activeBadge;
  badge.textContent = '🟢 Active Attack';
  badge.hidden = true;
  statusCell.append(statusText, badge);

  const lastUsedCell = document.createElement('td');
  lastUsedCell.textContent = '--';

  const actionsCell = document.createElement('td');
  const actionGroup = document.createElement('div');
  actionGroup.className = styles.actionGroup;
  const launchBtn = document.createElement('button');
  launchBtn.className = `bugstrike-launch ${styles.launchButton}`;
  launchBtn.dataset.team = teamName;
  launchBtn.type = 'button';
  launchBtn.textContent = '💥 Launch';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = `bugstrike-cancel ${styles.cancelButton}`;
  cancelBtn.dataset.team = teamName;
  cancelBtn.type = 'button';
  cancelBtn.textContent = '❌ Cancel';
  cancelBtn.disabled = true;

  actionGroup.append(launchBtn, cancelBtn);
  actionsCell.append(actionGroup);

  tr.append(teamCell, statusCell, lastUsedCell, actionsCell);
  tbody.appendChild(tr);

  return {
    teamName,
    rowEl: tr,
    statusText,
    badge,
    lastUsedCell,
    launchBtn,
    cancelBtn,
    timerId: null
  };
}

function applyStrikeState(row, data) {
  if (row.timerId) {
    window.clearInterval(row.timerId);
    row.timerId = null;
  }

  const now = Date.now();
  const isActive = Boolean(
    data &&
    data.active &&
    !data.cancelled &&
    (!data.expiresAt || normalizeTimestampMs(data.expiresAt) > now)
  );

  if (!isActive) {
    row.statusText.textContent = 'No active attack';
    row.badge.hidden = true;
    row.badge.textContent = '🟢 Active Attack';
    row.lastUsedCell.textContent = formatLastLaunch(row.teamName);
    row.launchBtn.disabled = false;
    row.cancelBtn.disabled = true;
    return;
  }

  const expiresAtMs = normalizeTimestampMs(data.expiresAt);
  const startedAtMs = normalizeTimestampMs(data.startedAt) || now;
  rememberLaunch(row.teamName, startedAtMs, data.attacker);

  row.statusText.textContent = data.message || `🪰 ${data.attacker || 'Unknown team'} unleashed a swarm!`;
  row.badge.hidden = false;
  row.lastUsedCell.textContent = formatLastLaunch(row.teamName);
  row.launchBtn.disabled = true;
  row.cancelBtn.disabled = false;

  if (expiresAtMs) {
    const updateBadge = () => {
      const remainingSec = Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
      row.badge.textContent = remainingSec > 0
        ? `🟢 Active Attack (${formatDuration(remainingSec)})`
        : '🟢 Active Attack';
      if (remainingSec <= 0) {
        window.clearInterval(row.timerId);
        row.timerId = null;
      }
    };
    updateBadge();
    row.timerId = window.setInterval(updateBadge, 1000);
  } else {
    row.badge.textContent = '🟢 Active Attack';
  }
}

async function handleLaunch({
  row,
  teamName,
  bugInput,
  durationInput,
  controlTeamName,
  currentSettings
}) {
  const bugs = sanitizeNumber(bugInput.value, currentSettings.bugs, 1);
  const durationMinutes = sanitizeNumber(durationInput.value, currentSettings.durationMinutes, 1);
  const durationMs = durationMinutes * 60 * 1000;
  const docRef = doc(db, 'bugStrikes', teamName);

  row.launchBtn.disabled = true;
  try {
    const attackable = await isTeamAttackable(teamName);
    if (!attackable) {
      alert(`🚫 ${teamName} is protected and cannot be attacked!`);
      row.launchBtn.disabled = false;
      return;
    }

    const expiresAt = Date.now() + durationMs;
    rememberLaunch(teamName, Date.now(), controlTeamName);
    row.lastUsedCell.textContent = formatLastLaunch(teamName);

    await setDoc(docRef, {
      active: true,
      victim: teamName,
      attacker: controlTeamName,
      bugs,
      durationMs,
      startedAt: serverTimestamp(),
      expiresAt,
      message: `🪰 ${controlTeamName} unleashed a swarm on ${teamName}!`,
      cancelled: false
    });

    alert(`🪰 Bug Swarm launched on ${teamName}!`);
  } catch (err) {
    console.error('❌ Failed to launch Bug Strike:', err);
    alert('⚠️ Could not send Bug Strike. Check console for details.');
    row.launchBtn.disabled = false;
  }
}

async function handleCancel({ row, teamName }) {
  const docRef = doc(db, 'bugStrikes', teamName);
  row.cancelBtn.disabled = true;
  try {
    await deleteDoc(docRef);
    alert(`❌ Attack on ${teamName} cancelled.`);
  } catch (err) {
    console.error('❌ Failed to cancel Bug Strike:', err);
    alert('⚠️ Could not cancel Bug Strike. Check console for details.');
    row.cancelBtn.disabled = false;
  }
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

function formatTime(ms) {
  if (!ms) return '--';
  try {
    return new Date(ms).toLocaleTimeString();
  } catch {
    return '--';
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function rememberLaunch(teamName, startedAtMs, attacker) {
  if (!teamName || !startedAtMs) return;
  lastLaunchByTeam.set(teamName, {
    startedAtMs,
    attacker: attacker || 'Control'
  });
}

function formatLastLaunch(teamName) {
  const entry = lastLaunchByTeam.get(teamName);
  if (!entry || !entry.startedAtMs) return '--';
  const when = formatTime(entry.startedAtMs);
  if (!entry.attacker) return when;
  return `${when} (${entry.attacker})`;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/BugStrikeControl/BugStrikeControl.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services
// exports: BugStrikeControlComponent, initializeBugStrikeControl
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features
// === END AICP COMPONENT FOOTER ===
