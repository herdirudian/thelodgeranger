"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Award, BarChart2, CheckCircle2, Loader2, Save } from "lucide-react";
import Link from "next/link";

type VotingCategory = {
  id: number;
  key: string;
  group: string;
  title: string;
  description?: string | null;
  targetType: "USER" | "DEPARTMENT";
};

type BallotUser = {
  id: number;
  name: string;
  department?: string | null;
  role: string;
};

type MyVote = {
  candidateUserId?: number | null;
  candidateDepartment?: string | null;
};

export default function VotingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<VotingCategory[]>([]);
  const [users, setUsers] = useState<BallotUser[]>([]);
  const [rookieNominees, setRookieNominees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Additional state for displaying all rookie nominee photos
  const [allRookiePhotos, setAllRookiePhotos] = useState<any[]>([]);

  // Admin/HR states for Rookie Photo Management
  const [rookiePhotos, setRookiePhotos] = useState<any[]>([]);
  const [selectedRookieId, setSelectedRookieId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'GM';

  const userOptions = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [users]);

  useEffect(() => {
    fetchBallot();
    if (isAdmin) {
      fetchAdminData();
    }
  }, [user, isAdmin]);

  const fetchBallot = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/voting/ballot");
      setCategories(res.data.categories || []);
      setUsers(res.data.options?.users || []);
      setRookieNominees(res.data.options?.rookieNominees || []);
      setAllRookiePhotos(res.data.options?.rookiePhotos || []);
      setDepartments(res.data.options?.departments || []);
      setMyVotes(res.data.myVotes || {});
      setIsFinalized(res.data.isFinalized || false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Gagal memuat voting");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const pRes = await api.get('/voting/admin/rookie-photos');
      setRookiePhotos(pRes.data);
    } catch (error) {
      console.error('Error fetching admin voting data:', error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRookieId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('candidateUserId', selectedRookieId);

    setIsUploading(true);
    try {
      // 1. Upload file to general upload endpoint
      const uploadData = new FormData();
      uploadData.append('file', file);
      
      const upRes = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const photoUrl = upRes.data.url;

      // 2. Save to voting candidate media
      await api.post('/voting/admin/rookie-photo', {
        candidateUserId: parseInt(selectedRookieId),
        photoUrl
      });

      alert("Foto kandidat berhasil ditambahkan!");
      setSelectedRookieId("");
      fetchAdminData();
      fetchBallot(); // Refresh ballot to show new photos
    } catch (error: any) {
      alert(error.response?.data?.message || "Gagal mengunggah foto");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (candidateUserId: number) => {
    if (!confirm("Hapus foto ini?")) return;
    try {
      await api.delete(`/voting/admin/rookie-photo/${candidateUserId}`);
      fetchAdminData();
      fetchBallot();
    } catch (error) {
      alert("Gagal menghapus foto");
    }
  };

  const handleSelect = (category: VotingCategory, value: string) => {
    if (isFinalized) return;
    setMyVotes((prev) => ({
      ...prev,
      [category.key]:
        category.targetType === "USER"
          ? { candidateUserId: parseInt(value, 10) || null, candidateDepartment: null }
          : { candidateUserId: null, candidateDepartment: value || null },
    }));
  };

  const handleSubmitAll = async () => {
    if (isFinalized) return;
    // Validate: All categories must be filled
    const missing = categories.filter(c => {
      const vote = myVotes[c.key];
      if (!vote) return true;
      if (c.targetType === 'USER' && !vote.candidateUserId) return true;
      if (c.targetType === 'DEPARTMENT' && !vote.candidateDepartment) return true;
      return false;
    });

    if (missing.length > 0) {
      alert(`Mohon lengkapi semua kategori sebelum submit. Belum diisi: ${missing.map(m => m.title).join(', ')}`);
      return;
    }

    if (!confirm("Kirim hasil voting Anda sekarang? Setelah dikirim, Anda tidak dapat mengubah pilihan Anda lagi.")) return;

    setIsSubmittingAll(true);
    try {
      const promises = categories.map(c => {
        const vote = myVotes[c.key];
        return api.post("/voting/vote", {
          categoryKey: c.key,
          candidateUserId: vote.candidateUserId,
          candidateDepartment: vote.candidateDepartment,
        });
      });

      await Promise.all(promises);

      // Finalize for this user
      await api.post("/voting/finalize");

      alert("Voting berhasil dikirim secara permanen! Terima kasih atas partisipasi Anda.");
      fetchBallot();
    } catch (e: any) {
      alert(e?.response?.data?.message || "Gagal mengirim voting");
    } finally {
      setIsSubmittingAll(false);
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, VotingCategory[]> = {};
    for (const c of categories) {
      map[c.group] = map[c.group] || [];
      map[c.group].push(c);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [categories]);

  if (!user) return null;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Award className="w-8 h-8 text-[#0F4D39]" />
            Voting Awards
          </h1>
          <p className="text-gray-600 mt-2">Pilih 1 vote untuk tiap kategori.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link 
              href="/admin?tab=voting" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4D39]/10 text-[#0F4D39] font-bold hover:bg-[#0F4D39]/20 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              Lihat Overview (Admin)
            </Link>
          )}
          <button
            onClick={fetchBallot}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F4D39] text-white font-bold hover:bg-[#0d3f2f] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="mb-10 bg-[#0F4D39]/5 border border-[#0F4D39]/20 rounded-xl p-6">
          <h2 className="text-lg font-bold text-[#0F4D39] mb-4">Management: Foto Kandidat Best Rookie</h2>
          <div className="flex flex-col md:flex-row items-end gap-4 mb-6">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Karyawan</label>
              <select
                value={selectedRookieId}
                onChange={(e) => setSelectedRookieId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40"
              >
                <option value="">-- Pilih --</option>
                {userOptions.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Upload Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={!selectedRookieId || isUploading}
                className="hidden"
                id="rookie-photo-upload"
              />
              <label
                htmlFor="rookie-photo-upload"
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer ${
                  !selectedRookieId || isUploading
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-[#0F4D39] text-white hover:bg-[#0d3f2f]'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Mengunggah...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Pilih & Upload
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allRookiePhotos.map(p => (
              <div key={p.candidateUserId} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white">
                <img
                  src={p.photoUrl.startsWith('http') ? p.photoUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${p.photoUrl}`}
                  className="w-full aspect-square object-cover"
                  alt={p.candidateUser?.name}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                  <p className="text-white text-xs font-bold mb-2">{p.candidateUser?.name}</p>
                  <button
                    onClick={() => handleDeletePhoto(p.candidateUserId)}
                    className="px-2 py-1 bg-red-600 text-white text-[10px] rounded hover:bg-red-700 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-14 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Memuat voting...
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          {grouped.map(([groupName, cats]) => (
            <div key={groupName} className="mb-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{groupName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cats.map((c) => {
                  const vote = myVotes[c.key] || {};
                  const currentVal =
                    c.targetType === "USER"
                      ? vote.candidateUserId
                        ? String(vote.candidateUserId)
                        : ""
                      : vote.candidateDepartment || "";

                  const rookieNominee = c.key === 'BEST_ROOKIE_OF_THE_YEAR' && currentVal 
                    ? (rookieNominees.find(p => String(p.id) === currentVal) || allRookiePhotos.find(p => String(p.candidateUserId) === currentVal))
                    : null;

                  if (c.key === 'BEST_EMPLOYEE_OF_THE_YEAR' || c.key === 'BEST_ROOKIE_OF_THE_YEAR') {
                    const nominees = c.key === 'BEST_ROOKIE_OF_THE_YEAR' ? rookieNominees : userOptions;
                    const isEmployeeOfYear = c.key === 'BEST_EMPLOYEE_OF_THE_YEAR';

                    return (
                      <div key={c.key} className="col-span-1 md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{c.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                          </div>
                          {savingKey === c.key && <Loader2 className="w-5 h-5 animate-spin text-[#0F4D39]" />}
                        </div>

                        <div className={`grid gap-6 ${isEmployeeOfYear ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'}`}>
                          {isEmployeeOfYear ? (
                            <div className="col-span-full">
                               <select
                                value={currentVal}
                                onChange={(e) => handleSelect(c, e.target.value)}
                                disabled={isFinalized}
                                className={`w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40 ${isFinalized ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`}
                              >
                                <option value="">Pilih Karyawan Terbaik...</option>
                                {userOptions.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} {u.department ? `(${u.department})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            nominees.map((nom) => {
                              const isSelected = currentVal === String(nom.id);
                              return (
                                <div 
                                  key={nom.id}
                                  onClick={() => handleSelect(c, String(nom.id))}
                                  className={`relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all ${
                                    isFinalized 
                                      ? isSelected 
                                        ? 'border-[#0F4D39] bg-[#0F4D39]/5 cursor-default' 
                                        : 'border-transparent bg-gray-50 opacity-50 cursor-not-allowed'
                                      : isSelected 
                                        ? 'border-[#0F4D39] bg-[#0F4D39]/5 scale-105 cursor-pointer hover:shadow-lg' 
                                        : 'border-transparent bg-gray-50 hover:border-gray-300 cursor-pointer hover:shadow-lg'
                                  }`}
                                >
                                  <div className="relative w-full aspect-square mb-3 overflow-hidden rounded-xl">
                                    <img 
                                      src={nom.photoUrl?.startsWith('http') ? nom.photoUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${nom.photoUrl || '/default-avatar.png'}`}
                                      alt={nom.name}
                                      className={`w-full h-full object-cover transition-transform duration-500 ${isSelected ? 'scale-110' : ''}`}
                                    />
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-[#0F4D39]/20 flex items-center justify-center">
                                        <div className="bg-white rounded-full p-1 shadow-md">
                                          <CheckCircle2 className="w-6 h-6 text-[#0F4D39]" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-center">
                                    <p className={`text-sm font-bold leading-tight ${isSelected ? 'text-[#0F4D39]' : 'text-gray-900'}`}>
                                      {nom.name}
                                    </p>
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{nom.department}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-auto">
                        <div>
                          <div className="text-base font-bold text-gray-900">{c.title}</div>
                          {c.description && <div className="text-sm text-gray-600 mt-1">{c.description}</div>}
                        </div>
                        {savingKey === c.key ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500 mt-1" />
                        ) : (
                          <Save className="w-4 h-4 text-gray-400 mt-1" />
                        )}
                      </div>

                      <div className="mt-4">
                        {c.targetType === "USER" ? (
                          <select
                            value={currentVal}
                            onChange={(e) => handleSelect(c, e.target.value)}
                            disabled={isFinalized}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40 ${isFinalized ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`}
                          >
                            <option value="">Pilih karyawan</option>
                            {userOptions.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                                {u.department ? ` (${u.department})` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={currentVal}
                            onChange={(e) => handleSelect(c, e.target.value)}
                            disabled={isFinalized}
                            className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40 ${isFinalized ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`}
                          >
                            <option value="">Pilih departemen</option>
                            {departments.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-12 flex flex-col items-center border-t border-gray-200 pt-10 pb-20">
            {isFinalized ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex flex-col items-center shadow-sm">
                <CheckCircle2 className="w-12 h-12 text-green-600 mb-3" />
                <h3 className="text-xl font-bold text-green-900">Voting Anda Sudah Terkirim</h3>
                <p className="text-green-700 mt-1">Terima kasih atas partisipasi Anda. Pilihan Anda telah disimpan secara permanen.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4 italic">Pastikan Anda telah mengisi semua kategori di atas.</p>
                <button
                  onClick={handleSubmitAll}
                  disabled={isSubmittingAll}
                  className={`flex items-center gap-3 px-10 py-4 rounded-2xl text-lg font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    isSubmittingAll 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-[#0F4D39] text-white hover:bg-[#0d3f2f] hover:shadow-[#0F4D39]/20'
                  }`}
                >
                  {isSubmittingAll ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Mengirim Voting...
                    </>
                  ) : (
                    <>
                      <Award className="w-6 h-6" />
                      Submit Hasil Voting
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

