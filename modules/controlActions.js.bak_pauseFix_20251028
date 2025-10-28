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
import { clearAllTeamSurprises } from './teamSurpriseManager.js';

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

    // 4b️⃣ Remove transient power-ups & assignments
    await clearTransientGameCollections();

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

// ---------------------------------------------------------------------------
// 🃏 Apply Wild Cards to every teamStatus document
// ---------------------------------------------------------------------------
export async function applyWildCardsToAllTeams(count) {
  const target = Number.isFinite(Number(count)) && Number(count) >= 0
    ? Math.floor(Number(count))
    : 0;

  const teamStatusSnap = await getDocs(collection(db, "teamStatus"));

  const statusUpdates = teamStatusSnap.docs.map((docSnap) =>
    updateDoc(docSnap.ref, {
      wildCards: target,
      flatTireCount: target,
      bugSplatCount: target,
      shieldWaxCount: target,
    })
  );

  const surprisesCollection = collection(db, 'teamSurprises');
  const surpriseUpdates = teamStatusSnap.docs.map((docSnap) => {
    const teamId = docSnap.id || '';
    const sanitizedId = teamId.replace(/[\\/#?]/g, '_');
    const ref = doc(surprisesCollection, sanitizedId);
    return setDoc(ref, {
      counts: {
        flatTire: target,
        bugSplat: target,
        wildCard: target,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  await Promise.all([...statusUpdates, ...surpriseUpdates]);

  showFlashMessage(`🃏 Wild cards set to ${target} for all teams.`, '#512da8', 2500);
  console.log(`🃏 Wild cards set to ${target} for ${teamStatusSnap.size} teamStatus docs.`);
  return target;
}

if (typeof window !== 'undefined') {
  window.applyWildCardsToAllTeams = applyWildCardsToAllTeams;
}

// ---------------------------------------------------------------------------
// 🧹 Transient cleanup: flat tire assignments, surprise stock, shields
// ---------------------------------------------------------------------------
export async function clearTransientGameCollections() {
  const targets = ["flatTireAssignments", "teamSurprises", "shields"];
  try {
    for (const colName of targets) {
      const snap = await getDocs(collection(db, colName));
      const deletions = snap.docs.map((docSnap) => deleteDoc(docSnap.ref));
      if (deletions.length) {
        await Promise.allSettled(deletions);
      }
      console.log(`🧹 Cleared ${snap.size} docs from ${colName}`);
    }
    await clearAllTeamSurprises();
  } catch (err) {
    console.error("❌ Error clearing transient game data:", err);
  }
}
