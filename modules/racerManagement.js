import { db } from '/core/config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/**
 * @param {string} teamName
 * @returns {Promise<any[]>}
 */
export async function getRacersByTeam(teamName) {
    if (!teamName) return [];
    const q = query(collection(db, "racers"), where("team", "==", teamName));
    const querySnapshot = await getDocs(q);
    const racers = [];
    querySnapshot.forEach((doc) => {
        racers.push({ id: doc.id, ...doc.data() });
    });
    return racers;
}

/**
 * @returns {Promise<any[]>}
 */
export async function getAllRacers() {
    const querySnapshot = await getDocs(collection(db, "racers"));
    const racers = [];
    querySnapshot.forEach((doc) => {
        racers.push({ id: doc.id, ...doc.data() });
    });
    return racers;
}