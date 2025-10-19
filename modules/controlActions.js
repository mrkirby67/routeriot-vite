// ============================================================================
// MODULE: controlActions.js
// Purpose: Core admin game control logic (scoreboard clears, resets, end game)
// ============================================================================

import {
  doc, getDocs, updateDoc, addDoc, collection, writeBatch, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from './config.js';
import { showFlashMessage } from './gameUI.js';

const GAME_STATE_REF = doc(db, "game", "gameState");

// ---------------------------------------------------------------------------
// 🧮 CLEAR SCOREBOARD (scores + locations + live table)
// ---------------------------------------------------------------------------
export async function clearAllScores(autoTriggered = false, clearTable = true) {
  try {
    // 🧹 Clear Firestore scores
    const scoresSnap = await getDocs(collection(db, "scores"));
    const batch = writeBatch(db);
    scoresSnap.forEach((s) => batch.delete(s.ref));
    await batch.commit();

    // 🧭 Clear teamStatus (last known location)
    const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
    for (const t of teamStatusSnap.docs) {
      await updateDoc(doc(db, "teamStatus", t.id), {
        lastKnownLocation: '',
        timestamp: serverTimestamp(),
      });
    }

    // 📣 Broadcast system message
    if (!autoTriggered) {
      await addDoc(collection(db, "communications"), {
        teamName: "Game Master",
        message: "🧹 Scoreboard has been cleared (scores + locations).",
        isBroadcast: true,
        timestamp: serverTimestamp(),
      });
    }

    // 🪄 Wipe visible scoreboard instantly on control screen
    if (clearTable) {
      const tbody = document.getElementById('scoreboard-tbody');
      if (tbody) {
        tbody.innerHTML = `
          <tr><td colspan="5" style="text-align:center;color:#888;">
            Scoreboard cleared — waiting for new data...
          </td></tr>`;
      }
    }

    // 📢 Trigger global event for other live scoreboards
    window.dispatchEvent(new CustomEvent('scoreboardCleared'));

    console.log(`✅ Scoreboard cleared (${autoTriggered ? 'auto' : 'manual'}).`);
  } catch (e) {
    console.error("❌ Error clearing scoreboard:", e);
    showFlashMessage('Scoreboard clearing failed.', '#c62828', 3000);
  }
}

// ---------------------------------------------------------------------------
// 🏁 SAFE END + RESET ZONES + CLEAR SCORES + BROADCAST
// ---------------------------------------------------------------------------
export async function safelyEndGameAndResetZones() {
  try {
    await updateDoc(GAME_STATE_REF, {
      status: 'finished',
      updatedAt: serverTimestamp(),
    });

    const zonesSnap = await getDocs(collection(db, "zones"));
    for (const z of zonesSnap.docs) {
      await updateDoc(doc(db, "zones", z.id), {
        status: 'Available',
        controllingTeam: '',
        lastUpdated: serverTimestamp(),
      });
    }

    const teamStatusSnap = await getDocs(collection(db, "teamStatus"));
    for (const t of teamStatusSnap.docs) {
      await updateDoc(doc(db, "teamStatus", t.id), {
        lastKnownLocation: '',
        timestamp: serverTimestamp(),
      });
    }

    await clearAllScores(true);

    await addDoc(collection(db, "communications"), {
      teamName: "Game Master",
      message: "🏁 The game has ended! All zones and scoreboard reset.",
      isBroadcast: true,
      timestamp: serverTimestamp(),
    });

    console.log("✅ Game ended, zones reset, and broadcast sent.");
  } catch (e) {
    console.error("❌ Error ending game:", e);
    showFlashMessage('End/Reset failed.', '#c62828', 3000);
  }
}

// ---------------------------------------------------------------------------
// 🔄 RESET GAME STATE (Clears scoreboard + locations)
// ---------------------------------------------------------------------------
export async function resetFullGameState() {
  try {
    await clearAllScores(true);
    await setDoc(GAME_STATE_REF, {
      status: 'waiting',
      zonesReleased: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log("🔄 Game state fully reset to WAITING.");
  } catch (e) {
    console.error("❌ Error resetting game:", e);
    showFlashMessage('Reset failed.', '#c62828', 2500);
  }
}