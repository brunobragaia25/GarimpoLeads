import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
  return initializeApp({ credential: cert(credentials) });
}

export function getGestaoDevzFirestore() {
  return getFirestore(getFirebaseApp());
}
