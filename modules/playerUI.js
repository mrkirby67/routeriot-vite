// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, and live countdown timer for players
// Author: Route Riot Control - 2025 (final merged build)
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection, query, where } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { listenForGameStatus } from './gameStateManager.js';

// ---------------------------------------------------------------------------
// Simple DOM helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

// ---------------------------------------------------------------------------
// Initialize Player UI
// ---------------------------------------------------------------------------
export function initializePlayerUI(teamName) {
  console.log('🎨 Initializing Player UI for team:', teamName);

  const team = allTeams.find(t => t.name === teamName) || {};

  // 🏷️ Team name + slogan
  setText('team-name', team.name || teamName);
  setText('team-slogan', team.slogan || 'Ready to race!');

  // 👥 Real-time roster listener
  const memberList = $('team-member-list');
  if (memberList) {
    // ⚠️ Firestore field fix: adjust to your actual field name
    const q = query(collection(db, "racers"), where("teamName", "==", teamName));
    onSnapshot(q, (snapshot) => {
      memberList.innerHTML = '';
      if (snapshot.empty) {
        memberList.innerHTML = '<li>No racers assigned to this team yet.</li>';
      } else {
        snapshot.forEach(docSnap => {
          const member = docSnap.data();
          const li = document.createElement('li');
          let info = `<strong>${member.name || 'Unnamed Racer'}</strong>`;
          if (member.cell) info += ` - 📱 ${member.cell}`;
          if (member.email) info += ` - ✉️ ${member.email}`;
          li.innerHTML = info;
          memberList.appendChild(li);
        });
      }
    }, (err) => console.error("❌ Error loading racers:", err));
  }

  // ⏱️ Time Remaining
  const timerEl = $('time-remaining');
  if (timerEl) {
    timerEl.textContent = '⏳ Waiting...';

    listenForGameStatus((state) => {
      if (!state) return;
      const { status, startTime, endTime } = state;

      if (status === 'waiting') {
        timerEl.textContent = 'Waiting for game start...';
        return;
      }

      if (status === 'active') {
        const start = startTime?.toMillis ? startTime.toMillis() : startTime || Date.now();
        // 🕒 If no endTime in Firestore, fallback to 30-minute round
        const end = endTime?.toMillis ? endTime.toMillis() : (start + 30 * 60 * 1000);
        console.log(`⏱️ Starting countdown: ${new Date(start).toLocaleTimeString()} → ${new Date(end).toLocaleTimeString()}`);
        startCountdown(timerEl, start, end);
        return;
      }

      if (status === 'finished' || status === 'ended') {
        timerEl.textContent = '🏁 Game Over!';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Countdown Timer Helper
// ---------------------------------------------------------------------------
function startCountdown(el, start, end) {
  if (!end || !start) {
    el.textContent = '⚠️ Timer unavailable';
    return;
  }

  let interval = null;

  const update = () => {
    const now = Date.now();
    const remaining = end - now;

    if (remaining <= 0) {
      el.textContent = '🏁 Time’s up!';
      clearInterval(interval);
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  update();
  interval = setInterval(update, 1000);
}