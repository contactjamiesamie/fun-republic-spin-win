import { NextResponse } from 'next/server';
import { PRIZES } from '@/config/prizes';
import { appendToGoogleSheet } from '@/lib/google/sheets';

// Campaign runtime state tracker
let globalCampaignState: Record<string, any> = {
  mixer_grinder_stock: 1,
  bluetooth_speaker_stock: 1,
  bbq_lunch_awarded_count: 0,
  last_award_date: '',
};

function getKolkataDateInfo() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(new Date());
  const dateMap: Record<string, string> = {};
  parts.forEach(({ type, value }) => {
    dateMap[type] = value;
  });

  const dateString = `${dateMap['year']}-${dateMap['month']}-${dateMap['day']}`;
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const weekdayNumber = weekdayMap[dateMap['weekday']] ?? 1;

  return { dateString, weekdayNumber };
}

export async function GET() {
  const { dateString, weekdayNumber } = getKolkataDateInfo();
  
  if (globalCampaignState['last_award_date'] !== dateString) {
    globalCampaignState['bbq_lunch_awarded_count'] = 0;
    globalCampaignState['last_award_date'] = dateString;
  }

  const mixerGrinderStock = globalCampaignState['mixer_grinder_stock'] ?? 1;
  const mixerGrinderAwardTimestamp = globalCampaignState['mixer_grinder_award_timestamp'];

  let activateBluetoothSpeaker = false;
  if (mixerGrinderStock <= 0 && mixerGrinderAwardTimestamp) {
    const diffDays = (new Date().getTime() - new Date(mixerGrinderAwardTimestamp).getTime()) / (1000 * 3600 * 24);
    if (diffDays >= 3) activateBluetoothSpeaker = true;
  }

  const isWeekend = weekdayNumber === 6 || weekdayNumber === 0;
  const bbqAwardedToday = globalCampaignState['bbq_lunch_awarded_count'] ?? 0;

  const statuses = PRIZES.map((prize) => {
    let isAvailable = true;
    if (prize.id === 'mixer_grinder' && mixerGrinderStock <= 0) isAvailable = false;
    if (prize.id === 'bluetooth_speaker' && (!activateBluetoothSpeaker || (globalCampaignState['bluetooth_speaker_stock'] ?? 1) <= 0)) isAvailable = false;
    if (prize.id === 'bbq_lunch' && (isWeekend || bbqAwardedToday >= 2)) isAvailable = false;
    
    return {
      id: prize.id,
      isAvailable,
    };
  });

  return NextResponse.json({ statuses });
}

export async function POST(request: Request) {
  try {
    console.log('ENV CHECK -> Sheet ID loaded:', process.env.GOOGLE_SHEET_ID ? 'YES' : 'NO');
    console.log('ENV CHECK -> Client Email loaded:', process.env.GOOGLE_SHEETS_CLIENT_EMAIL ? 'YES' : 'NO');

    const body = await request.json();
    const { verifiedAmount, brandName, customerName, mobileNumber } = body;

    const billAmount = Number(verifiedAmount || 5000);
    const brandId = (brandName || 'general').toLowerCase().trim().replace(/\s+/g, '_');
    const { dateString, weekdayNumber } = getKolkataDateInfo();
    const isWeekend = weekdayNumber === 6 || weekdayNumber === 0;

    if (globalCampaignState['last_award_date'] !== dateString) {
      globalCampaignState['bbq_lunch_awarded_count'] = 0;
      globalCampaignState['last_award_date'] = dateString;
    }

    const mixerGrinderStock = globalCampaignState['mixer_grinder_stock'] ?? 1;
    const mixerGrinderAwardTimestamp = globalCampaignState['mixer_grinder_award_timestamp'];
    let activateBluetoothSpeaker = false;

    if (mixerGrinderStock <= 0 && mixerGrinderAwardTimestamp) {
      const diffDays = (new Date().getTime() - new Date(mixerGrinderAwardTimestamp).getTime()) / (1000 * 3600 * 24);
      if (diffDays >= 3) activateBluetoothSpeaker = true;
    }

    const bbqAwardedToday = globalCampaignState['bbq_lunch_awarded_count'] ?? 0;
    const bbqAvailable = !isWeekend && bbqAwardedToday < 2 && (!PRIZES.find(p => p.id === 'bbq_lunch')?.excludedBrands?.includes(brandId));

    let eligiblePrizes = [];

    if (billAmount > 50000) {
      eligiblePrizes = PRIZES.filter(p => {
        if (p.id === 'mixer_grinder') return mixerGrinderStock > 0;
        if (p.id === 'bluetooth_speaker') return activateBluetoothSpeaker && (globalCampaignState['bluetooth_speaker_stock'] ?? 1) > 0;
        return false;
      });
    } else if (billAmount > 8000) {
      eligiblePrizes = PRIZES.filter(p => {
        if (p.tier === 'mega') return false;
        if (p.id === 'bbq_lunch' && !bbqAvailable) return false;
        if (p.excludedBrands && p.excludedBrands.includes(brandId)) return false;
        return true;
      });
    } else {
      eligiblePrizes = PRIZES.filter(p => {
        if (p.tier !== 'general') return false;
        if (p.excludedBrands && p.excludedBrands.includes(brandId)) return false;
        return true;
      });
    }

    if (eligiblePrizes.length === 0) {
      eligiblePrizes = PRIZES.filter(p => p.tier === 'general' && (!p.excludedBrands || !p.excludedBrands.includes(brandId)));
    }

    const randomIndex = Math.floor(Math.random() * eligiblePrizes.length);
    const wonPrize = eligiblePrizes[randomIndex];

    if (wonPrize.id === 'mixer_grinder') {
      globalCampaignState['mixer_grinder_stock'] = 0;
      globalCampaignState['mixer_grinder_award_timestamp'] = new Date().toISOString();
    } else if (wonPrize.id === 'bluetooth_speaker') {
      globalCampaignState['bluetooth_speaker_stock'] = 0;
    } else if (wonPrize.id === 'bbq_lunch') {
      globalCampaignState['bbq_lunch_awarded_count'] = bbqAwardedToday + 1;
    }

    // --- SYNC TO GOOGLE SHEETS ---
    const timestampStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    try {
      await appendToGoogleSheet({
        customerName: customerName || 'Participant',
        phoneNumber: mobileNumber || 'N/A',
        billAmount,
        storeName: brandName || 'General',
        prizeName: wonPrize.name,
        timestamp: timestampStr,
      });
      console.log('Successfully synced participant record to Google Sheet!');
    } catch (sheetErr) {
      console.error('Google Sheet sync error:', sheetErr);
    }

    return NextResponse.json({
      success: true,
      prize: wonPrize,
      duplicate: false,
    });

  } catch (error: any) {
    console.error('Spin API error:', error);
    return NextResponse.json({
      success: true,
      prize: PRIZES[0],
      duplicate: false,
    });
  }
}