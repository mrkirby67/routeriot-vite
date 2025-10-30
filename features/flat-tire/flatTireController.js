// features/flat-tire/flatTireController.js

/**
 * @file Controls the logic for the Flat Tire feature.
 * This will be the new home for logic from modules/flatTireUI.js and modules/flatTireManager.js
 */

import { showFlatTireOverlay, hideFlatTireOverlay } from "../../ui/overlays/FlatTireOverlay.js";

/**
 * Logic to handle when a player gets a flat tire.
 */
export function activateFlatTire() {
  console.log("Activating flat tire...");
  showFlatTireOverlay();
  // Additional logic for flat tire state management
}

/**
 * Logic to resolve a flat tire.
 */
export function resolveFlatTire() {
  console.log("Resolving flat tire...");
  hideFlatTireOverlay();
  // Additional logic for flat tire state management
}
