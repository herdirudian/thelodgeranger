'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, FileText, Play, Download, Printer, X } from 'lucide-react';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';

export default function ModuleDetail() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [module, setModule] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: any}>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [isChecked, setIsChecked] = useState(false);

  // 360 Assessment State
  const [targetUsers, setTargetUsers] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  // PDF Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Hasil_Penilaian_${new Date().toISOString().slice(0, 10)}`,
  } as any);

  useEffect(() => {
    if (params?.id) {
      fetchDetail();
    }
  }, [params?.id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/learning/modules/${params.id}`);
      setModule(res.data.module);
      setProgress(res.data.progress);
    } catch (error: any) {
      console.error('Error fetching detail:', error);
      setError(error.response?.data?.message || 'Gagal memuat modul. Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = progress?.status === 'COMPLETED';
  const isAcknowledged = progress?.acknowledged;
  const hasQuiz = module?.quizzes && module.quizzes.length > 0;
  const quiz = hasQuiz ? module.quizzes[0] : null;
  const isSelfAssessment = module?.type === 'SELF_ASSESSMENT';
  const is360 = module?.type === 'ASSESSMENT_360';

  // Fetch 360 Data
  useEffect(() => {
    if (is360 && params?.id) {
        api.get('/users/colleagues').then(res => setTargetUsers(res.data)).catch(console.error);
        fetchSubmissions();
    }
  }, [is360, params?.id]);

  const fetchSubmissions = async () => {
     try {
        const res = await api.get(`/learning/modules/${params.id}/submissions`);
        setSubmissions(res.data);
     } catch (e) {
        console.error(e);
     }
  };

  const isTargetAssessed = (targetId: number) => {
      return submissions.some(s => s.targetUserId === targetId);
  };

  const getRating = (score: number) => {
      if (score >= 90) return 'Sangat Baik';
      if (score >= 75) return 'Baik';
      if (score >= 60) return 'Cukup';
      return 'Kurang';
  };

  // Auto-show quiz for Self Assessment
  useEffect(() => {
    if (isSelfAssessment && !isCompleted && !showQuiz) {
      setShowQuiz(true);
    }
  }, [isSelfAssessment, isCompleted, showQuiz]);

  const handleAcknowledge = async () => {
    try {
      await api.post(`/learning/modules/${params.id}/acknowledge`, {});
      
      router.refresh();
      fetchDetail(); // Refresh to update status
    } catch (error) {
      alert('Gagal konfirmasi.');
    }
  };

  const submitQuiz = async () => {
    try {
      const payload: any = { answers: quizAnswers };
      if (is360) {
          if (!selectedTarget) return alert('Pilih karyawan yang dinilai.');
          payload.targetUserId = selectedTarget;
      }

      const res = await api.post(`/learning/modules/${params.id}/quiz`, payload);
      setQuizResult(res.data);
      
      if (is360) {
          fetchSubmissions(); // Refresh history
      } else {
          fetchDetail(); // Refresh status
      }

      // Auto-show preview only if passed
      if (res.data.isPassed) {
        const targetName = is360 
            ? targetUsers.find((u: any) => u.id === parseInt(selectedTarget))?.name 
            : user?.name;

        setPreviewData({
            moduleTitle: module.title,
            date: new Date().toLocaleDateString(),
            reviewerName: user?.name,
            targetName: targetName,
            score: res.data.score,
            rating: getRating(res.data.score),
            answers: quizAnswers,
            questions: quiz?.questions || []
        });
        setShowPreview(true);
      }

    } catch (error) {
      alert('Gagal mengirim quiz.');
    }
  };

  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const toPublicUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${publicBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  if (!module) return <div className="p-8 text-center">Modul tidak ditemukan.</div>;

  const images = Array.isArray(module.images) ? module.images : [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/elearning" className="flex items-center text-gray-500 hover:text-[#0F4D39] mb-6 transition-colors">
        <ArrowLeft size={20} className="mr-2" />
        Kembali ke The Lodge Learning
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-sm font-semibold text-[#0F4D39] bg-[#0F4D39]/10 px-3 py-1 rounded-full mb-3 inline-block">
                {module.category}
              </span>
              <h1 className="text-3xl font-bold text-gray-900">{module.title}</h1>
            </div>
            {isCompleted && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                <CheckCircle size={20} />
                <span className="font-medium">Selesai</span>
              </div>
            )}
          </div>
          <p className="text-gray-600 text-lg">{module.description}</p>
        </div>

        {/* Content Section */}
        <div className="p-8 space-y-8">
          {module.videoUrl && (
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden shadow-inner">
               <iframe 
                 src={module.videoUrl.replace('watch?v=', 'embed/')} 
                 className="w-full h-full" 
                 title="Learning Video"
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                 allowFullScreen
               />
            </div>
          )}

          <div className="prose max-w-none text-gray-700">
             <div dangerouslySetInnerHTML={{ __html: module.content || '' }} />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {images.map((img: string, idx: number) => (
                 <div key={idx} className="aspect-video rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-gray-50">
                    <img src={toPublicUrl(img)} alt={`Lampiran ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                 </div>
               ))}
            </div>
          )}
          
          {module.fileUrl && (
             <a 
               href={toPublicUrl(module.fileUrl)} 
               target="_blank" 
               rel="noreferrer"
               className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
             >
               <div className="p-3 bg-red-50 text-red-600 rounded-lg mr-4 group-hover:bg-red-100 transition-colors">
                 <FileText size={24} />
               </div>
               <div>
                 <h4 className="font-semibold text-gray-900">Dokumen Pendukung</h4>
                 <p className="text-sm text-gray-500">Klik untuk melihat/download PDF</p>
               </div>
               <Download size={20} className="ml-auto text-gray-400 group-hover:text-gray-600" />
             </a>
          )}
        </div>

        {/* Action Section */}
        <div className="p-8 bg-gray-50 border-t border-gray-200">
          {!is360 && !isAcknowledged && !isSelfAssessment ? (
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-gray-600 mb-6">
                Mohon pelajari materi di atas dengan seksama. Jika sudah paham, silakan konfirmasi di bawah ini.
              </p>
              
              <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 flex items-start text-left shadow-sm">
                <input
                  type="checkbox"
                  id="acknowledge-check"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 text-[#0F4D39] rounded focus:ring-[#0F4D39] border-gray-300 cursor-pointer"
                />
                <label htmlFor="acknowledge-check" className="ml-3 text-gray-700 cursor-pointer select-none">
                  Saya menyatakan telah membaca, memahami, dan siap menjalankan instruksi sesuai materi/SOP di atas. 
                  Saya sadar ini tercatat sebagai komitmen kerja.
                </label>
              </div>

              <button
                onClick={handleAcknowledge}
                disabled={!isChecked}
                className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg ${
                  isChecked 
                    ? 'bg-[#0F4D39] text-white hover:bg-[#0F4D39]/90 shadow-[#0F4D39]/20' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                }`}
              >
                Konfirmasi Pemahaman
              </button>
            </div>
          ) : (
            <div>
               {/* 360 Selection UI */}
               {is360 && (
                 <div className="mb-8">
                   <h3 className="text-xl font-bold text-blue-900 mb-4">Penilaian 360 Karyawan</h3>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-blue-800 mb-2">Pilih Karyawan yang Akan Dinilai</label>
                        <select 
                            value={selectedTarget}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedTarget(val);
                                setQuizResult(null); 
                                setQuizAnswers({}); 
                                setShowQuiz(!!val);
                            }}
                            className="w-full p-3 border border-blue-200 rounded-xl focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">-- Pilih Karyawan --</option>
                            {targetUsers.map((u: any) => {
                                const isAssessed = isTargetAssessed(u.id);
                                return (
                                    <option key={u.id} value={u.id} className={isAssessed ? 'text-green-600 bg-green-50' : ''}>
                                        {u.name} - {u.department} {isAssessed ? '✓ (Sudah Dinilai)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {submissions.length > 0 && !showQuiz && !quizResult && (
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <h4 className="font-semibold text-blue-800 mb-3">Riwayat Penilaian Anda ({submissions.length})</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {submissions.map((sub: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded border-b border-gray-50 last:border-0">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700">{sub.targetUser?.name || 'Tidak Diketahui'}</span>
                                            <span className="text-xs text-gray-500">{new Date(sub.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                sub.score >= 90 ? 'bg-green-100 text-green-700' :
                                                sub.score >= 75 ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {sub.score} / 100 ({getRating(sub.score)})
                                            </span>
                                            <button 
                                                onClick={() => {
                                                    // Construct preview data from submission
                                                    // Note: If answers are not in submission, we can't show full details. 
                                                    // Assuming for now we just show summary if no answers.
                                                    setPreviewData({
                                                        moduleTitle: module.title,
                                                        date: new Date(sub.updatedAt).toLocaleDateString(),
                                                        reviewerName: user?.name,
                                                        targetName: sub.targetUser?.name || user?.name,
                                                        score: sub.score,
                                                        rating: getRating(sub.score),
                                                        answers: sub.answers || {}, // If backend sends answers
                                                        questions: quiz?.questions || []
                                                    });
                                                    setShowPreview(true);
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Lihat PDF"
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>
               )}

               {/* Standard Acknowledgment Message */}
               {!is360 && isAcknowledged && (
                 <div className="flex items-center gap-3 text-green-700 bg-green-100/50 p-4 rounded-lg mb-6">
                   <CheckCircle size={20} />
                   <p className="font-medium">Anda telah mengkonfirmasi pemahaman materi ini pada {new Date(progress.acknowledgedAt).toLocaleDateString()}.</p>
                 </div>
               )}

               {/* Start Quiz Button (Standard Only) */}
               {!is360 && hasQuiz && !isCompleted && !showQuiz && (
                 <div className="text-center">
                   <h3 className="text-xl font-bold mb-2">Quiz Evaluasi</h3>
                   <p className="text-gray-600 mb-4">Selesaikan quiz ini untuk menyelesaikan modul.</p>
                   <button
                     onClick={() => setShowQuiz(true)}
                     className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                   >
                     Mulai Quiz
                   </button>
                 </div>
               )}

               {/* Quiz Form */}
               {showQuiz && (!isCompleted || is360) && quiz && (
                 <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                   <h3 className="text-xl font-bold mb-6 border-b pb-4">
                      {is360 ? `Penilaian untuk: ${targetUsers.find((u: any) => u.id === parseInt(selectedTarget))?.name || '...'}` : `Quiz: ${module.title}`}
                   </h3>
                   
                   {(module.type === 'ASSESSMENT_360' || module.type === 'SELF_ASSESSMENT') ? (
                      <div className="space-y-8">
                        {Object.entries(
                           quiz.questions.reduce((acc: any, q: any, idx: number) => {
                              const category = q.category || 'General';
                              if (!acc[category]) acc[category] = [];
                              acc[category].push({ ...q, originalIndex: idx });
                              return acc;
                           }, {})
                        ).map(([category, questions]: [string, any], catIdx) => (
                           <div key={catIdx} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                              <h4 className="text-lg font-bold text-[#0F4D39] mb-4 border-b border-gray-200 pb-2">{category}</h4>
                              <div className="space-y-6">
                                 {questions.map((q: any, qIdx: number) => (
                                    <div key={qIdx} className="bg-white p-4 rounded-lg shadow-sm">
                                       <p className="font-medium text-gray-900 mb-3">{q.question}</p>
                                       
                                       {q.type === 'SCALE' && (
                                          <div className="flex gap-4 items-center">
                                             <div className="flex gap-2">
                                                {Array.from({ length: (q.maxScale || 5) + 1 }).map((_, scaleVal) => (
                                                   <label key={scaleVal} className="flex flex-col items-center cursor-pointer group">
                                                      <input
                                                         type="radio"
                                                         name={`q-${q.originalIndex}`}
                                                         checked={quizAnswers[q.originalIndex] === scaleVal}
                                                         onChange={() => setQuizAnswers({...quizAnswers, [q.originalIndex]: scaleVal})}
                                                         className="w-5 h-5 text-[#0F4D39] focus:ring-[#0F4D39]"
                                                      />
                                                      <span className="text-xs text-gray-500 mt-1 font-medium group-hover:text-[#0F4D39]">{scaleVal}</span>
                                                   </label>
                                                ))}
                                             </div>
                                             <div className="text-xs text-gray-400 ml-2">
                                                (0 = Sangat Kurang, {q.maxScale || 5} = Sangat Baik)
                                             </div>
                                          </div>
                                       )}

                                       {q.type === 'ESSAY' && (
                                          <textarea
                                             className="w-full p-3 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                                             rows={3}
                                             placeholder="Tulis jawaban Anda disini..."
                                             value={quizAnswers[q.originalIndex] || ''}
                                             onChange={(e) => setQuizAnswers({...quizAnswers, [q.originalIndex]: e.target.value})}
                                          />
                                       )}
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ))}
                      </div>
                   ) : (
                      <div className="space-y-6">
                        {quiz.questions.map((q: any, idx: number) => (
                          <div key={idx}>
                            <p className="font-medium text-gray-900 mb-3">{idx + 1}. {q.question}</p>
                            <div className="space-y-2 pl-4">
                              {q.type === 'ESSAY' ? (
                                <textarea
                                  className="w-full p-3 border rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                                  rows={3}
                                  placeholder="Tulis jawaban Anda disini..."
                                  value={quizAnswers[idx] || ''}
                                  onChange={(e) => setQuizAnswers({...quizAnswers, [idx]: e.target.value})}
                                />
                              ) : (
                                (q.options || []).map((opt: string, optIdx: number) => (
                                  <label key={optIdx} className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`q-${idx}`}
                                      checked={quizAnswers[idx] === optIdx}
                                      onChange={() => setQuizAnswers({...quizAnswers, [idx]: optIdx})}
                                      className="w-4 h-4 text-[#0F4D39] focus:ring-[#0F4D39]"
                                    />
                                    <span className="text-gray-700">{opt}</span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                   )}
                   
                   <div className="mt-8 pt-4 border-t flex justify-end">
                     <button
                       onClick={submitQuiz}
                       className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0F4D39]/90"
                     >
                       Kirim Jawaban
                     </button>
                   </div>
                 </div>
               )}

               {quizResult && (
                 <div className={`mt-6 p-6 rounded-xl text-center border ${quizResult.isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                   {module.type === 'ASSESSMENT_360' ? (
                      <>
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                           <CheckCircle size={32} className="text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-blue-800 mb-2">Penilaian Selesai</h3>
                        <div className="text-4xl font-bold text-blue-900 mb-2">{quizResult.score} / 100</div>
                        <p className="text-blue-700 font-medium mb-2">
                           Output Penilaian: {
                              quizResult.score < 60 ? 'Kurang' :
                              quizResult.score < 75 ? 'Cukup' :
                              quizResult.score < 90 ? 'Baik' : 'Sangat Baik'
                           }
                        </p>
                        <p className="text-sm text-blue-600 mt-2">Terima kasih atas penilaian Anda.</p>
                        
                        <div className="mt-6 border-t border-blue-200 pt-4">
                           <button
                              onClick={() => {
                                 setQuizResult(null);
                                 setSelectedTarget('');
                                 setQuizAnswers({});
                                 setShowQuiz(false);
                              }}
                              className="bg-white border border-blue-300 text-blue-700 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-sm"
                           >
                              Lanjut Menilai Rekan Lain
                           </button>
                        </div>
                      </>
                   ) : (
                     quizResult.isPassed ? (
                       <>
                         <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                           <CheckCircle size={32} className="text-green-600" />
                         </div>
                         <h3 className="text-2xl font-bold text-green-800 mb-2">Lulus!</h3>
                         <p className="text-green-700">Skor Anda: {quizResult.score}% (Minimal: {quizResult.minScore}%)</p>
                         <p className="text-sm text-green-600 mt-2">Modul ini telah selesai.</p>
                       </>
                     ) : (
                       <>
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                           <AlertCircle size={32} className="text-red-600" />
                         </div>
                         <h3 className="text-2xl font-bold text-red-800 mb-2">Belum Lulus (Remedial)</h3>
                         <p className="text-red-700 mb-6">Skor Anda: {quizResult.score}% (Minimal: {quizResult.minScore}%)</p>
                         <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            Nilai Anda belum memenuhi standar kelulusan. Silakan ikuti remedial untuk mengulang materi dan quiz ini.
                         </p>
                         <button 
                            onClick={() => { 
                                setQuizResult(null); 
                                setShowQuiz(true); 
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} 
                            className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                         >
                           Ambil Remedial Sekarang
                         </button>
                       </>
                     )
                   )}
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
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
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Kategori</p>
                                <p className="font-medium text-gray-900">{module?.category || '-'}</p>
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

                        {/* Details */}
                        <div>
                            <h4 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">Detail Jawaban</h4>
                            <div className="space-y-6">
                                {previewData.questions && previewData.questions.length > 0 ? (
                                    previewData.questions.map((q: any, idx: number) => {
                                        // Handle category grouping if flattened, but here we just list them
                                        // Need to match answer. 
                                        // If questions structure is different (e.g. grouped in quiz object), we need to flatten or handle it.
                                        // In current component code, quiz.questions is a flat array? 
                                        // Let's check the quiz rendering logic.
                                        // It seems quiz.questions is array.
                                        
                                        const answerVal = previewData.answers ? previewData.answers[idx] : null;
                                        
                                        return (
                                            <div key={idx} className="break-inside-avoid">
                                                <div className="flex gap-4">
                                                    <span className="text-gray-400 font-medium">{idx + 1}.</span>
                                                    <div className="flex-1">
                                                        <p className="text-gray-900 font-medium mb-2">{q.question}</p>
                                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                                                            <span className="text-gray-500 block text-xs mb-1">Jawaban:</span>
                                                            {q.type === 'SCALE' ? (
                                                                <span className="font-bold text-[#0F4D39]">
                                                                    {answerVal !== undefined ? `${answerVal} (Skala 0-${q.maxScale || 5})` : '-'}
                                                                </span>
                                                            ) : q.type === 'ESSAY' ? (
                                                                <p className="text-gray-800 italic">"{answerVal || '-'}"</p>
                                                            ) : (
                                                                <span className="text-gray-800">
                                                                    {q.options && answerVal !== undefined ? q.options[answerVal] : (answerVal || '-')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-center text-gray-500 italic">Detail pertanyaan tidak tersedia.</p>
                                )}
                            </div>
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
