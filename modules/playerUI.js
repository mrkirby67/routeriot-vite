// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, live countdown timer, and last location
// Author: Route Riot Control - 2025 (fixed timer flicker + pause support)
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection, query, where, doc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { listenForGameStatus } from './gameStateManager.js';

// ---------------------------------------------------------------------------
// Simple DOM helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

// ---------------------------------------------------------------------------
// Initialize Player UI
// ---------------------------------------------------------------------------
export function initializePlayerUI(teamInput) {
  console.log('🎨 Initializing Player UI with:', teamInput);

  // Normalize input (handles both string or object)
  const teamName =
    typeof teamInput === 'string'
      ? teamInput
      : teamInput?.name || teamInput?.team?.name || 'Unknown Team';

  // Load team info from data.js only
  const team = allTeams.find(t => t.name === teamName);
  const displayName = team?.name || teamName;
  const displaySlogan = team?.slogan || 'Ready to race!';

  // 🏷️ Team name + slogan
  setText('team-name', displayName);
  setText('team-slogan', displaySlogan);
  console.log(`✅ Team info set: ${displayName} — "${displaySlogan}"`);

  // 👥 Real-time roster listener (from Firestore)
  const memberList = $('team-member-list');
  if (memberList) {
    const q = query(collection(db, "racers"), where("team", "==", teamName));
    onSnapshot(
      q,
      (snapshot) => {
        memberList.innerHTML = '';
        if (snapshot.empty) {
          memberList.innerHTML = '<li>No racers assigned to this team yet.</li>';
          return;
        }
        snapshot.forEach(docSnap => {
          const member = docSnap.data();
          const li = document.createElement('li');
          let info = `<strong>${member.name || 'Unnamed Racer'}</strong>`;
          if (member.cell) info += ` - 📱 ${member.cell}`;
          if (member.email) info += ` - ✉️ ${member.email}`;
          li.innerHTML = info;
          memberList.appendChild(li);
        });
      },
      (err) => console.error("❌ Error loading racers:", err)
    );
  }

  // 📍 Real-time location listener (teamStatus collection)
  const locationEl = $('player-location');
  if (locationEl) {
    const teamRef = doc(db, "teamStatus", teamName);
    onSnapshot(teamRef, (docSnap) => {
      if (!docSnap.exists()) {
        locationEl.textContent = '📍 No location yet.';
        return;
      }

      const data = docSnap.data();
      const zone = data.lastKnownLocation || 'Unknown zone';
      const ts = data.timestamp;
      const timeStr = ts
        ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleTimeString()
        : '';

      // ✨ Flash highlight when location updates
      locationEl.textContent = `📍 ${zone}${timeStr ? ` (updated ${timeStr})` : ''}`;
      locationEl.classList.add('flash');
      setTimeout(() => locationEl.classList.remove('flash'), 800);
    }, (err) => console.error("❌ Error reading teamStatus:", err));
  }

  // ⏱️ Time Remaining
  const timerEl = $('time-remaining') || $('player-timer');
  if (timerEl) {
    timerEl.textContent = '⏳ Waiting...';

    listenForGameStatus((state) => {
      if (!state) return;
      const { status, startTime, endTime } = state;

      // 🕓 Waiting
      if (status === 'waiting') {
        if (countdownInterval) clearInterval(countdownInterval);
        timerEl.textContent = 'Waiting for game start...';
        return;
      }

      // ⏸️ Paused
      if (status === 'paused') {
        if (countdownInterval) clearInterval(countdownInterval);
        timerEl.textContent = '⏸️ Game paused';
        return;
      }

      // 🚀 Active
      if (status === 'active') {
        const start = startTime?.toMillis
          ? startTime.toMillis()
          : startTime || Date.now();

        const end = endTime?.toMillis
          ? endTime.toMillis()
          : start + 30 * 60 * 1000;

        console.log(`⏱️ Countdown: ${new Date(start).toLocaleTimeString()} → ${new Date(end).toLocaleTimeString()}`);
        startCountdown(timerEl, start, end);
        return;
      }

      // 🏁 Finished
      if (['finished', 'ended'].includes(status)) {
        if (countdownInterval) clearInterval(countdownInterval);
        timerEl.textContent = '🏁 Game Over!';
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Countdown Timer Helper (single-instance, anti-flicker)
// ---------------------------------------------------------------------------
let countdownInterval = null;
let currentEndTime = null;

function startCountdown(el, start, end) {
  if (!start || !end) {
    el.textContent = '⚠️ Timer unavailable';
    return;
  }

  // Prevent duplicate intervals
  if (countdownInterval) clearInterval(countdownInterval);

  currentEndTime = end;

  const update = () => {
    const now = Date.now();
    const remaining = currentEndTime - now;

    if (remaining <= 0) {
      el.textContent = '🏁 Time’s up!';
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    el.textContent = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  update();
  countdownInterval = setInterval(update, 1000);
}