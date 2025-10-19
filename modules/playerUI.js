// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, location, inline live timer, pause + game-over UI
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import {
  onSnapshot,
  collection,
  query,
  where,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// DOM Helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}
function flashPlayerLocation(text) {
  const el = $('player-location');
  if (!el) return;
  el.textContent = text;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 800);
}

// ---------------------------------------------------------------------------
// Get teamName from URL (?teamName=)
// ---------------------------------------------------------------------------
function getTeamNameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const teamName = params.get('teamName');
  return teamName ? decodeURIComponent(teamName) : null;
}

// ---------------------------------------------------------------------------
// Initialize Player UI
// ---------------------------------------------------------------------------
export function initializePlayerUI(teamInput) {
  const teamNameFromUrl = getTeamNameFromUrl();
  const resolvedTeamName =
    teamNameFromUrl ||
    (typeof teamInput === 'string' ? teamInput : teamInput?.name || 'Unknown Team');

  console.log('🎨 Initializing Player UI for:', resolvedTeamName);

  // 🏷️ Team Info
  const team = allTeams.find(t => t.name === resolvedTeamName);
  setText('team-name', team?.name || resolvedTeamName);
  setText('team-slogan', team?.slogan || 'Ready to race!');
  initializeInlineTimer(); // ensure inline timer exists immediately

  // 👥 Team Roster (live)
  const memberList = $('team-member-list');
  if (memberList) {
    const q = query(collection(db, "racers"), where("team", "==", resolvedTeamName));
    onSnapshot(q, (snapshot) => {
      memberList.innerHTML = '';
      if (snapshot.empty) {
        memberList.innerHTML = '<li>No racers assigned yet.</li>';
        return;
      }
      snapshot.forEach(docSnap => {
        const m = docSnap.data();
        const li = document.createElement('li');
        let info = `<strong>${m.name || 'Unnamed Racer'}</strong>`;
        if (m.cell) info += ` - 📱 ${m.cell}`;
        if (m.email) info += ` - ✉️ ${m.email}`;
        li.innerHTML = info;
        memberList.appendChild(li);
      });
    });
  }

  // 📍 Live Location Tracking
  const locationEl = $('player-location');
  if (locationEl) {
    const teamRef = doc(db, "teamStatus", resolvedTeamName);
    onSnapshot(teamRef, (docSnap) => {
      if (!docSnap.exists()) {
        locationEl.textContent = '📍 No location yet.';
        return;
      }
      const data = docSnap.data() || {};

      const zone = (data.lastKnownLocation && data.lastKnownLocation.trim() !== '')
        ? data.lastKnownLocation
        : 'No location yet';

      let timeStr = '';
      if (data.timestamp) {
        if (data.timestamp.seconds)
          timeStr = new Date(data.timestamp.seconds * 1000).toLocaleTimeString();
        else if (typeof data.timestamp === 'number')
          timeStr = new Date(data.timestamp).toLocaleTimeString();
        else if (data.timestamp.toDate)
          timeStr = data.timestamp.toDate().toLocaleTimeString();
      }

      const display = zone === 'No location yet'
        ? '📍 No location yet.'
        : `📍 ${zone}${timeStr ? ` (updated ${timeStr})` : ''}`;

      flashPlayerLocation(display);
    });
  }
}

