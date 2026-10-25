
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { randomInt } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { appendToGoogleSheet } from '@/lib/google/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVENTORY_PATH = 'spinConfig/prizeInventory';
const TIME_ZONE = 'Asia/Kolkata';

// Carry-forward starts on this date in India.
const CARRY_FORWARD_START_DATE = '2026-10-26';

type Prize = {
  id: string;
  name: string;
  category: string;
  image: string;
};

type PrizeConfig = {
  key: string;
  prize: Prize;
  dailyMax: number;
  totalMax: number;
};

type Inventory = {
  totalCounts?: Record<string, number>;
  dailyCounts?: Record<string, Record<string, number>>;
};

type SheetRecord = {
  requestId: string;
  customerName: string;
  phoneNumber: string;
  billAmount: number;
  storeName: string;
  prizeName: string;
  timestamp: string;
};

const standardPrizes: PrizeConfig[] = [
  {
    key: 'movieTicket',
    prize: {
      id: 'movie_ticket',
      name: 'Movie Ticket',
      category: 'standard',
      image: '/images/prizes/movie-ticket.webp',
    },
    dailyMax: 18,
    totalMax: 300,
  },
  {
    key: 'gamingPoints',
    prize: {
      id: 'gaming_points',
      name: 'Gaming Points',
      category: 'standard',
      image: '/images/prizes/gaming-points.webp',
    },
    dailyMax: 30,
    totalMax: 480,
  },
  {
    key: 'iceCream',
    prize: {
      id: 'ice_cream',
      name: 'Ice Cream',
      category: 'standard',
      image: '/images/prizes/ice-cream.webp',
    },
    dailyMax: 12,
    totalMax: 200,
  },
  {
    key: 'carWash',
    prize: {
      id: 'car_wash',
      name: 'Car Wash Voucher',
      category: 'standard',
      image: '/images/prizes/car-wash.webp',
    },
    dailyMax: 6,
    totalMax: 100,
  },
  {
    key: 'pizza',
    prize: {
      id: 'pizza_discount',
      name: 'Pizza',
      category: 'standard',
      image: '/images/prizes/pizza.webp',
    },
    dailyMax: 10,
    totalMax: 160,
  },
];

const bbqPrize: Prize = {
  id: 'bbq_lunch',
  name: 'Barbeque Nation Lunch',
  category: 'special',
  image: '/images/prizes/bbq-lunch.webp',
};

const mixerPrize: Prize = {
  id: 'mixer_grinder',
  name: 'Mixer Grinder',
  category: 'bumper',
  image: '/images/prizes/mixer-grinder.webp',
};

const customGift: Prize = {
  id: 'gift_box',
  name: 'Custom Gift',
  category: 'fallback',
  image: '/images/prizes/gift-box.webp',
};

function getIndiaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function chooseRandom<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function getCount(
  counts: Record<string, number> | undefined,
  key: string
): number {
  const value = counts?.[key];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : 0;
}

/**
 * Adds calendar days using UTC to avoid server timezone differences.
 */
function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates the daily quota for a standard prize.
 *
 * Carry-forward begins on October 26, 2026.
 * Dates before the start date are not used to calculate
 * any carry-forward balance.
 *
 * For each day from the start date:
 * effective quota = regular quota + previous unused quota
 * unused quota = max(0, effective quota - prizes awarded)
 *
 * Missing dailyCounts dates are treated as zero awards.
 * This function only reads existing counts; it does not
 * reset or rewrite historical inventory data.
 */
function getEffectiveDailyMax(
  key: string,
  baseDailyMax: number,
  dailyCountsByDate: Record<string, Record<string, number>>,
  targetDate: string
): number {
  // Before and on the start date, use the normal quota.
  if (targetDate <= CARRY_FORWARD_START_DATE) {
    return baseDailyMax;
  }

  let carryForward = 0;
  let currentDate = CARRY_FORWARD_START_DATE;

  while (currentDate < targetDate) {
    const effectiveQuota = baseDailyMax + carryForward;
    const used = getCount(dailyCountsByDate[currentDate], key);

    carryForward = Math.max(0, effectiveQuota - used);
    currentDate = addDays(currentDate, 1);
  }

  return baseDailyMax + carryForward;
}

function isStandardAvailable(
  config: PrizeConfig,
  dailyCounts: Record<string, number>,
  totalCounts: Record<string, number>,
  effectiveDailyMax = config.dailyMax
): boolean {
  return (
    getCount(dailyCounts, config.key) < effectiveDailyMax &&
    getCount(totalCounts, config.key) < config.totalMax
  );
}

