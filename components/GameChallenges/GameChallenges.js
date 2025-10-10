// File: /public/components/GameChallenges/GameChallenges.js
import styles from './GameChallenges.module.css';

function GameChallengesComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Game-Wide Challenges</h2>
            <p>These are not tied to a specific zone.</p>
            <table class="${styles.questionsTable}">
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

export default GameChallengesComponent;

/* ... (Your original reference code remains here) ... */