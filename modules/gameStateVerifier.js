import { onSnapshot, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./config.js";

export function watchGameTransitions() {
  let lastStatus = null;
  onSnapshot(doc(db, 'game', 'gameState'), (snap) => {
    const data = snap.data();
    const status = data?.status;
    if (status !== lastStatus) {
      console.log(`[STATE] ${lastStatus || 'none'} → ${status}`, data);
      lastStatus = status;
    }
  });
}
