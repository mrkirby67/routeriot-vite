// File: playerInit.js
import { initializeZones } from './player.js';
import { db } from './modules/config.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function initializePlayerPage() {
  const params = new URLSearchParams(window.location.search);
  const teamName = params.get('team');

  if (!teamName) {
    alert("No team found. Please use your official team link.");
    return;
  }

  // Display team info
  const nameEl = document.getElementById('player-team-name');
  const sloganEl = document.getElementById('player-team-slogan');
  const membersEl = document.getElementById('player-team-members');
  const scoreEl = document.getElementById('player-score');
  const timerEl = document.getElementById('live-timer');

  const teamRef = doc(db, "teams", teamName);
  const teamSnap = await getDoc(teamRef);

  if (teamSnap.exists()) {
    const data = teamSnap.data();
    if (nameEl) nameEl.textContent = teamName;
    if (sloganEl) sloganEl.textContent = data.slogan || "No slogan set.";
    if (membersEl && Array.isArray(data.members)) {
      membersEl.innerHTML = data.members.map(m => `<li>${m}</li>`).join('');
    }
  }

  // Start live timer
  const start = Date.now();
  setInterval(() => {
    const elapsed = Date.now() - start;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }, 1000);

  // Watch live score
  const scoreRef = doc(db, "scores", teamName);
  onSnapshot(scoreRef, snap => {
    if (snap.exists()) scoreEl.textContent = snap.data().score || 0;
  });

  // Start zones logic
  initializeZones(teamName);
}

window.addEventListener('DOMContentLoaded', initializePlayerPage);