// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, opponent last known locations, pause + game-over UI
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
  // Supports Firestore Timestamp, {seconds}, number(ms), or Date
  try {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
    if (ts instanceof Date) return ts.toLocaleTimeString();
  } catch (e) {}
  return '';
}

// ---------------------------------------------------------------------------
// Exported: update timer text in the Game Info section
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
  const team = allTeams.find(function (t) { return t.name === resolvedTeamName; });
  setText('team-name', team ? team.name : resolvedTeamName);
  setText('team-slogan', team && team.slogan ? team.slogan : 'Ready to race!');

  // 👥 Team Roster (live)
  const memberList = $('team-member-list');
  if (memberList) {
    const qy = query(collection(db, "racers"), where("team", "==", resolvedTeamName));
    onSnapshot(qy, function (snapshot) {
      memberList.innerHTML = '';
      if (snapshot.empty) {
        memberList.innerHTML = '<li>No racers assigned yet.</li>';
        return;
      }
      snapshot.forEach(function (docSnap) {
        const m = docSnap.data();
        const li = document.createElement('li');
        var info = '<strong>' + (m.name || 'Unnamed Racer') + '</strong>';
        if (m.cell) info += ' - 📱 ' + m.cell;
        if (m.email) info += ' - ✉️ ' + m.email;
        li.innerHTML = info;
        memberList.appendChild(li);
      });
    });
  }

  // 🆚 Opponent Status & Messaging (live Firestore updates)
  const opponentsTbody = $('opponents-tbody');
  if (opponentsTbody) {
    opponentsTbody.innerHTML = '';

    const opponents = allTeams.filter(function (t) { return t.name !== resolvedTeamName; });

    opponents.forEach(function (opp) {
      const safeName = opp.name.replace(/\s+/g, '-');
      const tr = document.createElement('tr');
      tr.id = 'opp-row-' + safeName;

      tr.innerHTML =
        '<td>' + opp.name + '</td>' +
        '<td id="opp-loc-' + safeName + '">--</td>' +
        '<td>' +
          '<input id="msg-input-' + safeName + '" placeholder="Message ' + opp.name + '..." style="width:90%; margin-right:4px;">' +
          '<button id="msg-send-' + safeName + '" class="send-btn" data-team="' + opp.name + '">Send</button>' +
        '</td>';

      opponentsTbody.appendChild(tr);

      // Listen to Firestore for each opponent's live lastKnownLocation
      const teamRef = doc(db, "teamStatus", opp.name);
      onSnapshot(teamRef, function (docSnap) {
        const locCell = $('opp-loc-' + safeName);
        if (!locCell) return;

        if (!docSnap.exists()) {
          locCell.textContent = '--';
          return;
        }

        const data = docSnap.data() || {};
        const zoneRaw = data.lastKnownLocation;
        const zone = (zoneRaw && String(zoneRaw).trim() !== '') ? zoneRaw : '--';
        const timeStr = fmtTime(data.timestamp);

        if (zone !== '--') {
          locCell.textContent = '📍 ' + zone + (timeStr ? ' (updated ' + timeStr + ')' : '');
        } else {
          locCell.textContent = '--';
        }

        // brief flash to highlight updates
        locCell.style.background = '#f0c420';
        locCell.style.color = '#000';
        setTimeout(function () {
          locCell.style.background = '';
          locCell.style.color = '';
        }, 800);
      });
    });

    // Send Message buttons (preserve chatManager integration)
    opponentsTbody.addEventListener('click', function (e) {
      const target = e.target;
      if (target && target.classList.contains('send-btn')) {
        const teamTo = target.getAttribute('data-team');
        const safe = teamTo.replace(/\s+/g, '-');
        const input = $('msg-input-' + safe);
        const msg = input && input.value ? input.value.trim() : '';
        if (!msg) return;

        console.log('📨 [Message to ' + teamTo + '] ' + msg);
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
  overlay.innerHTML = '<div class="paused-message">⏸️ Paused<br><small>Wait for host to resume...</small></div>';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontSize = '2.5rem';
  overlay.style.fontWeight = 'bold';
  overlay.style.zIndex = '5000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.6s ease-in-out';

  const styleTag = document.createElement('style');
  styleTag.textContent =
    '@keyframes pulse {0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.1);opacity:0.85;}}';
  document.head.appendChild(styleTag);

  const msg = overlay.querySelector('.paused-message');
  if (msg) {
    msg.style.textAlign = 'center';
    msg.style.animation = 'pulse 1.5s infinite';
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
}

export function hidePausedOverlay() {
  const overlay = $('paused-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 600);
  }
}

// ---------------------------------------------------------------------------
// 🏁 GAME OVER OVERLAY (with confetti)
// ---------------------------------------------------------------------------
export function showGameOverOverlay() {
  if ($('gameover-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'gameover-overlay';
  overlay.innerHTML =
    '<div class="finish-message">🏁 GAME OVER<br><small>Return to base!</small></div>' +
    '<canvas id="confetti-canvas"></canvas>';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0,0,0,0.9)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontSize = '3rem';
  overlay.style.fontWeight = 'bold';
  overlay.style.zIndex = '6000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.8s ease-in-out';

  document.body.appendChild(overlay);
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });

  startConfetti();
  setTimeout(stopConfetti, 7000);
}

// ---------------------------------------------------------------------------
// 🎉 Confetti Animation
// ---------------------------------------------------------------------------
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = [];
  for (var i = 0; i < 200; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: 5 + Math.random() * 5,
      color: 'hsl(' + (Math.random() * 360) + ', 100%, 60%)',
      speed: 2 + Math.random() * 3
    });
  }

  var running = true;
  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var j = 0; j < pieces.length; j++) {
      var p = pieces[j];
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
  window._confettiStop = function () { running = false; };
}
function stopConfetti() {
  if (window._confettiStop) window._confettiStop();
  const overlay = $('gameover-overlay');
  if (overlay) setTimeout(function () { overlay.remove(); }, 2500);
}

// ---------------------------------------------------------------------------
// Auto-init (only if loaded standalone)
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  const teamName = getTeamNameFromUrl();
  if (teamName) initializePlayerUI(teamName);
});