'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Award, Sparkles } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

const PRIZE_WEDGE_INDEXES: Record<string, number> = {
  gift_box: 0,          // Top
  movie_ticket: 1,      // Top-Right
  bbq_lunch: 2,         // Right
  gaming_points: 3,     // Bottom-Right
  mixer_grinder: 4,     // Bottom
  pizza_discount: 5,    // Bottom-Left
  car_wash: 6,          // Left
  ice_cream: 7,         // Top-Left
};

export default function SpinPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('Customer');
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [prizeStatuses, setPrizeStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 1. Prevent re-entry: If user already won a prize, immediately push/replace back to result
    const existingPrize = sessionStorage.getItem('wonPrize');
    if (existingPrize) {
      router.replace('/result');
      return;
    }

    const storedData = sessionStorage.getItem('customerData');
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.fullName) setCustomerName(parsed.fullName.split(' ')[0]);
    }

    // Fetch live inventory availability for out-of-stock fading
    fetch('/api/spin')
      .then((res) => res.json())
      .then((data) => {
        if (data.statuses) {
          const map: Record<string, boolean> = {};
          data.statuses.forEach((s: any) => { map[s.id] = s.isAvailable; });
          setPrizeStatuses(map);
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setErrorMessage('');

    try {
      const storedData = sessionStorage.getItem('customerData');
      const parsed = storedData ? JSON.parse(storedData) : { fullName: 'Test User', billAmount: '5000', storeName: 'Store', mobileNumber: '9876543210' };

      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifiedAmount: Number(parsed.billAmount || 5000),
          brandName: parsed.storeName || 'General',
          customerName: parsed.fullName || 'Participant',
          mobileNumber: parsed.mobileNumber || 'N/A',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to process spin.');

      const wonPrize = data.prize;
      sessionStorage.setItem('wonPrize', JSON.stringify(wonPrize));

      // Save record to Firestore 'spins' collection with clear field names
      try {
        await addDoc(collection(db, 'spins'), {
          customerName: parsed.fullName || 'Customer',
          phoneNumber: parsed.mobileNumber || 'N/A',
          billAmount: Number(parsed.billAmount || 5000),
          storeName: parsed.storeName || 'General',
          prize: wonPrize,
          timestamp: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error('Firestore client write error:', dbErr);
      }

      const wedgeIndex = PRIZE_WEDGE_INDEXES[wonPrize.id] ?? 0;
      const degreesPerWedge = 360 / 8;
      const targetAngle = 360 - (wedgeIndex * degreesPerWedge);
      const totalSpins = 360 * 6;
      const newRotation = rotation + totalSpins + targetAngle;

      setRotation(newRotation);

      // Use router.replace so the spin page isn't left in history stack
      setTimeout(() => {
        setIsSpinning(false);
        router.replace('/result');
      }, 4000);

    } catch (err: any) {
      setIsSpinning(false);
      setErrorMessage(err.message || 'Something went wrong.');
    }
  };

  return (
    <main 
      className="min-h-screen w-full flex flex-col justify-between items-center text-[#f3f4f6] relative overflow-x-hidden px-4 py-4"
      style={{
        backgroundImage: `url('/images/backgrounds/customer-background.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] pointer-events-none"></div>

      {/* Top Greeting Header */}
      <div className="w-full max-w-sm flex justify-between items-center relative z-10 px-2 pt-1">
        <span className="text-[#D4AF37] text-lg font-bold cursor-pointer">&lt;</span>
        <div className="bg-[#141721]/90 border border-[#D4AF37]/50 px-3 py-1 rounded-full text-xs font-medium text-[#F7E7CE] shadow-md flex items-center space-x-1.5">
          <span className="text-gray-400">👤 Hi,</span>
          <span className="font-bold text-[#D4AF37]">{customerName}!</span>
        </div>
      </div>

      <div className="w-full max-w-[380px] relative z-10 my-auto flex flex-col items-center">
        
        {/* Step Progress (2 Steps) */}
        <div className="w-full flex items-center justify-between mb-3 px-8">
          <div className="flex flex-col items-center opacity-75">
            <div className="w-5 h-5 rounded-full bg-[#1e222f] text-[#D4AF37] flex items-center justify-center font-bold border border-[#D4AF37]/50 text-[9px]">✓</div>
            <span className="text-gray-300 text-[8.5px] mt-0.5">Register</span>
          </div>
          <div className="flex-1 h-[1.5px] bg-[#D4AF37] mx-4 -mt-3"></div>
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full bg-gradient-to-b from-[#d9534f] to-[#a94442] text-white flex items-center justify-center font-bold border border-[#D4AF37] shadow text-[9px]">2</div>
            <span className="text-[#D4AF37] text-[8.5px] font-medium mt-0.5">Spin & Win</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-2 p-2 bg-red-950/90 border border-red-500 text-red-200 text-xs rounded-xl text-center w-full">
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

        {/* Wheel Graphic Container */}
        <div className="relative w-[340px] h-[340px] flex items-center justify-center my-2">
          
          {/* Top Red Indicator Pin */}
          <div className="absolute -top-3 z-40 w-6 h-7 bg-red-600 border-2 border-[#D4AF37] shadow-2xl flex items-center justify-center text-white text-[10px] transform rotate-180">
            ▼
          </div>

          {/* Rotating Master Wheel Graphic Image */}
          <div 
            className="w-full h-full rounded-full relative flex items-center justify-center transition-all duration-[4000ms] cubic-bezier(0.1, 0.9, 0.1, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <img 
              src="/images/wheel/spin-wheel-full.webp" 
              alt="Fun Republic Master Spin Wheel" 
              className="w-full h-full object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/images/wheel/spin-wheel-full.png';
              }}
            />
          </div>

          {/* Central Interactive Spin Now Button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            className="absolute z-30 w-20 h-20 rounded-full bg-gradient-to-br from-[#a31c1c] via-[#800000] to-[#400000] border-2 border-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.9)] flex flex-col items-center justify-center text-white font-bold cursor-pointer hover:scale-105 active:scale-95 transition"
          >
            <span className="text-[10px] tracking-wider text-[#F7E7CE] font-serif">SPIN</span>
            <span className="text-[10px] tracking-widest text-[#D4AF37] font-serif">NOW</span>
          </button>

        </div>

        {/* Action Button Below Wheel */}
        <button
          onClick={handleSpin}
          disabled={isSpinning}
          className="w-full max-w-[280px] py-3 bg-gradient-to-r from-[#800000] via-[#a31c1c] to-[#660000] text-white font-bold rounded-2xl border-2 border-[#D4AF37] shadow-[0_4px_20px_rgba(163,28,28,0.6)] hover:brightness-110 transition flex items-center justify-center space-x-2 cursor-pointer text-sm tracking-wide mt-2"
        >
          <span>{isSpinning ? 'Spinning Wheel...' : 'SPIN NOW ➔'}</span>
        </button>

        {/* Security Footer */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-2.5 border-t border-[#D4AF37]/30 text-[9px] text-gray-300 w-full">
          <div className="flex items-center space-x-1.5 border-r border-[#D4AF37]/30 pr-1 justify-center">
            <ShieldCheck size={15} className="text-[#D4AF37] shrink-0" />
            <div>
              <span className="font-semibold text-white">100% Secure</span><br/>
              <span className="text-gray-400 text-[7.5px]">Your data is safe</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 justify-center">
            <Award size={15} className="text-[#D4AF37] shrink-0" />
            <div>
              <span className="font-semibold text-white">Fair Play</span><br/>
              <span className="text-gray-400 text-[7.5px]">Fair chance for everyone</span>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}