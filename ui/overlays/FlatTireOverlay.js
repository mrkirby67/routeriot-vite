// === AICP UI HEADER ===
// ============================================================================
// FILE: ui/overlays/FlatTireOverlay.js
// PURPOSE: Manages the UI overlay for the Flat Tire event.
// DEPENDS_ON: none
// USED_BY: none
// AUTHOR: James Kirby / Route Riot Project
// CREATED: 2025-10-30
// AICP_VERSION: 3.0
// ============================================================================
// === END AICP UI HEADER ===

// ui/overlays/FlatTireOverlay.js

/**
 * @file Manages the UI overlay for the Flat Tire event.
 */

/**
 * Shows the flat tire overlay.
 */
export function showFlatTireOverlay() {
  const overlay = document.getElementById("flat-tire-overlay"); // Assuming this exists
  if (overlay) {
    overlay.style.display = "block";
  }
}

/**
 * Hides the flat tire overlay.
 */
export function hideFlatTireOverlay() {
  const overlay = document.getElementById("flat-tire-overlay"); // Assuming this exists
  if (overlay) {
    overlay.style.display = "none";
  }
}

// === AICP UI FOOTER ===
// ai_origin: ui/overlays/FlatTireOverlay.js
// ai_role: Presentation Layer
// aicp_category: ui
// aicp_version: 3.0
// codex_phase: tier4_ui_injection
// export_bridge: components/*
// exports: showFlatTireOverlay, hideFlatTireOverlay
// linked_files: []
// owner: RouteRiot-AICP
// phase: tier4_ui_injection
// review_status: pending_alignment
// status: stable
// sync_state: aligned
// === END AICP UI FOOTER ===
