// ============================================================================
// FILE: /modules/zonesUtils.js
// PURPOSE: Generic utility + visual helpers for all zone-related modules
// ============================================================================

/* ---------------------------------------------------------------------------
 * 🧩 DOM HELPERS
 * ------------------------------------------------------------------------ */

/*
 * Waits for an element with a given ID to appear in the DOM.
 * @param {string} id - Element ID to wait for.
 * @param {number} timeout - Max time (ms) to wait before rejecting.
 * @returns {Promise<HTMLElement>}
 */
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
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element #${id}`));
    }, timeout);
  });
}

/*
 * Visually flashes the player's current location message in the UI.
 * @param {string} text - Text to display (e.g., "📍 Zone 3 (updated 12:05pm)").
 */
export function flashPlayerLocation(text) {
  const el = document.getElementById('player-location');
  if (!el) return;

  el.textContent = text;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1000);
}

/* ---------------------------------------------------------------------------
 * 🏁 GAME START COUNTDOWN
 * ------------------------------------------------------------------------ */

/*
 * Displays a temporary full-screen countdown banner.
 * @param {string} message - Message to show (e.g., "3", "2", "GO!").
 * @param {string} color - Background color for the banner.
 */
export function showCountdownBanner(message, color = '#222') {
  let banner = document.getElementById('game-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'game-banner';
    Object.assign(banner.style, {
      position: 'fixed',
      top: '30%',
      left: '50%',
      transform: 'translateX(-50%)',
      background: color,
      color: 'white',
      padding: '30px 50px',
      borderRadius: '12px',
      fontSize: '3em',
      fontWeight: 'bold',
      textAlign: 'center',
      zIndex: '9999',
      boxShadow: '0 0 20px rgba(0,0,0,0.5)',
      transition: 'opacity 0.4s ease',
    });
    document.body.appendChild(banner);
  }

  banner.style.background = color;
  banner.textContent = message;
  banner.style.display = 'block';
  banner.style.opacity = '1';

  setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => (banner.style.display = 'none'), 400);
  }, 2000);
}

/*
 * Plays the animated 3-2-1-GO countdown and final "Race is ON!" banner.
 */
export async function playRaceStartSequence() {
  const steps = ['3', '2', '1', 'GO!'];
  for (const step of steps) {
    const color = step === 'GO!' ? '#2E7D32' : '#C62828';
    showCountdownBanner(step, color);
    await new Promise(r => setTimeout(r, 1000));
  }
  showCountdownBanner('🏁 The Race is ON! 🏁', '#1565C0');
}

/* ---------------------------------------------------------------------------
 * 📏 MATH HELPERS
 * ------------------------------------------------------------------------ */

/*
 * Calculates the distance in kilometers between two lat/lon coordinates.
 * Uses the Haversine formula.
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/* ---------------------------------------------------------------------------
 * 🧠 ANSWER VALIDATION
 * ------------------------------------------------------------------------ */

/*
 * Validates a player's submitted answer against the correct one.
 * @param {string|number|Array} playerAnswer - Player input.
 * @param {string|number|Array} correctAnswer - Correct answer from Firestore.
 * @param {string} type - Type of validation ('YES_NO', 'OPEN', 'NUMBER', etc.).
 * @returns {boolean} True if the answer matches.
 */
export function validateAnswer(playerAnswer, correctAnswer, type = 'OPEN') {
  if (playerAnswer === undefined || correctAnswer === undefined) return false;

  const pAns = String(playerAnswer).trim().toLowerCase();
  const cAns = String(correctAnswer).trim().toLowerCase();

  if (!pAns || !cAns) return false;

  switch (type.toUpperCase()) {
    case 'YES_NO':
    case 'TRUE_FALSE':
    case 'UP_DOWN': {
      const truthy = ['yes', 'y', 'true', 'up'];
      const falsy = ['no', 'n', 'false', 'down'];
      return (
        (truthy.includes(pAns) && truthy.includes(cAns)) ||
        (falsy.includes(pAns) && falsy.includes(cAns))
      );
    }

    case 'NUMBER': {
      const pNum = parseFloat(pAns);
      const cNum = parseFloat(cAns);
      if (isNaN(pNum) || isNaN(cNum)) return false;
      // Tolerance can be stored in questionData.numberTolerance if needed
      return Math.abs(pNum - cNum) < 0.0001;
    }

    case 'MULTIPLE_CHOICE': {
      return pAns === cAns;
    }

    case 'CSV': {
      const list = cAns.split(',').map(s => s.trim());
      return list.includes(pAns);
    }

    case 'COMPLETE':
    case 'OPEN': {
      // Flexible partial match — good for riddles or long phrases
      if (Array.isArray(correctAnswer)) {
        return correctAnswer.some(a => pAns.includes(String(a).trim().toLowerCase()));
      }
      return cAns.includes(pAns) || pAns.includes(cAns);
    }

    default:
      return pAns === cAns;
  }
}