// ============================================================================
// FILE: modules/playerUI/core.js
// PURPOSE: Core player UI initialization + DOM helpers
// ============================================================================

import { db } from '../config.js';
import { allTeams } from '../../data.js';
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

  const team = allTeams.find(t => t.name === resolvedTeamName);
  setText('team-name', team ? team.name : resolvedTeamName);
  setText('team-slogan', team?.slogan || 'Ready to race!');

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

      const teamRef = doc(db, 'teamStatus', opp.name);
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

        locCell.style.background = '#f0c420';
        locCell.style.color = '#000';
        setTimeout(() => {
          locCell.style.background = '';
          locCell.style.color = '';
        }, 800);
      });
    });

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
