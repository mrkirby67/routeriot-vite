import { db } from '../modules/config.js';
import { allTeams } from '../data.js';
import { onSnapshot, doc, setDoc, writeBatch, getDocs, collection, query, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import styles from './GameControls.module.css';

/**
 * This function returns the static HTML structure for the component.
 */
export function GameControlsComponent() {
    const componentHtml = `
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

/**
 * This function finds the elements rendered by the component and attaches all the live logic.
 */
export function initializeGameControlsLogic() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const endBtn = document.getElementById('end-btn');
    const resetBtn = document.getElementById('reset-game-btn');
    const randomizeBtn = document.getElementById('randomize-btn');
    const sendBtn = document.getElementById('send-links-btn');
    const timerDisplay = document.getElementById('timer-display');
    let gameTimerInterval;

    // Live timer listener
    onSnapshot(doc(db, "game", "gameState"), (docSnap) => {
        if (gameTimerInterval) clearInterval(gameTimerInterval);
        const gameState = docSnap.data();
        if (gameState && gameState.status === 'active' && gameState.endTime) {
            gameTimerInterval = setInterval(() => {
                const now = Date.now();
                const remaining = gameState.endTime - now;
                if (remaining <= 0) {
                    timerDisplay.textContent = "00:00:00";
                    clearInterval(gameTimerInterval);
                } else {
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((remaining / 1000 / 60) % 60);
                    const seconds = Math.floor((remaining / 1000) % 60);
                    timerDisplay.textContent =
                        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                }
            }, 1000);
        } else {
            timerDisplay.textContent = "--:--:--";
        }
    });

    // Button event listeners
    startBtn.addEventListener('click', async () => {
        const durationMinutes = document.getElementById('game-duration').value || 120;
        const endTime = Date.now() + (durationMinutes * 60 * 1000);
        await setDoc(doc(db, "game", "gameState"), { status: 'active', endTime: endTime, dataVersion: Date.now() });
        alert('Game Started!');
    });

    pauseBtn.addEventListener('click', async () => {
        await setDoc(doc(db, "game", "gameState"), { status: 'paused' }, { merge: true });
        alert('Game Paused!');
    });

    endBtn.addEventListener('click', async () => {
        await setDoc(doc(db, "game", "gameState"), { status: 'finished' }, { merge: true });
        alert('Game Ended!');
    });

    resetBtn.addEventListener('click', async () => {
        if (!confirm("ARE YOU SURE?\nThis will post a winner announcement and then permanently delete all game data.")) {
            return;
        }

        alert("Finding winner and resetting game data... This may take a moment.");

        try {
            const scoresQuery = query(collection(db, "scores"), orderBy("score", "desc"), limit(1));
            const scoresSnapshot = await getDocs(scoresQuery);
            let winnerMessage = "Congratulations to the winning team from the last game!";
            if (!scoresSnapshot.empty) {
                const winningTeam = scoresSnapshot.docs[0];
                winnerMessage = `Congratulations to the winning team, ${winningTeam.id}, for scoring ${winningTeam.data().score} points!`;
            }

            const commsCollection = collection(db, "communications");
            const hardReturns = '<br>'.repeat(20);
            await addDoc(commsCollection, {
                teamName: "Game Master",
                message: `${hardReturns}${winnerMessage}`,
                timestamp: new Date()
            });

            const batch = writeBatch(db);
            batch.set(doc(db, "game", "gameState"), { status: 'not started', dataVersion: Date.now() });

            const racersSnapshot = await getDocs(collection(db, "racers"));
            racersSnapshot.forEach(racerDoc => {
                batch.update(racerDoc.ref, { name: '', cell: '', email: '', team: '-' });
            });

            const zonesSnapshot = await getDocs(collection(db, "zones"));
            zonesSnapshot.forEach(zoneDoc => {
                batch.update(zoneDoc.ref, { name: '', gps: '', diameter: '0.05', status: 'Available', controllingTeam: '' });
            });

            const allScores = await getDocs(collection(db, "scores"));
            allScores.forEach(scoreDoc => batch.delete(scoreDoc.ref));

            const allComms = await getDocs(collection(db, "communications"));
            allComms.forEach(commDoc => batch.delete(commDoc.ref));

            await batch.commit();
            alert('Game has been reset successfully!');
            window.location.reload();

        } catch (error) {
            console.error("Error during full game reset: ", error);
            alert("An error occurred while resetting the game. Check the console for details.");
        }
    });

    randomizeBtn.addEventListener('click', async () => {
        const teamSize = parseInt(document.getElementById('team-size').value);
        if (isNaN(teamSize) || teamSize < 1) { return alert("Please enter a valid team size."); }
        const racersSnapshot = await getDocs(collection(db, "racers"));
        let racers = [];
        racersSnapshot.forEach(doc => { if (doc.data().name) { racers.push({ id: doc.id, ...doc.data() }); } });

        for (let i = racers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [racers[i], racers[j]] = [racers[j], racers[i]];
        }

        const batch = writeBatch(db);
        racers.forEach((racer, index) => {
            const teamIndex = Math.floor(index / teamSize);
            const team = allTeams[teamIndex % allTeams.length];
            const racerRef = doc(db, "racers", racer.id);
            batch.update(racerRef, { team: team.name });
        });
        await batch.commit();
        alert("Teams have been randomized!");
    });

    sendBtn.addEventListener('click', async () => {
        const racersSnapshot = await getDocs(collection(db, "racers"));
        let racers = [];
        racersSnapshot.forEach(doc => racers.push(doc.data()));

        const teamsAreAssigned = racers.some(racer => racer.team && racer.team !== '-');
        if (!teamsAreAssigned) {
            alert("Teams haven't been assigned. Please press 'Randomize Teams' first.");
            return;
        }

        const teams = {};
        allTeams.forEach(team => { teams[team.name] = []; });
        racers.forEach(racer => { if (racer.team && teams[racer.team]) { teams[racer.team].push(racer); } });

        const modalBody = document.getElementById('roster-modal-body');
        modalBody.innerHTML = '';

        for (const teamName in teams) {
            if (teams[teamName].length > 0) {
                const teamBlock = document.createElement('div');
                teamBlock.className = 'team-roster-block';
                
                let membersHtml = teams[teamName].map(r => `<li>${r.name}</li>`).join('');
                
                const playerUrl = `${window.location.origin}/player.html?teamName=${encodeURIComponent(teamName)}`;
                const captain = teams[teamName].find(r => r.email) || teams[teamName][0];
                const mailtoLink = `mailto:${captain.email}?subject=Your%20Route%20Riot%20Team%20Link&body=Hello%20${captain.name},%0A%0AHere%20is%20the%20unique%20link%20for%20your%20team,%20${teamName}:%0A%0A${playerUrl}%0A%0AGood%20luck!`;

                teamBlock.innerHTML = `
                    <h3>${teamName}</h3>
                    <ul>${membersHtml}</ul>
                    <p><strong>Link:</strong> ${playerUrl}</p>
                    <button class="copy-link-btn" data-link="${playerUrl}">Copy Link</button>
                    <a href="${mailtoLink}" class="email-link-btn">Email to Captain</a>
                `;
                modalBody.appendChild(teamBlock);
            }
        }
        document.getElementById('roster-modal').style.display = 'flex';
    });

    const modal = document.getElementById('roster-modal');
    if (modal) {
        modal.querySelector('.modal-close-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (event) => {
            if (event.target.classList.contains('copy-link-btn')) {
                const link = event.target.dataset.link;
                navigator.clipboard.writeText(link).then(() => {
                    alert('Link copied to clipboard!');
                });
            }
        });
    }
}

