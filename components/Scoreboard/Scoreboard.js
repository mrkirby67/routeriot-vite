// File: /public/components/Scoreboard/Scoreboard.js
import styles from './Scoreboard.module.css'; // <-- 1. Import the CSS module

function ScoreboardComponent() {
    const componentHtml = `
        // 2. Use the imported styles on each class name
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
                <tbody id="scoreboard-tbody">
                    </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export default ScoreboardComponent;

/* ... (Your original reference code remains here) ... */