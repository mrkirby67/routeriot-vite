import { db } from './config.js';
import { allTeams } from '../data.js';
import { collection, addDoc, onSnapshot, query, where, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- FOR THE CONTROL PAGE ---
export function listenToAllMessages() {
    const logBox = document.getElementById('communication-log');
    if (!logBox) return;
    
    // This query looks across all "messages" subcollections.
    const messagesQuery = query(collectionGroup(db, 'messages'), orderBy('timestamp', 'asc'));
    
    onSnapshot(messagesQuery, (snapshot) => {
        logBox.innerHTML = ''; // Clear the log on each update
        snapshot.forEach(doc => {
            const msg = doc.data();
            const logEntry = document.createElement('p');
            logEntry.textContent = `[${new Date(msg.timestamp).toLocaleTimeString()}] From ${msg.sender} to ${msg.recipient}: ${msg.text}`;
            logBox.appendChild(logEntry);
        });
        logBox.scrollTop = logBox.scrollHeight; // Auto-scroll to bottom
    });
}

// --- FOR THE PLAYER PAGE ---
export function setupPlayerChat(currentTeamName) {
    const opponentsTbody = document.getElementById('opponents-tbody');
    const chatLog = document.getElementById('team-chat-log');
    if (!opponentsTbody || !chatLog) return;

    opponentsTbody.innerHTML = '';
    const otherTeams = allTeams.filter(team => team.name !== currentTeamName);
    otherTeams.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${team.name}</td>
            <td>--</td>
            <td class="message-cell">
                <input type="text" class="chat-input" data-recipient-input="${team.name}" placeholder="Message ${team.name}...">
                <button class="send-btn" data-recipient="${team.name}">Send</button>
            </td>
        `;
        opponentsTbody.appendChild(row);
    });

    opponentsTbody.querySelectorAll('.send-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const recipientName = e.target.dataset.recipient;
            const input = document.querySelector(`input[data-recipient-input="${recipientName}"]`);
            const messageText = input.value.trim();
            if (messageText) {
                sendMessage(currentTeamName, recipientName, messageText);
                input.value = '';
            }
        });
    });

    // Start listening for messages involving this team
    listenForMyMessages(currentTeamName, chatLog);
}

async function sendMessage(sender, recipient, text) {
    const sortedNames = [sender, recipient].sort();
    const convoId = `${sortedNames[0].replace(/\s/g, '')}_${sortedNames[1].replace(/\s/g, '')}`;
    const messagesRef = collection(db, 'conversations', convoId, 'messages');
    
    try {
        await addDoc(messagesRef, {
            sender: sender,
            recipient: recipient,
            text: text,
            timestamp: Date.now()
        });
        console.log(`Message sent from ${sender} to ${recipient}`);
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// --- THIS IS THE CORRECTED, ROBUST FUNCTION ---
function listenForMyMessages(myTeamName, logBox) {
    // We create a query that finds all messages where our team is either the sender OR the recipient.
    // This requires the two Firestore indexes that you have already created.
    const messagesRef = collectionGroup(db, 'messages');
    const sentQuery = query(messagesRef, where('sender', '==', myTeamName));
    const receivedQuery = query(messagesRef, where('recipient', '==', myTeamName));

    let allMyMessages = [];
    const messageIds = new Set(); // Use a Set to prevent duplicate messages

    const updateLog = () => {
        // Sort all messages chronologically
        allMyMessages.sort((a, b) => a.timestamp - b.timestamp);
        
        logBox.innerHTML = ''; // Clear and rebuild the log
        allMyMessages.forEach(msg => {
            const logEntry = document.createElement('p');
            if (msg.sender === myTeamName) {
                logEntry.innerHTML = `<strong>You said to ${msg.recipient}:</strong> ${msg.text}`;
            } else {
                logEntry.innerHTML = `<strong>From ${msg.sender}:</strong> ${msg.text}`;
            }
            logBox.appendChild(logEntry);
        });
        logBox.scrollTop = logBox.scrollHeight;
    };

    const processSnapshot = (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const docId = change.doc.id;
                // Add the message only if we haven't seen its ID before
                if (!messageIds.has(docId)) {
                    messageIds.add(docId);
                    allMyMessages.push(change.doc.data());
                }
            }
        });
        updateLog();
    };

    // Listen for messages you've sent
    onSnapshot(sentQuery, processSnapshot, (error) => { console.error("Error on sent query:", error); });
    
    // Listen for messages you've received
    onSnapshot(receivedQuery, processSnapshot, (error) => { console.error("Error on received query:", error); });
}