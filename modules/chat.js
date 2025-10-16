// --- IMPORTS & GLOBAL VARIABLES ---
import { db } from './config.js';
import { allTeams } from '../data.js';
import { doc, onSnapshot, collection, query, where, addDoc, orderBy, collectionGroup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- CHAT & BROADCAST SYSTEM ---
export function setupPlayerChatAndBroadcasts(teamName) {
    const chatLog = document.getElementById('team-chat-log');
    const opponentsTbody = document.getElementById('opponents-tbody');
    if (!chatLog || !opponentsTbody) return;

    // --- Part 1: Set up the UI for sending messages to other teams ---
    opponentsTbody.innerHTML = '';
    const otherTeams = allTeams.filter(t => t.name !== teamName);
    otherTeams.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${team.name}</td>
            <td id="location-${team.name.replace(/\s/g, '')}">--</td>
            <td class="message-cell">
                <input type="text" class="chat-input" data-recipient-input="${team.name}" placeholder="Message...">
                <button class="send-btn" data-recipient="${team.name}">Send</button>
            </td>
        `;
        opponentsTbody.appendChild(row);
    });

    opponentsTbody.addEventListener('click', (event) => {
        if (event.target.classList.contains('send-btn')) {
            const recipientName = event.target.dataset.recipient;
            const input = document.querySelector(`input[data-recipient-input="${recipientName}"]`);
            const messageText = input.value.trim();
            if (messageText) {
                sendMessage(teamName, recipientName, messageText);
                input.value = '';
            }
        }
    });
    
    // --- Part 2: Listen for all relevant messages ---
    listenForMyMessages(teamName, chatLog);
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
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

function listenForMyMessages(myTeamName, logBox) {
    const messagesRef = collectionGroup(db, 'messages');
    const sentQuery = query(messagesRef, where('sender', '==', myTeamName));
    const receivedQuery = query(messagesRef, where('recipient', '==', myTeamName));
    const broadcastQuery = query(collection(db, 'communications'), where('teamName', '==', 'Commissioner'));

    let allMessages = [];
    const messageIds = new Set();

    const updateLog = () => {
        allMessages.sort((a, b) => a.timestamp - b.timestamp);
        logBox.innerHTML = '';
        allMessages.forEach(msg => {
            const logEntry = document.createElement('p');
            const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (msg.sender === "Commissioner") {
                logEntry.style.backgroundColor = '#3a3a24';
                logEntry.style.padding = '8px';
                logEntry.style.borderRadius = '5px';
                logEntry.style.margin = '5px 0';
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong style="color: #fdd835; font-size: 1.1em; text-transform: uppercase;">Broadcast:</strong> <span style="font-size: 1.1em; font-weight: bold;">${msg.text}</span>`;
            } else if (msg.sender === myTeamName) {
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong>You to ${msg.recipient}:</strong> ${msg.text}`;
            } else {
                logEntry.innerHTML = `<span style="color: #aaa; margin-right: 8px;">[${timestamp}]</span> <strong>From ${msg.sender}:</strong> ${msg.text}`;
            }
            logBox.appendChild(logEntry);
        });
        logBox.scrollTop = logBox.scrollHeight;
    };

    const processSnapshot = (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && !messageIds.has(change.doc.id)) {
                messageIds.add(change.doc.id);
                allMessages.push(change.doc.data());
            }
        });
        updateLog();
    };

    onSnapshot(sentQuery, processSnapshot);
    onSnapshot(receivedQuery, processSnapshot);
    onSnapshot(broadcastQuery, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added' && !messageIds.has(change.doc.id)) {
                const data = change.doc.data();
                messageIds.add(change.doc.id);
                allMessages.push({
                    sender: "Commissioner",
                    recipient: "ALL",
                    text: data.message,
                    timestamp: data.timestamp.toMillis()
                });
            }
        });
        updateLog();
    });
}
