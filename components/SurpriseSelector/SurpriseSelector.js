// ============================================================================
// FILE: components/SurpriseSelector/SurpriseSelector.js
// PURPOSE: Control dashboard for monitoring and adjusting team surprises
// ============================================================================

import styles from './SurpriseSelector.module.css';
import { allTeams } from '../../data.js';
import {
  subscribeTeamSurprises,
  increment,
  decrement,
  SurpriseTypes,
  getShieldTimeRemaining
} from '../../modules/teamSurpriseManager.js';
import { escapeHtml } from '../../modules/utils.js';
import { applyWildCardsToAllTeams } from '../../modules/controlActions.js';
import { db } from '../../modules/config.js';
import { doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const TYPE_CONFIG = [
  { key: SurpriseTypes.FLAT_TIRE, label: 'Flat Tire' },
  { key: SurpriseTypes.BUG_SPLAT, label: 'Bug Splat' },
  { key: SurpriseTypes.WILD_CARD, label: 'Super SHIELD Wax' }
];

const STATUS_FIELD_MAP = {
  [SurpriseTypes.FLAT_TIRE]: 'flatTireCount',
  [SurpriseTypes.BUG_SPLAT]: 'bugSplatCount',
  [SurpriseTypes.WILD_CARD]: 'shieldWaxCount'
};

let cleanupHandle = null;

export function SurpriseSelectorComponent() {
  return `
    <section class="${styles.surpriseSelector}">
      <h2>🎉 Team Wild Cards Dashboard</h2>
      <p class="${styles.subtitle}">
        Monitor and adjust each team’s surprise inventory in real time.
      </p>
      <div class="${styles.masterControls}">
        <label for="wildcard-dashboard-input">Set All Wild Cards to:</label>
        <input id="wildcard-dashboard-input" type="number" min="0" value="1">
        <button type="button" id="wildcard-dashboard-apply">Apply to All Teams</button>
      </div>
      <table class="${styles.surpriseTable}">
        <thead>
          <tr>
            <th>Team</th>
            <th>Flat Tire</th>
            <th>Bug Splat</th>
            <th>Super SHIELD Wax</th>
            <th>Shield Timer</th>
          </tr>
        </thead>
        <tbody id="surprise-table-body"></tbody>
      </table>
    </section>
  `;
}

export function initializeSurpriseSelector() {
  teardownSurpriseSelector('reinitialize');

  const tbody = document.getElementById('surprise-table-body');
  if (!tbody) {
    console.warn('⚠️ Surprise selector table body missing.');
    return () => {};
  }

  const masterInput = document.getElementById('wildcard-dashboard-input');
  const masterApplyBtn = document.getElementById('wildcard-dashboard-apply');
  let masterApplyHandler = null;

  if (masterInput && masterApplyBtn) {
    masterApplyHandler = async () => {
      const raw = Number.parseInt(masterInput.value, 10);
      if (!Number.isFinite(raw) || raw < 0) {
        alert('Please enter a non-negative number.');
        return;
      }
      const target = Math.floor(raw);
      masterApplyBtn.disabled = true;
      try {
        await applyWildCardsToAllTeams(target);
        alert(`✅ All teams set to ${target} wild card${target === 1 ? '' : 's'}.`);
      } catch (err) {
        console.error('❌ Failed to apply wild cards to all teams:', err);
        alert('❌ Failed to update wild cards. Check console for details.');
      } finally {
        masterApplyBtn.disabled = false;
      }
    };
    masterApplyBtn.addEventListener('click', masterApplyHandler);
  }

  const handleClick = createClickHandler();
  tbody.addEventListener('click', handleClick);

  const unsubscribe = subscribeTeamSurprises((entries = [], byTeam = {}) => {
    const teamCounts = buildTeamCounts(entries, byTeam);
    renderTable(tbody, teamCounts);
  });

  const timerId = window.setInterval(() => {
    refreshShieldTimers(tbody);
  }, 1000);

  cleanupHandle = (reason = 'manual') => {
    unsubscribe?.();
    tbody.removeEventListener('click', handleClick);
    clearInterval(timerId);
    if (masterApplyBtn && masterApplyHandler) {
      masterApplyBtn.removeEventListener('click', masterApplyHandler);
    }
    cleanupHandle = null;
    console.info(`🧹 [SurpriseSelector] cleaned up (${reason})`);
  };

  // Initial render so the table isn't empty while waiting for Firestore
  renderTable(tbody, new Map());
  refreshShieldTimers(tbody);

  return cleanupHandle;
}

export function teardownSurpriseSelector(reason = 'manual') {
  cleanupHandle?.(reason);
  cleanupHandle = null;
}

function createClickHandler() {
  return async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const team = button.dataset.team;
    const type = button.dataset.type;
    const action = button.dataset.action;

    if (!team || !type || !action) return;

    const delta = action === 'increment' ? 1 : action === 'decrement' ? -1 : 0;
    if (!delta) return;

    const valueSpan = button.closest(`.${styles.counterControls}`)?.querySelector('span');
    const current = Number.parseInt(valueSpan?.textContent || '0', 10) || 0;
    const next = Math.max(0, current + delta);
    if (next === current) return; // no change

    if (valueSpan) valueSpan.textContent = String(next);

    try {
      if (delta > 0) {
        await increment(team, type);
      } else {
        await decrement(team, type);
      }
      await syncTeamStatusCount(team, type, next);
    } catch (err) {
      if (valueSpan) valueSpan.textContent = String(current);
      console.error(`❌ Failed to ${action} surprise for ${team}/${type}:`, err);
      alert('Failed to update wild card count. See console for details.');
    }
  };
}

