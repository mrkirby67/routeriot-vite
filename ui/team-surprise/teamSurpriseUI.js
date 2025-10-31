// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/team-surprise/teamSurpriseUI.js
// PURPOSE: UI helpers for shield confirmation flows in Team Surprise actions.
// DEPENDS_ON: ../../features/team-surprise/teamSurpriseEvents.js
// USED_BY: features/team-surprise/teamSurpriseController.js
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP UI HEADER ===

import { isShieldActive, deactivateShield } from '../../features/team-surprise/teamSurpriseEvents.js';

// === BEGIN RECOVERED BLOCK ===
export function checkShieldBeforeAttack(teamName, onProceed) {
  if (typeof onProceed !== 'function') return Promise.resolve(null);

  const execute = () => Promise.resolve(onProceed());

  if (!teamName || !isShieldActive(teamName)) {
    return execute();
  }

  if (typeof document === 'undefined') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        '🧼 Now why would you get that new polish tarnished with those dirty deeds? Proceeding will cancel your shield.'
      );
      if (!confirmed) {
        return Promise.resolve({ ok: false, reason: 'shield_cancelled' });
      }
      deactivateShield(teamName);
      return execute();
    }
    deactivateShield(teamName);
    return execute();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('.shield-confirm');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'shield-confirm';
    modal.innerHTML = `
      <div class="modal-content">
        <p>🧼 Now why would you get that new polish tarnished with those dirty deeds?</p>
        <p>If you proceed you cancel your shield.</p>
        <div class="modal-actions">
          <button type="button" id="cancelAttack">Cancel</button>
          <button type="button" id="proceedAttack">Proceed Anyway</button>
        </div>
      </div>
    `;

    const cleanup = () => modal?.remove();
    const handleCancel = () => {
      cleanup();
      resolve({ ok: false, reason: 'shield_cancelled' });
    };
    const handleProceed = () => {
      cleanup();
      deactivateShield(teamName);
      execute().then(resolve).catch(reject);
    };

    modal.querySelector('#cancelAttack')?.addEventListener('click', handleCancel, { once: true });
    modal.querySelector('#proceedAttack')?.addEventListener('click', handleProceed, { once: true });

    document.body.appendChild(modal);
  });
}
// === END RECOVERED BLOCK ===

// === AICP UI FOOTER ===
// aicp_category: ui
// ai_origin: ui/team-surprise/teamSurpriseUI.js
// ai_role: Presentation Layer
// codex_phase: tier4_ui_injection
// export_bridge: components/*
// exports: checkShieldBeforeAttack
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
