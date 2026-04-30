'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Link from 'next/link';
import { BookOpen, FileText, PlayCircle, CheckCircle, Clock, Search, Filter, Printer, X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';

export default function ElearningDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'PRODUCT_KNOWLEDGE' | 'SOP' | 'SELF_ASSESSMENT' | 'HISTORY' | 'MONITORING'>('PRODUCT_KNOWLEDGE');

  useEffect(() => {
    // Check URL params for initial tab
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'HISTORY') {
      setActiveTab('HISTORY');
    } else if (tab === 'MONITORING') {
      setActiveTab('MONITORING');
    }
  }, []);

  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  // PDF Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Riwayat_Penilaian_${new Date().toISOString().slice(0, 10)}`,
  } as any);

  useEffect(() => {
    setModules([]); // Clear modules to avoid showing stale data from other tabs
    setError('');
    fetchModules();
  }, [activeTab]);

  const fetchModules = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'MONITORING') {
        const res = await api.get('/learning/admin/submissions');
        // Flatten data for easier filtering/display
        const flatData = res.data.map((item: any) => ({
            ...item,
            title: item.module?.title || 'Untitled',
            category: item.module?.category || 'General',
            // API now returns pre-calculated names
            targetName: item.targetName || 'Diri Sendiri',
            submitterName: item.submitterName || 'Unknown',
            submitterDept: item.submitterDept || '-',
        }));
        setModules(flatData);
      } else {
        const url = activeTab === 'HISTORY' 
          ? '/learning/history' 
          : `/learning/modules?type=${activeTab}`;
        
        const res = await api.get(url);
        // Ensure consistent structure for history items too
        const historyData = res.data.map((item: any) => ({
            ...item,
            submitterName: item.reviewerName || user?.name || 'Unknown',
            // History items might not have dept unless we fetch it, but it's not shown in history tab usually
        }));
        setModules(historyData);
      }
    } catch (error: any) {
      console.error('Error fetching modules:', error);
      setError(error.response?.data?.message || 'Gagal memuat data. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus riwayat monitoring ini? Tindakan ini tidak dapat dibatalkan.')) {
        return;
    }

    try {
        await api.delete(`/learning/admin/submissions/${id}`);
        // Refresh data
        setModules(prev => prev.filter(m => m.id !== id));
        // alert('Riwayat berhasil dihapus'); // Optional: show success message or just update UI
    } catch (error: any) {
        console.error('Error deleting submission:', error);
        alert(error.response?.data?.message || 'Gagal menghapus riwayat');
    }
  };

  const filteredModules = modules.filter(m => {
    const title = m.title || '';
    const category = m.category || '';
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(modules.map(m => m.category)))];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-50 border-green-200';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Selesai';
      case 'IN_PROGRESS': return 'Sedang Dipelajari';
      default: return 'Belum Dipelajari';
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">The Lodge Learning</h1>
          <p className="text-gray-500">Belajar, Paham, Siap Melayani</p>
        </div>
        {(user?.role === 'HR' || user?.role === 'GM') && (
          <Link 
            href="/elearning/manage" 
            className="w-full md:w-auto justify-center bg-[#0F4D39] text-white px-4 py-2 rounded-lg hover:bg-[#0F4D39]/90 transition-colors flex items-center gap-2"
          >
            <BookOpen size={18} />
            Kelola Modul
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 sm:gap-4 border-b border-gray-200 mb-6">
        <button
          onClick={() => {
            setLoading(true);
            setActiveTab('PRODUCT_KNOWLEDGE');
          }}
          className={`pb-3 px-4 font-medium transition-colors relative ${
            activeTab === 'PRODUCT_KNOWLEDGE' 
              ? 'text-[#0F4D39]' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Product Knowledge
          {activeTab === 'PRODUCT_KNOWLEDGE' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F4D39]" />
          )}
        </button>
        <button
          onClick={() => {
            setLoading(true);
            setActiveTab('SOP');
          }}
          className={`pb-3 px-4 font-medium transition-colors relative ${
            activeTab === 'SOP' 
              ? 'text-[#0F4D39]' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bank SOP
          {activeTab === 'SOP' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F4D39]" />
          )}
        </button>
        <button
          onClick={() => {
            setLoading(true);
            setActiveTab('SELF_ASSESSMENT');
          }}
          className={`pb-3 px-4 font-medium transition-colors relative ${
            activeTab === 'SELF_ASSESSMENT' 
              ? 'text-[#0F4D39]' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Self Assessment
          {activeTab === 'SELF_ASSESSMENT' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F4D39]" />
          )}
        </button>
        <button
          onClick={() => {
            setLoading(true);
            setActiveTab('HISTORY');
          }}
          className={`pb-3 px-4 font-medium transition-colors relative ${
            activeTab === 'HISTORY' 
              ? 'text-[#0F4D39]' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Riwayat Penilaian
          {activeTab === 'HISTORY' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F4D39]" />
          )}
        </button>
        {(user?.role === 'HR' || user?.role === 'GM') && (
            <button
                onClick={() => {
                    setLoading(true);
                    setActiveTab('MONITORING');
                }}
                className={`pb-3 px-4 font-medium transition-colors relative ${
                    activeTab === 'MONITORING' 
                    ? 'text-[#0F4D39]' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                Monitoring
                {activeTab === 'MONITORING' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F4D39]" />
                )}
            </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={
              activeTab === 'PRODUCT_KNOWLEDGE'
                ? 'Cari Produk...'
                : activeTab === 'SOP'
                  ? 'Cari SOP...'
                  : 'Cari Self Assessment...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20"
          />
        </div>
        <div className="relative w-full sm:w-auto">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 appearance-none bg-white"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid or List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat data...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500 bg-red-50 rounded-xl border border-red-200">
            {error}
        </div>
      ) : activeTab === 'HISTORY' || activeTab === 'MONITORING' ? (
         // HISTORY & MONITORING TABLE VIEW
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             {filteredModules.length === 0 ? (
                 <div className="p-8 text-center text-gray-500">Belum ada data penilaian.</div>
             ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                         <thead>
                             <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                                 <th className="p-4 font-semibold">Tanggal</th>
                                 {activeTab === 'MONITORING' && <th className="p-4 font-semibold">Nama Karyawan</th>}
                                 {activeTab === 'MONITORING' && <th className="p-4 font-semibold">Departemen</th>}
                                 <th className="p-4 font-semibold">Judul Penilaian</th>
                                 <th className="p-4 font-semibold">Tipe</th>
                                 <th className="p-4 font-semibold">Target</th>
                                 <th className="p-4 font-semibold">Skor</th>
                                 <th className="p-4 font-semibold text-center">Aksi</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 text-sm">
                             {filteredModules.map((item) => (
                                 <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                     <td className="p-4 text-gray-600">
                                         {new Date(item.date).toLocaleDateString('id-ID', {
                                             day: 'numeric', month: 'short', year: 'numeric',
                                             hour: '2-digit', minute: '2-digit'
                                         })}
                                     </td>
                                     {activeTab === 'MONITORING' && <td className="p-4 font-medium text-gray-900">{item.submitterName}</td>}
                                     {activeTab === 'MONITORING' && <td className="p-4 text-gray-600">{item.submitterDept}</td>}
                                     <td className="p-4 font-medium text-gray-900">{item.title}</td>
                                     <td className="p-4">
                                         <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                             item.type === 'ASSESSMENT_360' ? 'bg-purple-100 text-purple-700' :
                                             item.type === 'SELF_ASSESSMENT' ? 'bg-blue-100 text-blue-700' :
                                             'bg-gray-100 text-gray-700'
                                         }`}>
                                             {item.type.replace('_', ' ')}
                                         </span>
                                     </td>
                                     <td className="p-4 text-gray-600">{item.targetName}</td>
                                     <td className="p-4">
                                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                             item.score >= 90 ? 'bg-green-100 text-green-700' :
                                             item.score >= 75 ? 'bg-blue-100 text-blue-700' :
                                             'bg-yellow-100 text-yellow-700'
                                         }`}>
                                             {item.score} / 100
                                         </span>
                                     </td>
                                     <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    setPreviewData({
                                                        moduleTitle: item.title,
                                                        date: new Date(item.date).toLocaleDateString(),
                                                        reviewerName: item.submitterName || user?.name || 'Unknown',
                                                        targetName: item.targetName,
                                                        score: item.score,
                                                        rating: item.score >= 90 ? 'Sangat Baik' : item.score >= 75 ? 'Baik' : item.score >= 60 ? 'Cukup' : 'Kurang',
                                                        qaList: item.qaList || [] 
                                                    });
                                                    setShowPreview(true);
                                                }}
                                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                title="Cetak PDF"
                                            >
                                                <Printer size={18} />
                                            </button>

                                            {activeTab === 'MONITORING' && ['ADMIN', 'HR', 'GM'].includes(user?.role || '') && (
                                                <button 
                                                    onClick={() => handleDeleteSubmission(item.id)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Hapus Riwayat"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             )}
         </div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">Belum ada modul tersedia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((module) => (
            <Link 
              href={`/elearning/${module.id}`} 
              key={module.id}
              className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all p-5 group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                  {module.category}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(module.userProgress?.status || 'NOT_STARTED')}`}>
                  {getStatusLabel(module.userProgress?.status || 'NOT_STARTED')}
                </span>
              </div>
              
              <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-[#0F4D39] transition-colors">
                {module.title}
              </h3>
              
              <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                {module.description || 'Tidak ada deskripsi singkat.'}
              </p>

              <div className="flex items-center gap-4 text-sm text-gray-400 border-t border-gray-100 pt-3">
                {module.videoUrl && (
                  <div className="flex items-center gap-1">
                    <PlayCircle size={16} />
                    <span>Video</span>
                  </div>
                )}
                {module.fileUrl && (
                  <div className="flex items-center gap-1">
                    <FileText size={16} />
                    <span>Materi</span>
                  </div>
                )}
                 {module.quizzes && module.quizzes.length > 0 && (
                  <div className="flex items-center gap-1 ml-auto text-orange-500">
                    <CheckCircle size={16} />
                    <span>Quiz</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-lg text-gray-800">Preview Hasil Penilaian</h3>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => handlePrint()}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Printer size={18} />
                            Cetak / Download PDF
                        </button>
                        <button 
                            onClick={() => setShowPreview(false)}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto p-8 bg-gray-100">
                    <div 
                        ref={printRef}
                        className="bg-white p-12 mx-auto shadow-sm max-w-[210mm] min-h-[297mm]" 
                        style={{ width: '210mm' }}
                    >
                        {/* Header */}
                        <div className="border-b-2 border-gray-800 pb-6 mb-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-2">LAPORAN HASIL PENILAIAN</h1>
                                    <p className="text-gray-600">The Lodge Ranger Learning System</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">Tanggal Cetak</p>
                                    <p className="font-medium">{new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="grid grid-cols-2 gap-8 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Judul Modul / Penilaian</p>
                                <p className="font-bold text-gray-900 text-lg">{previewData.moduleTitle}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Penilai (Reviewer)</p>
                                <p className="font-medium text-gray-900">{previewData.reviewerName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Dinilai (Target)</p>
                                <p className="font-medium text-gray-900">{previewData.targetName}</p>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center justify-center gap-8 mb-10 py-6 border-y border-gray-200">
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-1">Total Skor</p>
                                <p className={`text-4xl font-bold ${
                                    previewData.score >= 90 ? 'text-green-600' :
                                    previewData.score >= 75 ? 'text-blue-600' :
                                    'text-yellow-600'
                                }`}>{previewData.score} / 100</p>
                            </div>
                            <div className="h-12 w-px bg-gray-200"></div>
                            <div className="text-center">
                                <p className="text-sm text-gray-500 mb-1">Predikat</p>
                                <p className="text-2xl font-bold text-gray-800">{previewData.rating}</p>
                            </div>
                        </div>

                        {/* Detail Pertanyaan & Jawaban */}
                        <div className="mt-8">
                            <h3 className="text-lg font-bold mb-4 border-b pb-2">Detail Pertanyaan & Jawaban</h3>
                            {previewData.qaList && previewData.qaList.length > 0 ? (
                                <table className="w-full text-sm border-collapse border border-gray-300">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border border-gray-300 px-3 py-2 text-left w-12">No</th>
                                            <th className="border border-gray-300 px-3 py-2 text-left">Pertanyaan</th>
                                            <th className="border border-gray-300 px-3 py-2 text-left w-1/4">Jawaban</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.qaList.map((item: any, idx: number) => (
                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="border border-gray-300 px-3 py-2 text-center">{idx + 1}</td>
                                                <td className="border border-gray-300 px-3 py-2">{item.question}</td>
                                                <td className="border border-gray-300 px-3 py-2 font-medium">{item.answer}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-gray-500 italic">Tidak ada detail pertanyaan.</p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="mt-12 pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
                            <p>Dokumen ini dihasilkan secara otomatis oleh sistem The Lodge Ranger.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
