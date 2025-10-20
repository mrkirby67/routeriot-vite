// ============================================================================
// FILE: components/WildCardLauncher/WildCardLauncher.js
// PURPOSE: Player-side Wild Card launcher (Bug Strike + future power-ups)
// ============================================================================
import { db } from '../../modules/config.js';
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import styles from './WildCardLauncher.module.css';

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
            <th>Cooldown</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="wildcard-tbody">
          <!-- Rows will be rendered dynamically -->
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

  // Default list (future wildcards can be added easily)
  const defaultWildcards = [
    { type: 'bugStrike', icon: '🪰', label: 'Bug Strike', remaining: 3, cooldown: 30 }
  ];

  const cards = wildcards.length ? wildcards : defaultWildcards;

  // Render table
  tbody.innerHTML = '';
  cards.forEach(card => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${card.icon} ${card.label}</td>
      <td id="wildcard-${card.type}-remaining">${card.remaining}</td>
      <td id="wildcard-${card.type}-cooldown">Ready</td>
      <td>
        <button class="wildcard-launch" data-type="${card.type}">
          💥 Launch
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Handle Launch
  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.wildcard-launch');
    if (!btn) return;

    const type = btn.dataset.type;
    const remainingEl = document.getElementById(`wildcard-${type}-remaining`);
    let remaining = parseInt(remainingEl.textContent);

    if (remaining <= 0) {
      alert(`❌ No ${type} wildcards left!`);
      return;
    }

    const targetTeam = prompt('🎯 Enter target team name:');
    if (!targetTeam) return;

    if (!confirm(`Launch ${type} on ${targetTeam}?`)) return;

    try {
      await addDoc(collection(db, 'communications'), {
        type: 'wildcard',
        subtype: type,
        from: currentTeamName,
        to: targetTeam,
        message: `🔥 ${currentTeamName} has launched a ${type.toUpperCase()} on ${targetTeam}!`,
        timestamp: serverTimestamp()
      });

      remaining -= 1;
      remainingEl.textContent = remaining;
      document.getElementById(`wildcard-${type}-cooldown`).textContent = `${cards.find(c=>c.type===type).cooldown}m`;

      alert(`💥 ${type} launched on ${targetTeam}!`);
    } catch (err) {
      console.error('❌ Failed to launch wildcard:', err);
      alert('⚠️ Could not send wildcard.');
    }
  });
}