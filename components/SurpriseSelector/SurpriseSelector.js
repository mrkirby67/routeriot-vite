// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SurpriseSelector/SurpriseSelector.js
// PURPOSE: export async function applyToAllTeams(selectedType, newCount = 0) {
// DEPENDS_ON: ../../data.js, ../../features/team-surprise/teamSurpriseController.js, ../../modules/utils.js, https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js, ../../modules/config.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './SurpriseSelector.module.css';
import { allTeams } from '../../data.js';
import {
  subscribeTeamSurprises,
  increment,
  decrement,
  SurpriseTypes,
  subscribeAllCooldowns, // New
} from '../../features/team-surprise/teamSurpriseController.js';
import { escapeHtml } from '../../modules/utils.js';
import { getDocs, collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from '../../modules/config.js';

/* Apply the selected wild-card values to every team in Firestore. */
export async function applyToAllTeams(selectedType, newCount = 0) {
  if (!selectedType) {
    alert('⚠️ No surprise type selected!');
    return;
  }

  const snap = await getDocs(collection(db, 'teamSurprises'));
  if (snap.empty) {
    alert('⚠️ No teams found in Firestore.');
    return;
  }

  const batch = writeBatch(db);
  const typesToUpdate =
    selectedType === 'ALL'
      ? TYPE_CONFIG.map(cfg => cfg.key)
      : [selectedType];

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const counts = { ...(data.counts || {}) };
    typesToUpdate.forEach(type => {
      counts[type] = newCount;
    });
    batch.set(doc(db, 'teamSurprises', docSnap.id), { counts }, { merge: true });
  });

  await batch.commit();

  const label = selectedType === 'ALL' ? 'All wildcards' : (TYPE_CONFIG.find(cfg => cfg.key === selectedType)?.label || selectedType);
  console.log(`✅ Applied ${label}:${newCount} to all teams.`);
  alert(`✅ ${label} updated for every team!`);
}

const TYPE_CONFIG = [
  { key: SurpriseTypes.FLAT_TIRE, label: 'Flat Tire' },
  { key: SurpriseTypes.BUG_SPLAT, label: 'Bug Splat' },
  { key: SurpriseTypes.SPEED_BUMP, label: 'Speed Bump' },
  { key: SurpriseTypes.WILD_CARD, label: 'Super SHIELD Wax' }
];

const COOLDOWN_DURATION_STORAGE_KEY = 'cooldownDuration';

let cleanupHandle = null;
let activeCooldowns = {}; // Local cache for cooldowns

