"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { format } from 'date-fns';
import { 
    ClipboardCheck, 
    History, 
    Send, 
    CheckCircle2, 
    AlertCircle, 
    Clock, 
    User as UserIcon,
    ChevronDown,
    ChevronUp,
    FileText,
    Signature,
    Download
} from 'lucide-react';
import clsx from 'clsx';

export default function HODChecklistPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [answers, setAnswers] = useState<Record<number, { value: any, remarks: string }>>({});
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);

    useEffect(() => {
        fetchTemplates();
        fetchSubmissions();
    }, []);

    const fetchTemplates = async () => {
        try {
            // HOD sees their department template, Admin/GM see all
            const dept = (user?.role === 'GM' || user?.role === 'ADMIN' || user?.role === 'HR') ? undefined : user?.department;
            const res = await api.get('/checklist/templates', { params: { department: dept } });
            
            // Filter logic: If there are templates with dayOfWeek, only show for today
            const daysMap: Record<string, string> = {
                'Sunday': 'Minggu',
                'Monday': 'Senin',
                'Tuesday': 'Selasa',
                'Wednesday': 'Rabu',
                'Thursday': 'Kamis',
                'Friday': 'Jumat',
                'Saturday': 'Sabtu'
            };
            const englishDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
            const todayName = daysMap[englishDay] || englishDay;
            
            console.log("Filtering templates for day:", todayName);
            
            const filteredTemplates = res.data.filter((t: any) => {
                if (!t.dayOfWeek) return true; // Show general templates
                return t.dayOfWeek.toLowerCase() === todayName.toLowerCase(); // Only show today's specific checklist
            });

            setTemplates(filteredTemplates);
            if (filteredTemplates.length > 0) {
                // Default to first template found
                setSelectedTemplate(filteredTemplates[0]);
                // Initialize answers
                const initialAnswers: any = {};
                filteredTemplates[0].categories.forEach((cat: any) => {
                    cat.questions.forEach((q: any) => {
                        initialAnswers[q.id] = { value: q.type === 'BOOLEAN' ? false : q.type === 'NUMBER' ? 0 : "", remarks: "" };
                    });
                });
                setAnswers(initialAnswers);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSubmissions = async () => {
        try {
            const res = await api.get('/checklist/submissions');
            setSubmissions(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const exportToCSV = () => {
        if (submissions.length === 0) return;

        const headers = ["ID", "Template", "Department", "Staff", "Date", "Status", "HOD Sign", "SPV Sign", "GM Sign", "Notes"];
        const rows = submissions.map(sub => [
            sub.id,
            sub.template.name,
            sub.template.department,
            sub.user.name,
            format(new Date(sub.date), 'yyyy-MM-dd'),
            sub.status,
            sub.hodSigned ? 'YES' : 'NO',
            sub.spvSigned ? 'YES' : 'NO',
            sub.gmSigned ? 'YES' : 'NO',
            `"${(sub.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `checklist_report_${format(new Date(), 'yyyyMMdd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAnswerChange = (questionId: number, value: any) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: { ...prev[questionId], value }
        }));
    };

    const handleRemarkChange = (questionId: number, remarks: string) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: { ...prev[questionId], remarks }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTemplate) return;

        setLoading(true);
        try {
            const formattedAnswers = Object.entries(answers).map(([qId, data]) => ({
                questionId: parseInt(qId),
                value: data.value,
                remarks: data.remarks
            }));

            await api.post('/checklist/submit', {
                templateId: selectedTemplate.id,
                answers: formattedAnswers,
                notes
            });

            alert("Checklist berhasil dikirim!");
            setNotes("");
            fetchSubmissions();
            setActiveTab('history');
        } catch (error: any) {
            alert(error.response?.data?.message || "Gagal mengirim checklist");
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async (id: number, type: 'HOD' | 'SPV' | 'GM') => {
        try {
            await api.put(`/checklist/submissions/${id}/sign`, { type });
            alert("Berhasil menandatangani checklist");
            fetchSubmissions();
        } catch (error: any) {
            alert(error.response?.data?.message || "Gagal tanda tangan");
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-[#0F4D39]/10 rounded-lg">
                            <ClipboardCheck className="w-8 h-8 text-[#0F4D39]" />
                        </div>
                        HOD Daily Checklist
                    </h1>
                    <p className="text-gray-500 mt-1">Laporan pemantauan operasional harian departemen</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('form')}
                            className={clsx(
                                "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                activeTab === 'form' ? "bg-white text-[#0F4D39] shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <FileText className="w-4 h-4" />
                            Form Pengisian
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={clsx(
                                "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                activeTab === 'history' ? "bg-white text-[#0F4D39] shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <History className="w-4 h-4" />
                            Riwayat
                        </button>
                    </div>
                    {activeTab === 'history' && (
                        <button 
                            onClick={exportToCSV}
                            className="px-4 py-2 border border-[#0F4D39] text-[#0F4D39] rounded-lg text-sm font-bold hover:bg-[#0F4D39]/5 flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Export Report
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'form' && (
                <div className="space-y-6">
                    {templates.length > 1 && (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Bagian / Outlet:</label>
                            <select 
                                value={selectedTemplate?.id}
                                onChange={(e) => {
                                    const t = templates.find(t => t.id === parseInt(e.target.value));
                                    setSelectedTemplate(t);
                                    // Reset answers
                                    const initialAnswers: any = {};
                                    t.categories.forEach((cat: any) => {
                                        cat.questions.forEach((q: any) => {
                                            initialAnswers[q.id] = { value: q.type === 'BOOLEAN' ? false : q.type === 'NUMBER' ? 0 : "", remarks: "" };
                                        });
                                    });
                                    setAnswers(initialAnswers);
                                }}
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39] outline-none font-bold"
                            >
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedTemplate ? (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {selectedTemplate.categories
                                .filter((cat: any) => {
                                    // Hide categories that only contain signature rows
                                    return cat.questions.some((q: any) => {
                                        const lowerQ = q.question.toLowerCase();
                                        return !lowerQ.includes('signature') && !lowerQ.includes('tanda tangan');
                                    });
                                })
                                .map((category: any) => (
                                <div key={category.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                                        <h3 className="font-bold text-gray-800 uppercase tracking-wider">{category.name}</h3>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {category.questions
                                            .filter((q: any) => {
                                                const lowerQ = q.question.toLowerCase();
                                                return !lowerQ.includes('signature') && !lowerQ.includes('tanda tangan');
                                            })
                                            .map((q: any) => (
                                            <div key={q.id} className="p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex-1">
                                                    <p className="text-gray-700 font-medium">{q.question}</p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                                    {q.type === 'BOOLEAN' && (
                                                        <div className="flex bg-gray-100 p-1 rounded-lg">
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleAnswerChange(q.id, true)}
                                                                className={clsx(
                                                                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                                                                    answers[q.id]?.value === true ? "bg-white text-green-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                                )}
                                                            >
                                                                YES
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleAnswerChange(q.id, false)}
                                                                className={clsx(
                                                                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                                                                    answers[q.id]?.value === false ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                                )}
                                                            >
                                                                NO
                                                            </button>
                                                        </div>
                                                    )}
                                                    {q.type === 'NUMBER' && (
                                                        <input 
                                                            type="number"
                                                            value={answers[q.id]?.value}
                                                            onChange={(e) => handleAnswerChange(q.id, parseInt(e.target.value) || 0)}
                                                            className="w-24 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F4D39] outline-none"
                                                        />
                                                    )}
                                                    {q.type === 'TEXT' && (
                                                        <input 
                                                            type="text"
                                                            value={answers[q.id]?.value}
                                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                                            className="w-full sm:w-64 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0F4D39] outline-none"
                                                        />
                                                    )}
                                                    <input 
                                                        type="text"
                                                        placeholder="Catatan (opsional)"
                                                        value={answers[q.id]?.remarks}
                                                        onChange={(e) => handleRemarkChange(q.id, e.target.value)}
                                                        className="w-full sm:w-48 p-2 border border-gray-200 rounded-lg text-xs italic bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0F4D39] outline-none"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Notes / Kesimpulan Hari Ini:</label>
                                <textarea 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#0F4D39] outline-none min-h-[120px]"
                                    placeholder="Tuliskan catatan atau kendala operasional hari ini..."
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-[#0F4D39] text-white rounded-2xl font-bold text-lg hover:bg-[#0a3628] shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:bg-gray-400"
                            >
                                {loading ? "Mengirim..." : <><Send className="w-6 h-6" /> Kirim Checklist Harian</>}
                            </button>
                        </form>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400">Belum ada template checklist untuk departemen Anda.</h3>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    {submissions.length > 0 ? (
                        submissions.map((sub) => (
                            <div key={sub.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div 
                                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-50 text-[#0F4D39] rounded-xl">
                                            <ClipboardCheck className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{sub.template.name}</p>
                                            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {format(new Date(sub.date), 'dd MMM yyyy')}</span>
                                                <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> {sub.user.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                sub.status === 'APPROVED' ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                            )}>
                                                {sub.status}
                                            </span>
                                            <div className="flex gap-2">
                                                {sub.hodSigned ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-gray-300" />}
                                                {sub.spvSigned ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-gray-300" />}
                                                {sub.gmSigned ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-gray-300" />}
                                            </div>
                                        </div>
                                        {expandedSubmission === sub.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </div>

                                {expandedSubmission === sub.id && (
                                    <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {sub.answers
                                                .filter((ans: any) => {
                                                    const lowerQ = ans.question.question.toLowerCase();
                                                    return !lowerQ.includes('signature') && !lowerQ.includes('tanda tangan');
                                                })
                                                .map((ans: any) => (
                                                <div key={ans.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">{ans.question.question}</p>
                                                        {ans.remarks && <p className="text-xs text-gray-400 italic mt-1">"{ans.remarks}"</p>}
                                                    </div>
                                                    <div className={clsx(
                                                        "font-bold text-sm",
                                                        ans.question.type === 'BOOLEAN' ? (ans.value === 'true' ? "text-green-600" : "text-red-600") : "text-[#0F4D39]"
                                                    )}>
                                                        {ans.question.type === 'BOOLEAN' ? (ans.value === 'true' ? "YES" : "NO") : ans.value}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {sub.notes && (
                                            <div className="bg-white p-4 rounded-xl border border-gray-100">
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Kesimpulan:</p>
                                                <p className="text-gray-700">{sub.notes}</p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-3">
                                            {!sub.hodSigned && (user?.role === 'HOD' || user?.role?.includes('HOD')) && (user?.department?.toLowerCase() === sub.template.department?.toLowerCase() || user?.checklistTemplateId === sub.template.id) && (
                                                <button 
                                                    onClick={() => handleSign(sub.id, 'HOD')}
                                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-2"
                                                >
                                                    <Signature className="w-4 h-4" /> Tanda Tangan HOD
                                                </button>
                                            )}
                                            {!sub.spvSigned && (user?.role === 'SUPERVISOR' || user?.role?.includes('SPV')) && (
                                                <button 
                                                    onClick={() => handleSign(sub.id, 'SPV')}
                                                    className="px-6 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm hover:bg-orange-700 flex items-center gap-2"
                                                >
                                                    <Signature className="w-4 h-4" /> Tanda Tangan SPV
                                                </button>
                                            )}
                                            {!sub.gmSigned && (user?.role === 'GM' || user?.role === 'ADMIN') && (
                                                <button 
                                                    onClick={() => handleSign(sub.id, 'GM')}
                                                    className="px-6 py-2 bg-[#0F4D39] text-white rounded-lg font-bold text-sm hover:bg-[#0a3628] flex items-center gap-2"
                                                >
                                                    <Signature className="w-4 h-4" /> Approve & Sign (GM)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                            <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400">Belum ada riwayat pengisian.</h3>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
