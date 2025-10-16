import { db } from '../modules/config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './GameChallenges.module.css';

export function GameChallengesComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Game-Wide Challenges</h2>
            <p>These are not tied to a specific zone.</p>
            <table class="${styles.questionsTable} game-wide-challenges-table">
                 <thead>
                    <tr>
                        <th>Challenge Type</th>
                        <th>Question / Task</th>
                        <th>Answer</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="${styles.speedbumpRow}" data-question-id="speedbump">
                        <td><strong>SPEEDBUMP</strong></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                    </tr>
                    <tr class="${styles.flattireRow}" data-question-id="flattire">
                        <td><strong>FLAT TIRE</strong></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                        <td contenteditable="true"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export function initializeGameChallengesLogic() {
    const table = document.querySelector('.game-wide-challenges-table');
    if (!table) return;

    table.addEventListener('blur', async (event) => {
        const cell = event.target;
        if (cell.tagName !== 'TD' || !cell.isContentEditable) return;

        const row = cell.closest('tr');
        const challengeId = row.dataset.questionId;
        if (!challengeId) return;

        const fields = ['challengeType', 'question', 'answer', 'type']; 
        const field = fields[cell.cellIndex];
        if (!field || field === 'challengeType') return;

        const value = cell.textContent.trim();
        const challengeRef = doc(db, "specialChallenges", challengeId);
        try {
            await setDoc(challengeRef, { [field]: value }, { merge: true });
        } catch (error) { console.error("Error saving special challenge:", error); }
    }, true);
}
