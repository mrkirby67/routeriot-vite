import styles from './Scoreboard.module.css';

function ScoreboardComponent() {
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
                <tbody id="scoreboard-tbody">
                </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export default ScoreboardComponent;
