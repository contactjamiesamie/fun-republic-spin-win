
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function resetPrizeInventory() {
  const keyPath = resolve(process.cwd(), 'firebase-new-key.json');
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

  const appName = 'spin-inventory-reset';
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

  const db = getFirestore(app);
  const inventoryRef = db.doc('spinConfig/prizeInventory');

  // Safety check: make sure this script targets the correct Firebase project.
  if (serviceAccount.project_id !== 'fun-republic-spin-win') {
    throw new Error(
      `Wrong Firebase project: ${serviceAccount.project_id}`
    );
  }

  const inventory = {
    totalCounts: {
      movieTicket: 0,
      gamingPoints: 0,
      iceCream: 0,
      carWash: 0,
      pizza: 0,
      bbq: 0,
      mixer: 0,
      customGift: 0,
    },
    dailyCounts: {},
    updatedAt: FieldValue.serverTimestamp(),
  };

  await inventoryRef.set(inventory);

  console.log('✅ Prize inventory initialized successfully.');
  console.log('Firebase project:', serviceAccount.project_id);
  console.log('Document: spinConfig/prizeInventory');
  console.log('All inventory counters set to zero.');
  console.log('Existing spins records were not modified.');
}

resetPrizeInventory().catch((error) => {
  console.error('❌ Failed to reset prize inventory:', error);
  process.exitCode = 1;
});
