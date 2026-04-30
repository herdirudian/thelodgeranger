"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type AccessRow = { id: number; userId: number; type: string | null; user: { id: number; name: string; department?: string; role: string } };

export default function PublicSurveyAccessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [type, setType] = useState<string>("ALL");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "HR" && user.role !== "GM" && user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/public-survey/access");
      setRows(res.data || []);
      const uRes = await api.get("/users");
      setUsers(uRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u:any) => 
    (u.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const grant = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await api.post("/public-survey/access", { userId: selectedUserId, type: type === "ALL" ? "ALL" : type });
      await fetchData();
      setSelectedUserId('');
      setType("ALL");
    } catch (e) {
      alert("Gagal menambahkan akses");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Hapus akses ini?")) return;
    try {
      await api.delete(`/public-survey/access/${id}`);
      setRows(rows.filter(r=>r.id!==id));
    } catch (e) {
      alert("Gagal menghapus akses");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-[#0F4D39]">
        <ShieldCheck className="w-6 h-6" />
        <h1 className="text-xl font-bold">Pengaturan Akses Report Survey Publik</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-gray-700">Cari User</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama pengguna..." />
            <select className="w-full border rounded px-3 py-2 text-sm mt-2" value={selectedUserId as any} onChange={e=>setSelectedUserId(parseInt(e.target.value))}>
              <option value="">Pilih pengguna</option>
              {filteredUsers.map((u:any)=>(
                <option key={u.id} value={u.id}>{u.name} {u.department ? `• ${u.department}` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-700">Jenis Survey</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={type} onChange={e=>setType(e.target.value)}>
              <option value="ALL">Semua</option>
              <option value="THE_CAVE">The Cave</option>
              <option value="THE_PINES">The Pines</option>
              <option value="OMAH_BAMBOO">Omah Bamboo</option>
              <option value="HOTEL_GUEST">Penginapan</option>
              <option value="WISATA">Wisata</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={grant} disabled={saving || !selectedUserId} className="flex items-center gap-2 bg-[#0F4D39] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0a3628] disabled:opacity-60">
              <Plus className="w-4 h-4" /> Tambah Akses
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-3 text-left font-semibold text-gray-600">User</th>
                <th className="p-3 text-left font-semibold text-gray-600">Department</th>
                <th className="p-3 text-left font-semibold text-gray-600">Role</th>
                <th className="p-3 text-left font-semibold text-gray-600">Jenis Survey</th>
                <th className="p-3 text-left font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-100">
                  <td className="p-3">{r.user?.name || r.userId}</td>
                  <td className="p-3">{r.user?.department || "-"}</td>
                  <td className="p-3">{r.user?.role || "-"}</td>
                  <td className="p-3">{r.type || "ALL"}</td>
                  <td className="p-3">
                    <button onClick={()=>revoke(r.id)} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Hapus</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">Belum ada akses diatur</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
