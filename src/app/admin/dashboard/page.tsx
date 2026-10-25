
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  Award,
  LogOut,
  Loader2,
  Store,
  Phone,
  RefreshCw,
  AlertCircle,
  Download,
  FileSpreadsheet,
  CalendarDays,
  Clock,
} from 'lucide-react';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import * as XLSX from 'xlsx';

interface Participant {
  id: string;
  customerName: string;
  phoneNumber: string;
  billAmount: number;
  storeName: string;
  wonPrize: string;
  time: string;
  dateKey: string;
  dateLabel: string;
  requestId: string;
}

function getDateFromTimestamp(timestamp: unknown): Date | null {
  try {
    let date: Date;

    if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'toDate' in timestamp &&
      typeof timestamp.toDate === 'function'
    ) {
      date = timestamp.toDate();
    } else if (
      typeof timestamp === 'object' &&
      timestamp !== null &&
      'seconds' in timestamp &&
      typeof timestamp.seconds === 'number'
    ) {
      date = new Date(timestamp.seconds * 1000);
    } else if (
      timestamp instanceof Date ||
      typeof timestamp === 'string' ||
      typeof timestamp === 'number'
    ) {
      date = new Date(timestamp);
    } else {
      return null;
    }

    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Use India time consistently for date and time reports.
function getIndiaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}-${month}-${year}`;
}

function formatTime(date: Date | null): string {
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

export default function AdminDashboardPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingDate, setDownloadingDate] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchParticipants = useCallback(async () => {
    if (!mounted) return;

    if (sessionStorage.getItem('isAdminAuthenticated') !== 'true') {
      router.replace('/admin/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const spinsQuery = query(
        collection(db, 'spins'),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(spinsQuery);

      const data: Participant[] = snapshot.docs.map((docSnap) => {
        const item = docSnap.data();
        const amount = Number(item.billAmount ?? 0);
        const date = getDateFromTimestamp(item.timestamp);
        const dateKey = date
          ? getIndiaDateKey(date)
          : String(item.spinDate || '');

        return {
          id: docSnap.id,
          customerName: String(
            item.customerName || item.customerId || 'Customer'
          ),
          phoneNumber: String(
            item.phoneNumber || 'N/A'
          ),
          billAmount: Number.isFinite(amount) ? amount : 0,
          storeName: String(item.storeName || 'General'),
          wonPrize: String(
            item.prize?.name || item.wonPrize || item.prize || 'Voucher'
          ),
          time: formatTime(date),
          dateKey,
          dateLabel: dateKey
            ? formatDateLabel(dateKey)
            : 'Unknown date',
          requestId: String(item.requestId || docSnap.id),
        };
      });

      setParticipants(data);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError(
        'Unable to load participant records. Check Firebase configuration, internet connection, and Firestore security rules.'
      );
    } finally {
      setLoading(false);
    }
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted) return;

    if (sessionStorage.getItem('isAdminAuthenticated') !== 'true') {
      router.replace('/admin/login');
      return;
    }

    fetchParticipants();
  }, [mounted, router, fetchParticipants]);

  const handleLogout = () => {
    sessionStorage.removeItem('isAdminAuthenticated');
    router.replace('/admin/login');
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredParticipants = participants.filter((participant) =>
    participant.customerName.toLowerCase().includes(normalizedSearch) ||
    participant.phoneNumber.toLowerCase().includes(normalizedSearch) ||
    participant.storeName.toLowerCase().includes(normalizedSearch) ||
    participant.wonPrize.toLowerCase().includes(normalizedSearch)
  );

  // Display dates that have spin records, newest first.
  const availableDates = useMemo(() => {
    return [...new Set(
      participants
        .filter((participant) => /^\d{4}-\d{2}-\d{2}$/.test(participant.dateKey))
        .map((participant) => participant.dateKey)
    )].sort((a, b) => b.localeCompare(a));
  }, [participants]);

  const downloadExcel = (dateKey: string) => {
    const dateRecords = participants.filter(
      (participant) => participant.dateKey === dateKey
    );

    if (dateRecords.length === 0) {
      alert('No spin records found for this date.');
      return;
    }

    setDownloadingDate(dateKey);

    try {
      const excelRows = dateRecords.map((participant) => ({
        'Customer Name': participant.customerName,
        'Contact Number': participant.phoneNumber,
        'Store Name': participant.storeName,
        'Bill Amount (INR)': participant.billAmount,
        'Prize Won': participant.wonPrize,
        'Spin Date': participant.dateLabel,
        'Spin Time (IST)': participant.time,
        'Request ID': participant.requestId,
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      worksheet['!cols'] = [
        { wch: 24 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 28 },
        { wch: 15 },
        { wch: 20 },
        { wch: 34 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Spin Report');

      const filename = `FunRepublic_Spin_Report_${formatDateLabel(dateKey)}.xlsx`;

      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Excel download failed:', err);
      alert('Excel download failed. Please try again.');
    } finally {
      setDownloadingDate('');
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#0d0f14] text-[#f3f4f6] flex flex-col">
      <header className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-[#D4AF37]/40 bg-[#141721] px-4 py-3 shadow-md">
        <div>
          <h1 className="font-serif text-lg tracking-wide text-[#F7E7CE]">
            Fun Republic
          </h1>
          <p className="text-[9px] uppercase tracking-wider text-[#D4AF37]">
            Live Admin Dashboard
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-1 rounded-lg border border-red-500 bg-red-950/80 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-3 py-4">
        {/* Existing total counts */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#141721] p-3 shadow">
            <div className="mb-1 flex items-center space-x-2 text-[#D4AF37]">
              <Users size={16} />
              <span className="text-[10px] font-semibold uppercase">
                Total Spins
              </span>
            </div>
            <p className="text-xl font-bold text-white">
              {mounted ? participants.length : 0}
            </p>
          </div>

          <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#141721] p-3 shadow">
            <div className="mb-1 flex items-center space-x-2 text-[#D4AF37]">
              <Award size={16} />
              <span className="text-[10px] font-semibold uppercase">
                Prizes Issued
              </span>
            </div>
            <p className="text-xl font-bold text-white">
              {mounted ? participants.length : 0}
            </p>
          </div>
        </div>

        {/* NEW: Date-wise Excel download */}
        <section className="mb-5 rounded-2xl border border-[#D4AF37]/40 bg-[#141721] p-3">
          <div className="mb-3 flex items-center gap-2">
            <FileSpreadsheet size={19} className="text-[#D4AF37]" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#F7E7CE]">
                Daily Excel Reports
              </h2>
              <p className="mt-1 text-[10px] text-gray-400">
                Select a date to download its spin records.
              </p>
            </div>
          </div>

          {!mounted || loading ? (
            <p className="py-3 text-xs text-gray-400">
              Loading report dates...
            </p>
          ) : availableDates.length > 0 ? (
            <div className="space-y-2">
              {availableDates.map((dateKey) => {
                const count = participants.filter(
                  (participant) => participant.dateKey === dateKey
                ).length;

                return (
                  <div
                    key={dateKey}
                    className="flex items-center justify-between gap-2 rounded-xl border border-gray-700 bg-[#0d0f14] p-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CalendarDays
                        size={16}
                        className="shrink-0 text-[#D4AF37]"
                      />
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {formatDateLabel(dateKey)}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {count} spin record{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => downloadExcel(dateKey)}
                      disabled={downloadingDate !== ''}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#D4AF37] px-3 py-2 text-[10px] font-bold text-black transition hover:bg-[#F7E7CE] disabled:opacity-50"
                    >
                      {downloadingDate === dateKey ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      Excel
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-gray-800 p-3 text-xs text-gray-400">
              No dated spin records available yet.
            </p>
          )}
        </section>

        {/* Existing search */}
        <div className="relative mb-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#D4AF37]">
            <Search size={16} />
          </div>

          <input
            type="text"
            placeholder="Search by name, phone, store, or prize..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-[#D4AF37]/40 bg-[#141721] py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-400 focus:border-[#D4AF37] focus:outline-none"
          />
        </div>

        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#F7E7CE]">
            Live Participant Records
          </h3>
          <span className="text-[10px] text-gray-400">
            {mounted ? filteredParticipants.length : 0} total
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/30 p-3">
            <div className="flex items-start gap-2 text-red-300">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-5">{error}</p>
            </div>

            <button
              onClick={fetchParticipants}
              className="mt-3 flex items-center gap-2 rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-200 hover:bg-red-900/40"
            >
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        )}

        {!mounted || loading ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-12 text-gray-400">
            <Loader2 className="animate-spin text-[#D4AF37]" size={24} />
            <span className="text-xs">
              Loading live data from Firestore...
            </span>
          </div>
        ) : error ? null : (
          <div className="space-y-2.5 pb-6">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-2xl border border-[#D4AF37]/30 bg-[#141721] p-3 shadow-sm"
                >
                  <div className="mb-1.5 flex items-start justify-between">
                    <div className="min-w-0">
                      <h4 className="break-words text-xs font-bold text-white">
                        {participant.customerName}
                      </h4>

                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-gray-400">
                        <Phone size={10} className="shrink-0 text-[#D4AF37]" />
                        <span className="break-all">
                          {participant.phoneNumber}
                        </span>
                      </p>
                    </div>

                    <span className="ml-2 shrink-0 rounded-full border border-[#D4AF37]/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-[#F7E7CE]">
                      ₹{participant.billAmount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-300">
                    <Store size={10} className="shrink-0 text-[#D4AF37]" />
                    <span>
                      Store: <strong className="text-white">{participant.storeName}</strong>
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-400">
                    <CalendarDays size={10} className="shrink-0 text-[#D4AF37]" />
                    <span>{participant.dateLabel}</span>
                    <Clock size={10} className="ml-1 shrink-0 text-[#D4AF37]" />
                    <span>{participant.time} IST</span>
                  </div>

                  <div className="flex items-start justify-between gap-2 border-t border-gray-800 pt-2 text-[10px]">
                    <span className="break-words font-medium text-[#D4AF37]">
                      Won: {participant.wonPrize}
                    </span>
                    <span className="shrink-0 text-gray-500">
                      Spin record
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-[#141721]/50 py-12 text-center text-xs text-gray-400">
                {searchTerm.trim()
                  ? 'No participants match your search.'
                  : 'No real spin records found yet.'}

                {!searchTerm.trim() && (
                  <p className="mt-2 text-[10px] text-[#D4AF37]">
                    Try completing a test spin on the customer app!
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="w-full border-t border-[#D4AF37]/30 bg-[#141721] py-2.5 text-center text-[9px] text-gray-400">
        Fun Republic Mall, Coimbatore • Secure Admin Panel
      </footer>
    </main>
  );
}
