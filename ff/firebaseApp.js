import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  initializeAuth,
  browserSessionPersistence,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig } from './firebaseConfig.js';

if (!firebaseConfig) {
  throw new Error('Firebase config missing. Ensure core/config exports firebaseConfig.');
}

export const app = initializeApp(firebaseConfig);
const authInstance = initializeAuth(app, {
  persistence: browserSessionPersistence,
});
const firestoreInstance = getFirestore(app);
const realtimeInstance = getDatabase(app);

let anonPromise = null;

export async function ensureAnonymousAuth() {
  if (authInstance.currentUser) {
    return authInstance.currentUser;
  }
  if (!anonPromise) {
    anonPromise = signInAnonymously(authInstance);
  }
  const cred = await anonPromise;
  return cred.user;
}

export function getAuthInstance() {
  return authInstance;
}

export function getFirestoreInstance() {
  return firestoreInstance;
}

export function getRealtimeInstance() {
  return realtimeInstance;
}

export { authInstance as auth, firestoreInstance as firestore, realtimeInstance as realtime };
