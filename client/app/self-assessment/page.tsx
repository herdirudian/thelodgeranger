'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ClipboardCheck, Clock, FileText, PlayCircle, Search, Filter, BookOpen } from 'lucide-react';

export default function SelfAssessmentPage() {
  const { user } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/learning/modules?type=SELF_ASSESSMENT');
      setModules(res.data);
    } catch (error) {
      console.error('Error fetching self assessment:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => ['All', ...Array.from(new Set(modules.map(m => m.category)))], [modules]);

  const filteredModules = modules.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || m.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
      case 'IN_PROGRESS': return 'Sedang Dikerjakan';
      default: return 'Belum Dikerjakan';
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-[#0F4D39]/10 text-[#0F4D39] rounded-xl">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Self Assessment</h1>
            <p className="text-gray-500">Evaluasi diri untuk peningkatan kompetensi</p>
          </div>
        </div>
        {(user?.role === 'HR' || user?.role === 'GM') && (
          <Link
            href="/elearning/manage"
            className="bg-[#0F4D39] text-white px-4 py-2 rounded-lg hover:bg-[#0F4D39]/90 transition-colors flex items-center gap-2"
          >
            <BookOpen size={18} />
            Posting Self Assessment
          </Link>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari Self Assessment..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 appearance-none bg-white"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat...</div>
      ) : filteredModules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">Belum ada Self Assessment.</p>
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
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(module.userProgress.status)}`}>
                  {getStatusLabel(module.userProgress.status)}
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
                    <span>PDF</span>
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Clock size={16} />
                  <span>v{module.version}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