function getLegacyPrizeId(name: string): string {
  const ids: Record<string, string> = {
    'Movie Ticket': 'movie_ticket',
    'Gaming Points': 'gaming_points',
    'Ice Cream': 'ice_cream',
    'Ice Cream Buy 1 Get 1': 'ice_cream',
    'Car Wash Voucher': 'car_wash',
    'Car Wash Discount': 'car_wash',
    Pizza: 'pizza_discount',
    'Pizza 30% Off': 'pizza_discount',
    'Barbeque Nation Lunch': 'bbq_lunch',
    'Mixer Grinder': 'mixer_grinder',
    'Custom Gift': 'gift_box',
    'Custom Gift Box': 'gift_box',
  };

  return ids[name] ?? 'gift_box';
}

function getSavedTimestamp(value: unknown): string {
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

  return new Date().toISOString();
}

function makeSheetRecord(
  record: Record<string, unknown>,
  requestId: string
): SheetRecord {
  return {
    requestId,
    customerName: String(record.customerName ?? ''),
    phoneNumber: String(record.phoneNumber ?? ''),
    billAmount: Number(record.billAmount ?? 0),
    storeName: String(record.storeName ?? 'General'),
    prizeName: String(
      record.wonPrize ??
        (record.prize as Partial<Prize> | undefined)?.name ??
        'Custom Gift'
    ),
    timestamp: getSavedTimestamp(record.timestamp),
  };
}

/**
 * GET /api/spin
 * Returns current prize availability.
 */