// ---------------------------------------------------------------------------
// ⏱️ INLINE TIMER DISPLAY (inserted properly in Game Info section)
// ---------------------------------------------------------------------------
export function initializeInlineTimer(retries = 10) {
  // if already exists, just reset it
  const inline = document.getElementById('time-remaining');
  if (inline) {
    inline.textContent = '--:--:--';
    return;
  }

  // find the Game Info container
  const gameInfo = document.querySelector('#game-info');
  if (!gameInfo) {
    // if not yet rendered, retry in 200ms (max 10 times)
    if (retries > 0) {
      setTimeout(() => initializeInlineTimer(retries - 1), 200);
    } else {
      console.warn('⚠️ Could not find #game-info after multiple retries — adding timer at top of page');
      const timerLine = document.createElement('div');
      timerLine.innerHTML = `<strong>Time Remaining:</strong> <span id="time-remaining">--:--:--</span>`;
      document.body.prepend(timerLine);
    }
    return;
  }

  // create the timer line inside the Game Info section
  const timerLine = document.createElement('div');
  timerLine.innerHTML = `<strong>Time Remaining:</strong> <span id="time-remaining">--:--:--</span>`;
  // ✅ ensure it appears just after the Status line
  const statusEl = gameInfo.querySelector('#status-line') || gameInfo.firstChild;
  if (statusEl && statusEl.nextSibling) {
    gameInfo.insertBefore(timerLine, statusEl.nextSibling);
  } else {
    gameInfo.append(timerLine);
  }
}

// ---------------------------------------------------------------------------
// 🔄 UPDATE INLINE TIMER (used by player.js)
// ---------------------------------------------------------------------------
export function updatePlayerTimer(text) {
  let inline = document.getElementById('time-remaining');
  if (!inline) initializeInlineTimer(); // if not ready yet, try again
  inline = document.getElementById('time-remaining');
  if (inline) inline.textContent = text || '--:--:--';
}

// ---------------------------------------------------------------------------
// 🎬 PAUSE OVERLAY
// ---------------------------------------------------------------------------
export function showPausedOverlay() {
  if ($('paused-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'paused-overlay';
  overlay.innerHTML = `
    <div class="paused-message">
      ⏸️ Paused<br><small>Wait for host to resume...</small>
    </div>
  `;
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem',
    fontWeight: 'bold',
    zIndex: '5000',
    opacity: '0',
    transition: 'opacity 0.6s ease-in-out',
  });

  const msg = overlay.querySelector('.paused-message');
  msg.style.textAlign = 'center';
  msg.style.animation = 'pulse 1.5s infinite';
  msg.querySelector('small').style.fontSize = '1.1rem';
  msg.querySelector('small').style.opacity = '0.8';

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.85; }
    }
  `;
  document.head.appendChild(styleTag);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
}

export function hidePausedOverlay() {
  const overlay = $('paused-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 600);
  }
}

// ---------------------------------------------------------------------------
// 🏁 GAME OVER OVERLAY (with confetti)
// ---------------------------------------------------------------------------
export function showGameOverOverlay() {
  if ($('gameover-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  overlay.innerHTML = `
    <div class="finish-message">🏁 GAME OVER<br><small>Return to base!</small></div>
    <canvas id="confetti-canvas"></canvas>
  `;
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0', left: '0', width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.9)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    fontWeight: 'bold',
    zIndex: '6000',
    opacity: '0',
    transition: 'opacity 0.8s ease-in-out',
  });

  const msg = overlay.querySelector('.finish-message');
  msg.style.textAlign = 'center';
  msg.style.animation = 'pulse 1.6s infinite';
  msg.querySelector('small').style.fontSize = '1.2rem';
  msg.querySelector('small').style.opacity = '0.8';

  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));

  startConfetti();
  setTimeout(() => stopConfetti(), 7000);
}

// ---------------------------------------------------------------------------
// 🎉 Confetti Animation
// ---------------------------------------------------------------------------
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = new Array(200).fill().map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: 5 + Math.random() * 5,
    color: `hsl(${Math.random() * 360}, 100%, 60%)`,
    speed: 2 + Math.random() * 3,
  }));

  let running = true;
  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed;
      if (p.y > canvas.height) p.y = -10;
    }
    requestAnimationFrame(draw);
  }
  draw();
  window._confettiStop = () => (running = false);
}

function stopConfetti() {
  window._confettiStop?.();
  const overlay = $('gameover-overlay');
  if (overlay) setTimeout(() => overlay.remove(), 2500);
}

// ---------------------------------------------------------------------------
// Auto-init (only if loaded standalone)
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const teamName = getTeamNameFromUrl();
  if (teamName) initializePlayerUI(teamName);
});