"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import api from "@/lib/api";
import { Loader2, Plus, X, Search, FileText, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type RchStatus = 'LOW' | 'NORMAL' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface Rch {
  id: number;
  nomor: string;
  area: string;
  guestName: string;
  type: string;
  date: string;
  description: string;
  followUp: string | null;
  status: RchStatus;
  targetDepartment: string;
  createdBy: {
    id: number;
    name: string;
    department: string;
  };
  createdAt: string;
}

export default function RchPage() {
  const { user } = useAuth();
  const [rchs, setRchs] = useState<Rch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    nomor: '',
    area: '',
    guestName: '',
    type: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    followUp: '',
    status: 'NORMAL' as RchStatus,
    targetDepartment: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchDepartments();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rch');
      setRchs(res.data);
    } catch (error) {
      console.error('Error fetching RCH:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      // Fetch users to get unique departments
      const res = await api.get('/auth/users'); // Try hitting users, assuming it exists. If not, fallback to hardcoded list
      if (res.data && Array.isArray(res.data)) {
        const depts = Array.from(new Set(res.data.map((u: any) => u.department).filter(Boolean))) as string[];
        setDepartments(depts.sort());
      }
    } catch (error) {
      // Fallback
      setDepartments([
        'Front Office', 'Housekeeping', 'F&B', 'Engineering', 'Security', 'HR', 'Sales', 'Marketing', 'Accounting'
      ]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/rch', formData);
      alert('RCH berhasil disubmit dan notifikasi telah dikirim ke departemen terkait.');
      setShowForm(false);
      setFormData({
        nomor: '',
        area: '',
        guestName: '',
        type: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        followUp: '',
        status: 'NORMAL',
        targetDepartment: ''
      });
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Gagal submit RCH');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: RchStatus) => {
    switch (status) {
      case 'LOW': return 'bg-green-100 text-green-800'; // 🟢
      case 'NORMAL': return 'bg-blue-100 text-blue-800'; // 🔵
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'; // 🟡
      case 'HIGH': return 'bg-orange-100 text-orange-800'; // 🟠
      case 'CRITICAL': return 'bg-red-100 text-red-800'; // 🔴
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = (status: RchStatus) => {
    switch (status) {
      case 'LOW': return '🟢';
      case 'NORMAL': return '🔵';
      case 'MEDIUM': return '🟡';
      case 'HIGH': return '🟠';
      case 'CRITICAL': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Cari RCH..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
            />
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0c3d2d] transition-all shadow-sm hover:shadow-md font-medium text-sm whitespace-nowrap w-full md:w-auto justify-center"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Batal' : 'Buat RCH Baru'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Form Ranger Customer Handling</h2>
            <p className="text-xs text-gray-500 mt-0.5">Lengkapi data penanganan pelanggan di bawah ini</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Nomor RCH</label>
                <input
                  type="text"
                  name="nomor"
                  required
                  value={formData.nomor}
                  onChange={handleInputChange}
                  placeholder="Contoh: RCH-001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Area</label>
                <input
                  type="text"
                  name="area"
                  required
                  value={formData.area}
                  onChange={handleInputChange}
                  placeholder="Area penanganan"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Nama Tamu</label>
                <input
                  type="text"
                  name="guestName"
                  required
                  value={formData.guestName}
                  onChange={handleInputChange}
                  placeholder="Nama tamu"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Jenis Laporan</label>
                <input
                  type="text"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleInputChange}
                  placeholder="Contoh: Keluhan Fasilitas"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tanggal</label>
                <input
                  type="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Prioritas</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                >
                  <option value="LOW">🟢 Low</option>
                  <option value="NORMAL">🔵 Normal</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="CRITICAL">🔴 Critical</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Departemen Tujuan (Notifikasi WhatsApp)</label>
                <select
                  name="targetDepartment"
                  required
                  value={formData.targetDepartment}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all"
                >
                  <option value="">-- Pilih Departemen --</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Deskripsi Kejadian</label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Jelaskan detail penanganan pelanggan..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all resize-none"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Tindakan Lanjut (Follow Up)</label>
                <textarea
                  name="followUp"
                  rows={3}
                  value={formData.followUp}
                  onChange={handleInputChange}
                  placeholder="Langkah-langkah yang sudah/akan diambil..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] outline-none transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#0F4D39] text-white font-bold rounded-lg hover:bg-[#0c3d2d] transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                Kirim & Notifikasi
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Loader2 className="w-10 h-10 animate-spin text-[#0F4D39] mb-4" />
          <p className="text-gray-500 font-medium">Memuat data RCH...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4 font-bold">Nomor & Tanggal</th>
                  <th className="px-6 py-4 font-bold">Tamu & Area</th>
                  <th className="px-6 py-4 font-bold">Tipe & Tujuan</th>
                  <th className="px-6 py-4 font-bold">Prioritas</th>
                  <th className="px-6 py-4 font-bold">Pelapor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rchs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <FileText className="w-12 h-12 text-gray-200 mb-3" />
                        <p className="text-gray-400 font-medium">Belum ada data RCH yang tercatat</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rchs.map((rch) => (
                    <tr key={rch.id} className="hover:bg-gray-50/80 transition-all group cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 group-hover:text-[#0F4D39] transition-colors">{rch.nomor}</div>
                        <div className="text-[11px] text-gray-400 font-medium mt-0.5">{format(new Date(rch.date), 'dd MMM yyyy')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-800">{rch.guestName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{rch.area}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">{rch.type}</div>
                        <div className="inline-flex text-[10px] font-bold text-[#0F4D39] bg-green-50 px-2 py-0.5 rounded mt-1 uppercase tracking-tighter">
                          {rch.targetDepartment}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm border ${getStatusColor(rch.status)}`}>
                          {getStatusIcon(rch.status)} {rch.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                            {rch.createdBy?.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{rch.createdBy?.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{rch.createdBy?.department}</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
