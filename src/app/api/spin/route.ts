
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { randomInt } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { appendToGoogleSheet } from '@/lib/google/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIME_ZONE = 'Asia/Kolkata';
const CAMPAIGN_START = '2026-10-31';
const CAMPAIGN_END = '2026-11-07';

// Separate document: existing inventory and historical counters are untouched.
const CAMPAIGN_INVENTORY_PATH =
  'spinConfig/funRepublicCampaign20261031';

type Prize = {
  id: string;
  name: string;
  category: string;
  image: string;
};

type PrizeConfig = {
  key: string;
  prize: Prize;
  totalStock: number;
};

type CampaignInventory = {
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

const prizes: PrizeConfig[] = [
  {
    key: 'movieTicket',
    totalStock: 242,
    prize: {
      id: 'movie_ticket',
      name: 'Movie Ticket',
      category: 'standard',
      image: '/images/prizes/movie-ticket.webp',
    },
  },
  {
    key: 'bbq',
    totalStock: 20,
    prize: {
      id: 'bbq_lunch',
      name: 'Barbeque Nation Lunch',
      category: 'special',
      image: '/images/prizes/bbq-lunch.webp',
    },
  },
  {
    key: 'gamingPoints',
    totalStock: 426,
    prize: {
      id: 'gaming_points',
      name: '250 Gaming Points',
      category: 'standard',
      image: '/images/prizes/gaming-points.webp',
    },
  },
  {
    key: 'pizza',
    totalStock: 130,
    prize: {
      id: 'pizza_discount',
      name: 'Pizza',
      category: 'standard',
      image: '/images/prizes/pizza.webp',
    },
  },
  {
    key: 'carWash',
    totalStock: 83,
    prize: {
      id: 'car_wash',
      name: 'Car Wash Voucher',
      category: 'standard',
      image: '/images/prizes/car-wash.webp',
    },
  },
  {
    key: 'iceCream',
    totalStock: 135,
    prize: {
      id: 'ice_cream',
      name: 'Ice Cream',
      category: 'standard',
      image: '/images/prizes/ice-cream.webp',
    },
  },
];

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

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCount(
  counts: Record<string, number> | undefined,
  key: string
): number {
  const value = counts?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function isCampaignDate(date: string): boolean {
  return date >= CAMPAIGN_START && date <= CAMPAIGN_END;
}

/**
 * Divides the total stock across 8 days.
 * Any remainder is allocated one at a time to the earliest days.
 *
 * Example: 242 / 8 = 30 remainder 2
 * Days 1 and 2 get 31; days 3–8 get 30.
 */
function getBaseDailyQuota(totalStock: number, dayIndex: number): number {
  const days = 8;
  const base = Math.floor(totalStock / days);
  const remainder = totalStock % days;

  return base + (dayIndex < remainder ? 1 : 0);
}

/**
 * Calculates today's quota, including all unused quota carried
 * forward from previous campaign days.
 */
function getEffectiveDailyQuota(
  prize: PrizeConfig,
  targetDate: string,
  dailyCounts: Record<string, Record<string, number>>
): number {
  let carryForward = 0;
  let currentDate = CAMPAIGN_START;
  let dayIndex = 0;

  while (currentDate <= targetDate) {
    const baseQuota = getBaseDailyQuota(prize.totalStock, dayIndex);
    const effectiveQuota = baseQuota + carryForward;
    const awarded = getCount(dailyCounts[currentDate], prize.key);

    if (currentDate === targetDate) {
      return Math.max(0, effectiveQuota);
    }

    carryForward = Math.max(0, effectiveQuota - awarded);
    currentDate = addDays(currentDate, 1);
    dayIndex++;
  }

  return 0;
}

function getAvailableForToday(
  prize: PrizeConfig,
  today: string,
  inventory: CampaignInventory
): number {
  if (!isCampaignDate(today)) return 0;

  const allDailyCounts = inventory.dailyCounts ?? {};
  const todayCounts = allDailyCounts[today] ?? {};
  const totalCounts = inventory.totalCounts ?? {};

  const dailyQuota = getEffectiveDailyQuota(
    prize,
    today,
    allDailyCounts
  );

  const dailyRemaining = Math.max(
    0,
    dailyQuota - getCount(todayCounts, prize.key)
  );

  const totalRemaining = Math.max(
    0,
    prize.totalStock - getCount(totalCounts, prize.key)
  );

  return Math.min(dailyRemaining, totalRemaining);
}

/**
 * Randomly selects one remaining prize unit.
 * A prize with 20 remaining units has twice the selection weight
 * of a prize with 10 remaining units.
 */
function chooseWeightedPrize(
  availablePrizes: Array<{ config: PrizeConfig; remaining: number }>
): PrizeConfig {
  const totalWeight = availablePrizes.reduce(
    (sum, item) => sum + item.remaining,
    0
  );

  if (totalWeight <= 0) {
    throw new Error('NO_PRIZES_AVAILABLE');
  }

  let selectedNumber = randomInt(totalWeight);

  for (const item of availablePrizes) {
    if (selectedNumber < item.remaining) {
      return item.config;
    }

    selectedNumber -= item.remaining;
  }

  throw new Error('NO_PRIZES_AVAILABLE');
}

function getLegacyPrizeId(name: string): string {
  const ids: Record<string, string> = {
    'Movie Ticket': 'movie_ticket',
    'Barbeque Nation Lunch': 'bbq_lunch',
    '250 Gaming Points': 'gaming_points',
    'Gaming Points': 'gaming_points',
    Pizza: 'pizza_discount',
    'Car Wash Voucher': 'car_wash',
    'Ice Cream': 'ice_cream',
    'Mixer Grinder': 'mixer_grinder',
    'Custom Gift': 'gift_box',
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
  const savedPrize = record.prize as Partial<Prize> | undefined;

  return {
    requestId,
    customerName: String(record.customerName ?? ''),
    phoneNumber: String(record.phoneNumber ?? ''),
    billAmount: Number(record.billAmount ?? 0),
    storeName: String(record.storeName ?? 'General'),
    prizeName: String(
      record.wonPrize ?? savedPrize?.name ?? 'Custom Gift'
    ),
    timestamp: getSavedTimestamp(record.timestamp),
  };
}

/**
 * GET /api/spin
 * Returns today's availability and remaining daily quantities.
 */
export async function GET() {
  try {
    const today = getIndiaDate();
    const snapshot = await adminDb
      .doc(CAMPAIGN_INVENTORY_PATH)
      .get();

    const inventory = snapshot.exists
      ? (snapshot.data() as CampaignInventory)
      : {};

    const statuses = prizes.map((config) => {
      const remaining = getAvailableForToday(
        config,
        today,
        inventory
      );

      return {
        id: config.prize.id,
        isAvailable: remaining > 0,
        remaining,
        totalStock: config.totalStock,
      };
    });

    return NextResponse.json({
      success: true,
      campaign: {
        startDate: CAMPAIGN_START,
        endDate: CAMPAIGN_END,
        today,
        isActive: isCampaignDate(today),
      },
      statuses,
    });
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
 * Firestore is the source of truth.
 * Prize selection and inventory updates happen atomically.
 * Google Sheets sync happens only after the transaction commits.
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

    if (!Number.isFinite(bill) || bill <= 0) {
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
    const campaignInventoryRef = adminDb.doc(
      CAMPAIGN_INVENTORY_PATH
    );

    const now = new Date();
    const today = getIndiaDate(now);

    const result = await adminDb.runTransaction(async (tx) => {
      // Check idempotency first. A retry returns the original result,
      // even if the campaign date has since ended.
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
          image:
            savedPrize?.image ?? '/images/prizes/gift-box.webp',
        };

        return {
          prize,
          repeated: true,
          sheetRecord: makeSheetRecord(existing, requestId),
        };
      }

      if (!isCampaignDate(today)) {
        throw new Error('CAMPAIGN_NOT_ACTIVE');
      }

      const inventorySnapshot = await tx.get(
        campaignInventoryRef
      );

      const inventory: CampaignInventory =
        inventorySnapshot.exists
          ? (inventorySnapshot.data() as CampaignInventory)
          : {};

      const totalCounts = inventory.totalCounts ?? {};
      const allDailyCounts = inventory.dailyCounts ?? {};
      const todayCounts = allDailyCounts[today] ?? {};

      const availablePrizes = prizes
        .map((config) => ({
          config,
          remaining: getAvailableForToday(
            config,
            today,
            inventory
          ),
        }))
        .filter((item) => item.remaining > 0);

      if (availablePrizes.length === 0) {
        throw new Error('NO_PRIZES_AVAILABLE');
      }

      const selected = chooseWeightedPrize(availablePrizes);
      const assignedPrize = selected.prize;

      const newTotalCounts = {
        ...totalCounts,
        [selected.key]:
          getCount(totalCounts, selected.key) + 1,
      };

      const newTodayCounts = {
        ...todayCounts,
        [selected.key]:
          getCount(todayCounts, selected.key) + 1,
      };

      const sheetRecord: SheetRecord = {
        requestId,
        customerName,
        phoneNumber,
        billAmount: bill,
        storeName,
        prizeName: assignedPrize.name,
        timestamp: now.toISOString(),
      };

      // This creates the campaign inventory document only if it
      // does not exist. It never resets the old inventory document.
      tx.set(
        campaignInventoryRef,
        {
          campaignStart: CAMPAIGN_START,
          campaignEnd: CAMPAIGN_END,
          totalCounts: newTotalCounts,
          dailyCounts: {
            ...allDailyCounts,
            [today]: newTodayCounts,
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
        campaignId: 'funRepublicCampaign20261031',
        googleSheetsSyncStatus: 'pending',
      });

      return {
        prize: assignedPrize,
        repeated: false,
        sheetRecord,
      };
    });

    // Keep Google Sheets sync outside the transaction.
    // A failed sync does not undo a successful spin.
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
      console.error('Google Sheets sync failed:', sheetError);

      try {
        await spinRef.set(
          {
            googleSheetsSyncStatus: 'pending',
            googleSheetsLastSyncAttemptAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (statusError) {
        console.error(
          'Unable to update Sheets sync status:',
          statusError
        );
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
      error.message === 'CAMPAIGN_NOT_ACTIVE'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The Spin & Win campaign is active only from October 31 to November 7, 2026.',
        },
        { status: 403 }
      );
    }

    if (
      error instanceof Error &&
      error.message === 'NO_PRIZES_AVAILABLE'
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No prizes are currently available. Please contact mall staff.',
        },
        { status: 409 }
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
