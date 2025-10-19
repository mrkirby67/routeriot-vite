// ============================================================================
// File: modules/playerUI.js
// Purpose: Displays team info, roster, and last location.
// ============================================================================

import { db } from './config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection, query, where, doc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// Simple DOM helpers
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
// Initialize Player UI
// ---------------------------------------------------------------------------
export function initializePlayerUI(teamInput) {
  console.log('🎨 Initializing Player UI with:', teamInput);

  const teamName =
    typeof teamInput === 'string'
      ? teamInput
      : teamInput?.name || 'Unknown Team';

  const team = allTeams.find(t => t.name === teamName);
  const displayName = team?.name || teamName;
  const displaySlogan = team?.slogan || 'Ready to race!';

  // 🏷️ Team name + slogan
  setText('team-name', displayName);
  setText('team-slogan', displaySlogan);
  console.log(`✅ Team info set: ${displayName} — "${displaySlogan}"`);

  // 👥 Real-time roster listener
  const memberList = $('team-member-list');
  if (memberList) {
    const q = query(collection(db, "racers"), where("team", "==", teamName));
    onSnapshot(q, (snapshot) => {
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
    }, (err) => console.error("❌ Error loading racers:", err));
  }

  // 📍 Real-time location listener
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
      const timeStr = ts ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleTimeString() : '';
      flashPlayerLocation(`📍 ${zone}${timeStr ? ` (updated ${timeStr})` : ''}`);
    }, (err) => console.error("❌ Error reading teamStatus:", err));
  }
}

