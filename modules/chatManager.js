import { db } from './config.js';
import { allTeams } from '../data.js';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  collectionGroup,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------------------------------------------------------------------
 * CONTROL PAGE: Listen to ALL MESSAGES (visible to Game Master)
 * ------------------------------------------------------------------------ */
export async function listenToAllMessages() {
  const logBox = document.getElementById('communication-log');
  if (!logBox) return;

  const activeSnap = await getDoc(doc(db, "game", "activeTeams"));
  const activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];

  // This query now listens to both private messages and public communications
  const privateMessagesQuery = query(collectionGroup(db, 'messages'), orderBy('timestamp', 'asc'));
  const publicCommsQuery = query(collection(db, 'communications'), orderBy('timestamp', 'asc'));

  let allMessages = [];
  const messageIds = new Set();

  const renderLog = () => {
    allMessages.sort((a, b) => a.timestamp - b.timestamp);
    logBox.innerHTML = '';
    allMessages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const entry = document.createElement('p');
      if (msg.sender === 'Game Master' || msg.teamName === 'Game Master') {
        entry.innerHTML = `<span style="color:#888;">[${time}]</span> <strong style="color:#fdd835;">GAME MASTER:</strong> ${msg.text || msg.message}`;
      } else {
        entry.innerHTML = `
          <span style="color:#888;">[${time}]</span>
          <strong style="color:#FFD700;">${msg.sender}</strong> ➡️
          <strong style="color:#00CED1;">${msg.recipient}</strong>: ${msg.text}
        `;
      }
      logBox.appendChild(entry);
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
    renderLog();
  };

  onSnapshot(privateMessagesQuery, processSnapshot);
  onSnapshot(publicCommsQuery, processSnapshot);
}


/* ---------------------------------------------------------------------------
 * PLAYER PAGE: Chat UI and Message Handling
 * ------------------------------------------------------------------------ */
export async function setupPlayerChat(currentTeamName) {
  const opponentsTbody = document.getElementById('opponents-tbody');
  const chatLog = document.getElementById('team-chat-log');
  if (!opponentsTbody || !chatLog) return;

  opponentsTbody.innerHTML = '';

  const activeSnap = await getDoc(doc(db, "game", "activeTeams"));
  const activeTeams = activeSnap.exists() ? activeSnap.data().list || [] : [];
  const playableTeams =
    activeTeams.length > 0
      ? activeTeams.filter(t => t !== currentTeamName)
      : allTeams.filter(t => t.name !== currentTeamName).map(t => t.name);

  playableTeams.forEach(teamName => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${teamName}</td>
      <td>--</td>
      <td class="message-cell">
        <input type="text" class="chat-input" data-recipient-input="${teamName}"
               placeholder="Message ${teamName}...">
        <button class="send-btn" data-recipient="${teamName}">Send</button>
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

  listenForMyMessages(currentTeamName, chatLog);
}

/* ---------------------------------------------------------------------------
 * Send Message between Teams
 * ------------------------------------------------------------------------ */
async function sendMessage(sender, recipient, text) {
  const sortedNames = [sender, recipient].sort();
  const convoId = `${sortedNames[0].replace(/\s/g, '')}_${sortedNames[1].replace(/\s/g, '')}`;
  const messagesRef = collection(db, 'conversations', convoId, 'messages');

  try {
    await addDoc(messagesRef, {
      sender,
      recipient,
      text,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

/* ---------------------------------------------------------------------------
 * Listen for Messages (Player Side) - NOW INCLUDES BROADCASTS
 * ------------------------------------------------------------------------ */
function listenForMyMessages(myTeamName, logBox) {
  const messagesRef = collectionGroup(db, 'messages');
  const sentQuery = query(messagesRef, where('sender', '==', myTeamName));
  const receivedQuery = query(messagesRef, where('recipient', '==', myTeamName));
  // --- THIS IS THE NEW LISTENER FOR BROADCASTS ---
  const broadcastQuery = query(collection(db, 'communications'), orderBy('timestamp', 'asc'));

  const allMyMessages = [];
  const messageIds = new Set();

  const renderLog = () => {
    allMyMessages.sort((a, b) => a.timestamp - b.timestamp);
    logBox.innerHTML = '';
    allMyMessages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const entry = document.createElement('p');

      // --- NEW: Logic to display broadcasts with special styling ---
      if (msg.sender === 'Game Master' || msg.teamName === 'Game Master') {
        entry.style.backgroundColor = '#3a3a24';
        entry.style.padding = '8px';
        entry.style.borderRadius = '5px';
        entry.style.margin = '5px 0';
        entry.innerHTML = `<span style="color: #aaa;">[${time}]</span> <strong style="color: #fdd835; text-transform: uppercase;">Game Master:</strong> <span style="font-weight:bold;">${msg.text || msg.message}</span>`;
      } 
      // --- END of new logic ---
      else {
        const isMine = msg.sender === myTeamName;
        const color = isMine ? '#FFD700' : '#00CED1';
        const prefix = isMine
          ? `<strong style="color:${color};">You ➡️ ${msg.recipient}:</strong>`
          : `<strong style="color:${color};">${msg.sender} ➡️ You:</strong>`;
        entry.innerHTML = `<p>${prefix} ${msg.text} <span style="color:#888;">(${time})</span></p>`;
      }
      logBox.appendChild(entry);
    });
    logBox.scrollTop = logBox.scrollHeight;
  };

  const processSnapshot = (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' && !messageIds.has(change.doc.id)) {
        messageIds.add(change.doc.id);
        allMyMessages.push(change.doc.data());
      }
    });
    renderLog();
  };

  onSnapshot(sentQuery, processSnapshot);
  onSnapshot(receivedQuery, processSnapshot);
  // --- Attach the new broadcast listener ---
  onSnapshot(broadcastQuery, processSnapshot);
}

