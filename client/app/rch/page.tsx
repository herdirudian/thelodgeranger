"use client";

import React, { useState, useEffect } from "react";
import ClientLayout from "@/components/ClientLayout";
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
    <ClientLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-[#0F4D39]" />
              Ranger Customer Handling (RCH)
            </h1>
            <p className="text-gray-500 text-sm mt-1">Kelola dan pantau laporan penanganan pelanggan</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0c3d2d] transition-colors"
          >
            {showForm ? <X size={20} /> : <Plus size={20} />}
            {showForm ? 'Tutup Form' : 'Buat RCH Baru'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Form Input RCH</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor RCH</label>
                  <input
                    type="text"
                    name="nomor"
                    required
                    value={formData.nomor}
                    onChange={handleInputChange}
                    placeholder="Contoh: RCH-001"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  <input
                    type="text"
                    name="area"
                    required
                    value={formData.area}
                    onChange={handleInputChange}
                    placeholder="Area penanganan"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                  <input
                    type="text"
                    name="guestName"
                    required
                    value={formData.guestName}
                    onChange={handleInputChange}
                    placeholder="Nama tamu"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <input
                    type="text"
                    name="type"
                    required
                    value={formData.type}
                    onChange={handleInputChange}
                    placeholder="Jenis keluhan/laporan"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  >
                    <option value="LOW">🟢 Low</option>
                    <option value="NORMAL">🔵 Normal</option>
                    <option value="MEDIUM">🟡 Medium</option>
                    <option value="HIGH">🟠 High</option>
                    <option value="CRITICAL">🔴 Critical</option>
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Department (Untuk Notifikasi)</label>
                  <select
                    name="targetDepartment"
                    required
                    value={formData.targetDepartment}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  >
                    <option value="">-- Pilih Departemen --</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Deskripsi detail RCH..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow Up</label>
                  <textarea
                    name="followUp"
                    rows={2}
                    value={formData.followUp}
                    onChange={handleInputChange}
                    placeholder="Tindakan lanjut (opsional)..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-[#0F4D39] text-white font-medium rounded-lg hover:bg-[#0c3d2d] transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Submit & Notifikasi
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-[#0F4D39]" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                    <th className="p-4 font-semibold">Nomor & Tanggal</th>
                    <th className="p-4 font-semibold">Tamu & Area</th>
                    <th className="p-4 font-semibold">Type & Dept. Tujuan</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Dibuat Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rchs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        Belum ada data RCH.
                      </td>
                    </tr>
                  ) : (
                    rchs.map((rch) => (
                      <tr key={rch.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{rch.nomor}</div>
                          <div className="text-sm text-gray-500">{format(new Date(rch.date), 'dd MMM yyyy')}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{rch.guestName}</div>
                          <div className="text-sm text-gray-500">{rch.area}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-gray-800">{rch.type}</div>
                          <div className="text-sm font-medium text-[#0F4D39]">{rch.targetDepartment}</div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(rch.status)}`}>
                            {getStatusIcon(rch.status)} {rch.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-gray-800">{rch.createdBy?.name}</div>
                          <div className="text-xs text-gray-500">{rch.createdBy?.department}</div>
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
    </ClientLayout>
  );
}
