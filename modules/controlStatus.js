// ============================================================================
// MODULE: controlStatus.js (FINAL CLEAN VERSION)
// Purpose: Watch Firestore for live game updates and team status sync
// Includes auto Top 3 broadcast + separate clearChatOnly() + full clearAll()
// ============================================================================

import { listenForGameStatus } from './gameStateManager.js';
import { showFlashMessage } from './gameUI.js';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './config.js';
import { broadcastTopThree, resetScores } from './scoreboardManager.js';

// ---------------------------------------------------------------------------
// 🔹 Main Game Status Watcher
// ---------------------------------------------------------------------------
export function watchLiveGameStatus() {
  listenForGameStatus(async (state) => {
    const { status = 'waiting', zonesReleased = false } = state || {};
    const statusEl = document.getElementById('live-game-status');
    const zonesEl = document.getElementById('live-zones-status');

    if (statusEl) statusEl.textContent = status.toUpperCase();
    if (zonesEl) zonesEl.textContent = zonesReleased ? 'Unlocked' : 'Locked';

    switch (status) {
      case 'active':
        showFlashMessage('🏁 Zones are LIVE!', '#2e7d32');
        break;
      case 'paused':
        showFlashMessage('⏸️ Game Paused!', '#ff9800');
        break;
      case 'finished':
      case 'ended':
        showFlashMessage('🏁 Game Over!', '#7b1fa2');
        await broadcastTopThree();
        break;
      default:
        showFlashMessage('Waiting to start...', '#616161');
        break;
    }
  });

  watchTeamStatuses();
}

// ---------------------------------------------------------------------------
// 🧭 Watch all teamStatus/{teamName} documents
// ---------------------------------------------------------------------------
function watchTeamStatuses() {
  const teamTable = document.getElementById('control-team-status-tbody');
  if (!teamTable) return;

  const teamStatusRef = collection(db, 'teamStatus');
  onSnapshot(teamStatusRef, (snapshot) => {
    teamTable.innerHTML = '';

    snapshot.forEach((docSnap) => {
      const teamName = docSnap.id;
      const data = docSnap.data() || {};
      const location = data.lastKnownLocation || '--';
      const time = formatTimestamp(data.timestamp);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${teamName}</td>
        <td>${location !== '--' ? '📍 ' + location : '--'}</td>
        <td>${time || '--'}</td>
      `;
      teamTable.appendChild(tr);
    });
  });

  console.log('📡 Watching live teamStatus updates...');
}

// ---------------------------------------------------------------------------
// 💬 CLEAR CHAT ONLY (Does NOT touch scores or zones)
// ---------------------------------------------------------------------------
export async function clearChatOnly() {
  try {
    console.log('💬 Clearing all communications and chat logs (scores untouched)...');

    // 1️⃣ Delete all documents in communications
    const commSnap = await getDocs(collection(db, 'communications'));
    for (const docSnap of commSnap.docs) {
      await deleteDoc(doc(db, 'communications', docSnap.id));
    }

    // 2️⃣ Delete all CONTROL_ALL conversation messages
    const controlSnap = await getDocs(collection(db, 'conversations', 'CONTROL_ALL', 'messages'));
    for (const docSnap of controlSnap.docs) {
      await deleteDoc(doc(db, 'conversations', 'CONTROL_ALL', 'messages', docSnap.id));
    }

    // 3️⃣ Delete all player-to-player conversation subcollections
    const convoSnap = await getDocs(collection(db, 'conversations'));
    for (const docSnap of convoSnap.docs) {
      if (docSnap.id !== 'CONTROL_ALL') {
        const msgSnap = await getDocs(collection(db, 'conversations', docSnap.id, 'messages'));
        for (const msgDoc of msgSnap.docs) {
          await deleteDoc(doc(db, 'conversations', docSnap.id, 'messages', msgDoc.id));
        }
      }
    }

    // ✅ Leave scores and zones untouched
    await addSystemNotice('💬 All chat and messages cleared by Game Master (scores preserved)');
    showFlashMessage('💬 Chat cleared — scores preserved.', '#0288d1', 3000);
    console.log('✅ Chat cleared; scores preserved.');
  } catch (err) {
    console.error('❌ Error clearing chat:', err);
    showFlashMessage('❌ Chat clear failed. Check console.', '#c62828', 4000);
  }
}

// ---------------------------------------------------------------------------
// 🧹 CLEAR ALL (Chat + Scores + Team Status + Zones)
// ---------------------------------------------------------------------------
export async function clearAllChatAndScores() {
  try {
    console.log('🧹 Performing full CLEAR ALL: chat, scores, teamStatus, zones...');

    // 1️⃣ Clear chat/conversations
    await clearChatOnly();

    // 2️⃣ Reset scoreboard
    await resetScores();

    // 3️⃣ Clear all teamStatus locations
    await clearAllTeamStatuses();

    // 4️⃣ Reset all zones to Available
    await clearAllZones();

    // 5️⃣ Notify everyone
    await addSystemNotice('\n'.repeat(10) + '🧹 ALL CHAT, SCORES, TEAM STATUSES & ZONES CLEARED 🧹');
    showFlashMessage('🧼 All data fully cleared.', '#1565c0', 3000);

    console.log('✅ All data cleared: chat, scores, teamStatus, zones.');
  } catch (err) {
    console.error('❌ Error during full Clear All:', err);
    showFlashMessage('❌ Clear All failed.', '#c62828', 4000);
  }
}

// ---------------------------------------------------------------------------
// 🧼 Clear all team statuses
// ---------------------------------------------------------------------------
export async function clearAllTeamStatuses() {
  try {
    const teamStatusRef = collection(db, "teamStatus");
    const snapshot = await getDocs(teamStatusRef);

    const updates = snapshot.docs.map((docSnap) =>
      updateDoc(docSnap.ref, {
        lastKnownLocation: "",
        timestamp: serverTimestamp(),
      })
    );

    await Promise.allSettled(updates);
    console.log("🧼 All teamStatus entries cleared!");
  } catch (err) {
    console.error("❌ Error clearing teamStatus collection:", err);
  }
}

// ---------------------------------------------------------------------------
// 🧭 Clear all zones
// ---------------------------------------------------------------------------
export async function clearAllZones() {
  try {
    const zonesRef = collection(db, "zones");
    const snapshot = await getDocs(zonesRef);

    const updates = snapshot.docs.map((docSnap) =>
      setDoc(
        docSnap.ref,
        {
          status: "Available",
          controllingTeam: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    );

    await Promise.allSettled(updates);
    console.log("🗺️ All zones reset to Available.");
  } catch (err) {
    console.error("❌ Error clearing zones collection:", err);
  }
}

// ---------------------------------------------------------------------------
// 💬 Helper: Add broadcast system notice
// ---------------------------------------------------------------------------
async function addSystemNotice(message) {
  try {
    const { addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    await addDoc(collection(db, 'communications'), {
      teamName: 'Game Master',
      message,
      isBroadcast: true,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('⚠️ Failed to broadcast system notice:', err);
  }
}

// ---------------------------------------------------------------------------
// ⏱️ Helper: Format Firestore timestamps
// ---------------------------------------------------------------------------
function formatTimestamp(ts) {
  try {
    if (!ts) return '';
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleTimeString();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis()).toLocaleTimeString();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleTimeString();
    if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
  } catch (err) {
    console.warn('⚠️ Bad timestamp:', err);
  }
  return '';
}