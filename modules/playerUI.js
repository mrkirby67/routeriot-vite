// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, opponent last known locations, pause + game-over UI
// Standardized Firestore path: teamStatus/{teamName}
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
function fmtTime(ts) {
  if (!ts) return '';
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
  } catch {}
  return '';
}

// ---------------------------------------------------------------------------
// Exported: Timer update for Game Info
// ---------------------------------------------------------------------------
export function updatePlayerTimer(text) {
  const el = document.getElementById('timer-display');
  if (el) el.textContent = text || '--:--:--';
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
    (typeof teamInput === 'string' ? teamInput : (teamInput && teamInput.name) || 'Unknown Team');

  console.log('🎨 Initializing Player UI for:', resolvedTeamName);

  // 🏷️ Team Info
  const team = allTeams.find(t => t.name === resolvedTeamName);
  setText('team-name', team ? team.name : resolvedTeamName);
  setText('team-slogan', team?.slogan || 'Ready to race!');

  // 👥 Team Roster (live)
  const memberList = $('team-member-list');
  if (memberList) {
    const qy = query(collection(db, "racers"), where("team", "==", resolvedTeamName));
    onSnapshot(qy, (snapshot) => {
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

  // 🆚 Opponent Status & Messaging (uses standardized Firestore path)
  const opponentsTbody = $('opponents-tbody');
  if (opponentsTbody) {
    opponentsTbody.innerHTML = '';

    const opponents = allTeams.filter(t => t.name !== resolvedTeamName);
    opponents.forEach((opp) => {
      const safeName = opp.name.replace(/\s+/g, '-');
      const tr = document.createElement('tr');
      tr.id = `opp-row-${safeName}`;
      tr.innerHTML = `
        <td>${opp.name}</td>
        <td id="opp-loc-${safeName}">--</td>
        <td>
          <input id="msg-input-${safeName}" placeholder="Message ${opp.name}..." style="width:90%; margin-right:4px;">
          <button id="msg-send-${safeName}" class="send-btn" data-team="${opp.name}">Send</button>
        </td>`;
      opponentsTbody.appendChild(tr);

      // 🔥 Live listener for standardized teamStatus collection
      const teamRef = doc(db, "teamStatus", opp.name);
      onSnapshot(teamRef, (docSnap) => {
        const locCell = $(`opp-loc-${safeName}`);
        if (!locCell) return;
        if (!docSnap.exists()) {
          locCell.textContent = '--';
          return;
        }

        const data = docSnap.data();
        const zone = data.lastKnownLocation || '--';
        const timeStr = fmtTime(data.timestamp);
        locCell.textContent =
          zone !== '--'
            ? `📍 ${zone}${timeStr ? ` (updated ${timeStr})` : ''}`
            : '--';

        // brief flash
        locCell.style.background = '#f0c420';
        locCell.style.color = '#000';
        setTimeout(() => {
          locCell.style.background = '';
          locCell.style.color = '';
        }, 800);
      });
    });

    // 💬 Handle message send (chatManager-safe)
    opponentsTbody.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('send-btn')) {
        const teamTo = target.dataset.team;
        const safe = teamTo.replace(/\s+/g, '-');
        const input = $(`msg-input-${safe}`);
        const msg = input?.value?.trim();
        if (!msg) return;
        console.log(`📨 [Message to ${teamTo}] ${msg}`);
        input.value = '';

        try {
          if (typeof window.sendTeamMessage === 'function') {
            window.sendTeamMessage(teamTo, msg);
          } else if (window.chatManager && typeof window.chatManager.sendTeamMessage === 'function') {
            window.chatManager.sendTeamMessage(teamTo, msg);
          } else {
            console.warn('⚠️ No sendTeamMessage() available — message not sent.');
          }
        } catch (err) {
          console.error('💥 Error sending message:', err);
        }
      }
    });
  }
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
    </div>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.5rem', fontWeight: 'bold', zIndex: '5000',
    opacity: '0', transition: 'opacity 0.6s ease-in-out'
  });
  const styleTag = document.createElement('style');
  styleTag.textContent = `@keyframes pulse {0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.85;}}`;
  document.head.appendChild(styleTag);
  const msg = overlay.querySelector('.paused-message');
  if (msg) {
    msg.style.textAlign = 'center';
    msg.style.animation = 'pulse 1.5s infinite';
  }
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
    <canvas id="confetti-canvas"></canvas>`;
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.9)', color: '#fff',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontSize: '3rem', fontWeight: 'bold', zIndex: '6000',
    opacity: '0', transition: 'opacity 0.8s ease-in-out'
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => (overlay.style.opacity = '1'));
  startConfetti();
  setTimeout(stopConfetti, 7000);
}

// ---------------------------------------------------------------------------
// 🎉 Confetti Animation (sparkling + color-fade version)
// ---------------------------------------------------------------------------
let confettiActive = false;
let confettiPieces = [];
let confettiAnimation;

export function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;

  // --- Canvas setup
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '99998'
    });
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    'hsl(0, 100%, 60%)',   // red
    'hsl(30, 100%, 60%)',  // orange
    'hsl(60, 100%, 60%)',  // yellow
    'hsl(120, 100%, 60%)', // green
    'hsl(200, 100%, 60%)', // blue
    'hsl(280, 100%, 70%)'  // purple
  ];

  confettiPieces = Array.from({ length: 250 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: 4 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 1 + Math.random() * 3,
    opacity: 1,
    drift: (Math.random() - 0.5) * 1.5,
    hueShift: Math.random() * 360
  }));

  function draw() {
    if (!confettiActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confettiPieces.forEach((p) => {
      // 🌈 Hue shift sparkle effect
      p.hueShift = (p.hueShift + 2) % 360;
      const hueColor = `hsl(${p.hueShift}, 100%, 65%)`;

      // ✨ Fading shimmer
      p.opacity -= 0.002;
      if (p.opacity < 0.2) p.opacity = 1;

      ctx.fillStyle = hueColor;
      ctx.globalAlpha = p.opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Motion
      p.y += p.speed;
      p.x += p.drift;
      if (p.y > canvas.height) p.y = -10;
      if (p.x > canvas.width) p.x = 0;
      if (p.x < 0) p.x = canvas.width;
    });

    confettiAnimation = requestAnimationFrame(draw);
  }

  draw();
  console.log('🎆 Sparkling confetti started!');
}

export function stopConfetti() {
  if (!confettiActive) return;
  confettiActive = false;

  cancelAnimationFrame(confettiAnimation);
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) {
    canvas.style.transition = 'opacity 0.8s ease';
    canvas.style.opacity = '0';
    setTimeout(() => canvas.remove(), 1000);
  }
  console.log('✨ Confetti stopped.');
}
// ---------------------------------------------------------------------------
// Auto-init (only if loaded standalone)
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const teamName = getTeamNameFromUrl();
  if (teamName) initializePlayerUI(teamName);
});