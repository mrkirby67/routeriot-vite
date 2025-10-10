// File: /public/components/GameControls/GameControls.js
import styles from './GameControls.module.css'; // <-- 1. Import the CSS module

function GameControlsComponent() {
    const componentHtml = `
        //  2. Use the imported styles on each class name
        <div class="${styles.controlSection}">
            <h2>Game Controls & Setup</h2>
            <div class="${styles.gameControls}">
                <button id="start-btn" class="${styles.controlButton} ${styles.start}">Start Game</button>
                <button id="pause-btn" class="${styles.controlButton} ${styles.pause}">Pause Game</button>
                <button id="end-btn" class="${styles.controlButton} ${styles.end}">End Game</button>
                <button id="reset-game-btn" class="${styles.controlButton} ${styles.pause}">Reset Game Data</button>
            </div>
            <div class="${styles.teamSetup}">
                <label for="team-size">Team Size:</label>
                <input type="number" id="team-size" value="2" min="1">
                <button id="randomize-btn">Randomize Teams</button>
                <button id="send-links-btn" class="${styles.controlButton} ${styles.start}">Racers Take Your Marks</button>
            </div>
            <div class="${styles.timerSetup}">
                <label for="game-duration">Game Duration (minutes):</label>
                <input type="number" id="game-duration" value="120">
                <div class="${styles.liveTimer}">
                    <strong>Live Timer:</strong> <span id="timer-display">00:00:00</span>
                </div>
            </div>
        </div>
    `;
    return componentHtml;
}

export default GameControlsComponent;

/* ... (Your original reference code remains here) ... */