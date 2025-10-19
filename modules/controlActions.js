// ============================================================================
// MODULE: controlActions.js (FIXED + VERIFIED FULL RESET)
// Purpose: Admin-side game control (resets scoreboard, zones, and teams safely)
// ============================================================================

import {
  doc,
  getDocs,
  setDoc,
  addDoc,
  collection,
  writeBatch,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from './config.js';
import { showFlashMessage } from './gameUI.js';

const GAME_STATE_REF = doc(db, "game", "gameState");

// ---------------------------------------------------------------------------
// 🧮 CLEAR SCOREBOARD (scores + teamStatus + UI)
// ---------------------------------------------------------------------------
export async function clearAllScores(autoTriggered = false, clearTable = true) {
  try {
    console.group("🧹 CLEAR SCOREBOARD START");

    // 1️⃣ Delete all documents in "scores"
    const scoresSnap = await getDocs(collection(db, "scores"));
    const batch = writeBatch(db);
    scoresSnap.forEach((s) => batch.delete(s.ref));
    await batch.commit();
    console.log(`🗑️ ${scoresSnap.size} score docs deleted`);

    // 2️⃣ Fully reset each teamStatus document
    const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
    for (const t of teamStatusSnap.docs) {
      const ref = doc(db, "teamStatus", t.id);
      // Delete doc completely to remove stale fields, then re-add clean record
      await deleteDoc(ref);
      await setDoc(ref, {
        lastKnownLocation: '',
        controllingTeam: '',
        activeZone: '',
        timestamp: serverTimestamp(),
      });
    }
    console.log(`🧭 ${teamStatusSnap.size} teamStatus docs reset`);

    // 3️⃣ Broadcast system message (unless auto)
    if (!autoTriggered) {
      await addDoc(collection(db, "communications"), {
        teamName: "Game Master",
        message: "🧹 Scoreboard and team locations cleared.",
        isBroadcast: true,
        timestamp: serverTimestamp(),
      });
      console.log("📣 Broadcast sent");
    }

    // 4️⃣ Reset visible control scoreboard instantly
    if (clearTable) {
      const tbody = document.getElementById('scoreboard-tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr><td colspan="5" style="text-align:center;color:#888;">
            Scoreboard cleared — waiting for updates...
          </td></tr>`;
      }
    }

    // 5️⃣ Trigger client UI refresh globally
    window.dispatchEvent(new CustomEvent('scoreboardCleared'));
    window.dispatchEvent(new CustomEvent('forceScoreboardRefresh'));

    showFlashMessage('🧹 Scoreboard & locations cleared.', '#2e7d32', 2000);
    console.log(`✅ Scoreboard cleared (${autoTriggered ? 'auto' : 'manual'})`);
    console.groupEnd();
  } catch (e) {
    console.error("❌ Error clearing scoreboard:", e);
    showFlashMessage('Scoreboard clearing failed.', '#c62828', 3000);
  }
}

// ---------------------------------------------------------------------------
// 🏁 SAFELY END GAME (Resets zones + teamStatus + scores)
// ---------------------------------------------------------------------------
export async function safelyEndGameAndResetZones() {
  try {
    console.group("🏁 SAFE END GAME");

    // 1️⃣ Mark game as finished
    await updateDoc(GAME_STATE_REF, {
      status: 'finished',
      updatedAt: serverTimestamp(),
    });
    console.log("🕹️ Game status updated → finished");

    // 2️⃣ Reset zones to Available
    const zonesSnap = await getDocs(collection(db, "zones"));
    for (const z of zonesSnap.docs) {
      await updateDoc(doc(db, "zones", z.id), {
        status: 'Available',
        controllingTeam: '',
        lastUpdated: serverTimestamp(),
      });
    }
    console.log(`🗺️ ${zonesSnap.size} zones reset`);

    // 3️⃣ Reset all teamStatus
    const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
    for (const t of teamStatusSnap.docs) {
      const ref = doc(db, "teamStatus", t.id);
      await deleteDoc(ref);
      await setDoc(ref, {
        lastKnownLocation: '',
        controllingTeam: '',
        activeZone: '',
        timestamp: serverTimestamp(),
      });
    }
    console.log(`🧭 ${teamStatusSnap.size} teamStatus docs wiped`);

    // 4️⃣ Clear scoreboard
    await clearAllScores(true);

    // 5️⃣ Broadcast end message
    await addDoc(collection(db, "communications"), {
      teamName: "Game Master",
      message: "🏁 Game ended — zones & scoreboard reset.",
      isBroadcast: true,
      timestamp: serverTimestamp(),
    });

    showFlashMessage('🏁 Game ended & reset complete.', '#2e7d32', 2500);
    console.log("✅ Full reset done.");
    console.groupEnd();
  } catch (e) {
    console.error("❌ Error ending game:", e);
    showFlashMessage('End/Reset failed.', '#c62828', 3000);
  }
}

// ---------------------------------------------------------------------------
// 🔄 FULL RESET (Wait state + empty scoreboard)
// ---------------------------------------------------------------------------
export async function resetFullGameState() {
  try {
    await clearAllScores(true);
    await setDoc(GAME_STATE_REF, {
      status: 'waiting',
      zonesReleased: false,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      remainingMs: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    showFlashMessage('🔄 Game reset to WAITING.', '#2e7d32', 2000);
    console.log("🔄 Game state fully reset to WAITING.");
  } catch (e) {
    console.error("❌ Error resetting game:", e);
    showFlashMessage('Reset failed.', '#c62828', 2500);
  }
}