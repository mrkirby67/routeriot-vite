// ============================================================================
// FILE: components/BugStrikeControl/BugStrikeControl.js
// PURPOSE: Manage and trigger Bug Strikes from Control dashboard
// ============================================================================

import { db } from '../../modules/config.js';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { allTeams } from '../../data.js';
import styles from './BugStrikeControl.module.css'; // Scoped CSS styling

// ============================================================================
// 🧱 COMPONENT MARKUP
// ============================================================================
export function BugStrikeControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <h2>🪰 Bug Strike Control</h2>

      <div class="${styles.settingsRow}">
        <label>
          Starting Strikes per Team:
          <input id="starting-bugstrikes" type="number" min="0" value="3" class="${styles.numberInput}">
        </label>

        <label>
          Cooldown (minutes):
          <input id="bugstrike-cooldown" type="number" min="5" value="30" class="${styles.numberInput}">
        </label>

        <button id="apply-bugstrike-settings" class="${styles.launchButton}">
          💾 Apply Settings
        </button>
      </div>

      <table id="bugstrike-table" style="margin-top:15px;width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#2c2c2c;color:#fff;">
            <th style="padding:6px;">Team</th>
            <th style="padding:6px;">Remaining</th>
            <th style="padding:6px;">Last Used</th>
            <th style="padding:6px;">Action</th>
          </tr>
        </thead>
        <tbody id="bugstrike-tbody" style="text-align:center;"></tbody>
      </table>
    </div>
  `;
}

// ============================================================================
// 🚀 INITIALIZER
// ============================================================================
export async function initializeBugStrikeControl() {
  const tbody = document.getElementById('bugstrike-tbody');
  const startInput = document.getElementById('starting-bugstrikes');
  const cooldownInput = document.getElementById('bugstrike-cooldown');
  const applyBtn = document.getElementById('apply-bugstrike-settings');

  if (!tbody) return;

  // 🔹 Load or initialize settings from Firestore
  const settingsDocRef = doc(db, 'settings', 'bugstrike');
  let currentSettings = { starting: 3, cooldown: 30 };

  try {
    const snap = await getDoc(settingsDocRef);
    if (snap.exists()) {
      currentSettings = { ...currentSettings, ...snap.data() };
    }
  } catch (err) {
    console.error('⚠️ Error loading Bug Strike settings:', err);
  }

  startInput.value = currentSettings.starting;
  cooldownInput.value = currentSettings.cooldown;

  // 💾 Save updated settings
  applyBtn.addEventListener('click', async () => {
    try {
      await setDoc(settingsDocRef, {
        starting: Number(startInput.value),
        cooldown: Number(cooldownInput.value),
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert('✅ Bug Strike settings saved!');
    } catch (err) {
      console.error('❌ Failed to save Bug Strike settings:', err);
      alert('⚠️ Could not save settings. Check console for details.');
    }
  });

  // 🧩 Build live team table
  tbody.innerHTML = '';
  allTeams.forEach(team => {
    const safeId = team.name.replace(/\s+/g, '-');
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #333';
    tr.innerHTML = `
      <td>${team.name}</td>
      <td id="bugstrike-remaining-${safeId}">${currentSettings.starting}</td>
      <td id="bugstrike-last-${safeId}">--</td>
      <td>
        <button class="bugstrike-launch" data-team="${team.name}" class="${styles.launchButton}">💥 Launch</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 💥 Launch Bug Strike Handler
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.bugstrike-launch');
    if (!btn) return;

    const targetTeam = btn.dataset.team;
    const safeId = targetTeam.replace(/\s+/g, '-');
    const remainingEl = document.getElementById(`bugstrike-remaining-${safeId}`);
    const lastUsedEl = document.getElementById(`bugstrike-last-${safeId}`);

    let remaining = parseInt(remainingEl.textContent);
    if (remaining <= 0) {
      alert(`❌ ${targetTeam} has no Bug Strikes left!`);
      return;
    }

    if (!confirm(`Launch a Bug Strike on ${targetTeam}?`)) return;

    try {
      await addDoc(collection(db, 'communications'), {
        type: 'bugStrike',
        to: targetTeam,
        from: 'Game Master',
        message: `🪰 A Bug Strike has been unleashed on ${targetTeam}!`,
        isBroadcast: true,
        timestamp: serverTimestamp()
      });

      // 🕐 Update UI
      remaining -= 1;
      remainingEl.textContent = remaining;
      lastUsedEl.textContent = new Date().toLocaleTimeString();

      console.log(`💥 Bug Strike launched on ${targetTeam}`);
    } catch (err) {
      console.error('❌ Failed to launch Bug Strike:', err);
      alert('⚠️ Could not send Bug Strike.');
    }
  });
}