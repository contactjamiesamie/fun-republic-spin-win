import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    projectId: "fun-republic-spin-win-36100", // Hardcoded fail-safe project ID
  });
}

export const adminDb = getFirestore();