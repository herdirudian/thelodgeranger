"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Award, CheckCircle2, Loader2, Save } from "lucide-react";

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

  const handleSelect = async (category: VotingCategory, value: string) => {
    setSavingKey(category.key);
    setError(null);
    try {
      const next: Record<string, MyVote> = { ...myVotes };
      if (category.targetType === "USER") {
        const id = parseInt(value, 10);
        next[category.key] = { candidateUserId: Number.isNaN(id) ? null : id, candidateDepartment: null };
        setMyVotes(next);
        await api.post("/voting/vote", { categoryKey: category.key, candidateUserId: id });
      } else {
        next[category.key] = { candidateUserId: null, candidateDepartment: value || null };
        setMyVotes(next);
        await api.post("/voting/vote", { categoryKey: category.key, candidateDepartment: value });
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Gagal menyimpan vote");
      await fetchBallot();
    } finally {
      setSavingKey(null);
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-[#0F4D39]" />
            Voting Awards
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Pilih 1 vote untuk tiap kategori.
          </p>
        </div>
        <button
          onClick={fetchBallot}
          className="px-4 py-2 rounded-lg bg-[#0F4D39] text-white text-sm font-semibold hover:bg-[#0d3f2f] transition-colors"
        >
          Refresh
        </button>
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

                  if (c.key === 'BEST_ROOKIE_OF_THE_YEAR') {
                    return (
                      <div key={c.key} className="col-span-1 md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{c.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                          </div>
                          {savingKey === c.key && <Loader2 className="w-5 h-5 animate-spin text-[#0F4D39]" />}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                          {rookieNominees.map((nom) => {
                            const isSelected = currentVal === String(nom.id);
                            return (
                              <div 
                                key={nom.id}
                                onClick={() => handleSelect(c, String(nom.id))}
                                className={`relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-lg ${
                                  isSelected 
                                    ? 'border-[#0F4D39] bg-[#0F4D39]/5 scale-105' 
                                    : 'border-transparent bg-gray-50 hover:border-gray-300'
                                }`}
                              >
                                <div className="relative w-full aspect-square mb-3 overflow-hidden rounded-xl">
                                  <img 
                                    src={nom.photoUrl.startsWith('http') ? nom.photoUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${nom.photoUrl}`}
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
                          })}
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40"
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
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/40"
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
        </>
      )}
    </div>
  );
}

