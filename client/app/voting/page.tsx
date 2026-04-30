"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Award, Loader2, Save } from "lucide-react";

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
  const [departments, setDepartments] = useState<string[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userOptions = useMemo(() => {
    const list = [...users];
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [users]);

  useEffect(() => {
    fetchBallot();
  }, []);

  const fetchBallot = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/voting/ballot");
      setCategories(res.data.categories || []);
      setUsers(res.data.options?.users || []);
      setDepartments(res.data.options?.departments || []);
      setMyVotes(res.data.myVotes || {});
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Gagal memuat voting");
    } finally {
      setLoading(false);
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

                  return (
                    <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-3">
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