export function SurpriseSelectorComponent() {
  return `
    <section class="${styles.surpriseSelector}">
      <h2>🎉 Team Wild Cards Dashboard</h2>
      <p class="${styles.subtitle}">
        Monitor and adjust each team’s surprise inventory in real time.
      </p>
      <div class="${styles.masterControls}">
        <div>
          <label for="wildcard-dashboard-type">Apply To All Teams:</label>
          <select id="wildcard-dashboard-type">
            <option value="ALL">All of Them</option>
            <option value="${SurpriseTypes.FLAT_TIRE}">Flat Tire</option>
            <option value="${SurpriseTypes.BUG_SPLAT}">Bug Splat</option>
            <option value="${SurpriseTypes.SPEED_BUMP}">Speed Bump</option>
            <option value="${SurpriseTypes.WILD_CARD}">Super SHIELD Wax</option>
          </select>
          <input id="wildcard-dashboard-input" type="number" min="0" value="1">
          <button type="button" id="wildcard-dashboard-apply">Apply to All Teams</button>
        </div>
        <div class="${styles.cooldownControl}">
          <label for="cooldown-duration-select">Global Cooldown:</label>
          <select id="cooldown-duration-select">
            <option value="5">5 Minutes</option>
            <option value="10">10 Minutes</option>
            <option value="15">15 Minutes</option>
            <option value="20">20 Minutes</option>
          </select>
        </div>
      </div>
      <table class="${styles.surpriseTable}">
        <thead>
          <tr>
            <th>Team</th>
            <th>Flat Tire</th>
            <th>Bug Splat</th>
            <th>Speed Bump</th>
            <th>Super SHIELD Wax</th>
            <th>Cooldown Timer</th>
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

  // Master controls for setting all wildcards
  const masterInput = document.getElementById('wildcard-dashboard-input');
  const masterTypeSelect = document.getElementById('wildcard-dashboard-type');
  const masterApplyBtn = document.getElementById('wildcard-dashboard-apply');
  if (masterTypeSelect) {
    masterTypeSelect.value = SurpriseTypes.WILD_CARD;
  }

  if (masterInput && masterApplyBtn && masterTypeSelect) {
    masterApplyBtn.addEventListener('click', async () => {
      const raw = Number.parseInt(masterInput.value, 10);
      if (!Number.isFinite(raw) || raw < 0) {
        alert('Please enter a non-negative number.');
        return;
      }
      const target = Math.floor(raw);
      const selectedType = masterTypeSelect.value || SurpriseTypes.WILD_CARD;
      masterApplyBtn.disabled = true;
      try {
        await applyToAllTeams(selectedType, target);
      } catch (err) {
        console.error('❌ Failed to apply wild cards to all teams:', err);
        alert('❌ Failed to update wild cards. Check console for details.');
      } finally {
        masterApplyBtn.disabled = false;
      }
    });
  }

  // Cooldown duration control
  const cooldownSelect = document.getElementById('cooldown-duration-select');
  if (cooldownSelect) {
    const savedDuration = localStorage.getItem(COOLDOWN_DURATION_STORAGE_KEY) || '5';
    cooldownSelect.value = savedDuration;
    cooldownSelect.addEventListener('change', () => {
      localStorage.setItem(COOLDOWN_DURATION_STORAGE_KEY, cooldownSelect.value);
    });
  }

  const handleClick = createClickHandler();
  tbody.addEventListener('click', handleClick);

  const unsubscribeSurprises = subscribeTeamSurprises((entries = [], byTeam = {}) => {
    const teamCounts = buildTeamCounts(entries, byTeam);
    renderTable(tbody, teamCounts);
  });

  const unsubscribeCooldowns = subscribeAllCooldowns((cooldowns) => {
    activeCooldowns = cooldowns;
    refreshCooldownTimers(tbody);
  });

  const timerId = window.setInterval(() => {
    refreshCooldownTimers(tbody);
  }, 1000);

  cleanupHandle = (reason = 'manual') => {
    unsubscribeSurprises?.();
    unsubscribeCooldowns?.();
    tbody.removeEventListener('click', handleClick);
    clearInterval(timerId);
    cleanupHandle = null;
    console.info(`🧹 [SurpriseSelector] cleaned up (${reason})`);
  };

  renderTable(tbody, new Map());
  refreshCooldownTimers(tbody);

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
    const shield = normalizeCount(counts[SurpriseTypes.WILD_CARD] ?? counts.superShieldWax ?? counts.wildCard);

    const hasShieldStock = shield > 0;
    row.className = hasShieldStock ? styles.hasStock : styles.noStock;

    row.innerHTML = `
      <td class="${styles.teamCell}">
        <strong>${escapeHtml(team.name)}</strong>
        <small>${escapeHtml(team.slogan || '')}</small>
      </td>
      ${TYPE_CONFIG.map(cfg => renderCounterCell(team.name, cfg, counts)).join('')}
      <td data-role="cooldown-timer">${renderCooldownTimer(team.name)}</td>
    `;

    fragment.appendChild(row);
  });

  tbody.replaceChildren(fragment);
}

function renderCounterCell(teamName, config, counts) {
  const { key, label } = config;
  let rawValue = counts?.[key];
  if (key === SurpriseTypes.WILD_CARD) {
    rawValue = counts?.[key] ?? counts?.superShieldWax;
  }
  const value = normalizeCount(rawValue);

  return `
    <td class="${styles.counterCell}">
      <div class="${styles.counterLabel}">${escapeHtml(label)}</div>
      <div class="${styles.counterControls}">
        <button type="button" data-action="decrement" data-team="${escapeHtml(teamName)}" data-type="${key}">−</button>
        <span>${value}</span>
        <button type="button" data-action="increment" data-team="${escapeHtml(teamName)}" data-type="${key}">+</button>
      </div>
    </td>
  `;
}

function renderCooldownTimer(teamName) {
  const expiresAt = activeCooldowns[teamName] || 0;
  const remaining = Math.max(0, expiresAt - Date.now());

  if (remaining > 0) {
    const seconds = Math.ceil(remaining / 1000);
    return `<span class="${styles.activeCooldown}">⏳ ${seconds}s</span>`;
  }
  return `<span class="${styles.inactiveCooldown}">—</span>`;
}

function refreshCooldownTimers(tbody) {
  tbody.querySelectorAll('tr[data-team]').forEach(row => {
    const teamName = row.dataset.team;
    const cell = row.querySelector('[data-role="cooldown-timer"]');
    if (!teamName || !cell) return;

    const expiresAt = activeCooldowns[teamName] || 0;
    const remaining = Math.max(0, expiresAt - Date.now());

    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      cell.innerHTML = `<span class="${styles.activeCooldown}">⏳ ${seconds}s</span>`;
    } else {
      cell.innerHTML = `<span class="${styles.inactiveCooldown}">—</span>`;
    }
  });
}

function normalizeCount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SurpriseSelector/SurpriseSelector.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: applyToAllTeams, SurpriseSelectorComponent, initializeSurpriseSelector, teardownSurpriseSelector
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
