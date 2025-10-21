// ============================================================================
// MODULE: playerBugStrikeUI.js
// PURPOSE: Handle the on-screen chaos when a Bug Strike is launched
// AUTHOR: Route Riot Dev (James + ChatGPT 2025)
// ============================================================================

import { db } from './config.js';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// ⚙️ State
// ---------------------------------------------------------------------------
let bugStrikeActive = false;
let bugStrikeTimer = null;
let timeRemaining = 0;
let lastProcessedTime = 0;
let lastBugStrikeTime = 0; // ⏱️ Cooldown between Bug Strikes (ms)

// ---------------------------------------------------------------------------
// 🎯 Start listening for Bug Strike messages (for this team only)
// ---------------------------------------------------------------------------
export function initializeBugStrikeListener(teamName) {
  if (!teamName) {
    console.warn('⚠️ BugStrike listener not initialized: Missing teamName.');
    return;
  }

  const commRef = collection(db, 'communications');
  // Firestore needs a composite index here because we chain `where('to' == teamName)` and
  // `where('type' == 'bugStrike')` with `orderBy('timestamp', 'desc')`. Create it via
  // Firebase Console → Firestore Database → Indexes → Composite → collection `communications`,
  // fields: `to` Ascending, `type` Ascending, `timestamp` Descending.
  const q = query(
    commRef,
    where('to', '==', teamName),
    where('type', '==', 'bugStrike'),
    orderBy('timestamp', 'desc')
  );

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;

      const data = change.doc.data();
      const ts = data.timestamp?.seconds || 0;

      // Ignore old strikes and cooldown overlap
      if (ts <= lastProcessedTime) return;

      const now = Date.now();
      if (now - lastBugStrikeTime < 5000) {
        console.log('🛑 Ignored overlapping Bug Strike (5s cooldown)');
        return;
      }

      lastProcessedTime = ts;
      lastBugStrikeTime = now;

      console.log(`🪰 Bug Strike received for ${teamName}!`);
      triggerBugStrikeEffect(data.from);
    });
  });

  console.log(`📡 Listening for Bug Strikes for team: ${teamName}`);
}

// ---------------------------------------------------------------------------
// 💥 Trigger the full Bug Strike sequence
// ---------------------------------------------------------------------------
function triggerBugStrikeEffect(fromTeam) {
  if (bugStrikeActive) {
    console.log('🛑 Ignoring Bug Strike — one already active.');
    return;
  }
  bugStrikeActive = true;

  timeRemaining = 120; // seconds
  disableGameplayControls(true);

  // Overlay setup
  const overlay = createBugStrikeOverlay(fromTeam);
  document.body.appendChild(overlay);

  // Begin popup madness
  const popupInterval = setInterval(() => createRandomSplat(overlay), 300);

  // Countdown display
  bugStrikeTimer = setInterval(() => {
    timeRemaining--;
    updateCountdownDisplay(overlay);

    if (timeRemaining <= 0) {
      clearInterval(popupInterval);
      clearInterval(bugStrikeTimer);
      removeBugStrikeOverlay(overlay);
    }
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🧱 Overlay Creation
// ---------------------------------------------------------------------------
function createBugStrikeOverlay(fromTeam) {
  const overlay = document.createElement('div');
  overlay.id = 'bugstrike-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    color: white;
    font-family: 'Comic Sans MS', sans-serif;
    z-index: 9999;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    text-align: center;
  `;

  overlay.innerHTML = `
    <h1 style="font-size:3rem; color:#ffeb3b; text-shadow:2px 2px #000;">
      🪰 BUG STRIKE INCOMING! 🪰
    </h1>
    <p style="font-size:1.5rem; color:#f44336;">
      ${fromTeam ? `${fromTeam} just splatted you!` : 'You were hit!'}
    </p>
    <div id="bugstrike-countdown" style="
      font-size:2rem;
      font-weight:bold;
      margin-top:20px;
      color:#00e5ff;
    ">
      Time Remaining: 2:00
    </div>
  `;

  return overlay;
}

// ---------------------------------------------------------------------------
// 💦 Create Random Splat Popups
// ---------------------------------------------------------------------------
function createRandomSplat(container) {
  if (!container) return;
  const splat = document.createElement('div');
  splat.className = 'bugstrike-splat';
  splat.textContent = '💥 SPLAT!';
  splat.style.position = 'absolute';
  splat.style.left = Math.random() * 90 + 'vw';
  splat.style.top = Math.random() * 80 + 'vh';
  splat.style.fontSize = Math.random() * 20 + 20 + 'px';
  splat.style.color = randomColor();
  splat.style.opacity = '0';
  splat.style.transition = 'opacity 0.3s, transform 0.3s';
  splat.style.transform = 'scale(0.5) rotate(' + (Math.random() * 60 - 30) + 'deg)';
  splat.style.cursor = 'pointer';
  container.appendChild(splat);

  // Animate and remove
  setTimeout(() => {
    splat.style.opacity = '1';
    splat.style.transform = 'scale(1) rotate(' + (Math.random() * 60 - 30) + 'deg)';
  }, 10);

  // On click — SPLAT feedback and timer drain
  splat.addEventListener('click', () => {
    const splatSound = new Audio('/sounds/splat.mp3'); // optional sound
    splatSound.volume = 0.4;
    splatSound.play().catch(() => {}); // ignore autoplay errors
    splat.textContent = `💦 SPLAT! (${formatTime(timeRemaining)})`;
    timeRemaining = Math.max(0, timeRemaining - 1);
    splat.style.opacity = '0';
    setTimeout(() => splat.remove(), 300);
  });

  // Auto remove after 2.5s
  setTimeout(() => splat.remove(), 2500);
}

// ---------------------------------------------------------------------------
// ⏱️ Countdown Update
// ---------------------------------------------------------------------------
function updateCountdownDisplay(overlay) {
  const el = overlay.querySelector('#bugstrike-countdown');
  if (el) el.textContent = `Time Remaining: ${formatTime(timeRemaining)}`;
}

// ---------------------------------------------------------------------------
// 🧼 Overlay Cleanup
// ---------------------------------------------------------------------------
function removeBugStrikeOverlay(overlay) {
  if (!overlay) return;
  overlay.style.transition = 'opacity 1s ease-out';
  overlay.style.opacity = '0';
  setTimeout(() => {
    overlay.remove();
    bugStrikeActive = false;
    disableGameplayControls(false);
  }, 1000);
}

// ---------------------------------------------------------------------------
// 🚫 Disable gameplay controls while Bug Strike active
// ---------------------------------------------------------------------------
function disableGameplayControls(disabled) {
  const buttons = document.querySelectorAll('button, input, select, textarea');
  buttons.forEach(btn => {
    if (disabled) {
      btn.disabled = true;
      btn.style.filter = 'grayscale(0.8)';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.disabled = false;
      btn.style.filter = '';
      btn.style.cursor = '';
    }
  });
}

// ---------------------------------------------------------------------------
// 🎨 Helpers
// ---------------------------------------------------------------------------
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function randomColor() {
  const colors = ['#ff5252', '#ffeb3b', '#00e676', '#03a9f4', '#ff80ab'];
  return colors[Math.floor(Math.random() * colors.length)];
}
