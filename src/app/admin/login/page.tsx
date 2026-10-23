'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, ArrowRight, ShieldAlert } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'funrepublic2026') {
      sessionStorage.setItem('isAdminAuthenticated', 'true');
      router.push('/admin/dashboard');
    } else {
      setError('Invalid username or password.');
    }
  };

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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] pointer-events-none"></div>

      <div className="w-full max-w-[360px] relative z-10 my-auto">
        <div className="bg-[#141721]/95 border-2 border-[#D4AF37] rounded-[28px] p-6 shadow-[0_15px_50px_rgba(212,175,55,0.3)] backdrop-blur-md relative text-center">
          
          <div className="mb-6">
            <h1 className="text-2xl font-serif tracking-wide text-[#F7E7CE]">Fun Republic</h1>
            <p className="text-[9px] tracking-[0.25em] text-[#D4AF37] uppercase mt-0.5">Admin Portal Access</p>
          </div>

          <h2 className="text-xl font-bold text-white tracking-wide mb-4">Admin Login</h2>

          {error && (
            <div className="mb-4 p-2 bg-red-950/90 border border-red-500 text-red-200 text-xs rounded-xl text-center flex items-center justify-center space-x-1">
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-2.5 px-3.5 focus-within:border-[#D4AF37] transition shadow-inner">
              <label className="block text-[10px] text-[#D4AF37] font-medium tracking-wide">Username</label>
              <div className="flex items-center space-x-2.5 mt-0.5">
                <User size={16} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="bg-[#191d29] border border-[#D4AF37]/40 rounded-xl p-2.5 px-3.5 focus-within:border-[#D4AF37] transition shadow-inner">
              <label className="block text-[10px] text-[#D4AF37] font-medium tracking-wide">Password</label>
              <div className="flex items-center space-x-2.5 mt-0.5">
                <Lock size={16} className="text-[#D4AF37]/70 shrink-0" />
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-[#800000] via-[#a31c1c] to-[#660000] text-white font-bold rounded-xl border-2 border-[#D4AF37] shadow-[0_4px_20px_rgba(163,28,28,0.6)] hover:brightness-110 transition flex items-center justify-center space-x-2 cursor-pointer text-sm tracking-wide mt-2"
            >
              <span>LOGIN</span>
              <ArrowRight size={16} />
            </button>
          </form>

        </div>
      </div>
    </main>
  );
}