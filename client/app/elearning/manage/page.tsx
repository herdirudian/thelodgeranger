'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Plus, Trash2, Edit, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function ManageElearning() {
  const { user } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const toPublicUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${publicBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'PRODUCT_KNOWLEDGE',
    category: '',
    content: '',
    videoUrl: '',
    fileUrl: '',
    images: [] as string[],
    isMandatory: false,
    targetRoles: [] as string[]
  });

  const availableRoles = ['GM', 'HR', 'HOD', 'SUPERVISOR', 'STAFF', 'FINANCE', 'STORE', 'MERCHANDISE_STAFF', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV', 'PHOTOGRAPHER_STAFF', 'PHOTOGRAPHER_HOD'];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'fileUrl' | 'images') => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setLoading(true);

    try {
      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('file', file);
        
        const res = await api.post('/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const url = res.data.url;
        
        if (field === 'fileUrl') {
          setFormData(prev => ({ ...prev, fileUrl: url }));
        } else if (field === 'images') {
          setFormData(prev => ({ ...prev, images: [...(prev.images || []), url] }));
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Gagal upload file.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (role: string) => {
    setFormData(prev => {
      if (prev.targetRoles.includes(role)) {
        return { ...prev, targetRoles: prev.targetRoles.filter(r => r !== role) };
      } else {
        return { ...prev, targetRoles: [...prev.targetRoles, role] };
      }
    });
  };

  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [minScore, setMinScore] = useState(70);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Template Data for Assessment 360
  const load360Template = () => {
    if (!confirm('Ini akan menimpa pertanyaan yang sudah ada. Lanjutkan?')) return;
    
    const template = [
      // Attitude (20)
      { type: 'SCALE', question: 'Etika & Kesopanan', category: 'Attitude', maxScale: 5 },
      { type: 'SCALE', question: 'Kerja Sama Tim', category: 'Attitude', maxScale: 5 },
      { type: 'SCALE', question: 'Semangat Kerja', category: 'Attitude', maxScale: 5 },
      { type: 'SCALE', question: 'Kepatuhan Nilai Perusahaan', category: 'Attitude', maxScale: 5 },
      { type: 'ESSAY', question: 'Bagaimana Anda menilai sikap karyawan ini terhadap pekerjaan sehari-hari?', category: 'Attitude' },
      { type: 'ESSAY', question: 'Dalam situasi penuh tekanan, seperti apa reaksi atau respons sikap yang ditunjukkan oleh karyawan ini?', category: 'Attitude' },
      { type: 'ESSAY', question: 'Sejauh mana karyawan ini berkontribusi dalam menjaga suasana kerja yang positif?', category: 'Attitude' },

      // Skill (15)
      { type: 'SCALE', question: 'Penguasaan Teknologi/Alat Kerja', category: 'Skill', maxScale: 5 },
      { type: 'SCALE', question: 'Keterampilan Praktis', category: 'Skill', maxScale: 5 },
      { type: 'SCALE', question: 'Adaptasi Skill Baru', category: 'Skill', maxScale: 5 },
      { type: 'ESSAY', question: 'Apa keterampilan utama yang paling terlihat dari karyawan ini, dan bagaimana penerapannya dalam pekerjaan sehari-hari?', category: 'Skill' },
      { type: 'ESSAY', question: 'Apakah karyawan ini mampu menjalankan tugas tanpa pengawasan langsung? Jelaskan dengan contoh.', category: 'Skill' },
      { type: 'ESSAY', question: 'Bagaimana kemampuan karyawan ini dalam mempelajari keterampilan baru yang dibutuhkan?', category: 'Skill' },

      // Knowledge (15)
      { type: 'SCALE', question: 'Pengetahuan Produk/Program', category: 'Knowledge', maxScale: 5 },
      { type: 'SCALE', question: 'Pengetahuan Prosedur Kerja', category: 'Knowledge', maxScale: 5 },
      { type: 'SCALE', question: 'Inisiatif Belajar', category: 'Knowledge', maxScale: 5 },
      { type: 'ESSAY', question: 'Sejauh mana pemahaman karyawan ini terhadap tugas dan konteks kerjanya?', category: 'Knowledge' },
      { type: 'ESSAY', question: 'Apakah ia menunjukkan inisiatif dalam memperbarui pengetahuan atau memahami sistem/proses baru?', category: 'Knowledge' },

      // Experience (15)
      { type: 'SCALE', question: 'Pemanfaatan Pengalaman', category: 'Experience', maxScale: 5 },
      { type: 'SCALE', question: 'Kecepatan Ambil Peran', category: 'Experience', maxScale: 5 },
      { type: 'SCALE', question: 'Penanganan Masalah', category: 'Experience', maxScale: 5 },
      { type: 'ESSAY', question: 'Bagaimana pengalaman sebelumnya digunakan oleh karyawan ini untuk mengatasi tantangan kerja?', category: 'Experience' },
      { type: 'ESSAY', question: 'Apakah ia menjadi tempat bertanya bagi rekan-rekan yang lebih baru atau kurang berpengalaman?', category: 'Experience' },
      { type: 'ESSAY', question: 'Ceritakan situasi di mana pengalaman kerjanya terlihat jelas membantu proses kerja.', category: 'Experience' },

      // Responsible (15)
      { type: 'SCALE', question: 'Penyelesaian Tugas', category: 'Responsible', maxScale: 5 },
      { type: 'SCALE', question: 'Ketekunan', category: 'Responsible', maxScale: 5 },
      { type: 'SCALE', question: 'Kedisiplinan', category: 'Responsible', maxScale: 5 },
      { type: 'ESSAY', question: 'Seberapa besar konsistensi karyawan ini dalam menyelesaikan tugas tepat waktu dan sesuai standar?', category: 'Responsible' },
      { type: 'ESSAY', question: 'Bagaimana perilaku karyawan ini terhadap jam kerja, kehadiran, dan komitmen harian?', category: 'Responsible' },
      { type: 'ESSAY', question: 'Jika diberi tanggung jawab tambahan, bagaimana kecenderungannya dalam mengelola tugas-tugas tersebut?', category: 'Responsible' },

      // Accountable (20)
      { type: 'SCALE', question: 'Kesediaan Tanggung Jawab', category: 'Accountable', maxScale: 5 },
      { type: 'SCALE', question: 'Kemampuan Refleksi', category: 'Accountable', maxScale: 5 },
      { type: 'SCALE', question: 'Konsistensi Tindakan', category: 'Accountable', maxScale: 5 },
      { type: 'SCALE', question: 'Dampak terhadap Tim', category: 'Accountable', maxScale: 5 },
      { type: 'ESSAY', question: 'Bagaimana karyawan ini menanggapi ketika terjadi kesalahan atau ketidaksesuaian hasil kerja?', category: 'Accountable' },
      { type: 'ESSAY', question: 'Apakah ia mampu melakukan refleksi diri dan memperbaiki cara kerja secara mandiri?', category: 'Accountable' },
      { type: 'ESSAY', question: 'Dalam kerja tim, bagaimana ia menunjukkan akuntabilitas terhadap peran dan hasil kerjanya?', category: 'Accountable' },
    ];

    setQuizQuestions(template);
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const res = await api.get('/learning/modules');
      setModules(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Effect to handle SELF_ASSESSMENT type
  useEffect(() => {
    if (formData.type === 'SELF_ASSESSMENT' || formData.type === 'ASSESSMENT_360') {
      setShowQuizForm(true);
    }
  }, [formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let moduleId = editingId;

      if (editingId) {
         // Update Module
         await api.put(`/learning/admin/modules/${editingId}`, formData);
      } else {
         // Create Module
         const res = await api.post('/learning/admin/modules', formData);
         moduleId = res.data.id;
      }

      // Create/Update Quiz if exists
      if (showQuizForm && quizQuestions.length > 0) {
        const quizPayload = {
          questions: quizQuestions,
          minScore
        };

        if (editingId) {
           await api.put(`/learning/admin/modules/${moduleId}/quiz`, quizPayload);
        } else {
           await api.post(`/learning/admin/modules/${moduleId}/quiz`, quizPayload);
        }
      }

      alert(editingId ? 'Modul berhasil diperbarui!' : 'Modul berhasil dibuat!');
      setIsCreating(false);
      setEditingId(null);
      fetchModules();
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan modul.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus modul ini?')) return;
    try {
      await api.delete(`/learning/admin/modules/${id}`);
      fetchModules();
    } catch (error) {
      alert('Gagal menghapus.');
    }
  };

  const startEdit = async (module: any) => {
    setLoading(true);
    try {
      const res = await api.get(`/learning/modules/${module.id}`);
      const fullModule = res.data.module;

      setFormData({
        title: fullModule.title,
        description: fullModule.description || '',
        type: fullModule.type,
        category: fullModule.category,
        content: fullModule.content || '',
        videoUrl: fullModule.videoUrl || '',
        fileUrl: fullModule.fileUrl || '',
        images: fullModule.images || [],
        isMandatory: fullModule.isMandatory,
        targetRoles: fullModule.targetRoles || []
      });

      const quiz = fullModule.quizzes && fullModule.quizzes.length > 0 ? fullModule.quizzes[0] : null;
      if (quiz) {
        setQuizQuestions(quiz.questions || []);
        setMinScore(quiz.minScore || 70);
        setShowQuizForm(true);
      } else {
        setQuizQuestions([]);
        setShowQuizForm(false);
      }

      setEditingId(module.id);
      setIsCreating(true);
    } catch (e) {
      console.error(e);
      alert('Gagal mengambil data modul.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'PRODUCT_KNOWLEDGE',
      category: '',
      content: '',
      videoUrl: '',
      fileUrl: '',
      images: [],
      isMandatory: false,
      targetRoles: []
    });
    setQuizQuestions([]);
    setShowQuizForm(false);
  };

  const addQuestion = () => {
    setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], answer: 0 }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQuestions = [...quizQuestions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuizQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...quizQuestions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuizQuestions(newQuestions);
  };

  if (user?.role !== 'HR' && user?.role !== 'GM') {
    return <div className="p-8">Akses ditolak.</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Manajemen Modul The Lodge Learning</h1>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-[#0F4D39] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#0F4D39]/90"
          >
            <Plus size={20} /> Tambah Modul
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{editingId ? 'Edit Modul' : 'Buat Modul Baru'}</h2>
            <button onClick={() => { setIsCreating(false); resetForm(); }} className="text-gray-500 hover:text-red-500">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Modul</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border rounded-lg"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Wahana, SOP Safety"
                  className="w-full p-2 border rounded-lg"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Modul</label>
                <select
                  className="w-full p-2 border rounded-lg"
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="PRODUCT_KNOWLEDGE">Product Knowledge</option>
                  <option value="SOP">Bank SOP</option>
                  <option value="SELF_ASSESSMENT">Self Assessment</option>
                  <option value="ASSESSMENT_360">Assessment 360</option>
                </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (Youtube)</label>
                 <input
                  type="text"
                  placeholder="https://youtube.com/..."
                  className="w-full p-2 border rounded-lg"
                  value={formData.videoUrl}
                  onChange={e => setFormData({...formData, videoUrl: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dokumen PDF (SOP/Materi)</label>
                  <div className="flex flex-col gap-2">
                     <input
                       type="file"
                       accept="application/pdf"
                       onChange={(e) => handleFileUpload(e, 'fileUrl')}
                       className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0F4D39]/10 file:text-[#0F4D39] hover:file:bg-[#0F4D39]/20"
                     />
                     {formData.fileUrl && (
                        <div className="text-xs bg-green-50 text-green-700 p-2 rounded border border-green-200 break-all">
                           File terupload: <a href={toPublicUrl(formData.fileUrl)} target="_blank" rel="noreferrer" className="underline">{formData.fileUrl}</a>
                        </div>
                     )}
                  </div>
               </div>
               
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gambar / Foto Pendukung</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e, 'images')}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0F4D39]/10 file:text-[#0F4D39] hover:file:bg-[#0F4D39]/20 mb-2"
                  />
                  {formData.images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                       {formData.images.map((img, idx) => (
                          <div key={idx} className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                             <img src={toPublicUrl(img)} alt="Preview" className="w-full h-full object-cover" />
                             <button
                               type="button"
                               onClick={() => setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                               className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                             >
                               <X size={12} />
                             </button>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Role (Kosongkan untuk semua)</label>
              <div className="flex flex-wrap gap-3">
                {availableRoles.map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={formData.targetRoles.includes(role)}
                      onChange={() => handleRoleChange(role)}
                      className="w-4 h-4 text-[#0F4D39] rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Singkat</label>
              <textarea
                className="w-full p-2 border rounded-lg"
                rows={2}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>

            {formData.type !== 'SELF_ASSESSMENT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konten Lengkap (HTML Supported)</label>
                <textarea
                  className="w-full p-2 border rounded-lg font-mono text-sm"
                  rows={10}
                  placeholder="<p>Isi materi disini...</p>"
                  value={formData.content}
                  onChange={e => setFormData({...formData, content: e.target.value})}
                />
              </div>
            )}
            
            <div className="border-t pt-6">
               <div className="flex items-center gap-2 mb-4">
                 <input 
                   type="checkbox" 
                   id="hasQuiz" 
                   checked={showQuizForm} 
                   onChange={e => setShowQuizForm(e.target.checked)}
                   className="w-4 h-4 text-[#0F4D39]"
                   disabled={formData.type === 'SELF_ASSESSMENT'}
                 />
                 <label htmlFor="hasQuiz" className="font-bold text-gray-800">
                   {formData.type === 'SELF_ASSESSMENT' ? 'Pertanyaan Assessment (Wajib)' : 'Tambahkan Quiz'}
                 </label>
               </div>

               {showQuizForm && (
                 <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="mb-4 flex justify-between items-center">
                      <div>
                        <label className="text-sm font-medium">Minimal Nilai Kelulusan (%)</label>
                        <input 
                          type="number" 
                          value={minScore}
                          onChange={e => setMinScore(parseInt(e.target.value))}
                          className="w-20 p-2 border rounded ml-2"
                        />
                      </div>
                      
                      {(formData.type === 'ASSESSMENT_360' || formData.type === 'SELF_ASSESSMENT') && (
                        <button
                          type="button"
                          onClick={load360Template}
                          className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 border border-blue-200 transition-colors"
                        >
                          Load Template 360
                        </button>
                      )}
                    </div>
                    
                    {quizQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 mr-4">
                             <div className="flex gap-2 mb-2">
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                                   No. {qIdx + 1}
                                </span>
                                <select
                                   value={q.type || 'MULTIPLE_CHOICE'}
                                   onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)}
                                   className="p-1 border rounded text-xs bg-white"
                                >
                                   <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
                                   <option value="ESSAY">Essay / Isian</option>
                                   <option value="SCALE">Skala (0-5)</option>
                                </select>
                             </div>
                             
                             {(formData.type === 'ASSESSMENT_360' || q.type === 'SCALE' || q.type === 'ESSAY') && (
                                <input
                                  type="text"
                                  className="w-full p-2 border rounded mb-2 text-sm bg-gray-50"
                                  value={q.category || ''}
                                  onChange={e => updateQuestion(qIdx, 'category', e.target.value)}
                                  placeholder="Kategori (misal: Attitude, Skill, dll)"
                                />
                             )}

                             <input
                               type="text"
                               className="w-full p-2 border rounded font-medium"
                               value={q.question}
                               onChange={e => updateQuestion(qIdx, 'question', e.target.value)}
                               placeholder="Tulis pertanyaan..."
                             />
                          </div>

                          <button type="button" onClick={() => {
                             const newQ = [...quizQuestions];
                             newQ.splice(qIdx, 1);
                             setQuizQuestions(newQ);
                          }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                             <Trash2 size={16} />
                          </button>
                        </div>
                        
                        {(q.type === 'MULTIPLE_CHOICE' || !q.type) && (
                          <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-gray-200">
                            {(q.options || ['', '', '', '']).map((opt: string, oIdx: number) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                 <input 
                                   type="radio" 
                                   name={`correct-${qIdx}`} 
                                   checked={q.answer === oIdx}
                                   onChange={() => updateQuestion(qIdx, 'answer', oIdx)}
                                   className="cursor-pointer"
                                 />
                                 <input
                                   type="text"
                                   className="w-full p-2 border rounded text-sm"
                                   value={opt}
                                   onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                                   placeholder={`Opsi ${String.fromCharCode(65+oIdx)}`}
                                 />
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {q.type === 'SCALE' && (
                           <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 flex items-center gap-2">
                              <span>Skala Maksimal:</span>
                              <input 
                                type="number" 
                                value={q.maxScale || 5} 
                                onChange={e => updateQuestion(qIdx, 'maxScale', parseInt(e.target.value))}
                                className="w-16 p-1 border rounded text-center"
                              />
                              <span className="text-xs opacity-75">(User akan memilih nilai 0 sampai {q.maxScale || 5})</span>
                           </div>
                        )}

                        {q.type === 'ESSAY' && (
                          <div className="bg-gray-50 p-3 rounded text-sm text-gray-500 italic border border-dashed border-gray-300">
                            Peserta akan menjawab dengan teks bebas.
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <button type="button" onClick={addQuestion} className="text-[#0F4D39] font-medium text-sm flex items-center gap-1">
                      <Plus size={16} /> Tambah Pertanyaan
                    </button>
                 </div>
               )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0F4D39]/90"
              >
                Simpan Modul
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Judul</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Kategori</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Tipe</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-6 text-gray-800 font-medium">{module.title}</td>
                  <td className="py-4 px-6 text-gray-600">{module.category}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      module.type === 'SOP' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {module.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 flex gap-2">
                    <button 
                       onClick={() => startEdit(module)}
                       className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                       title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                       onClick={() => handleDelete(module.id)}
                       className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                       title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {modules.length === 0 && (
            <div className="p-8 text-center text-gray-500">Belum ada modul.</div>
          )}
        </div>
      )}
    </div>
  );
}
