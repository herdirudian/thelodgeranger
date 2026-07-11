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
    Download,
    Camera,
    ImageIcon,
    X,
    Loader2,
    ArrowLeft,
    Save
} from 'lucide-react';
import clsx from 'clsx';

interface AnswerData {
    value: any;
    remarks: string;
    photoUrl?: string;
}

export default function HODChecklistPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [answers, setAnswers] = useState<Record<number, AnswerData>>({});
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
    const [todaySubmissions, setTodaySubmissions] = useState<Record<number, boolean>>({});
    const [photoUrl, setPhotoUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [historyFilter, setHistoryFilter] = useState<'ALL' | 'PENDING_MY_APPROVAL'>('ALL');
    const [showUnitSelector, setShowUnitSelector] = useState(true);
    const [draftStatus, setDraftStatus] = useState<string>("");
    const [exportDate, setExportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [exporting, setExporting] = useState<string>("");

    const getDraftKey = (templateId: number) => {
        if (!user?.id) return null;
        return `checklist_draft_${user.id}_${templateId}`;
    };

    const getLastTemplateKey = () => {
        if (!user?.id) return null;
        return `checklist_last_template_${user.id}`;
    };

    const isSignatureQuestion = (questionText: string) => {
        const lowerQuestion = questionText.toLowerCase();
        return lowerQuestion.includes('signature') || lowerQuestion.includes('tanda tangan');
    };

    const initializeAnswersForTemplate = (template: any) => {
        const initialAnswers: Record<number, AnswerData> = {};
        template.categories.forEach((cat: any) => {
            cat.questions.forEach((q: any) => {
                initialAnswers[q.id] = {
                    value: q.type === 'BOOLEAN' ? false : q.type === 'NUMBER' ? 0 : "",
                    remarks: "",
                    photoUrl: ""
                };
            });
        });
        setAnswers(initialAnswers);
        setNotes("");
        setPhotoUrl("");
    };

    const persistLastSelectedTemplate = (templateId: number) => {
        const lastTemplateKey = getLastTemplateKey();
        if (!lastTemplateKey) return;
        localStorage.setItem(lastTemplateKey, String(templateId));
    };

    // --- AUTO-SAVE DRAFT LOGIC ---
    const loadDraft = (templateId: number) => {
        const draftKey = getDraftKey(templateId);
        if (!draftKey) return false;
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                setAnswers(parsed.answers || {});
                setNotes(parsed.notes || "");
                setPhotoUrl(parsed.photoUrl || "");
                setDraftStatus("Draft dimuat otomatis");
                setTimeout(() => setDraftStatus(""), 3000);
                return true;
            } catch (e) {
                console.error("Failed to load draft", e);
            }
        }
        return false;
    };

    // Save draft whenever answers or notes change
    useEffect(() => {
        if (!selectedTemplate || Object.keys(answers).length === 0) return;
        const draftKey = getDraftKey(selectedTemplate.id);
        if (!draftKey) return;
        const draftData = {
            answers,
            notes,
            photoUrl,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(draftKey, JSON.stringify(draftData));
        persistLastSelectedTemplate(selectedTemplate.id);
    }, [answers, notes, photoUrl, selectedTemplate, user?.id]);

    const clearDraft = () => {
        if (!selectedTemplate) return;
        const draftKey = getDraftKey(selectedTemplate.id);
        if (!draftKey) return;
        localStorage.removeItem(draftKey);
    };

    useEffect(() => {
        if (!user?.id) return;
        fetchTemplates();
        fetchSubmissions(exportDate);
    }, [user?.id, user?.role, user?.department, exportDate]);

    useEffect(() => {
        // Calculate which templates are already submitted today
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const submittedMap: Record<number, boolean> = {};
        submissions.forEach(sub => {
            if (format(new Date(sub.date), 'yyyy-MM-dd') === todayStr) {
                submittedMap[sub.templateId] = true;
            }
        });
        setTodaySubmissions(submittedMap);
    }, [submissions]);

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
                const lastTemplateKey = getLastTemplateKey();
                const savedTemplateId = lastTemplateKey ? Number(localStorage.getItem(lastTemplateKey)) : null;
                const restoredTemplate = filteredTemplates.find((t: any) => t.id === savedTemplateId) || filteredTemplates[0];

                setSelectedTemplate(restoredTemplate);
                persistLastSelectedTemplate(restoredTemplate.id);

                const draftLoaded = loadDraft(restoredTemplate.id);
                if (!draftLoaded) {
                    initializeAnswersForTemplate(restoredTemplate);
                }

                setShowUnitSelector(filteredTemplates.length > 1 ? !draftLoaded : false);
            } else {
                setSelectedTemplate(null);
                setAnswers({});
                setNotes("");
                setPhotoUrl("");
                setShowUnitSelector(true);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSubmissions = async (date?: string) => {
        try {
            const params: any = {};
            const targetDate = date || exportDate;
            if (targetDate) {
                params.startDate = targetDate;
                params.endDate = targetDate;
            }
            const res = await api.get('/checklist/submissions', { params });
            setSubmissions(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
        return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const getFilteredHistorySubmissions = () => {
        return submissions.filter(sub => {
            // Filter by date
            const subDate = format(new Date(sub.date), 'yyyy-MM-dd');
            if (subDate !== exportDate) return false;

            // Filter by approval status
            if (historyFilter === 'ALL') return true;
            if (historyFilter === 'PENDING_MY_APPROVAL') {
                if (sub.status === 'PENDING_SUPERVISOR' && (user?.role === 'SUPERVISOR' || user?.role?.includes('SPV') || user?.role === 'ADMIN')) return true;
                if (sub.status === 'PENDING_GM' && (user?.role === 'GM' || user?.role === 'ADMIN')) return true;
                return false;
            }
            return true;
        });
    };

    const getDailySubmissions = () => {
        return submissions.filter(sub => format(new Date(sub.date), 'yyyy-MM-dd') === exportDate);
    };

    const downloadBlobResponse = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const extractFilename = (contentDisposition?: string, fallback = 'checklist-export') => {
        if (!contentDisposition) return fallback;
        const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
        const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
        return plainMatch?.[1] || fallback;
    };

    const handleExportChecklist = async (formatType: 'csv' | 'pdf', scope: 'filtered' | 'daily') => {
        const sourceSubmissions = scope === 'daily' ? getDailySubmissions() : getFilteredHistorySubmissions();
        if (sourceSubmissions.length === 0) {
            alert(scope === 'daily'
                ? `Belum ada data checklist pada tanggal ${exportDate} untuk diexport.`
                : 'Belum ada data checklist pada riwayat yang sedang ditampilkan.');
            return;
        }

        const exportKey = `${formatType}-${scope}`;
        setExporting(exportKey);

        try {
            const response = await api.post(`/checklist/export/${formatType}`, {
                submissionIds: sourceSubmissions.map(sub => sub.id),
                scope,
                exportDate,
                historyFilter
            }, {
                responseType: 'blob'
            });

            const defaultFilename = `checklist_${scope}_${exportDate}.${formatType}`;
            const filename = extractFilename(response.headers['content-disposition'], defaultFilename);
            const blobType = formatType === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;';
            downloadBlobResponse(new Blob([response.data], { type: blobType }), filename);
        } catch (error: any) {
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const parsed = JSON.parse(text);
                    alert(parsed.message || 'Gagal export checklist');
                    return;
                } catch {
                    // ignore and fallback below
                }
            }
            alert(error.response?.data?.message || 'Gagal export checklist');
        } finally {
            setExporting("");
        }
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

    const handleQuestionPhotoUpload = async (questionId: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setAnswers(prev => ({
                ...prev,
                [questionId]: { ...prev[questionId], photoUrl: res.data.url }
            }));
        } catch (error) {
            console.error("Upload error:", error);
            alert("Gagal mengupload foto");
        } finally {
            setUploading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPhotoUrl(res.data.url);
        } catch (error) {
            console.error("Upload error:", error);
            alert("Gagal mengupload foto");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTemplate) return;

        const questionsWithoutPhoto = selectedTemplate.categories.flatMap((category: any) =>
            category.questions.filter((q: any) => !isSignatureQuestion(q.question) && !answers[q.id]?.photoUrl)
        );

        if (questionsWithoutPhoto.length > 0) {
            const firstMissingQuestion = questionsWithoutPhoto[0]?.question || 'pertanyaan checklist';
            alert(`Semua pertanyaan wajib difoto. Masih ada ${questionsWithoutPhoto.length} foto yang belum diisi.\n\nContoh yang belum difoto:\n${firstMissingQuestion}`);
            return;
        }

        setLoading(true);
        try {
            const formattedAnswers = Object.entries(answers).map(([qId, data]) => ({
                questionId: parseInt(qId),
                value: data.value,
                remarks: data.remarks,
                photoUrl: data.photoUrl
            }));

            await api.post('/checklist/submit', {
                templateId: selectedTemplate.id,
                answers: formattedAnswers,
                notes,
                photoUrl
            });

            alert("Checklist berhasil dikirim!");
            clearDraft(); // Clear local storage after successful submit
            setNotes("");
            setPhotoUrl("");
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
                </div>
            </div>

            {activeTab === 'form' && (
                <div className="space-y-6">
                    {/* UNIT SELECTION GRID */}
                    {showUnitSelector && templates.length > 1 && (
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
                            <label className="block text-sm font-bold text-gray-700 mb-4">Pilih Kamar / Unit yang Akan Di-cek:</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {templates.map(t => {
                                    const isSubmitted = todaySubmissions[t.id];
                                    const isSelected = selectedTemplate?.id === t.id;
                                    
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setSelectedTemplate(t);
                                                persistLastSelectedTemplate(t.id);
                                                
                                                // Try to load draft first
                                                const draftLoaded = loadDraft(t.id);
                                                
                                                if (!draftLoaded) {
                                                    initializeAnswersForTemplate(t);
                                                }
                                                setShowUnitSelector(false); // Hide selector after picking
                                            }}
                                            className={clsx(
                                                "relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center",
                                                isSelected 
                                                    ? "border-[#0F4D39] bg-[#0F4D39]/5 ring-2 ring-[#0F4D39]/20" 
                                                    : "border-gray-100 bg-white hover:border-gray-200",
                                                isSubmitted && "opacity-60"
                                            )}
                                        >
                                            <div className={clsx(
                                                "p-2 rounded-full",
                                                isSubmitted ? "bg-green-100 text-green-600" : (isSelected ? "bg-[#0F4D39] text-white" : "bg-gray-100 text-gray-400")
                                            )}>
                                                {isSubmitted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-5 h-5 font-bold text-xs flex items-center justify-center">?</div>}
                                            </div>
                                            <span className={clsx(
                                                "text-xs font-bold break-words",
                                                isSelected ? "text-[#0F4D39]" : "text-gray-600"
                                            )}>
                                                {t.name.replace('Room - ', '').replace('Parkir - ', '').replace('Cashier - ', '')}
                                            </span>
                                            {isSubmitted && (
                                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                                                    DONE
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedTemplate && (
                        <div className={clsx("space-y-8 animate-in fade-in duration-500", showUnitSelector && templates.length > 1 && "hidden")}>
                            <div className="flex items-center justify-between bg-[#0F4D39] text-white p-6 rounded-3xl shadow-lg">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Sedang Mengisi:</span>
                                    <h2 className="text-xl font-bold">{selectedTemplate.name}</h2>
                                    {draftStatus && (
                                        <p className="text-[10px] text-green-300 font-bold animate-pulse mt-0.5 flex items-center gap-1">
                                            <Save size={10} /> {draftStatus}
                                        </p>
                                    )}
                                </div>
                                {templates.length > 1 && (
                                    <button 
                                        onClick={() => setShowUnitSelector(true)}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/20"
                                    >
                                        <ArrowLeft size={16} /> Ganti Unit
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                            {selectedTemplate.categories
                                .filter((cat: any) => {
                                    // Hide categories that only contain signature rows
                                    return cat.questions.some((q: any) => {
                                        return !isSignatureQuestion(q.question);
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
                                                return !isSignatureQuestion(q.question);
                                            })
                                            .map((q: any) => (
                                            <div key={q.id} className="p-6 flex flex-col gap-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4">
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

                                                {/* Per-Question Camera Section */}
                                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                                    {!answers[q.id]?.photoUrl ? (
                                                        <div className="flex gap-2">
                                                            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-[#0F4D39] transition-all text-gray-700 text-xs font-bold shadow-sm">
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    capture="environment" 
                                                                    onChange={(e) => handleQuestionPhotoUpload(q.id, e)}
                                                                    className="hidden"
                                                                    disabled={uploading}
                                                                />
                                                                <Camera className="w-4 h-4 text-[#0F4D39]" />
                                                                Ambil Foto Bukti (Wajib)
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <div className="relative group">
                                                            <img 
                                                                src={getFullUrl(answers[q.id].photoUrl || '')} 
                                                                alt="Evidence" 
                                                                className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-md"
                                                            />
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    setAnswers(prev => ({
                                                                        ...prev,
                                                                        [q.id]: { ...prev[q.id], photoUrl: "" }
                                                                    }));
                                                                }}
                                                                className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {uploading && !answers[q.id]?.photoUrl && (
                                                        <div className="flex items-center gap-2 text-xs text-[#0F4D39] font-bold animate-pulse">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            Mengupload foto...
                                                        </div>
                                                    )}
                                                    {!answers[q.id]?.photoUrl && !uploading && (
                                                        <div className="text-xs font-bold text-red-500">
                                                            Foto wajib diisi sebelum checklist bisa dikirim.
                                                        </div>
                                                    )}
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

                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#0F4D39]/20 bg-[#0F4D39]/5 px-4 py-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-[#0F4D39]">
                                    <Save className="w-4 h-4" />
                                    Draft tersimpan otomatis di perangkat ini dan akan dimuat lagi setelah refresh atau login ulang.
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!selectedTemplate) return;
                                        persistLastSelectedTemplate(selectedTemplate.id);
                                        setDraftStatus("Draft tersimpan");
                                        setTimeout(() => setDraftStatus(""), 3000);
                                    }}
                                    className="shrink-0 rounded-xl border border-[#0F4D39]/20 bg-white px-3 py-2 text-xs font-bold text-[#0F4D39] hover:bg-[#0F4D39]/5"
                                >
                                    Simpan Draft
                                </button>
                            </div>

                            <button 
                                type="submit"
                                disabled={loading || uploading}
                                className="w-full py-5 bg-[#0F4D39] text-white rounded-2xl font-bold text-lg hover:bg-[#0a3628] shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 disabled:bg-gray-400"
                            >
                                {loading ? "Mengirim..." : <><Send className="w-6 h-6" /> Kirim Checklist Harian</>}
                            </button>
                        </form>
                    </div>
                )}

                {!selectedTemplate && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-400">Belum ada template checklist untuk departemen Anda.</h3>
                    </div>
                )}
            </div>
        )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                            <button 
                                onClick={() => setHistoryFilter('ALL')}
                                className={clsx(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    historyFilter === 'ALL' ? "bg-[#0F4D39] text-white" : "text-gray-500 hover:bg-gray-50"
                                )}
                            >
                                Semua Riwayat
                            </button>
                            <button 
                                onClick={() => setHistoryFilter('PENDING_MY_APPROVAL')}
                                className={clsx(
                                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                                    historyFilter === 'PENDING_MY_APPROVAL' ? "bg-orange-600 text-white" : "text-gray-500 hover:bg-gray-50"
                                )}
                            >
                                Perlu Approval Saya
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <input
                                type="date"
                                value={exportDate}
                                onChange={(e) => setExportDate(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm outline-none focus:border-[#0F4D39]"
                            />
                            <button
                                onClick={() => handleExportChecklist('csv', 'filtered')}
                                disabled={!!exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> {exporting === 'csv-filtered' ? 'Exporting...' : 'CSV Riwayat'}
                            </button>
                            <button
                                onClick={() => handleExportChecklist('pdf', 'filtered')}
                                disabled={!!exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> {exporting === 'pdf-filtered' ? 'Exporting...' : 'PDF Riwayat'}
                            </button>
                            <button
                                onClick={() => handleExportChecklist('csv', 'daily')}
                                disabled={!!exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-[#0F4D39]/5 border border-[#0F4D39]/20 rounded-xl text-xs font-bold text-[#0F4D39] hover:bg-[#0F4D39]/10 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> {exporting === 'csv-daily' ? 'Exporting...' : 'CSV 1 File Harian'}
                            </button>
                            <button
                                onClick={() => handleExportChecklist('pdf', 'daily')}
                                disabled={!!exporting}
                                className="flex items-center gap-2 px-4 py-2 bg-[#0F4D39] rounded-xl text-xs font-bold text-white hover:bg-[#0a3628] transition-all shadow-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" /> {exporting === 'pdf-daily' ? 'Exporting...' : 'PDF 1 File Harian'}
                            </button>
                        </div>
                    </div>

                    {submissions.length > 0 ? (
                        getFilteredHistorySubmissions()
                            .map((sub) => (
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
                                                sub.status === 'APPROVED' ? "bg-green-100 text-green-700" : 
                                                sub.status === 'PENDING_GM' ? "bg-blue-100 text-blue-700" :
                                                sub.status === 'PENDING_SUPERVISOR' ? "bg-orange-100 text-orange-700" :
                                                "bg-gray-100 text-gray-700"
                                            )}>
                                                {sub.status.replace('_', ' ')}
                                            </span>
                                            <div className="flex gap-2">
                                                <div className="flex items-center gap-1" title="Staff Submitted">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                    <span className="text-[8px] text-gray-400">STAFF</span>
                                                </div>
                                                <div className="flex items-center gap-1" title="Supervisor Approval">
                                                    {sub.spvSigned ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Clock className="w-3.5 h-3.5 text-gray-300" />}
                                                    <span className="text-[8px] text-gray-400">SPV</span>
                                                </div>
                                                <div className="flex items-center gap-1" title="GM Approval">
                                                    {sub.gmSigned ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Clock className="w-3.5 h-3.5 text-gray-300" />}
                                                    <span className="text-[8px] text-gray-400">GM</span>
                                                </div>
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
                                                <div key={ans.id} className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
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
                                                    
                                                    {ans.photoUrl && (
                                                        <div className="mt-2">
                                                            <a 
                                                                href={getFullUrl(ans.photoUrl)} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-block relative group"
                                                            >
                                                                <img 
                                                                    src={getFullUrl(ans.photoUrl)} 
                                                                    alt="Answer Evidence" 
                                                                    className="w-24 h-24 object-cover rounded-lg border border-gray-100 shadow-sm group-hover:shadow-md transition-all"
                                                                />
                                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-lg transition-all flex items-center justify-center">
                                                                    <span className="text-white text-[8px] font-bold">Zoom</span>
                                                                </div>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {sub.notes && (
                                            <div className="bg-white p-4 rounded-xl border border-gray-100">
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Kesimpulan:</p>
                                                <p className="text-gray-700">{sub.notes}</p>
                                            </div>
                                        )}

                                        {sub.photoUrl && (
                                            <div className="bg-white p-4 rounded-xl border border-gray-100">
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Bukti Foto:</p>
                                                <a 
                                                    href={getFullUrl(sub.photoUrl)} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-block relative group"
                                                >
                                                    <img 
                                                        src={getFullUrl(sub.photoUrl)} 
                                                        alt="Evidence" 
                                                        className="w-full max-w-sm h-48 object-cover rounded-xl shadow-sm group-hover:shadow-md transition-all"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-xl transition-all flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">Klik untuk Memperbesar</span>
                                                    </div>
                                                </a>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
                                            {/* Supervisor Action */}
                                            {!sub.spvSigned && sub.status === 'PENDING_SUPERVISOR' && (user?.role === 'SUPERVISOR' || user?.role?.includes('SPV') || user?.role === 'ADMIN') && (
                                                <button 
                                                    onClick={() => handleSign(sub.id, 'SPV')}
                                                    className="px-6 py-2.5 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 flex items-center gap-2 shadow-md transition-all active:scale-95"
                                                >
                                                    <Signature className="w-4 h-4" /> Setujui sebagai Supervisor
                                                </button>
                                            )}

                                            {/* GM Action */}
                                            {!sub.gmSigned && sub.status === 'PENDING_GM' && (user?.role === 'GM' || user?.role === 'ADMIN') && (
                                                <button 
                                                    onClick={() => handleSign(sub.id, 'GM')}
                                                    className="px-6 py-2.5 bg-[#0F4D39] text-white rounded-xl font-bold text-sm hover:bg-[#0a3628] flex items-center gap-2 shadow-md transition-all active:scale-95"
                                                >
                                                    <Signature className="w-4 h-4" /> Approve & Sign (GM)
                                                </button>
                                            )}

                                            {sub.status === 'APPROVED' && (
                                                <div className="flex items-center gap-2 text-green-600 font-bold text-sm bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                                                    <CheckCircle2 className="w-5 h-5" /> Checklist Selesai & Disetujui GM
                                                </div>
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
