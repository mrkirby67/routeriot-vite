// ============================================================================
// File: /modules/zonesUtils.js
// Purpose: Generic utility + visual helpers for zones module
// ============================================================================

/* ---------------------------------------------------------------------------
 * DOM HELPERS
 * ------------------------------------------------------------------------ */
export function waitForElement(id, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const el = document.getElementById(id);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.getElementById(id);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => reject(`Timeout waiting for #${id}`), timeout);
  });
}

export function flashPlayerLocation(text) {
  const el = document.getElementById('player-location');
  if (!el) return;
  el.textContent = text;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 800);
}

/* ---------------------------------------------------------------------------
 * GAME START COUNTDOWN
 * ------------------------------------------------------------------------ */
export function showCountdownBanner(message, color = '#222') {
  let banner = document.getElementById('game-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'game-banner';
    banner.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: ${color};
      color: white;
      padding: 30px 50px;
      border-radius: 12px;
      font-size: 3em;
      font-weight: bold;
      text-align: center;
      z-index: 9999;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(banner);
  }
  banner.style.background = color;
  banner.textContent = message;
  banner.style.display = 'block';
  setTimeout(() => (banner.style.display = 'none'), 2000);
}

export async function playRaceStartSequence() {
  const steps = ['3', '2', '1', 'GO!'];
  for (let i = 0; i < steps.length; i++) {
    const color = steps[i] === 'GO!' ? '#2E7D32' : '#C62828';
    showCountdownBanner(steps[i], color);
    await new Promise((r) => setTimeout(r, 1000));
  }
  showCountdownBanner('🏁 The Race is ON! 🏁', '#1565C0');
}

/* ---------------------------------------------------------------------------
 * MATH HELPERS
 * ------------------------------------------------------------------------ */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    (1 - Math.cos(dLon)) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/* ---------------------------------------------------------------------------
 * ANSWER VALIDATION
 * ------------------------------------------------------------------------ */
export function validateAnswer(playerAnswer, correctAnswer, type) {
  const pAns = playerAnswer.toLowerCase().trim();
  const cAns = (correctAnswer || '').toLowerCase().trim();
  switch ((type || 'OPEN').toUpperCase()) {
    case 'SET':
    case 'YES': case 'Y': case 'TRUE':
    case 'NO': case 'N': case 'FALSE':
      return pAns === cAns;
    case 'CSV':
      return cAns.split(',').map(s => s.trim()).includes(pAns);
    default:
      return pAns.length > 0;
  }
}
