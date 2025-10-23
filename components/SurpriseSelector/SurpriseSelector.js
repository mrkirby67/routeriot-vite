// ============================================================================
// FILE: components/SurpriseSelector/SurpriseSelector.js
// PURPOSE: Surprise Selector control panel – manage surprise counts per team
// ============================================================================

import styles from './SurpriseSelector.module.css';
import { allTeams } from '../../data.js';
import {
  subscribeTeamSurprises,
  incrementSurprise,
  decrementSurprise,
  SurpriseTypes
} from '../../modules/teamSurpriseManager.js';
import { getActiveBump } from '../../modules/speedBumpManager.js';

const ACTIVE_TYPES = [SurpriseTypes.FLAT_TIRE, SurpriseTypes.BUG_SPLAT, SurpriseTypes.WILD_CARD];

let controllerInstance = null;

const SHIELD_DURATION_STORAGE_KEY = 'shieldDuration';
const DEFAULT_SHIELD_MINUTES = 15;

function clampShieldDuration(value) {
  if (!Number.isFinite(value)) return DEFAULT_SHIELD_MINUTES;
  return Math.min(60, Math.max(1, value));
}

function readShieldDurationMinutes() {
  if (typeof window === 'undefined') return DEFAULT_SHIELD_MINUTES;
  const stored = Number.parseInt(window.localStorage.getItem(SHIELD_DURATION_STORAGE_KEY), 10);
  if (!Number.isFinite(stored) || stored <= 0) return DEFAULT_SHIELD_MINUTES;
  return clampShieldDuration(stored);
}

let shieldDurationMinutes = readShieldDurationMinutes();

function getShieldDurationMinutes() {
  shieldDurationMinutes = readShieldDurationMinutes();
  return shieldDurationMinutes;
}

function setShieldDurationMinutes(nextValue) {
  const normalized = clampShieldDuration(nextValue);
  shieldDurationMinutes = normalized;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SHIELD_DURATION_STORAGE_KEY, String(normalized));
  }
  return normalized;
}

