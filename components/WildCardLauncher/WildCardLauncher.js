// ============================================================================
// FILE: components/WildCardLauncher/WildCardLauncher.js
// PURPOSE: Player-side Wild Card launcher (Bug Strike + future power-ups)
// Now reacts to game state (pause/active/finished) and supports cooldown logic
// ============================================================================
import { db } from '../../modules/config.js';
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import styles from './WildCardLauncher.module.css';

// ============================================================================
// 🔹 Internal State
// ============================================================================
let wildCardButtons = [];
let wildCardCooldowns = {}; // { type: timestampUntilReady }

// ============================================================================
// 🧱 COMPONENT MARKUP
// ============================================================================
export function WildCardLauncherComponent() {
  return `
    <div class="${styles.launcherSection}">
      <h3>🎮 Wild Card Launcher</h3>
      <table class="${styles.launcherTable}">
        <thead>
          <tr>
            <th>Wildcard</th>
            <th>Remaining</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="wildcard-tbody">
          <!-- Rows rendered dynamically -->
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================================
// 🚀 INITIALIZER
// ============================================================================
export function initializeWildCardLauncher(currentTeamName, wildcards = []) {
  const tbody = document.getElementById('wildcard-tbody');
  if (!tbody) return;

  // Default wildcards (expandable)
  const defaultWildcards = [
    { type: 'bugStrike', icon: '🪰', label: 'Bug Strike', remaining: 3, cooldown: 30 } // minutes
  ];

  const cards = wildcards.length ? wildcards : defaultWildcards;
  wildCardButtons = [];

  tbody.innerHTML = '';
  cards.forEach(card => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${card.icon} ${card.label}</td>
      <td id="wildcard-${card.type}-remaining">${card.remaining}</td>
      <td id="wildcard-${card.type}-cooldown">Ready</td>
      <td>
        <button class="wildcard-btn" data-type="${card.type}">
          💥 Launch
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Collect buttons for global enable/disable
  wildCardButtons = Array.from(document.querySelectorAll('.wildcard-btn'));

  // Handle Launch
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.wildcard-btn');
    if (!btn) return;
    if (btn.disabled) {
      alert('⏳ Wildcards temporarily unavailable.');
      return;
    }

    const type = btn.dataset.type;
    const remainingEl = document.getElementById(`wildcard-${type}-remaining`);
    const cooldownEl = document.getElementById(`wildcard-${type}-cooldown`);
    let remaining = parseInt(remainingEl.textContent);

    if (remaining <= 0) {
      alert(`❌ No ${type} wildcards left!`);
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (wildCardCooldowns[type] && wildCardCooldowns[type] > now) {
      const minsLeft = Math.ceil((wildCardCooldowns[type] - now) / 60000);
      alert(`⏱️ ${type} will be ready in ${minsLeft} minute(s).`);
      return;
    }

    const targetTeam = prompt('🎯 Enter target team name:');
    if (!targetTeam) return;

    if (!confirm(`Launch ${type} on ${targetTeam}?`)) return;

    try {
      await addDoc(collection(db, 'communications'), {
        teamName: currentTeamName,
        sender: currentTeamName,
        senderDisplay: currentTeamName,
        type: 'wildcard',
        subtype: type,
        from: currentTeamName,
        to: targetTeam,
        message: `🔥 ${currentTeamName} launched a ${type.toUpperCase()} on ${targetTeam}!`,
        timestamp: serverTimestamp()
      });

      // Update counters
      remaining -= 1;
      remainingEl.textContent = remaining;

      // Cooldown tracking
      const cooldownMins = cards.find(c => c.type === type)?.cooldown || 30;
      const readyAt = now + cooldownMins * 60 * 1000;
      wildCardCooldowns[type] = readyAt;
      cooldownEl.textContent = `Cooldown: ${cooldownMins}m`;

      // Visual feedback
      btn.disabled = true;
      btn.style.opacity = '0.6';
      alert(`💥 ${type} launched on ${targetTeam}! Cooldown started.`);

      // Restore after cooldown expires
      setTimeout(() => {
        if (parseInt(remainingEl.textContent) > 0) {
          cooldownEl.textContent = 'Ready';
          btn.disabled = false;
          btn.style.opacity = '1';
        } else {
          cooldownEl.textContent = 'Depleted';
        }
      }, cooldownMins * 60 * 1000);
    } catch (err) {
      console.error('❌ Failed to launch wildcard:', err);
      alert('⚠️ Could not send wildcard.');
    }
  });
}

// ============================================================================
// 🔒 ENABLE / DISABLE CONTROLS (called by gameStateManager)
// ============================================================================
export function setWildCardEnabled(isEnabled) {
  wildCardButtons.forEach(btn => {
    btn.disabled = !isEnabled;
    btn.style.opacity = isEnabled ? '1' : '0.5';
    btn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
  });

  // Tooltip or visual hint (optional)
  const statusLabel = isEnabled ? 'Ready' : 'Unavailable';
  document.querySelectorAll('[id^="wildcard-"][id$="-cooldown"]').forEach(el => {
    if (!isEnabled) el.textContent = 'Paused';
    else if (el.textContent === 'Paused') el.textContent = statusLabel;
  });

  console.log(`🎮 Wildcards ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
}
