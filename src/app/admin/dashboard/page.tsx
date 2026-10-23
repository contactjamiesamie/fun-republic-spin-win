'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, Award, LogOut, Loader2, Store, Phone } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface Participant {
  id: string;
  customerName: string;
  phoneNumber: string;
  billAmount: number;
  storeName: string;
  wonPrize: string;
  time: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuth = sessionStorage.getItem('isAdminAuthenticated');
    if (!isAuth) {
      router.push('/admin/login');
      return;
    }

    // Fetch real spin records from Firestore
    const fetchParticipants = async () => {
      try {
        const q = query(collection(db, 'spins'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: Participant[] = [];
        
        querySnapshot.forEach((docSnap) => {
          const item = docSnap.data();
          data.push({
            id: docSnap.id,
            customerName: item.customerName || item.customerId || 'Customer',
            phoneNumber: item.phoneNumber || item.invoiceId || 'N/A',
            billAmount: item.billAmount || 0,
            storeName: item.storeName || 'General',
            wonPrize: item.prize?.name || item.wonPrize || 'Voucher',
            time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          });
        });

        setParticipants(data);
      } catch (err) {
        console.error('Error fetching participants:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    router.push('/admin/login');
  };

  const filteredParticipants = participants.filter((p) => 
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phoneNumber.includes(searchTerm) ||
    p.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.wonPrize.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen w-full bg-[#0d0f14] text-[#f3f4f6] flex flex-col justify-between">
      
      {/* Top Header */}
      <header className="w-full bg-[#141721] border-b border-[#D4AF37]/40 px-4 py-3 flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div>
          <h1 className="text-lg font-serif tracking-wide text-[#F7E7CE]">Fun Republic</h1>
          <p className="text-[9px] text-[#D4AF37] uppercase tracking-wider">Live Admin Dashboard</p>
        </div>
        <button 
          onClick={handleLogout}
          className="bg-red-950/80 border border-red-500 text-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer hover:bg-red-900 transition"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-md mx-auto px-3 py-4 flex-1">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#141721] border border-[#D4AF37]/40 rounded-2xl p-3 shadow">
            <div className="flex items-center space-x-2 text-[#D4AF37] mb-1">
              <Users size={16} />
              <span className="text-[10px] uppercase font-semibold">Total Spins</span>
            </div>
            <p className="text-xl font-bold text-white">{participants.length}</p>
          </div>
          <div className="bg-[#141721] border border-[#D4AF37]/40 rounded-2xl p-3 shadow">
            <div className="flex items-center space-x-2 text-[#D4AF37] mb-1">
              <Award size={16} />
              <span className="text-[10px] uppercase font-semibold">Prizes Issued</span>
            </div>
            <p className="text-xl font-bold text-white">{participants.length}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#D4AF37]">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, store, or prize..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#141721] border border-[#D4AF37]/40 rounded-xl text-xs text-white placeholder-gray-400 focus:outline-none focus:border-[#D4AF37] shadow-inner"
          />
        </div>

        <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="text-xs font-bold text-[#F7E7CE] uppercase tracking-wider">Live Participant Records</h3>
          <span className="text-[10px] text-gray-400">{filteredParticipants.length} total</span>
        </div>

        {/* Participant List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-2">
            <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
            <span className="text-xs">Loading live data from Firestore...</span>
          </div>
        ) : (
          <div className="space-y-2.5 pb-6">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((p) => (
                <div key={p.id} className="bg-[#141721] border border-[#D4AF37]/30 rounded-2xl p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <h4 className="text-xs font-bold text-white">{p.customerName}</h4>
                      <p className="text-[10px] text-gray-400 flex items-center space-x-1 mt-0.5 font-mono">
                        <Phone size={10} className="text-[#D4AF37]" />
                        <span>{p.phoneNumber}</span>
                      </p>
                    </div>
                    <span className="text-[10px] bg-amber-950/60 text-[#F7E7CE] border border-[#D4AF37]/40 px-2 py-0.5 rounded-full font-semibold">
                      ₹{p.billAmount}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-[10px] text-gray-300 mb-2">
                    <Store size={10} className="text-[#D4AF37]" />
                    <span>Store: <strong className="text-white">{p.storeName}</strong></span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-800 text-[10px]">
                    <span className="text-[#D4AF37] font-medium">Won: {p.wonPrize}</span>
                    <span className="text-gray-500">{p.time}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-xs text-gray-400 bg-[#141721]/50 rounded-2xl border border-gray-800">
                No real spin records found yet.<br />
                <span className="text-[10px] text-[#D4AF37]">Try completing a test spin on the customer app!</span>
              </div>
            )}
          </div>
        )}

      </div>

      <footer className="w-full bg-[#141721] border-t border-[#D4AF37]/30 py-2.5 text-center text-[9px] text-gray-400">
        Fun Republic Mall, Coimbatore • Secure Admin Panel
      </footer>

    </main>
  );
}