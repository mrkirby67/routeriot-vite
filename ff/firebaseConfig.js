// /ff/firebaseConfig.js
// Loads the Fastest Finger Firebase config from a runtime global populated by
// ff/ff-config.js (which should be ignored in git).

const CONFIG_GLOBAL_KEY = '__FF_FIREBASE_CONFIG__';
const FALLBACK_GLOBAL_KEY = '__ROUTE_RIOT_FIREBASE_CONFIG__';

function readGlobalConfig() {
  if (typeof window === 'undefined') return null;
  const direct = window[CONFIG_GLOBAL_KEY];
  if (direct) return direct;
  return window[FALLBACK_GLOBAL_KEY] || null;
}

const firebaseConfig = readGlobalConfig();

if (!firebaseConfig) {
  throw new Error(
    'Fastest Finger Firebase config missing. Ensure core/runtime-config.js sets window.__FF_FIREBASE_CONFIG__.'
  );
}

export { firebaseConfig };
