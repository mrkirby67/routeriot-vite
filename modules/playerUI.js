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

      const zone = (data.lastKnownLocation && String(data.lastKnownLocation).trim() !== '')
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
/**
 * ⏱️ Timer rendering helpers
 * - Prefer the inline element (#time-remaining) inside the "Game Info" section.
 * - ONLY create a floating fallback if the inline element truly does not exist.
 */
// ---------------------------------------------------------------------------

function ensureTimerDisplay() {
  // If the inline timer exists, do NOT create the floating one.
  if ($('time-remaining')) return;

  // If a floating timer already exists, nothing to do.
  if ($('player-timer')) return;

  // Create a floating fallback ONLY if inline is missing.
  const timerEl = document.createElement('div');
  timerEl.id = 'player-timer';
  timerEl.textContent = '--:--:--';
  timerEl.style.cssText = `
    position: fixed;
    bottom: 12px;
    right: 12px;
    background: rgba(0,0,0,0.75);
    color: #00ff90;
    padding: 8px 14px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 1.4em;
    letter-spacing: 1px;
    z-index: 2500;
    box-shadow: 0 0 6px rgba(0,255,144,0.5);
  `;
  document.body.appendChild(timerEl);
}

export function updatePlayerTimer(text) {
  const value = text ?? '--:--:--';
  const inline = $('time-remaining');

  // Always update the inline spot when it exists.
  if (inline) {
    inline.textContent = value;
    return;
  }

  // Otherwise, ensure and update the fallback.
  ensureTimerDisplay();
  const fallback = $('player-timer');
  if (fallback) fallback.textContent = value;
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