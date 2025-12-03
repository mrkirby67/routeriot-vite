// ============================================================================
// FILE: components/WildCards/WildCards.js
// PURPOSE: Initialize the Wild Cards collapsible controls on the control panel
// DEPENDS_ON: DOM structure from SurpriseSelectorComponent
// ============================================================================

export function initializeWildCardsCollapsible() {
  const toggleBtn = document.getElementById('toggle-wildcards-btn');
  const panel = document.getElementById('wildcards-section');

  if (!toggleBtn || !panel) return () => {};

  const applyState = (expanded) => {
    panel.style.display = expanded ? 'block' : 'none';
    toggleBtn.textContent = expanded ? 'Collapse ▲' : 'Expand ▼';
    toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    panel.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  };

  // Initialize to the current display state (defaults to collapsed via inline style)
  const initialExpanded = panel.style.display !== 'none';
  applyState(initialExpanded);

  const handleToggle = () => {
    const isExpanded = panel.style.display !== 'none';
    applyState(!isExpanded);
  };

  toggleBtn.addEventListener('click', handleToggle);

  return (reason = 'manual') => {
    try {
      toggleBtn.removeEventListener('click', handleToggle);
    } catch {}
  };
}

// === AICP COMPONENT FOOTER ===
// ai_origin: components/WildCards/WildCards.js
// ai_role: UI Layer
// aicp_category: component
// aicp_version: 1.0
// codex_phase: bugfix_collapsible
// export_bridge: components
// exports: initializeWildCardsCollapsible
// linked_files: []
// owner: Route Riot-AICP
// phase: bugfix_collapsible
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// ui_dependency: components
// === END AICP COMPONENT FOOTER ===
