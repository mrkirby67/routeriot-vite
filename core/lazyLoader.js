// core/lazyLoader.js
// Centralizes dynamic imports for secondary bundles.
export async function loadTeamSurpriseUI() {
  const mod = await import('@/ui/team-surprise/teamSurpriseUI.js');
  return mod;
}
