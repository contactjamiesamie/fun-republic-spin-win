
import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_KEY environment variable'
    );
  }

  let serviceAccount: Record<string, unknown>;

  try {
    const json = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');

    serviceAccount = JSON.parse(json);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY must contain valid service-account JSON or base64-encoded JSON'
    );
  }

  if (
    typeof serviceAccount.project_id !== 'string' ||
    typeof serviceAccount.client_email !== 'string' ||
    typeof serviceAccount.private_key !== 'string'
  ) {
    throw new Error(
      'Service account must contain project_id, client_email and private_key'
    );
  }

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
  };
}

const appName = 'spin-win-admin';

const adminApp =
  getApps().find((app) => app.name === appName) ??
  initializeApp(
    {
      credential: cert(getServiceAccount()),
    },
    appName
  );

export const adminDb = getFirestore(adminApp);
