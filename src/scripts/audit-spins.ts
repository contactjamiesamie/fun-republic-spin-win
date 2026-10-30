
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serviceAccountPath = resolve(
  process.cwd(),
  'firebase-new-key.json'
);

const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, 'utf8')
);

const appName = 'spin-audit';

const app =
  getApps().find((item) => item.name === appName) ??
  initializeApp(
    {
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
    },
    appName
  );

const adminDb = getFirestore(app);

type SpinRecord = {
  customerName?: string;
  phoneNumber?: string;
  billAmount?: number | string;
  prize?: {
    name?: string;
    category?: string;
  };
  wonPrize?: string;
  spinDate?: string;
  timestamp?: unknown;
};

function getIndiaDate(rawDate: unknown): string {
  let parsedDate: Date | null = null;

  if (typeof rawDate === 'string') {
    parsedDate = new Date(rawDate);
  } else if (
    rawDate !== null &&
    typeof rawDate === 'object' &&
    'toDate' in rawDate &&
    typeof rawDate.toDate === 'function'
  ) {
    parsedDate = rawDate.toDate();
  }

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsedDate);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function auditSpins() {
  console.log('Reading existing spin records...');

  const snapshot = await adminDb.collection('spins').get();

  const totals: Record<string, number> = {};
  const dailyTotals: Record<string, Record<string, number>> = {};

  const reviewRecords: Array<{
    id: string;
    name: string;
    phone: string;
    bill: number | string;
    prize: string;
    date: string;
    reason: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as SpinRecord;

    const name = (data.customerName || '').trim();
    const phone = (data.phoneNumber || '').trim();
    const bill = Number(data.billAmount);
    const prize = data.prize?.name || data.wonPrize || 'UNKNOWN';

    const date =
      typeof data.spinDate === 'string' && data.spinDate
        ? data.spinDate
        : getIndiaDate(data.timestamp);

    const reasons: string[] = [];

    if (!name || /demo|test|sample/i.test(name)) {
      reasons.push('name missing or looks like demo/test');
    }

    if (!/^\d{10}$/.test(phone) || phone === '0000000000') {
      reasons.push('phone missing or invalid');
    }

    if (!Number.isFinite(bill) || bill <= 0) {
      reasons.push('bill below ₹3,999 or missing');
    }

    if (prize === 'UNKNOWN') {
      reasons.push('prize missing');
    }

    // Provisional only: passing these checks does not prove a real customer win.
    if (reasons.length === 0) {
      totals[prize] = (totals[prize] || 0) + 1;

      if (date) {
        dailyTotals[date] ||= {};
        dailyTotals[date][prize] =
          (dailyTotals[date][prize] || 0) + 1;
      }
    } else {
      reviewRecords.push({
        id: doc.id,
        name: name || '(missing)',
        phone: phone || '(missing)',
        bill: Number.isFinite(bill) ? bill : '(invalid)',
        prize,
        date: date || '(unknown)',
        reason: reasons.join('; '),
      });
    }
  }

  console.log('\nTOTAL RECORDS:', snapshot.size);

  console.log('\nPROVISIONAL COUNTS (review before using):');
  console.table(
    Object.entries(totals).map(([prize, count]) => ({
      prize,
      count,
    }))
  );

  console.log('\nDAILY COUNTS (prize name and India date):');
  console.log(JSON.stringify(dailyTotals, null, 2));

  console.log('\nRECORDS NEEDING REVIEW:', reviewRecords.length);
  console.table(reviewRecords);

  const sample = snapshot.docs[0]?.data();

  console.log('\nSAMPLE RECORD FIELD NAMES:');
  console.log(Object.keys(sample || {}));

  console.log('\nDATE FIELD TYPES:');

  for (const key of ['timestamp', 'createdAt', 'spinDate', 'date']) {
    const value = sample?.[key];

    console.log(
      key,
      value == null
        ? 'missing'
        : value instanceof Date
          ? 'Date'
          : typeof value
    );
  }

  console.log('\nNo Firestore documents were changed.');
}

auditSpins().catch((error) => {
  console.error('Audit failed:', error);
  process.exitCode = 1;
});
