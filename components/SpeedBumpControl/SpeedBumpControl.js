// === AICP COMPONENT HEADER ===
// ============================================================================
// FILE: components/SpeedBumpControl/SpeedBumpControl.js
// PURPOSE: === AI-CONTEXT-MAP ===
// DEPENDS_ON: components/SpeedBumpControl/speedBumpControlController.js
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP COMPONENT HEADER ===

import styles from './SpeedBumpControl.module.css';
import { createSpeedBumpControlController } from './speedBumpControlController.js';

let controllerInstance = null;

export function SpeedBumpControlComponent() {
  return `
    <div class="${styles.controlSection}">
      <div class="${styles.headerRow}">
        <div>
          <h2>Speed Bump – Photo Challenge</h2>
          <p class="${styles.subhead}">Manage and release speed bump challenges.</p>
        </div>
        <label class="${styles.overrideToggle}">
          <input type="checkbox" id="speedbump-admin-override" checked>
          <span>Admin override enabled</span>
        </label>
      </div>

      <div class="${styles.promptLegend}">
        <div class="${styles.legendControls}">
          <button type="button" id="speedbump-shuffle-all" class="${styles.secondaryBtn}">🔁 Shuffle</button>
          <button type="button" id="speedbump-save-prompts" class="${styles.secondaryBtn}">💾 Save Team Prompts</button>
        </div>
        <span class="${styles.legendNote}">⚠️ Release when you are sent a photo of the Speed Bump Photo Fix.</span>
      </div>

      <table class="${styles.dataTable}" id="speedbump-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Challenge Prompt</th>
            <th>Send / Release</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="speedbump-table-body">
          <tr>
            <td colspan="4" class="${styles.loading}">Loading teams…</td>
          </tr>
        </tbody>
      </table>

      <div class="${styles.challengeBankSection}">
        <div class="${styles.bankHeader}">
          <h3>📸 Speed Bump Challenge Bank</h3>
          <p class="${styles.bankHint}">Edit the live challenge bank below. Shuffles pull from this list.</p>
        </div>
        <div id="speedbump-bank-list" class="${styles.challengeList}">
          <div class="${styles.loading}">Loading challenge bank…</div>
        </div>
        <div class="${styles.bankControls}">
          <button type="button" id="speedbump-bank-add" class="${styles.secondaryBtn}">➕ Add New Challenge</button>
          <button type="button" id="speedbump-save-bank" class="${styles.primaryBtn}">💾 Save Speed Bump Bank</button>
        </div>
        <div id="speedbump-bank-status" class="${styles.bankStatus}" role="status" aria-live="polite"></div>
      </div>
    </div>
  `;
}

export async function initializeSpeedBumpControl() {
  controllerInstance?.destroy('reinitialize');
  controllerInstance = createSpeedBumpControlController();
  return controllerInstance.initialize();
}

export function teardownSpeedBumpControl(reason = 'manual') {
  controllerInstance?.destroy(reason);
  controllerInstance = null;
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/SpeedBumpControl/SpeedBumpControl.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 3.0
// codex_phase: tier3_components_injection
// export_bridge: services/*
// exports: SpeedBumpControlComponent, initializeSpeedBumpControl, teardownSpeedBumpControl
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier3_components_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: features/*
// === END AICP COMPONENT FOOTER ===