export function SurpriseSelectorComponent() {
  return `
    <div class="${styles.selectorSection}">
      <div class="${styles.headerRow}">
        <div>
          <h3>🎉 Surprise Selector</h3>
          <p class="${styles.subhead}">Track surprises awarded to each team and balance the chaos.</p>
        </div>
        <div class="${styles.legend}">
          <span class="${styles.legendBadge} ${styles.flatTire}">🚗 Flat Tire</span>
          <span class="${styles.legendBadge} ${styles.bugSplat}">🐞 Bug Splat</span>
          <span class="${styles.legendBadge} ${styles.shieldWax}">🛡️ Super SHIELD Wax</span>
        </div>
      </div>

      <div class="${styles.shieldDurationControl}">
        <label for="shield-duration-input">🛡️ Shield Wax Duration (min)</label>
        <input
          id="shield-duration-input"
          data-role="shield-duration-input"
          type="number"
          min="1"
          max="60"
          value="${getShieldDurationMinutes()}"
        />
      </div>

      <table class="${styles.dataTable}">
        <thead>
          <tr>
            <th>Team</th>
            <th>Flat Tire</th>
            <th>Bug Splat</th>
            <th>Super SHIELD Wax</th>
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="surprise-selector-body">
          <tr><td colspan="6" class="${styles.loading}">Loading surprise counts…</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function initializeSurpriseSelector() {
  controllerInstance?.destroy('reinitialize');
  controllerInstance = new SurpriseSelectorController();
  return controllerInstance.initialize();
}

export function teardownSurpriseSelector(reason = 'manual') {
  controllerInstance?.destroy(reason);
  controllerInstance = null;
}

class SurpriseSelectorController {
  constructor() {
    this.tableBody = null;
    this.unsubscribe = null;
    this.state = new Map();
    this.durationInput = null;
    this.onData = this.onData.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleDurationChange = this.handleDurationChange.bind(this);
  }

  initialize() {
    this.tableBody = document.getElementById('surprise-selector-body');
    if (!this.tableBody) {
      console.warn('⚠️ Surprise selector container missing.');
      return () => {};
    }
    this.tableBody.innerHTML = '';
    this.renderSkeleton();
    this.unsubscribe = subscribeTeamSurprises(this.onData);
    this.tableBody.addEventListener('click', this.handleClick);

    this.durationInput = document.querySelector('[data-role="shield-duration-input"]');
    if (this.durationInput) {
      this.durationInput.value = String(getShieldDurationMinutes());
      this.durationInput.addEventListener('change', this.handleDurationChange);
    }

    return (reason) => this.destroy(reason);
  }

  destroy(reason = 'manual') {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.tableBody?.removeEventListener('click', this.handleClick);
    this.tableBody = null;
    if (this.durationInput) {
      this.durationInput.removeEventListener('change', this.handleDurationChange);
      this.durationInput = null;
    }
    console.info(`🧹 [SurpriseSelector] destroyed (${reason})`);
  }

  onData(snapshot = []) {
    this.state.clear();
    snapshot.forEach(entry => {
      if (!entry?.teamName) return;
      this.state.set(entry.teamName, entry);
    });
    this.renderRows();
  }

  renderSkeleton() {
    const frag = document.createDocumentFragment();
    allTeams.forEach(team => {
      const tr = document.createElement('tr');
      tr.dataset.team = team.name;
      tr.innerHTML = `
        <td class="${styles.teamCell}">
          <strong>${team.name}</strong>
          <span>${team.slogan || ''}</span>
        </td>
        ${ACTIVE_TYPES.map(type => this.renderCounterCell(type)).join('')}
        <td class="${styles.totalCell}" data-role="total">0</td>
        <td class="${styles.statusCell}" data-role="status">—</td>
      `;
      frag.appendChild(tr);
    });
    this.tableBody.appendChild(frag);
  }

  renderRows() {
    if (!this.tableBody) return;
    allTeams.forEach(team => {
      const row = this.tableBody.querySelector(`tr[data-team="${team.name}"]`);
      if (!row) return;
      const entry = this.state.get(team.name) || {};
      let total = 0;
      ACTIVE_TYPES.forEach(type => {
        const cell = row.querySelector(`[data-role="counter-${type}"]`);
        const count = Number(entry?.counts?.[type] ?? 0);
        total += count;
        if (cell) {
          const valueEl = cell.querySelector('[data-role="value"]');
          if (valueEl) valueEl.textContent = String(count);
        }
      });
      const totalCell = row.querySelector('[data-role="total"]');
      if (totalCell) totalCell.textContent = String(total);
      const statusCell = row.querySelector('[data-role="status"]');
      if (statusCell) {
        const activeBump = getActiveBump(team.name);
        if (activeBump) {
          const statusLabel = activeBump.proofSentAt ? 'In Route' : 'Assigned';
          const statusClass = activeBump.proofSentAt ? styles.statusTagEnroute : styles.statusTagAssigned;
          statusCell.innerHTML = `
            <span class="${styles.statusTag} ${statusClass}">${escapeHtml(statusLabel)}</span>
            <span class="${styles.statusSubtext}">from ${escapeHtml(activeBump.by)}</span>
          `;
        } else {
          statusCell.innerHTML = `<span class="${styles.statusTag} ${styles.statusTagCleared}">Ready</span>`;
        }
      }
    });
  }

  renderCounterCell(type) {
    const icon = type === SurpriseTypes.FLAT_TIRE ? '🚗'
      : type === SurpriseTypes.BUG_SPLAT ? '🐞'
      : '🛡️';
    return `
      <td class="${styles.counterCell}" data-role="counter-${type}">
        <div class="${styles.counterLabel}">${icon}</div>
        <div class="${styles.counterControls}">
          <button type="button" class="${styles.counterBtn}" data-action="decrement" data-type="${type}">−</button>
          <span data-role="value">0</span>
          <button type="button" class="${styles.counterBtn}" data-action="increment" data-type="${type}">+</button>
        </div>
      </td>
    `;
  }

  handleClick(event) {
    const btn = event.target.closest(`.${styles.counterBtn}`);
    if (!btn) return;
    const row = btn.closest('tr[data-team]');
    const type = btn.dataset.type;
    const action = btn.dataset.action;
    if (!row || !type || !ACTIVE_TYPES.includes(type)) return;
    const teamName = row.dataset.team;
    if (action === 'increment') {
      incrementSurprise(teamName, type).catch(err => {
        console.error('❌ Failed to increment surprise:', err);
      });
    } else if (action === 'decrement') {
      decrementSurprise(teamName, type).catch(err => {
        console.error('❌ Failed to decrement surprise:', err);
      });
    }
  }

  handleDurationChange(event) {
    const next = Number.parseInt(event?.target?.value, 10);
    const normalized = setShieldDurationMinutes(Number.isFinite(next) ? next : DEFAULT_SHIELD_MINUTES);
    if (this.durationInput) {
      this.durationInput.value = String(normalized);
    }
    console.log(`🛡️ Shield duration set to ${normalized} minutes`);
  }
}
