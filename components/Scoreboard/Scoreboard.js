import { db } from '../modules/config.js';
import { allTeams } from '../data.js';
import { onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './Scoreboard.module.css';

export function ScoreboardComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Scoreboard</h2>
            <table class="${styles.dataTable}" id="scoreboard-table">
                <thead>
                    <tr>
                        <th>Team Name</th>
                        <th>Score</th>
                        <th>Zones Controlled</th>
                    </tr>
                </thead>
                <tbody id="scoreboard-tbody"></tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export function initializeScoreboardListener() {
    const scoreboardBody = document.getElementById('scoreboard-tbody');
    if (!scoreboardBody) return;
    const scoresCollection = collection(db, "scores");
    onSnapshot(scoresCollection, (snapshot) => {
        const scores = {};
        snapshot.forEach(doc => { scores[doc.id] = doc.data(); });
        scoreboardBody.innerHTML = '';
        allTeams.forEach(team => {
            const teamScoreData = scores[team.name] || { score: 0, zonesControlled: "" };
            const row = document.createElement('tr');
            row.innerHTML = `<td>${team.name}</td><td>${teamScoreData.score}</td><td>${teamScoreData.zonesControlled || "None"}</td>`;
            scoreboardBody.appendChild(row);
        });
    });
}