export async function GET() {
  try {
    const snapshot = await adminDb.doc(INVENTORY_PATH).get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prize inventory has not been initialized.',
        },
        { status: 503 }
      );
    }

    const inventory = snapshot.data() as Inventory;
    const today = getIndiaDate();
    const totalCounts = inventory.totalCounts ?? {};
    const allDailyCounts = inventory.dailyCounts ?? {};
    const dailyCounts = allDailyCounts[today] ?? {};

    const statuses = [
      ...standardPrizes.map((config) => {
        const effectiveDailyMax = getEffectiveDailyMax(
          config.key,
          config.dailyMax,
          allDailyCounts,
          today
        );

        return {
          id: config.prize.id,
          isAvailable: isStandardAvailable(
            config,
            dailyCounts,
            totalCounts,
            effectiveDailyMax
          ),
        };
      }),
      {
        id: bbqPrize.id,
        isAvailable:
          getCount(dailyCounts, 'bbq') < 2 &&
          getCount(totalCounts, 'bbq') < 30,
      },
      {
        id: mixerPrize.id,
        isAvailable: getCount(totalCounts, 'mixer') < 1,
      },
      {
        id: customGift.id,
        isAvailable: true,
      },
    ];

    return NextResponse.json({ success: true, statuses });
  } catch (error) {
    console.error('Get Prize Availability Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to check prize availability.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spin
 *
 * Firebase remains the source of truth.
 * Google Sheets is synced after the Firestore transaction commits.
 *
 * Repeating a request ID never awards a second prize.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const customerName =
      typeof body.customerName === 'string'
        ? body.customerName.trim()
        : '';

    const phoneNumber =
      typeof body.phoneNumber === 'string'
        ? body.phoneNumber.trim()
        : '';

    const storeName =
      typeof body.storeName === 'string' && body.storeName.trim()
        ? body.storeName.trim()
        : 'General';

    const bill = Number(body.billAmount);

    if (!/^\d{10}$/.test(phoneNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Enter a valid 10-digit phone number.',
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(bill) || bill < 3999) {
      return NextResponse.json(
        {
          success: false,
          error: 'A minimum bill amount of ₹3,999 is required.',
        },
        { status: 400 }
      );
    }

    if (!customerName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name is required.',
        },
        { status: 400 }
      );
    }

    const requestId =
      typeof body.requestId === 'string' &&
      /^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId)
        ? body.requestId
        : '';

    if (!requestId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing requestId. Reuse the same ID when retrying a spin.',
        },
        { status: 400 }
      );
    }

    const spinRef = adminDb.collection('spins').doc(requestId);
    const inventoryRef = adminDb.doc(INVENTORY_PATH);

    const now = new Date();
    const today = getIndiaDate(now);

    const result = await adminDb.runTransaction(async (tx) => {
      const existingSpin = await tx.get(spinRef);

      if (existingSpin.exists) {
        const existing = existingSpin.data()!;
        const savedPrize = existing.prize as Partial<Prize> | undefined;
        const savedName =
          savedPrize?.name ?? existing.wonPrize ?? 'Custom Gift';

        const prize: Prize = {
          id: savedPrize?.id ?? getLegacyPrizeId(savedName),
          name: savedName,
          category: savedPrize?.category ?? 'fallback',
          image: savedPrize?.image ?? '/images/prizes/gift-box.webp',
        };

        return {
          prize,
          repeated: true,
          sheetRecord: makeSheetRecord(existing, requestId),
        };
      }

      const inventorySnapshot = await tx.get(inventoryRef);

      if (!inventorySnapshot.exists) {
        throw new Error('INVENTORY_NOT_INITIALIZED');
      }

      const inventory = inventorySnapshot.data() as Inventory;
      const totalCounts = inventory.totalCounts ?? {};
      const allDailyCounts = inventory.dailyCounts ?? {};
      const dailyCounts = allDailyCounts[today] ?? {};

      let assignedPrize: Prize;
      let claimedKey: string | null = null;

      if (bill >= 50000) {
        if (getCount(totalCounts, 'mixer') < 1) {
          assignedPrize = mixerPrize;
          claimedKey = 'mixer';
        } else {
          assignedPrize = customGift;
        }
      } else if (bill >= 8000) {
        if (
          getCount(dailyCounts, 'bbq') < 2 &&
          getCount(totalCounts, 'bbq') < 30
        ) {
          assignedPrize = bbqPrize;
          claimedKey = 'bbq';
        } else {
          assignedPrize = customGift;
        }
      } else {
        const availableStandard = standardPrizes.filter((config) => {
          const effectiveDailyMax = getEffectiveDailyMax(
            config.key,
            config.dailyMax,
            allDailyCounts,
            today
          );

          return isStandardAvailable(
            config,
            dailyCounts,
            totalCounts,
            effectiveDailyMax
          );
        });

        if (availableStandard.length === 0) {
          throw new Error('NO_PRIZES_AVAILABLE');
        }

        const selected = chooseRandom(availableStandard);
        assignedPrize = selected.prize;
        claimedKey = selected.key;
      }

      const newTotalCounts = { ...totalCounts };
      const newDailyCounts = { ...dailyCounts };

      if (claimedKey) {
        newTotalCounts[claimedKey] =
          getCount(totalCounts, claimedKey) + 1;

        newDailyCounts[claimedKey] =
          getCount(dailyCounts, claimedKey) + 1;
      }

      const sheetRecord: SheetRecord = {
        requestId,
        customerName,
        phoneNumber,
        billAmount: bill,
        storeName,
        prizeName: assignedPrize.name,
        timestamp: now.toISOString(),
      };

      tx.set(
        inventoryRef,
        {
          totalCounts: newTotalCounts,
          dailyCounts: {
            ...allDailyCounts,
            [today]: newDailyCounts,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.create(spinRef, {
        customerName,
        phoneNumber,
        storeName,
        billAmount: bill,
        prize: assignedPrize,
        wonPrize: assignedPrize.name,
        timestamp: FieldValue.serverTimestamp(),
        spinDate: today,
        requestId,
        googleSheetsSyncStatus: 'pending',
      });

      return {
        prize: assignedPrize,
        repeated: false,
        sheetRecord,
      };
    });

    // Sync Google Sheets only after the Firestore transaction commits.
    // Repeated requests retry syncing the original saved spin.
    let sheetSynced = false;

    try {
      await appendToGoogleSheet(result.sheetRecord);

      await spinRef.set(
        {
          googleSheetsSyncStatus: 'synced',
          googleSheetsSyncedAt: FieldValue.serverTimestamp(),
          googleSheetsSyncError: FieldValue.delete(),
        },
        { merge: true }
      );

      sheetSynced = true;
    } catch (sheetError) {
      // Do not undo a successful spin if Google Sheets is unavailable.
      console.error('Google Sheets sync failed:', sheetError);

      try {
        await spinRef.set(
          {
            googleSheetsSyncStatus: 'pending',
            googleSheetsLastSyncAttemptAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (statusError) {
        console.error('Unable to update Sheets sync status:', statusError);
      }
    }

    return NextResponse.json({
      success: true,
      prize: result.prize,
      repeated: result.repeated,
      sheetSynced,
      sheetSyncStatus: sheetSynced ? 'synced' : 'pending',
    });
  } catch (error) {
    console.error('Spin API Error:', error);

    if (
      error instanceof Error &&
      error.message === 'NO_PRIZES_AVAILABLE'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No standard prizes are currently available. Please contact mall staff.',
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message === 'INVENTORY_NOT_INITIALIZED'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Prize inventory has not been initialized. Please contact the administrator.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unable to process the spin.',
      },
      { status: 500 }
    );
  }
}
