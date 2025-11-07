// ============================================================================
// FILE: features/team-surprise/speedBumpFlavor.js
// PURPOSE: Light-weight prompt bank for Speed Bump overlay flavor text.
// DEPENDS_ON: none
// USED_BY: ui/overlays/speedBumpOverlay.js
// AUTHOR: Route Riot – Speed Bump Refresh
// CREATED: 2025-10-31
// AICP_VERSION: 3.1
// ============================================================================

export const speedBumpFlavor = Object.freeze([
  "Your shocks just clocked out — enjoy the sudden flight.",
  "That thud you heard? Our friendship hitting a pothole.",
  "Consider this your impromptu launchpad to humiliation.",
  "We're upgrading your suspension to 'wishful thinking'.",
  "Oops, did the asphalt disappear again?",
  "We tuned this bump to 'spicy' — mind the sparks.",
  "Friendly reminder: gravity is optional around us.",
  "Pretty sure your tires just saw the afterlife."
]);

export function getRandomSpeedBumpFlavor() {
  if (!speedBumpFlavor.length) {
    return "This bump comes with extra flair.";
  }
  const index = Math.floor(Math.random() * speedBumpFlavor.length);
  return speedBumpFlavor[index] || speedBumpFlavor[0];
}

// === AICP FEATURE FOOTER ===
// ai_origin: features/team-surprise/speedBumpFlavor.js
// ai_role: Logic Layer
// aicp_category: feature
// aicp_version: 3.1
// codex_phase: tier2_features_injection
// export_bridge: ui
// exports: speedBumpFlavor, getRandomSpeedBumpFlavor
// linked_files: []
// owner: Route Riot-AICP
// phase: active
// review_status: pending_alignment
// status: beta
// sync_state: aligned
// === END AICP FEATURE FOOTER ===
