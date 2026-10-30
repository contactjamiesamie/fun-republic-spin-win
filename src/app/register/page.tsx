'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Coins, Store, Phone, Mail, ShieldCheck, Lock, ArrowRight, ChevronDown } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    billAmount: '',
    storeName: '',
    mobileNumber: '',
    email: '',
    agreed: true,
  });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.billAmount || !formData.storeName || !formData.mobileNumber) {
      setError('Please fill in all required fields.');
      return;
    }

    // 1. Phone number validation (exactly 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.mobileNumber)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    // 2. Bill amount validation (minimum ₹3,999)
    const numericBill = Number(formData.billAmount);
    if (isNaN(numericBill) || numericBill <= 0) {
      setError('Not eligible for the bill amount. Minimum bill must be ₹3,999.');
      return;
    }

    if (!formData.agreed) {
      setError('You must agree to the Terms & Conditions.');
      return;
    }
    setError('');
    
    // Clear previous win so a new registration can spin freshly
    sessionStorage.removeItem('wonPrize');

    const dataToSave = {
      ...formData,
      billAmount: numericBill,
    };

    sessionStorage.setItem('customerData', JSON.stringify(dataToSave));
    router.push('/spin');
  };

  return (
    <main 
      className="min-h-screen w-full flex flex-col justify-between items-center text-[#f3f4f6] relative overflow-x-hidden px-4 py-8"
      style={{
        backgroundImage: `url('/images/backgrounds/customer-background.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      
      {/* Light gradient overlay to preserve background clarity while making the card readable */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px] pointer-events-none"></div>

      {/* Top spacing spacer to let the background image's logo & header show */}
      <div className="h-16 relative z-10 pointer-events-none"></div>

      {/* Center Smaller Compact Luxury Card Container */}
      <div className="w-full max-w-[340px] relative z-10 my-auto">
        <div className="bg-[#141721]/92 border border-[#D4AF37]/70 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-md relative">
          
          {/* Step Progress Indicator (2 Steps: Register -> Spin) */}
          <div className="flex items-center justify-between mb-3 px-6">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-gradient-to-b from-[#d9534f] to-[#a94442] text-white flex items-center justify-center font-bold border border-[#D4AF37] shadow text-[10px]">
                1
              </div>
              <span className="text-[#D4AF37] text-[9px] font-medium mt-0.5">Register</span>
            </div>

            <div className="flex-1 h-[1.5px] bg-[#D4AF37]/40 mx-4 -mt-3"></div>

            <div className="flex flex-col items-center opacity-75">
              <div className="w-6 h-6 rounded-full bg-[#1e222f] text-gray-300 flex items-center justify-center font-bold border border-[#D4AF37]/50 text-[10px]">
                2
              </div>
              <span className="text-gray-300 text-[9px] mt-0.5">Spin & Win</span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold text-white tracking-wide">Join the Fun!</h2>
            <p className="text-[10px] text-gray-300 mt-0.5 px-1 leading-tight">
              Register your details to participate in the <span className="text-[#D4AF37] font-medium">Luxury</span> campaign!
            </p>
          </div>

          {error && (
            <div className="mb-2.5 p-1.5 bg-red-950/80 border border-red-500 text-red-200 text-[10px] rounded-lg text-center font-medium animate-shake">
              {error}
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            
            {/* Full Name Input */}
            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-1.5 px-3 focus-within:border-[#D4AF37] transition shadow-inner">
              <label className="block text-[9px] text-[#D4AF37] font-medium tracking-wide">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2 mt-0.5">
                <User size={14} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

           {/* Bill Amount Input */}
<div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-1.5 px-3 focus-within:border-[#D4AF37] transition shadow-inner">
  <label className="block text-[9px] text-[#D4AF37] font-medium tracking-wide">
    Bill Amount <span className="text-red-500">*</span>
  </label>

  <div className="flex items-center space-x-2 mt-0.5">
    <Coins size={14} className="text-[#D4AF37]/70 shrink-0" />

    <input
      type="number"
      min="1"
      step="0.01"
      placeholder="Please enter the valid bill amount"
      value={formData.billAmount}
      onChange={(e) =>
        setFormData({ ...formData, billAmount: e.target.value })
      }
      className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
      required
    />
  </div>
</div>

            {/* Store Name Input */}
            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-1.5 px-3 focus-within:border-[#D4AF37] transition shadow-inner">
              <label className="block text-[9px] text-[#D4AF37] font-medium tracking-wide">
                Store / Brand Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2 mt-0.5">
                <Store size={14} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. BBQ Nation, PVR, Lifestyle"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Mobile Number Input */}
            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-1.5 px-3 focus-within:border-[#D4AF37] transition shadow-inner">
              <label className="block text-[9px] text-[#D4AF37] font-medium tracking-wide">
                Mobile Number (10 Digits) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-2 mt-0.5">
                <Phone size={14} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Email ID (Optional) Input */}
            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-1.5 px-3 focus-within:border-[#D4AF37] transition shadow-inner relative">
              <label className="block text-[9px] text-gray-400 font-medium tracking-wide">
                Email ID (Optional)
              </label>
              <div className="flex items-center space-x-2 mt-0.5">
                <Mail size={14} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none pr-6"
                />
                <ChevronDown size={13} className="text-gray-400 absolute right-3 top-5 pointer-events-none" />
              </div>
            </div>

            {/* Terms & Conditions Checkbox */}
            <div className="flex items-center space-x-2 text-[9.5px] text-gray-300 pt-0.5 px-0.5">
              <input
                type="checkbox"
                id="terms"
                checked={formData.agreed}
                onChange={(e) => setFormData({ ...formData, agreed: e.target.checked })}
                className="w-3 h-3 accent-[#991b1b] rounded cursor-pointer"
              />
              <label htmlFor="terms" className="cursor-pointer leading-tight">
                I agree to the <span className="text-[#D4AF37] underline">Terms & Conditions</span> & <span className="text-[#D4AF37] underline">Privacy Policy</span>
              </label>
            </div>

            {/* Continue Gradient Button */}
            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-[#800000] via-[#a31c1c] to-[#660000] text-white font-bold rounded-xl border border-[#D4AF37] shadow-[0_4px_12px_rgba(163,28,28,0.5)] hover:brightness-110 transition flex items-center justify-center space-x-2 mt-2 cursor-pointer text-xs tracking-wide"
            >
              <span>Continue to Spin</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Security Footer inside Card */}
          <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2.5 border-t border-[#D4AF37]/25 text-[8.5px] text-gray-300">
            <div className="flex items-center space-x-1.5 border-r border-[#D4AF37]/25 pr-1">
              <ShieldCheck size={16} className="text-[#D4AF37] shrink-0" />
              <div>
                <span className="font-semibold text-white">100% Secure</span><br/>
                <span className="text-gray-400 text-[7.5px]">Your data is safe</span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 pl-1.5">
              <Lock size={14} className="text-[#D4AF37] shrink-0" />
              <div>
                <span className="font-semibold text-white">Used only</span><br/>
                <span className="text-gray-400 text-[7.5px]">For campaign</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom spacing spacer to let the background image's red footer design show */}
      <div className="h-14 relative z-10 pointer-events-none"></div>

    </main>
  );
}