// ============================================================================
// FILE: components/SpeedBumpControl/SpeedBumpControl.js
// PURPOSE: Markup + bootstrapper for the Speed Bump – Photo Challenge panel
// ============================================================================

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
        <button type="button" id="speedbump-shuffle-all" class="${styles.secondaryBtn}">🔁 Shuffle All Prompts</button>
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
