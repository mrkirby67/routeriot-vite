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
