'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Plus, X, Save, Users, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Question = {
  prompt: string;
  type: 'rating' | 'text';
  scaleMax?: number;
};

export default function Review360ManagePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetUserId, setTargetUserId] = useState<number | ''>('');
  const [reviewerUserIds, setReviewerUserIds] = useState<number[]>([]);
  const [questions, setQuestions] = useState<Question[]>([
    { prompt: 'Kerja sama tim', type: 'rating', scaleMax: 5 },
    { prompt: 'Komunikasi', type: 'rating', scaleMax: 5 },
    { prompt: 'Catatan / komentar', type: 'text' }
  ]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [reviewerSearch, setReviewerSearch] = useState('');

  useEffect(() => {
    if (user && user.role !== 'HR' && user.role !== 'GM' && user.role !== 'ADMIN') return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, formsRes] = await Promise.all([
        api.get('/users'),
        api.get('/review360/admin/forms')
      ]);
      setUsers(usersRes.data);
      setForms(formsRes.data);
    } catch (error) {
      console.error('Error fetching manage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const target = useMemo(() => users.find(u => u.id === targetUserId), [users, targetUserId]);

  const filteredUsersForTarget = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredUsersForReviewer = useMemo(() => {
    const q = reviewerSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  }, [users, reviewerSearch]);

  const toggleReviewer = (id: number) => {
    setReviewerUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { prompt: '', type: 'rating', scaleMax: 5 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTargetUserId('');
    setReviewerUserIds([]);
    setQuestions([{ prompt: '', type: 'rating', scaleMax: 5 }]);
    setEditingId(null);
  };

  const loadTemplate = () => {
    if (!confirm('Ini akan menimpa pertanyaan yang ada. Lanjutkan?')) return;

    const template: Question[] = [
        // Attitude
        { prompt: '[Attitude] Etika & Kesopanan', type: 'rating', scaleMax: 5 },
        { prompt: '[Attitude] Kerja Sama Tim', type: 'rating', scaleMax: 5 },
        { prompt: '[Attitude] Semangat Kerja', type: 'rating', scaleMax: 5 },
        { prompt: '[Attitude] Kepatuhan Nilai Perusahaan', type: 'rating', scaleMax: 5 },
        // Skill
        { prompt: '[Skill] Penguasaan Teknologi/Alat Kerja', type: 'rating', scaleMax: 5 },
        { prompt: '[Skill] Keterampilan Praktis', type: 'rating', scaleMax: 5 },
        { prompt: '[Skill] Adaptasi Skill Baru', type: 'rating', scaleMax: 5 },
        // Knowledge
        { prompt: '[Knowledge] Pengetahuan Produk/Program', type: 'rating', scaleMax: 5 },
        { prompt: '[Knowledge] Pengetahuan Prosedur Kerja', type: 'rating', scaleMax: 5 },
        { prompt: '[Knowledge] Inisiatif Belajar', type: 'rating', scaleMax: 5 },
        // Experience
        { prompt: '[Experience] Pemanfaatan Pengalaman', type: 'rating', scaleMax: 5 },
        { prompt: '[Experience] Kecepatan Ambil Peran', type: 'rating', scaleMax: 5 },
        { prompt: '[Experience] Penanganan Masalah', type: 'rating', scaleMax: 5 },
        // Responsible
        { prompt: '[Responsible] Penyelesaian Tugas', type: 'rating', scaleMax: 5 },
        { prompt: '[Responsible] Ketekunan', type: 'rating', scaleMax: 5 },
        { prompt: '[Responsible] Kedisiplinan', type: 'rating', scaleMax: 5 },
        // Accountable
        { prompt: '[Accountable] Kesediaan Tanggung Jawab', type: 'rating', scaleMax: 5 },
        { prompt: '[Accountable] Kemampuan Refleksi', type: 'rating', scaleMax: 5 },
        { prompt: '[Accountable] Konsistensi Tindakan', type: 'rating', scaleMax: 5 },
        { prompt: '[Accountable] Dampak terhadap Tim', type: 'rating', scaleMax: 5 },
        
        // Essays
        { prompt: '[Attitude Essay] Bagaimana Anda menilai sikap karyawan ini terhadap pekerjaan sehari-hari?', type: 'text' },
        { prompt: '[Attitude Essay] Dalam situasi penuh tekanan, seperti apa reaksi atau respons sikap yang ditunjukkan oleh karyawan ini?', type: 'text' },
        { prompt: '[Attitude Essay] Sejauh mana karyawan ini berkontribusi dalam menjaga suasana kerja yang positif?', type: 'text' },
        
        { prompt: '[Skill Essay] Apa keterampilan utama yang paling terlihat dari karyawan ini, dan bagaimana penerapannya dalam pekerjaan sehari-hari?', type: 'text' },
        { prompt: '[Skill Essay] Apakah karyawan ini mampu menjalankan tugas tanpa pengawasan langsung? Jelaskan dengan contoh.', type: 'text' },
        { prompt: '[Skill Essay] Bagaimana kemampuan karyawan ini dalam mempelajari keterampilan baru yang dibutuhkan?', type: 'text' },
        
        { prompt: '[Knowledge Essay] Sejauh mana pemahaman karyawan ini terhadap tugas dan konteks kerjanya?', type: 'text' },
        { prompt: '[Knowledge Essay] Apakah ia menunjukkan inisiatif dalam memperbarui pengetahuan atau memahami sistem/proses baru?', type: 'text' },
        
        { prompt: '[Experience Essay] Bagaimana pengalaman sebelumnya digunakan oleh karyawan ini untuk mengatasi tantangan kerja?', type: 'text' },
        { prompt: '[Experience Essay] Apakah ia menjadi tempat bertanya bagi rekan-rekan yang lebih baru atau kurang berpengalaman?', type: 'text' },
        { prompt: '[Experience Essay] Ceritakan situasi di mana pengalaman kerjanya terlihat jelas membantu proses kerja.', type: 'text' },
        
        { prompt: '[Responsible Essay] Seberapa besar konsistensi karyawan ini dalam menyelesaikan tugas tepat waktu dan sesuai standar?', type: 'text' },
        { prompt: '[Responsible Essay] Bagaimana perilaku karyawan ini terhadap jam kerja, kehadiran, dan komitmen harian?', type: 'text' },
        { prompt: '[Responsible Essay] Jika diberi tanggung jawab tambahan, bagaimana kecenderungannya dalam mengelola tugas-tugas tersebut?', type: 'text' },
        
        { prompt: '[Accountable Essay] Bagaimana karyawan ini menanggapi ketika terjadi kesalahan atau ketidaksesuaian hasil kerja?', type: 'text' },
        { prompt: '[Accountable Essay] Apakah ia mampu melakukan refleksi diri dan memperbaiki cara kerja secara mandiri?', type: 'text' },
        { prompt: '[Accountable Essay] Dalam kerja tim, bagaimana ia menunjukkan akuntabilitas terhadap peran dan hasil kerjanya?', type: 'text' },
    ];

    setQuestions(template);
  };

  const startEdit = async (formId: number) => {
    try {
      setLoading(true);
      const res = await api.get(`/review360/admin/forms/${formId}`);
      const form = res.data;

      setTitle(form.title || '');
      setDescription(form.description || '');

      const formQuestions = Array.isArray(form.questions) && form.questions.length > 0
        ? form.questions
        : [{ prompt: '', type: 'rating', scaleMax: 5 }];
      setQuestions(formQuestions);

      const assignments = Array.isArray(form.assignments) ? form.assignments : [];
      if (assignments.length > 0) {
        const mainTargetId = assignments[0].targetUserId;
        setTargetUserId(mainTargetId);
        const reviewers = assignments
          .filter((a: any) => a.targetUserId === mainTargetId)
          .map((a: any) => a.reviewerUserId);
        setReviewerUserIds(reviewers);
      } else {
        setTargetUserId('');
        setReviewerUserIds([]);
      }

      setEditingId(form.id);
    } catch (error) {
      console.error('Error loading form 360:', error);
      alert('Gagal memuat form 360 untuk edit.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId: number) => {
    const ok = confirm('Yakin ingin menghapus form 360 ini? Data assignment yang belum dijawab akan ikut terhapus.');
    if (!ok) return;

    try {
      setLoading(true);
      await api.delete(`/review360/admin/forms/${formId}`);
      alert('Form 360 berhasil dihapus.');
      if (editingId === formId) {
        resetForm();
      }
      await fetchData();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Gagal menghapus form 360.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return alert('Judul wajib diisi.');
    if (!targetUserId) return alert('Pilih user yang akan dinilai.');
    if (reviewerUserIds.length === 0) return alert('Pilih minimal 1 reviewer.');
    const cleanedQuestions = questions
      .map(q => ({ ...q, prompt: (q.prompt || '').trim() }))
      .filter(q => q.prompt);
    if (cleanedQuestions.length === 0) return alert('Minimal 1 pertanyaan.');

    try {
      setSaving(true);
      const assignments = reviewerUserIds
        .filter(id => id !== targetUserId)
        .map(reviewerUserId => ({ targetUserId, reviewerUserId }));

      const payload = {
        title,
        description,
        questions: cleanedQuestions,
        assignments
      };

      if (editingId) {
        await api.put(`/review360/admin/forms/${editingId}`, payload);
        alert('Form 360 berhasil diperbarui.');
      } else {
        await api.post('/review360/admin/forms', payload);
        alert('Form 360 berhasil dibuat.');
      }

      resetForm();
      await fetchData();
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Gagal menyimpan form 360.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'HR' && user?.role !== 'GM' && user?.role !== 'ADMIN') {
    return <div className="p-8">Akses ditolak.</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-[#0F4D39]/10 text-[#0F4D39] rounded-xl">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Kelola Penilaian 360</h1>
            <p className="text-gray-500">Posting form 360 untuk user</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/review-360')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={18} />
          Kembali
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {editingId ? 'Edit Form 360' : 'Buat Form Baru'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg"
                placeholder="Contoh: Penilaian 360 Januari"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (opsional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg"
                rows={2}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">User yang Dinilai</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Cari nama / departemen..."
                  className="text-xs border border-gray-200 rounded px-2 py-1 ml-2"
                />
              </div>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value ? Number(e.target.value) : '')}
                className="w-full p-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value="">Pilih user</option>
                {filteredUsersForTarget.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.department ? `(${u.department})` : ''} - {u.role}
                  </option>
                ))}
              </select>
              {target && (
                <div className="text-xs text-gray-500 mt-1">
                  Target: {target.name} {target.department ? `• ${target.department}` : ''} • {target.role}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Pilih Reviewer</label>
                <input
                  type="text"
                  value={reviewerSearch}
                  onChange={e => setReviewerSearch(e.target.value)}
                  placeholder="Cari reviewer..."
                  className="text-xs border border-gray-200 rounded px-2 py-1 ml-2"
                />
              </div>
              <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg p-3 space-y-2">
                {filteredUsersForReviewer.map(u => {
                  const disabled = targetUserId === u.id;
                  const checked = reviewerUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 text-sm cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleReviewer(u.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">
                        {u.name} {u.department ? `(${u.department})` : ''} - {u.role}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="text-xs text-gray-500 mt-1">Dipilih: {reviewerUserIds.length}</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Pertanyaan</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={loadTemplate}
                    className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded hover:bg-blue-100 border border-blue-200 transition-colors"
                  >
                    Load Template 360
                  </button>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-[#0F4D39] text-sm font-medium flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Tambah
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-700">Pertanyaan {idx + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        className="text-gray-500 hover:text-red-600"
                        title="Hapus"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <input
                      value={q.prompt}
                      onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg mb-2"
                      placeholder="Tulis pertanyaan..."
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Tipe</label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(idx, { type: e.target.value as Question['type'] })}
                          className="w-full p-2 border border-gray-200 rounded-lg bg-white text-sm"
                        >
                          <option value="rating">Rating</option>
                          <option value="text">Text</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Skala (rating)</label>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={q.scaleMax ?? 5}
                          onChange={(e) => updateQuestion(idx, { scaleMax: Number(e.target.value) })}
                          disabled={q.type !== 'rating'}
                          className="w-full p-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                disabled={saving}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="bg-[#0F4D39] text-white px-5 py-2 rounded-lg hover:bg-[#0F4D39]/90 disabled:opacity-60 flex items-center gap-2"
                disabled={saving}
              >
                <Save size={18} />
                Simpan
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Daftar Form</h2>

          {loading ? (
            <div className="text-gray-500">Memuat...</div>
          ) : forms.length === 0 ? (
            <div className="text-gray-500">Belum ada form.</div>
          ) : (
            <div className="space-y-3">
              {forms.map(f => (
                <div
                  key={f.id}
                  className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <button
                    type="button"
                    onClick={() => startEdit(f.id)}
                    className="flex-1 text-left"
                  >
                    <div className="font-semibold text-gray-800">{f.title}</div>
                    <div className="text-sm text-gray-500">
                      {f.completedAssignments}/{f.totalAssignments} selesai
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(f.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-blue-100 text-blue-700 hover:bg-blue-50 text-sm"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-red-100 text-red-700 hover:bg-red-50 text-sm"
                    >
                      <Trash2 size={14} />
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
