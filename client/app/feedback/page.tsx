"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { 
    Star, 
    User, 
    Calendar, 
    MessageSquare, 
    Phone, 
    Mail, 
    CheckCircle, 
    XCircle,
    Eye,
    ThumbsUp,
    AlertCircle,
    Download
} from "lucide-react";

interface Feedback {
    id: number;
    staffId: number;
    staff: {
        name: string;
    };
    ratingFriendliness: number;
    ratingExplanation: number;
    ratingHelpfulness: number;
    ratingRecommend: number;
    likedAspects: string;
    improvementAreas: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    wantFollowUp: boolean;
    privacyConsent: boolean;
    marketingConsent: boolean;
    createdAt: string;
}

export default function FeedbackPage() {
    const { user } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const res = await api.get("/feedback");
            setFeedbacks(res.data);
        } catch (err) {
            console.error("Error fetching feedback:", err);
        } finally {
            setLoading(false);
        }
    };

    const calculateAverageRating = (f: Feedback) => {
        const sum = f.ratingFriendliness + f.ratingExplanation + f.ratingHelpfulness + f.ratingRecommend;
        return (sum / 4).toFixed(1);
    };

    const getStarColor = (rating: number) => {
        if (rating >= 4) return "text-yellow-400";
        if (rating >= 3) return "text-yellow-600";
        return "text-red-500";
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/feedback/export', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `feedback_data_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed:", error);
            alert("Gagal mengunduh data.");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0F4D39]">Umpan Balik Pelanggan</h1>
                    <p className="text-gray-600">Daftar penilaian dan masukan dari pelanggan.</p>
                </div>
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-white text-[#0F4D39] border border-[#0F4D39]/20 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">Tanggal</th>
                                <th className="p-4 font-semibold text-gray-600">Staff</th>
                                <th className="p-4 font-semibold text-gray-600">Pelanggan</th>
                                <th className="p-4 font-semibold text-gray-600">Rating Rata-rata</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {feedbacks.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        Belum ada data feedback.
                                    </td>
                                </tr>
                            ) : (
                                feedbacks.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-gray-600">
                                            {format(new Date(item.createdAt), "dd MMM yyyy HH:mm")}
                                        </td>
                                        <td className="p-4 font-medium text-gray-800">
                                            {item.staff?.name || "-"}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            <div className="font-medium text-gray-800">{item.customerName}</div>
                                            <div className="text-xs text-gray-500">{item.customerPhone}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1">
                                                <Star className={`w-4 h-4 fill-current ${getStarColor(parseFloat(calculateAverageRating(item)))}`} />
                                                <span className="font-bold text-gray-700">{calculateAverageRating(item)}</span>
                                                <span className="text-gray-400 text-xs">/ 5</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => setSelectedFeedback(item)}
                                                className="text-[#0F4D39] hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedFeedback && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-[#0F4D39]">Detail Feedback</h2>
                            <button 
                                onClick={() => setSelectedFeedback(null)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Staff Dinilai</p>
                                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                                        <User className="w-4 h-4 text-[#0F4D39]" />
                                        {selectedFeedback.staff?.name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Waktu Penilaian</p>
                                    <p className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-[#0F4D39]" />
                                        {format(new Date(selectedFeedback.createdAt), "dd MMM yyyy HH:mm")}
                                    </p>
                                </div>
                            </div>

                            {/* Ratings Breakdown */}
                            <div>
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                                    Penilaian Layanan
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <RatingItem label="Keramahan & Kesopanan" value={selectedFeedback.ratingFriendliness} />
                                    <RatingItem label="Penjelasan Produk" value={selectedFeedback.ratingExplanation} />
                                    <RatingItem label="Membantu Kebutuhan" value={selectedFeedback.ratingHelpfulness} />
                                    <RatingItem label="Rekomendasi ke Orang Lain" value={selectedFeedback.ratingRecommend} />
                                </div>
                            </div>

                            {/* Comments */}
                            <div className="space-y-4">
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <h4 className="font-semibold text-[#0F4D39] mb-2 flex items-center gap-2">
                                        <ThumbsUp className="w-4 h-4" />
                                        Hal yang disukai
                                    </h4>
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                        {selectedFeedback.likedAspects || "-"}
                                    </p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Hal yang perlu ditingkatkan
                                    </h4>
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                        {selectedFeedback.improvementAreas || "-"}
                                    </p>
                                </div>
                            </div>

                            {/* Customer Info & Consents */}
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="font-bold text-gray-800 mb-4">Data Pelanggan</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                                    <div>
                                        <p className="text-xs text-gray-500">Nama</p>
                                        <p className="font-medium">{selectedFeedback.customerName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="font-medium flex items-center gap-2">
                                            <Mail className="w-3 h-3 text-gray-400" />
                                            {selectedFeedback.customerEmail || "-"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Telepon</p>
                                        <p className="font-medium flex items-center gap-2">
                                            <Phone className="w-3 h-3 text-gray-400" />
                                            {selectedFeedback.customerPhone || "-"}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <ConsentItem 
                                        label="Bersedia dihubungi kembali" 
                                        checked={selectedFeedback.wantFollowUp} 
                                    />
                                    <ConsentItem 
                                        label="Menyetujui Kebijakan Privasi" 
                                        checked={selectedFeedback.privacyConsent} 
                                    />
                                    <ConsentItem 
                                        label="Menyetujui Info Promosi (Marketing)" 
                                        checked={selectedFeedback.marketingConsent} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RatingItem({ label, value }: { label: string, value: number }) {
    return (
        <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
            <span className="text-sm text-gray-600">{label}</span>
            <div className="flex items-center gap-1">
                <span className="font-bold text-gray-800">{value}</span>
                <Star className={`w-3 h-3 fill-current ${value >= 4 ? 'text-yellow-400' : 'text-gray-300'}`} />
            </div>
        </div>
    );
}

function ConsentItem({ label, checked }: { label: string, checked: boolean }) {
    return (
        <div className="flex items-center gap-2">
            {checked ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
                <XCircle className="w-4 h-4 text-gray-300" />
            )}
            <span className={`text-sm ${checked ? 'text-gray-700' : 'text-gray-400'}`}>
                {label}
            </span>
        </div>
    );
}
