'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Award, Sparkles } from 'lucide-react';

const PRIZE_WEDGE_INDEXES: Record<string, number> = {
  gift_box: 0,
  movie_ticket: 1,
  bbq_lunch: 2,
  gaming_points: 3,
  mixer_grinder: 4,
  pizza_discount: 5,
  car_wash: 6,
  ice_cream: 7,
};

type CustomerData = {
  fullName?: string;
  billAmount?: string | number;
  storeName?: string;
  mobileNumber?: string;
};

type Prize = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

type SpinResponse = {
  success?: boolean;
  error?: string;
  prize?: Prize;
  statuses?: Array<{
    id: string;
    isAvailable: boolean;
  }>;
};

// Generates an ID even in browsers where crypto.randomUUID is unavailable.
// The same ID is retained in requestIdRef when retrying the same request.
function generateRequestId(): string {
  try {
    if (
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.randomUUID === 'function'
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Use the fallback below.
  }

  return `spin_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export default function SpinPage() {
  const router = useRouter();

  const [customerName, setCustomerName] = useState('Customer');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const requestIdRef = useRef<string | null>(null);
  const spinStartedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    const existingPrize = sessionStorage.getItem('wonPrize');

    if (existingPrize) {
      router.replace('/result');
      return;
    }

    try {
      const storedData = sessionStorage.getItem('customerData');

      if (storedData) {
        const parsed: CustomerData = JSON.parse(storedData);

        if (parsed.fullName?.trim()) {
          setCustomerName(parsed.fullName.trim().split(/\s+/)[0]);
        }
      }
    } catch {
      setErrorMessage(
        'Unable to read customer details. Please register again.'
      );
    }

    // Check prize availability. The server remains responsible for
    // validating stock and selecting the actual prize.
    fetch('/api/spin')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to fetch prize availability');
        }

        return (await response.json()) as SpinResponse;
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data.statuses)) return;

        // Availability is optional for this page's UI.
        // The server validates availability when a spin is submitted.
      })
      .catch(() => {
        // Do not block spinning if the optional availability request fails.
      });

    return () => {
      cancelled = true;

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [router]);

  const handleSpin = async () => {
    // Prevent two buttons or rapid taps from starting concurrent requests.
    if (spinStartedRef.current) return;

    spinStartedRef.current = true;
    setIsSpinning(true);
    setErrorMessage('');

    try {
      const storedData = sessionStorage.getItem('customerData');

      if (!storedData) {
        throw new Error(
          'Customer details not found. Please register again.'
        );
      }

      const parsed: CustomerData = JSON.parse(storedData);

      const customerNameValue = parsed.fullName?.trim() || '';
      const phoneNumber = String(parsed.mobileNumber || '').trim();
      const billAmount = Number(parsed.billAmount);

      if (!customerNameValue) {
        throw new Error(
          'Customer name is missing. Please register again.'
        );
      }

      if (!/^\d{10}$/.test(phoneNumber)) {
        throw new Error(
          'Please register with a valid 10-digit phone number.'
        );
      }

      if (!Number.isFinite(billAmount) || billAmount <= 0) {
        throw new Error(
          'A minimum bill amount of ₹3,999 is required.'
        );
      }

      // Create once and retain the ID after a failed request so that
      // retrying uses the same ID. The API must implement idempotency too.
      if (!requestIdRef.current) {
        requestIdRef.current = generateRequestId();
      }

      const requestId = requestIdRef.current;

      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: customerNameValue,
          phoneNumber,
          storeName: parsed.storeName || 'General',
          billAmount,
          requestId,
        }),
      });

      const data = (await response.json()) as SpinResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process spin.');
      }

      if (!data.prize) {
        throw new Error(
          'The server did not return a prize. Please contact mall staff.'
        );
      }

      const wonPrize = data.prize;

      // Store the server-selected prize for the result page.
      sessionStorage.setItem('wonPrize', JSON.stringify(wonPrize));

      // Match the prize ID returned by /api/spin to the wheel artwork.
      const wedgeIndex =
        typeof wonPrize.id === 'string' &&
        PRIZE_WEDGE_INDEXES[wonPrize.id] !== undefined
          ? PRIZE_WEDGE_INDEXES[wonPrize.id]
          : 0;

      const degreesPerWedge = 360 / 8;

      // Rotate multiple complete turns, then align the selected wedge
      // with the pointer. This assumes the artwork's wedge orientation
      // matches the PRIZE_WEDGE_INDEXES mapping above.
      const targetAngle = 360 - wedgeIndex * degreesPerWedge;
      const totalSpins = 360 * 6;

      setRotation(
        (previousRotation) =>
          previousRotation + totalSpins + targetAngle
      );

      redirectTimerRef.current = setTimeout(() => {
        setIsSpinning(false);
        router.replace('/result');
      }, 4000);
    } catch (err: unknown) {
      setIsSpinning(false);
      spinStartedRef.current = false;

      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.';

      setErrorMessage(message);

      // Keep requestIdRef unchanged. If the server processed the request
      // but the response failed, retrying can reuse the same request ID.
    }
  };

  return (
    <main
      className="min-h-screen w-full flex flex-col justify-between items-center text-[#f3f4f6] relative overflow-x-hidden px-4 py-4"
      style={{
        backgroundImage:
          "url('/images/backgrounds/customer-background.webp')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] pointer-events-none" />

      {/* Top Greeting Header */}
      <div className="w-full max-w-sm flex justify-between items-center relative z-10 px-2 pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="text-[#D4AF37] text-lg font-bold"
          disabled={isSpinning}
        >
          &lt;
        </button>

        <div className="bg-[#141721]/90 border border-[#D4AF37]/50 px-3 py-1 rounded-full text-xs font-medium text-[#F7E7CE] shadow-md flex items-center space-x-1.5">
          <span className="text-gray-400">👤 Hi,</span>
          <span className="font-bold text-[#D4AF37]">
            {customerName}!
          </span>
        </div>
      </div>

      <div className="w-full max-w-[380px] relative z-10 my-auto flex flex-col items-center">
        {/* Step Progress */}
        <div className="w-full flex items-center justify-between mb-3 px-8">
          <div className="flex flex-col items-center opacity-75">
            <div className="w-5 h-5 rounded-full bg-[#1e222f] text-[#D4AF37] flex items-center justify-center font-bold border border-[#D4AF37]/50 text-[9px]">
              ✓
            </div>
            <span className="text-gray-300 text-[8.5px] mt-0.5">
              Register
            </span>
          </div>

          <div className="flex-1 h-[1.5px] bg-[#D4AF37] mx-4 -mt-3" />

          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full bg-gradient-to-b from-[#d9534f] to-[#a94442] text-white flex items-center justify-center font-bold border border-[#D4AF37] shadow text-[9px]">
              2
            </div>
            <span className="text-[#D4AF37] text-[8.5px] font-medium mt-0.5">
              Spin &amp; Win
            </span>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-2 p-2 bg-red-950/90 border border-red-500 text-red-200 text-xs rounded-xl text-center w-full"
          >
            {errorMessage}
          </div>
        )}

        {/* Badge */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center space-x-1 text-[#D4AF37] text-xs font-semibold uppercase tracking-widest bg-[#141721]/90 px-3 py-1 rounded-full border border-[#D4AF37]/50 shadow">
            <Sparkles size={12} />
            <span>Shop • Spin • Win</span>
          </div>
        </div>

        {/* Wheel */}
        <div className="relative w-[min(340px,85vw)] aspect-square flex items-center justify-center my-2">
          <div className="absolute -top-3 z-40 w-6 h-7 bg-red-600 border-2 border-[#D4AF37] shadow-2xl flex items-center justify-center text-white text-[10px] transform rotate-180">
            ▼
          </div>

          <div
            className="w-full h-full rounded-full relative flex items-center justify-center transition-transform duration-[4000ms] ease-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <img
              src="/images/wheel/spin-wheel-full.webp"
              alt="Fun Republic Master Spin Wheel"
              className="w-full h-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]"
              onError={(event) => {
                const image = event.currentTarget;

                if (!image.src.endsWith('spin-wheel-full.png')) {
                  image.src = '/images/wheel/spin-wheel-full.png';
                }
              }}
            />
          </div>

          {/* Central Spin Button */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning}
            className="absolute z-30 w-20 h-20 rounded-full bg-gradient-to-br from-[#a31c1c] via-[#800000] to-[#400000] border-2 border-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.9)] flex flex-col items-center justify-center text-white font-bold cursor-pointer hover:scale-105 active:scale-95 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span className="text-[10px] tracking-wider text-[#F7E7CE] font-serif">
              {isSpinning ? 'PLEASE' : 'SPIN'}
            </span>
            <span className="text-[10px] tracking-widest text-[#D4AF37] font-serif">
              {isSpinning ? 'WAIT' : 'NOW'}
            </span>
          </button>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={isSpinning}
          className="w-full max-w-[280px] py-3 bg-gradient-to-r from-[#800000] via-[#a31c1c] to-[#660000] text-white font-bold rounded-2xl border-2 border-[#D4AF37] shadow-[0_4px_20px_rgba(163,28,28,0.6)] hover:brightness-110 transition flex items-center justify-center space-x-2 cursor-pointer text-sm tracking-wide mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <span>
            {isSpinning ? 'Spinning Wheel...' : 'SPIN NOW ➔'}
          </span>
        </button>

        {/* Security Footer */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-2.5 border-t border-[#D4AF37]/30 text-[9px] text-gray-300 w-full">
          <div className="flex items-center space-x-1.5 border-r border-[#D4AF37]/30 pr-1 justify-center">
            <ShieldCheck
              size={15}
              className="text-[#D4AF37] shrink-0"
            />
            <div>
              <span className="font-semibold text-white">
                100% Secure
              </span>
              <br />
              <span className="text-gray-400 text-[7.5px]">
                Your data is safe
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 justify-center">
            <Award
              size={15}
              className="text-[#D4AF37] shrink-0"
            />
            <div>
              <span className="font-semibold text-white">
                Fair Play
              </span>
              <br />
              <span className="text-gray-400 text-[7.5px]">
                Fair chance for everyone
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}