function buildTeamCounts(entries, byTeam) {
  const countsMap = new Map();

  if (byTeam && typeof byTeam === 'object') {
    Object.entries(byTeam).forEach(([teamName, counts]) => {
      countsMap.set(teamName, counts || {});
    });
  } else if (Array.isArray(entries)) {
    entries.forEach(entry => {
      countsMap.set(entry.teamName, entry.counts || {});
    });
  }

  return countsMap;
}

function renderTable(tbody, countsMap) {
  const fragment = document.createDocumentFragment();

  allTeams.forEach(team => {
    const row = document.createElement('tr');
    row.dataset.team = team.name;

    const counts = countsMap.get(team.name) || {};
    const flat = normalizeCount(counts[SurpriseTypes.FLAT_TIRE] ?? counts.flatTire);
    const bug = normalizeCount(counts[SurpriseTypes.BUG_SPLAT] ?? counts.bugSplat);
    const shield = normalizeCount(counts[SurpriseTypes.WILD_CARD] ?? counts.superShieldWax ?? counts.wildCard);

    const hasShieldStock = shield > 0;
    row.className = hasShieldStock ? styles.hasStock : styles.noStock;

    row.innerHTML = `
      <td class="${styles.teamCell}">
        <strong>${escapeHtml(team.name)}</strong>
        <small>${escapeHtml(team.slogan || '')}</small>
      </td>
      ${TYPE_CONFIG.map(cfg => renderCounterCell(team.name, cfg.key, counts)).join('')}
      <td data-role="shield-timer">${renderShieldTimer(team.name)}</td>
    `;

    fragment.appendChild(row);
  });

  tbody.replaceChildren(fragment);
}

function renderCounterCell(teamName, typeKey, counts) {
  const value = normalizeCount(counts?.[typeKey]);
  const label =
    typeKey === SurpriseTypes.WILD_CARD ? 'Super SHIELD Wax' :
    typeKey === SurpriseTypes.BUG_SPLAT ? 'Bug Splat' :
    'Flat Tire';

  return `
    <td class="${styles.counterCell}">
      <div class="${styles.counterLabel}">${escapeHtml(label)}</div>
      <div class="${styles.counterControls}">
        <button type="button" data-action="decrement" data-team="${escapeHtml(teamName)}" data-type="${typeKey}">−</button>
        <span>${value}</span>
        <button type="button" data-action="increment" data-team="${escapeHtml(teamName)}" data-type="${typeKey}">+</button>
      </div>
    </td>
  `;
}

function renderShieldTimer(teamName) {
  const remaining = getShieldTimeRemaining(teamName);
  if (remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    return `<span class="${styles.activeShield}">🛡️ ${seconds}s</span>`;
  }
  return `<span class="${styles.inactiveShield}">—</span>`;
}

function refreshShieldTimers(tbody) {
  tbody.querySelectorAll('tr[data-team]').forEach(row => {
    const teamName = row.dataset.team;
    const cell = row.querySelector('[data-role="shield-timer"]');
    if (!teamName || !cell) return;

    const remaining = getShieldTimeRemaining(teamName);
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      cell.innerHTML = `<span class="${styles.activeShield}">🛡️ ${seconds}s</span>`;
      row.className = styles.hasStock;
    } else {
      cell.innerHTML = `<span class="${styles.inactiveShield}">—</span>`;
      if (!row.classList.contains(styles.hasStock) && !row.classList.contains(styles.noStock)) {
        row.className = styles.noStock;
      }
    }
  });
}

function normalizeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

async function syncTeamStatusCount(teamName, typeKey, value) {
  const field = STATUS_FIELD_MAP[typeKey];
  if (!field || !teamName) return;

  const safeValue = Math.max(0, Number.parseInt(value, 10) || 0);
  const ref = doc(db, 'teamStatus', teamName);
  try {
    await updateDoc(ref, { [field]: safeValue });
  } catch (err) {
    if (err?.code === 'not-found') {
      try {
        await setDoc(ref, { [field]: safeValue }, { merge: true });
      } catch (innerErr) {
        console.error(`❌ Failed to upsert teamStatus for ${teamName}:`, innerErr);
      }
    } else {
      console.error(`❌ Failed to sync teamStatus ${field} for ${teamName}:`, err);
    }
  }
}
