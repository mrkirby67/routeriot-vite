// ============================================================================
// MODULE: flatTireUI.js
// PURPOSE: Player-side Flat Tire reveal + tow zone check-in flow
// ============================================================================

import { db } from './config.js';
import { generateMiniMap } from './zonesMap.js';
import { calculateDistance } from './zonesUtils.js';
import { showFlashMessage } from './gameUI.js';
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ASSIGNMENT_CONTAINER_ID = 'flat-tire-panel';

let unsubscribe = null;

// ----------------------------------------------------------------------------
// 🎛️ Initialize listener for a team
// ----------------------------------------------------------------------------
export function initializeFlatTireUI(teamName) {
  if (!teamName) {
    console.warn('⚠️ Flat Tire UI not initialized (missing team name).');
    return;
  }

  const assignmentRef = doc(db, 'flatTireAssignments', teamName);
  unsubscribe?.();

  unsubscribe = onSnapshot(assignmentRef, async (snap) => {
    if (!snap.exists()) {
      hidePanel();
      return;
    }

    const data = snap.data();

    if (data.status === 'revealed') {
      const zoneData = await loadZoneData(data.towZoneId);
      renderPanel(teamName, data, zoneData);
    } else if (data.status === 'completed') {
      showCompletionToast(data);
      hidePanel();
    } else {
      hidePanel();
    }
  }, (err) => {
    console.error('❌ Flat Tire assignment listener failed:', err);
    hidePanel();
  });
}

// ----------------------------------------------------------------------------
// 🖼️ Panel rendering
// ----------------------------------------------------------------------------
function renderPanel(teamName, assignment, zoneData) {
  const panel = ensurePanel();

  const zoneName = zoneData?.name || assignment.towZoneId || 'Tow Zone';
  const radiusMeters = getZoneRadiusMeters(zoneData);

  const mapData = { ...(zoneData || {}), name: zoneName };

  panel.innerHTML = `
    <div class="flat-tire-header">
      <h2>🚧 Tow Time!</h2>
      <p>Your ride blew a tire. Hustle to the tow zone.</p>
    </div>
    <div class="flat-tire-body">
      <div class="flat-tire-map">${generateMiniMap(mapData)}</div>
      <div class="flat-tire-details">
        <h3>${zoneName}</h3>
        <p>${formatDueBy(assignment.dueBy)}</p>
        <p class="flat-tire-meta">Stay within ${Math.round(radiusMeters)}m of the marker to check in.</p>
        <button id="flat-tire-checkin" class="flat-tire-btn">Don’t get deflated — Fix that Flat</button>
        <div id="flat-tire-feedback" class="flat-tire-feedback"></div>
      </div>
    </div>
  `;

  const button = panel.querySelector('#flat-tire-checkin');
  const feedback = panel.querySelector('#flat-tire-feedback');

  if (button) {
    button.addEventListener('click', async () => {
      feedback.textContent = 'Checking your location…';
      button.disabled = true;

      try {
        const success = await verifyAndComplete(teamName, assignment, zoneData);
        if (!success) {
          feedback.textContent = 'You are outside the tow zone radius.';
          button.disabled = false;
        }
      } catch (err) {
        console.error('❌ Flat Tire check-in failed:', err);
        feedback.textContent = err.message || 'Failed to verify your location.';
        button.disabled = false;
      }
    });
  }
}

function ensurePanel() {
  let panel = document.getElementById(ASSIGNMENT_CONTAINER_ID);
  if (!panel) {
    panel = document.createElement('div');
    panel.id = ASSIGNMENT_CONTAINER_ID;
    panel.className = 'flat-tire-container';
    document.body.appendChild(panel);
    injectStyles();
  }
  panel.style.display = 'block';
  return panel;
}

