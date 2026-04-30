'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ShieldCheck, ShieldX } from 'lucide-react';

type SecurityRow = {
  id: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  securityReturnStatus: 'RETURNED' | 'NOT_RETURNED' | null;
  securityReturnNote: string | null;
  securityReturnAt: string | null;
  user: { id: number; name: string; department: string | null; role: string };
};

export default function SecurityDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<SecurityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [includeConfirmed, setIncludeConfirmed] = useState(false);

  const [noteById, setNoteById] = useState<Record<number, string>>({});

  const hasAccess = useMemo(() => {
    if (!user) return false;
    const privileged = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'GM';
    const isSecurity = String(user.department || '').toLowerCase() === 'security';
    return privileged || isSecurity;
  }, [user]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/requests/security/leave-workplace', {
        params: { startDate, endDate, includeConfirmed },
      });
      setRows(res.data || []);
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Gagal memuat data';
      const detail = e.response?.data?.error;
      setError(detail ? `${msg}: ${detail}` : msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && hasAccess) fetchRows();
  }, [user, hasAccess, startDate, endDate, includeConfirmed]);

  const confirm = async (id: number, status: 'RETURNED' | 'NOT_RETURNED') => {
    try {
      const note = noteById[id] || '';
      await api.post(`/requests/${id}/security-return`, { status, note });
      await fetchRows();
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Unknown error';
      const detail = e.response?.data?.error;
      alert('Gagal menyimpan konfirmasi: ' + (detail ? `${msg}: ${detail}` : msg));
    }
  };

  if (authLoading) {
    return <div className="p-4 sm:p-6 md:p-8 text-gray-500">Memuat...</div>;
  }

  if (!user) return null;

  if (!hasAccess) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-700">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Izin Meninggalkan Tempat Kerja (saat jam kerja) yang sudah disetujui.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm text-gray-700">Dari</label>
            <input
              type="date"
              className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-sm text-gray-700">Sampai</label>
            <input
              type="date"
              className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeConfirmed}
              onChange={(e) => setIncludeConfirmed(e.target.checked)}
            />
            Tampilkan yang sudah dikonfirmasi
          </label>
        </div>
      </div>

      {error ? (
        <div className="bg-white border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-gray-500">Memuat data...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-500">
          Tidak ada data pada periode ini.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 break-words">{r.user?.name}</p>
                  <p className="text-sm text-gray-500">
                    {r.user?.department || '-'} • {r.user?.role}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Tanggal: {String(r.startDate).slice(0, 10)} {r.startTime ? `• Jam keluar: ${r.startTime}` : ''}{' '}
                    {r.endTime ? `• Estimasi kembali: ${r.endTime}` : ''}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                    Detail: {r.reason || '-'}
                  </p>
                </div>

                <div className="shrink-0">
                  {r.securityReturnStatus ? (
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        r.securityReturnStatus === 'RETURNED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.securityReturnStatus === 'RETURNED' ? 'Sudah kembali' : 'Tidak kembali'}
                    </div>
                  ) : (
                    <div className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                      Belum dikonfirmasi
                    </div>
                  )}
                </div>
              </div>

              {r.securityReturnStatus ? (
                <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                  Catatan Security: {r.securityReturnNote || '-'}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="w-full min-h-[72px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                    placeholder="Catatan Security (opsional)..."
                    value={noteById[r.id] || ''}
                    onChange={(e) => setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => confirm(r.id, 'RETURNED')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0F4D39] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0a3628] transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Sudah Kembali
                    </button>
                    <button
                      onClick={() => confirm(r.id, 'NOT_RETURNED')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                    >
                      <ShieldX className="w-4 h-4" />
                      Tidak Kembali
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
