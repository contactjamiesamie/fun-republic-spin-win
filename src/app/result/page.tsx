'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Sparkles, Camera } from 'lucide-react';

export default function ResultPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('Customer');
  const [billAmount, setBillAmount] = useState('5000');
  const [prizeName, setPrizeName] = useState('Custom Gift Box');
  const [prizeImage, setPrizeImage] = useState('/images/prizes/gift-box.webp');

  useEffect(() => {
    // Load customer registration info
    const storedData = sessionStorage.getItem('customerData');
    if (storedData) {
      const parsed = JSON.parse(storedData);
      if (parsed.fullName) setCustomerName(parsed.fullName);
      if (parsed.billAmount) setBillAmount(parsed.billAmount);
    }

    // Load actual prize won from backend spin API
    const wonPrizeData = sessionStorage.getItem('wonPrize');
    if (wonPrizeData) {
      const prize = JSON.parse(wonPrizeData);
      
      if (prize.name) {
        setPrizeName(prize.name);
      }

      // If the backend object already has an image property, use it
      if (prize.image) {
        setPrizeImage(prize.image);
      } else if (prize.name) {
        // Fallback robust name-to-image mapping
        const lower = prize.name.toLowerCase();
        if (lower.includes('barbeque') || lower.includes('bbq')) {
          setPrizeImage('/images/prizes/bbq-lunch.webp');
        } else if (lower.includes('mixer') || lower.includes('grinder')) {
          setPrizeImage('/images/prizes/mixer-grinder.webp');
        } else if (lower.includes('movie')) {
          setPrizeImage('/images/prizes/movie-ticket.webp');
        } else if (lower.includes('game') || lower.includes('gaming')) {
          setPrizeImage('/images/prizes/gaming-points.webp');
        } else if (lower.includes('ice cream')) {
          setPrizeImage('/images/prizes/ice-cream.webp');
        } else if (lower.includes('car wash')) {
          setPrizeImage('/images/prizes/car-wash.webp');
        } else if (lower.includes('pizza')) {
          setPrizeImage('/images/prizes/pizza.webp');
        } else {
          setPrizeImage('/images/prizes/gift-box.webp'); // Custom Gift / Fallback
        }
      }
    }
  }, []);

  return (
    <main 
      className="min-h-screen w-full flex flex-col justify-center items-center text-[#f3f4f6] relative overflow-x-hidden px-4 py-6"
      style={{
        backgroundImage: `url('/images/backgrounds/customer-background.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] pointer-events-none"></div>

      <div className="w-full max-w-[380px] relative z-10 my-auto">
        <div className="bg-[#141721]/95 border-2 border-[#D4AF37] rounded-[28px] p-5 shadow-[0_15px_50px_rgba(212,175,55,0.25)] backdrop-blur-md relative text-center">
          
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#800000] via-[#a31c1c] to-[#660000] border border-[#D4AF37] px-4 py-1 rounded-full text-xs font-bold text-[#F7E7CE] shadow-lg flex items-center space-x-1">
            <Sparkles size={14} className="text-[#D4AF37]" />
            <span>VICTORY REWARD</span>
          </div>

          <div className="mt-3 mb-3">
            <h2 className="text-2xl font-extrabold text-[#F7E7CE] tracking-wider font-serif drop-shadow">CONGRATULATIONS!</h2>
            <h3 className="text-lg font-bold text-white tracking-wide mt-0.5">You Won!</h3>
          </div>

          <div className="bg-gradient-to-b from-[#1a1e2b] to-[#10121a] border border-[#D4AF37]/60 rounded-2xl p-3 shadow-inner mb-3 relative overflow-hidden">
            <p className="text-[11px] text-gray-300 leading-snug mb-2">
              Congratulations <span className="text-[#D4AF37] font-semibold">{customerName}</span>!<br />
              Your bill of <span className="text-white font-bold">₹{billAmount}</span> has won you:
            </p>

            <div className="w-full h-40 relative rounded-xl overflow-hidden border border-[#D4AF37]/40 shadow-md mb-2 bg-[#0d0f14] flex items-center justify-center p-1">
              <img 
                src={prizeImage} 
                alt={prizeName} 
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <h4 className="text-sm font-bold text-[#F7E7CE] tracking-wide">{prizeName}</h4>
            <p className="text-[9px] text-gray-300 mt-0.5">Enjoy your exclusive reward at Fun Republic Mall!</p>
          </div>

          <div className="bg-[#1e1515] border border-red-500/40 rounded-xl p-3 mb-3 text-center flex items-center justify-center space-x-2">
            <Camera size={18} className="text-[#D4AF37] shrink-0" />
            <p className="text-[11px] text-red-200 font-medium">
              Take a screenshot to show staff and collect your prize.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#D4AF37]/25 text-[9px] text-gray-300">
            <div className="flex items-center space-x-1.5 border-r border-[#D4AF37]/25 pr-1 justify-center">
              <ShieldCheck size={16} className="text-[#D4AF37] shrink-0" />
              <div className="text-left">
                <span className="font-semibold text-white">100% Secure</span><br/>
                <span className="text-gray-400 text-[7.5px]">Your data is safe</span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 justify-center">
              <Lock size={14} className="text-[#D4AF37] shrink-0" />
              <div className="text-left">
                <span className="font-semibold text-white">Valid Campaign</span><br/>
                <span className="text-gray-400 text-[7.5px]">For single use only</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}