function hidePanel() {
  const panel = document.getElementById(ASSIGNMENT_CONTAINER_ID);
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

function injectStyles() {
  if (document.getElementById('flat-tire-styles')) return;
  const style = document.createElement('style');
  style.id = 'flat-tire-styles';
  style.textContent = `
    .flat-tire-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      background: rgba(14, 14, 14, 0.95);
      border: 2px solid #ffb300;
      border-radius: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.6);
      color: #fff;
      z-index: 4000;
      font-family: 'Montserrat', sans-serif;
      overflow: hidden;
      animation: flatTireSlide 0.3s ease-out;
    }

    .flat-tire-header {
      padding: 12px 16px;
      background: linear-gradient(135deg, #ffb300, #ff6f00);
      color: #111;
      text-align: center;
    }

    .flat-tire-header h2 {
      margin: 0;
      font-size: 1.4rem;
    }

    .flat-tire-header p {
      margin: 4px 0 0;
      font-size: 0.9rem;
      color: rgba(0,0,0,0.75);
    }

    .flat-tire-body {
      display: flex;
      flex-direction: column;
      padding: 14px 16px 18px;
      gap: 12px;
    }

    .flat-tire-map img {
      width: 100%;
      border-radius: 10px;
      border: 1px solid #333;
    }

    .flat-tire-details h3 {
      margin: 0 0 4px 0;
      font-size: 1.2rem;
      color: #ffe082;
    }

    .flat-tire-details p {
      margin: 4px 0;
      font-size: 0.85rem;
      color: #ddd;
    }

    .flat-tire-meta {
      color: #90caf9;
      font-size: 0.78rem;
    }

    .flat-tire-btn {
      margin-top: 10px;
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #00e676, #00acc1);
      border: none;
      border-radius: 999px;
      font-weight: bold;
      color: #00363a;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .flat-tire-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(0, 230, 118, 0.35);
    }

    .flat-tire-btn:disabled {
      opacity: 0.7;
      cursor: default;
      box-shadow: none;
    }

    .flat-tire-feedback {
      margin-top: 8px;
      min-height: 18px;
      font-size: 0.8rem;
      color: #ffcc80;
    }

    @keyframes flatTireSlide {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function formatDueBy(dueBy) {
  if (!dueBy) return 'Complete ASAP.';
  try {
    const date = dueBy?.toDate ? dueBy.toDate() : new Date(dueBy);
    if (Number.isNaN(date.getTime())) return 'Complete ASAP.';
    return `Due by ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return 'Complete ASAP.';
  }
}

// ----------------------------------------------------------------------------
// 📍 Location verification & completion
// ----------------------------------------------------------------------------
async function verifyAndComplete(teamName, assignment, zoneData) {
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation not supported on this device.');
  }

  const coords = zoneData?.gps?.split(',').map(Number) || [];
  if (coords.length !== 2 || coords.some(Number.isNaN)) {
    throw new Error('Tow zone GPS data is invalid.');
  }

  const radiusMeters = getZoneRadiusMeters(zoneData);
  const currentPos = await getCurrentPosition();
  const distanceKm = calculateDistance(
    coords[0],
    coords[1],
    currentPos.coords.latitude,
    currentPos.coords.longitude
  );

  const distanceMeters = distanceKm * 1000;
  if (distanceMeters > radiusMeters) {
    return false;
  }

  await markAssignmentComplete(teamName, assignment, zoneData, currentPos);
  return true;
}

function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getZoneRadiusMeters(zoneData) {
  const diameterKm = parseFloat(zoneData?.diameter);
  if (Number.isNaN(diameterKm) || diameterKm <= 0) return 50;
  return (diameterKm / 2) * 1000;
}

async function markAssignmentComplete(teamName, assignment, zoneData, geoPosition) {
  const assignmentRef = doc(db, 'flatTireAssignments', teamName);

  await updateDoc(assignmentRef, {
    status: 'completed',
    completedAt: Timestamp.fromMillis(Date.now()),
    updatedAt: serverTimestamp()
  });

  const zoneName = zoneData?.name || assignment.towZoneId || 'Tow Zone';

  await addDoc(collection(db, 'communications'), {
    teamName: 'Game Master',
    message: `🔧 ${teamName} fixed the flat at ${zoneName}.`,
    type: 'flatTireCompleted',
    isBroadcast: true,
    createdAt: serverTimestamp(),
    meta: {
      team: teamName,
      towZone: assignment.towZoneId,
      location: {
        lat: geoPosition.coords.latitude,
        lng: geoPosition.coords.longitude,
        accuracy: geoPosition.coords.accuracy
      }
    }
  });

  hidePanel();
}

function showCompletionToast(assignment) {
  if (!assignment?.towZoneId) return;
  try {
    showFlashMessage('✅ Flat fixed! Back on the road.', '#2e7d32', 2000);
  } catch {}
}

// ----------------------------------------------------------------------------
// 🔍 Zone data loader (cached)
// ----------------------------------------------------------------------------
async function loadZoneData(zoneId) {
  if (!zoneId) return null;
  if (zoneCache.has(zoneId)) return zoneCache.get(zoneId);

  const zoneSnap = await getDoc(doc(db, 'zones', zoneId));
  if (zoneSnap.exists()) {
    const data = zoneSnap.data();
    zoneCache.set(zoneId, data);
    return data;
  }
  return null;
}

const zoneCache = new Map();
