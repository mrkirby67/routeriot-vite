// ============================================================================
// FILE: modules/playerUI/core.js
// PURPOSE: Core player UI initialization + DOM helpers
// ============================================================================

import { db } from '../config.js';
import { allTeams } from '../../data.js';
import { getZoneDisplayName } from '../zoneManager.js';
import { hidePausedOverlay, showResumeBanner } from './overlays.js';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function $(id) {
  return document.getElementById(id);
}

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

function formatCountdown(ms) {
  if (!Number.isFinite(ms)) return '--:--:--';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function updatePlayerTimer(text) {
  const el = document.getElementById('timer-display');
  if (el) el.textContent = text || '--:--:--';
}

export function getTeamNameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const teamName = params.get('teamName');
  return teamName ? decodeURIComponent(teamName) : null;
}

export function initializePlayerUI(teamInput) {
  const teamNameFromUrl = getTeamNameFromUrl();
  const resolvedTeamName =
    teamNameFromUrl ||
    (typeof teamInput === 'string' ? teamInput : (teamInput && teamInput.name) || 'Unknown Team');

  console.log('🎨 Initializing Player UI for:', resolvedTeamName);

  // Find team from allTeams to get slogan, but don't use it for opponent list
  const teamData = allTeams.find(t => t.name === resolvedTeamName);
  setText('team-name', teamData ? teamData.name : resolvedTeamName);
  setText('team-slogan', teamData?.slogan || 'Ready to race!');

  const memberList = $('team-member-list');
  if (memberList) {
    const qy = query(collection(db, 'racers'), where('team', '==', resolvedTeamName));
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

  const opponentsTbody = $('opponents-tbody');
  if (opponentsTbody) {
    const activeTeamsRef = doc(db, 'game', 'activeTeams');
    onSnapshot(activeTeamsRef, (docSnap) => {
      opponentsTbody.innerHTML = ''; // Clear table on each update

      if (!docSnap.exists()) {
        return;
      }

      const data = docSnap.data();
      const activeTeams = Array.isArray(data.list) ? data.list : [];
      const opponents = activeTeams.filter(teamName => teamName !== resolvedTeamName);

      opponents.forEach((oppName) => {
        const safeName = oppName.replace(/\s+/g, '-');
        const tr = document.createElement('tr');
        tr.id = `opp-row-${safeName}`;
        tr.dataset.team = oppName; // Add for easier selection
        tr.innerHTML = `
          <td>${oppName}</td>
          <td id="opp-loc-${safeName}">--</td>
          <td>
            <input id="msg-input-${safeName}" placeholder="Message ${oppName}..." style="width:90%; margin-right:4px;">
            <button id="msg-send-${safeName}" class="send-btn" data-team="${oppName}">Send</button>
          </td>`;
        opponentsTbody.appendChild(tr);

        const teamRef = doc(db, 'teamStatus', oppName);
        onSnapshot(teamRef, async (docSnap) => {
          const locCell = $(`opp-loc-${safeName}`);
          if (!locCell) return;
          if (!docSnap.exists()) {
            locCell.textContent = '--';
            return;
          }

          const data = docSnap.data();
          const zoneId = typeof data.lastKnownLocation === 'string'
            ? data.lastKnownLocation.trim()
            : '';
          const timeStr = fmtTime(data.timestamp);
          let zoneLabel = '--';
          if (zoneId) {
            try {
              zoneLabel = await getZoneDisplayName(zoneId);
            } catch (err) {
              console.warn('⚠️ Zone label fallback for', zoneId, err);
              zoneLabel = zoneId;
            }
          }
          locCell.textContent =
            zoneLabel !== '--'
              ? `📍 ${zoneLabel}${timeStr ? ` (updated ${timeStr})` : ''}`
              : '--';

          locCell.style.background = '#f0c420';
          locCell.style.color = '#000';
          setTimeout(() => {
            locCell.style.background = '';
            locCell.style.color = '';
          }, 800);
        });
      });
    });

    // Event delegation for send buttons
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

function startLocalTimer() {
  if (typeof window === 'undefined') return;

  const timerState = window.__rrTimerState || {};
  const gameState = window.__rrGameState || {};

  let endMs = Number.isFinite(timerState.endTime) ? timerState.endTime : null;
  if (!Number.isFinite(endMs) && typeof timerState.remainingMs === 'number') {
    endMs = Date.now() + timerState.remainingMs;
  }

  if (!Number.isFinite(endMs) && gameState?.endTime && typeof gameState.endTime.toMillis === 'function') {
    endMs = gameState.endTime.toMillis();
  } else if (!Number.isFinite(endMs) && typeof gameState?.endTime === 'number') {
    endMs = gameState.endTime;
  }

  if (!Number.isFinite(endMs) && typeof gameState?.remainingMs === 'number') {
    endMs = Date.now() + gameState.remainingMs;
  }

  if (!Number.isFinite(endMs)) return;
  const remaining = Math.max(0, endMs - Date.now());
  updatePlayerTimer(formatCountdown(remaining));
}

if (typeof window !== 'undefined') {
  window.addEventListener('gameResumed', () => {
    hidePausedOverlay();
    showResumeBanner();
    startLocalTimer();
  });
}
