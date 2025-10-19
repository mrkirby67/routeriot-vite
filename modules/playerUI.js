// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, and last known location.
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection, query, where, doc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}
function flashPlayerLocation(text) {
  const el = document.getElementById('player-location');
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

  // 🏷️ Set static team info
  const team = allTeams.find(t => t.name === resolvedTeamName);
  setText('team-name', team?.name || resolvedTeamName);
  setText('team-slogan', team?.slogan || 'Ready to race!');
  console.log(`✅ Loaded team: ${team?.name || resolvedTeamName}`);

  // 👥 Real-time roster listener
  const memberList = $('team-member-list');
  if (memberList) {
    const q = query(collection(db, "racers"), where("team", "==", resolvedTeamName));
    onSnapshot(q, (snapshot) => {
      memberList.innerHTML = '';
      if (snapshot.empty) {
        memberList.innerHTML = '<li>No racers assigned to this team yet.</li>';
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
    }, err => console.error("❌ Error loading racers:", err));
  }

  // 📍 Real-time last known location listener
  const locationEl = $('player-location');
  if (locationEl) {
    const teamRef = doc(db, "teamStatus", resolvedTeamName);
    onSnapshot(teamRef, (docSnap) => {
      if (!docSnap.exists()) {
        locationEl.textContent = '📍 No location yet.';
        return;
      }
      const data = docSnap.data() || {};
      const zone = data.lastKnownLocation || 'Unknown zone';

      // Convert Firestore or Date object timestamps to readable format
      let timeStr = '';
      if (data.timestamp) {
        if (data.timestamp.seconds) {
          timeStr = new Date(data.timestamp.seconds * 1000).toLocaleTimeString();
        } else if (typeof data.timestamp === 'number') {
          timeStr = new Date(data.timestamp).toLocaleTimeString();
        } else if (data.timestamp.toDate) {
          timeStr = data.timestamp.toDate().toLocaleTimeString();
        }
      }

      flashPlayerLocation(`📍 ${zone}${timeStr ? ` (updated ${timeStr})` : ''}`);
    }, err => console.error("❌ Error reading teamStatus:", err));
  }
}

// ---------------------------------------------------------------------------
// Auto-init if player.html directly loads this script
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const teamName = getTeamNameFromUrl();
  if (teamName) initializePlayerUI(teamName);
});