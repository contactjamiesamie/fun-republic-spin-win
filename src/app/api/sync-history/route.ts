
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { appendToGoogleSheet } from '@/lib/google/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getTimestamp(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return (value.toDate() as Date).toISOString();
  }

  if (typeof value === 'string' && value) {
    return value;
  }

  return '';
}

export async function POST(req: Request) {
  const secret = process.env.HISTORY_SYNC_SECRET;

  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'History sync is not configured.' },
      { status: 503 }
    );
  }

  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized.' },
      { status: 401 }
    );
  }

  try {
    const snapshot = await adminDb.collection('spins').get();

    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const record = doc.data();

      try {
        const result = await appendToGoogleSheet({
          requestId:
            typeof record.requestId === 'string' && record.requestId
              ? record.requestId
              : doc.id,
          customerName: String(record.customerName ?? ''),
          phoneNumber: String(record.phoneNumber ?? ''),
          billAmount: Number(record.billAmount ?? 0),
          storeName: String(record.storeName ?? 'General'),
          prizeName: String(
            record.wonPrize ??
              (record.prize as { name?: string } | undefined)?.name ??
              'Custom Gift'
          ),
          timestamp: getTimestamp(record.timestamp),
        });

        if (result?.added === false) {
          skipped++;
        } else {
          added++;
        }
      } catch (error) {
        failed++;
        console.error('Historical sync failed for a record:', doc.id, error);
      }
    }

    return NextResponse.json({
      success: failed === 0,
      totalRecords: snapshot.size,
      added,
      skipped,
      failed,
    });
  } catch (error) {
    console.error('Historical Google Sheets sync failed:', error);

    return NextResponse.json(
      { success: false, error: 'Unable to sync historical records.' },
      { status: 500 }
    );
  }
}
