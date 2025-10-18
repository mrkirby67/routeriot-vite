import { db } from './config.js';
import { doc, setDoc, increment, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Adds a given number of points to a team's score.
 * This is used by the zones.js module when a challenge is successfully completed.
 * @param {string} teamName - The name of the team to award points to.
 * @param {number} points - The number of points to add (can be negative).
 */
export async function addPointsToTeam(teamName, points) {
    if (!teamName || !points) return;
    const scoreRef = doc(db, "scores", teamName);
    try {
        await setDoc(scoreRef, { score: increment(points) }, { merge: true });
    } catch (error) {
        console.error(`Failed to add points for ${teamName}:`, error);
    }
}

/**
 * Updates the 'zonesControlled' field for a team in the scoreboard.
 * @param {string} teamName - The name of the team.
 * @param {string} zoneName - The name of the zone they now control.
 */
export async function updateControlledZones(teamName, zoneName) {
    if (!teamName || !zoneName) return;
    const scoreRef = doc(db, "scores", teamName);
    try {
        // This will overwrite the previous zone. A more advanced version might append to a list.
        await setDoc(scoreRef, { zonesControlled: zoneName }, { merge: true });
    } catch (error) {
        console.error(`Failed to update controlled zones for ${teamName}:`, error);
    }
}

/**
 * Initializes the live scoreboard on the player page.
 */
export function initializePlayerScoreboard() {
    const scoreboardBody = document.getElementById('player-scoreboard-tbody');
    if (!scoreboardBody) return;

    const scoresCollection = collection(db, "scores");
    onSnapshot(scoresCollection, (snapshot) => {
        let scores = [];
        snapshot.forEach(doc => {
            scores.push({ name: doc.id, ...doc.data() });
        });

        // Sort teams by score in descending order
        scores.sort((a, b) => (b.score || 0) - (a.score || 0));

        scoreboardBody.innerHTML = '';
        scores.forEach(teamScore => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${teamScore.name}</td><td>${teamScore.score || 0}</td>`;
            scoreboardBody.appendChild(row);
        });
    });
}

