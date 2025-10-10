// File: /public/components/Broadcast/Broadcast.js
import styles from './Broadcast.module.css';

function BroadcastComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Broadcast & Communication</h2>
            <div class="${styles.broadcastBox}">
                <label for="broadcast-message">Broadcast Message to All Racers:</label>
                <input type="text" id="broadcast-message" placeholder="E.g., Meet at City Hall for lunch...">
                <button id="broadcast-btn">Send Broadcast</button>
            </div>
            <div id="communication-log" class="${styles.logBox}">
                <p>All team communications will appear here...</p>
            </div>
        </div>
    `;
    return componentHtml;
}

export default BroadcastComponent;

/* ... (Your original reference code remains here) ... */