'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';

type Question = {
  prompt: string;
  type?: 'rating' | 'text';
  scaleMax?: number;
};

export default function Review360DetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});

  useEffect(() => {
    if (!id) return;
    fetchAssignment();
  }, [id]);

  const fetchAssignment = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/review360/assignments/${id}`);
      setAssignment(res.data);
      setAnswers(res.data.answers || {});
    } catch (error) {
      console.error('Error fetching assignment:', error);
      alert('Gagal memuat form 360.');
      router.push('/review-360');
    } finally {
      setLoading(false);
    }
  };

  const questions: Question[] = useMemo(() => {
    const q = assignment?.form?.questions;
    return Array.isArray(q) ? q : [];
  }, [assignment]);

  const isSubmitted = Boolean(assignment?.submittedAt);

  const setAnswer = (index: number, value: any) => {
    setAnswers((prev: any) => ({ ...prev, [index]: value }));
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await api.post(`/review360/assignments/${id}/submit`, { answers });
      await fetchAssignment();
      alert('Penilaian berhasil disimpan.');
    } catch (error) {
      console.error('Error submitting assignment:', error);
      alert('Gagal menyimpan penilaian.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-500">Memuat...</div>;
  }

  if (!assignment) {
    return <div className="p-8 text-gray-500">Data tidak ditemukan.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => router.push('/review-360')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={18} />
          Kembali
        </button>

        {isSubmitted && (
          <div className="text-sm px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
            <CheckCircle size={16} />
            Sudah disubmit
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-1">{assignment.form?.title}</h1>
        {assignment.form?.description && (
          <p className="text-gray-500 mb-4">{assignment.form.description}</p>
        )}
        <div className="text-sm text-gray-600 mb-6">
          Dinilai: <span className="font-semibold">{assignment.targetUser?.name}</span>
          {assignment.targetUser?.department ? ` • ${assignment.targetUser.department}` : ''}
        </div>

        {questions.length === 0 ? (
          <div className="text-gray-500">Pertanyaan belum tersedia.</div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const type = q.type || 'rating';
              const scaleMax = q.scaleMax || 5;
              const value = answers?.[idx];

              return (
                <div key={idx} className="border border-gray-200 rounded-xl p-4">
                  <div className="font-semibold text-gray-800 mb-3">
                    {idx + 1}. {q.prompt}
                  </div>

                  {type === 'text' ? (
                    <textarea
                      value={value || ''}
                      onChange={(e) => setAnswer(idx, e.target.value)}
                      rows={3}
                      disabled={isSubmitted}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 disabled:bg-gray-50"
                      placeholder="Tulis jawaban..."
                    />
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {Array.from({ length: scaleMax }).map((_, i) => {
                        const score = i + 1;
                        const checked = Number(value) === score;
                        return (
                          <label
                            key={score}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                              checked ? 'border-[#0F4D39] bg-[#0F4D39]/5' : 'border-gray-200 hover:bg-gray-50'
                            } ${isSubmitted ? 'cursor-not-allowed opacity-70' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`q-${idx}`}
                              value={score}
                              checked={checked}
                              onChange={() => setAnswer(idx, score)}
                              disabled={isSubmitted}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">{score}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end mt-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || isSubmitted || questions.length === 0}
            className="bg-[#0F4D39] text-white px-5 py-2 rounded-lg hover:bg-[#0F4D39]/90 disabled:opacity-60 flex items-center gap-2"
          >
            <Save size={18} />
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

