'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Users, CheckCircle, Clock, ArrowRight, Plus, History } from 'lucide-react';

export default function Review360Page() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/review360/assignments/mine');
      setAssignments(res.data);
    } catch (error) {
      console.error('Error fetching review 360 assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(a => a.submittedAt).length;
    return { total, completed };
  }, [assignments]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-[#0F4D39]/10 text-[#0F4D39] rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Penilaian 360</h1>
            <p className="text-gray-500">Berikan penilaian untuk rekan kerja</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
           <Link
             href="/elearning?tab=HISTORY"
             className="w-full sm:w-auto justify-center bg-white text-[#0F4D39] border border-[#0F4D39] px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
           >
             <History size={18} />
             Riwayat Penilaian
           </Link>
           {(user?.role === 'HR' || user?.role === 'GM') && (
             <Link
               href="/review-360/manage"
               className="w-full sm:w-auto justify-center bg-[#0F4D39] text-white px-4 py-2 rounded-lg hover:bg-[#0F4D39]/90 transition-colors flex items-center gap-2"
             >
               <Plus size={18} />
               Buat Form 360
             </Link>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Tugas</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Selesai</p>
          <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Belum Selesai</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total - stats.completed}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">Belum ada tugas penilaian 360.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-800">{a.form?.title}</h3>
                  {a.submittedAt ? (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                      <CheckCircle size={14} />
                      Selesai
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <Clock size={14} />
                      Belum
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Dinilai: <span className="font-medium text-gray-700">{a.targetUser?.name}</span>
                  {a.targetUser?.department ? ` • ${a.targetUser.department}` : ''}
                </p>
              </div>

              <Link
                href={`/review-360/${a.id}`}
                className="w-full sm:w-auto justify-center px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-2"
              >
                {a.submittedAt ? 'Lihat' : 'Isi'}
                <ArrowRight size={18} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
