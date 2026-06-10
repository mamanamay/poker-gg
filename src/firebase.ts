/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getDatabase, ref, onValue, set, update, off } from 'firebase/database';

/**
 * =========================================================================
 * FIREBASE INITIALIZATION CODE BLOCK
 * =========================================================================
 * Please replace the placeholder values below with your actual Firebase 
 * project configuration details from the Firebase Console 
 * (Project Settings -> General -> Your Apps).
 * 
 * To run with Live Realtime Database, make sure you have enabled:
 * 1. Firebase Authentication (under Build -> Authentication -> Sign-in Method, enable the "Anonymous" provider)
 * 2. Realtime Database (under Build -> Realtime Database, create a database and configure read/write rules to allowing access)
 * =========================================================================
 */
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID_HERE.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID_HERE-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_PROJECT_ID_HERE.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Check if we have valid environment config or fallback to custom runtime state
export function getFirebaseConfig() {
  // Check if standard Vite environment variables exist
  const meta = import.meta as any;
  const envApiKey = meta?.env?.VITE_FIREBASE_API_KEY;
  const envDbUrl = meta?.env?.VITE_FIREBASE_DATABASE_URL;
  const envProjId = meta?.env?.VITE_FIREBASE_PROJECT_ID;

  if (envApiKey && envApiKey !== "YOUR_API_KEY_HERE") {
    return {
      apiKey: envApiKey,
      authDomain: meta?.env?.VITE_FIREBASE_AUTH_DOMAIN || `${envProjId}.firebaseapp.com`,
      databaseURL: envDbUrl,
      projectId: envProjId,
      storageBucket: meta?.env?.VITE_FIREBASE_STORAGE_BUCKET || `${envProjId}.appspot.com`,
      messagingSenderId: meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: meta?.env?.VITE_FIREBASE_APP_ID || ""
    };
  }

  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Core lazy-initialization block to prevent breaking the build if the user's config is empty.
 */
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseDb: any = null;

export function isFirebaseConfigured(config: typeof DEFAULT_FIREBASE_CONFIG = getFirebaseConfig()): boolean {
  return !!config.apiKey && 
         config.apiKey !== "YOUR_API_KEY_HERE" && 
         config.apiKey.trim() !== "" &&
         !!config.databaseURL && 
         config.databaseURL !== "https://YOUR_PROJECT_ID_HERE-default-rtdb.firebaseio.com";
}

export function initFirebase(customConfig?: typeof DEFAULT_FIREBASE_CONFIG) {
  const activeConfig = customConfig || getFirebaseConfig();
  
  if (!isFirebaseConfigured(activeConfig)) {
    return null;
  }

  try {
    if (!getApps().length) {
      firebaseApp = initializeApp(activeConfig);
    } else {
      firebaseApp = getApp();
    }
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getDatabase(firebaseApp);
    return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb };
  } catch (error) {
    console.error("Failed to initialize Firebase Web SDK:", error);
    return null;
  }
}

/**
 * Triggers Anonymous Authentication sign-in
 */
export async function authenticateAnonymously(authInstance: any): Promise<User | null> {
  if (!authInstance) return null;
  try {
    const credential = await signInAnonymously(authInstance);
    return credential.user;
  } catch (error) {
    console.error("Firebase Anonymous login failed:", error);
    throw error;
  }
}

/**
 * Subscribes to the Realtime Database and listens to updates for the specified poker room
 */
export function listenToRoomState(
  dbInstance: any,
  roomId: string,
  onUpdate: (data: { public: any; players: any; privateCards: any }) => void,
  onError?: (err: any) => void
) {
  if (!dbInstance) return () => {};

  const roomRef = ref(dbInstance, `rooms/${roomId}`);
  
  const listener = onValue(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      onUpdate({
        public: val.public || null,
        players: val.players || {},
        privateCards: val.private || {}
      });
    } else {
      onUpdate({ public: null, players: {}, privateCards: {} });
    }
  }, (err) => {
    console.error("Database read error:", err);
    if (onError) onError(err);
  });

  // Return unsubscribe handle
  return () => {
    off(roomRef, "value", listener);
  };
}

/**
 * Updates a player's hand chips or cards on Firebase directly
 */
export async function writeRoomStateToFirebase(dbInstance: any, roomId: string, stateUpdate: any) {
  if (!dbInstance) return;
  const roomRef = ref(dbInstance, `rooms/${roomId}`);
  try {
    await update(roomRef, stateUpdate);
  } catch (error) {
    console.error("Failed to write room state to Firebase RTDB:", error);
    throw error;
  }
}

/**
 * Push an game action to Firebase RTDB
 */
export async function pushPlayerActionToFirebase(
  dbInstance: any,
  roomId: string,
  playerId: string,
  action: string,
  betAmount: number,
  newChips: number,
  currentBet: number,
  nextActivePlayerId: string | null
) {
  if (!dbInstance) return;
  
  const updates: any = {};
  updates[`rooms/${roomId}/players/${playerId}/lastAction`] = action;
  updates[`rooms/${roomId}/players/${playerId}/currentBet`] = currentBet;
  updates[`rooms/${roomId}/players/${playerId}/chips`] = newChips;
  updates[`rooms/${roomId}/public/activePlayerId`] = nextActivePlayerId;
  
  try {
    await update(ref(dbInstance), updates);
  } catch (err) {
    console.error("Firebase RTDB action push failure:", err);
    throw err;
  }
}
