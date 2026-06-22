"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import AnnouncementSection from "@/components/AnnouncementSection";
import OnboardingWidget from "@/components/OnboardingWidget";
import { 
  Clock, 
  Calendar, 
  Users, 
  FileText, 
  Download,
  Bell, 
  Sun, 
  Moon,
  Cloud,
  CheckCircle,
  Briefcase,
  ArrowRight,
  LogOut,
  MapPin,
  Coffee,
  AlertCircle,
  MessageSquare,
  Copy,
  ExternalLink,
  Bug,
  Eye,
  Phone,
  Mail,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { formatWibTime, formatWibDateTime } from "@/lib/wibHelpers";
import api from "@/lib/api";

export default function Dashboard() {
  const { user, loading, refreshUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todaySchedule, setTodaySchedule] = useState<any | null>(null);
  const [tomorrowSchedule, setTomorrowSchedule] = useState<any | null>(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugForm, setBugForm] = useState({
    title: "",
    description: "",
    type: "BUG",
    priority: "MEDIUM",
    imageUrl: ""
  });
  const [myBugReports, setMyBugReports] = useState<any[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waOtp, setWaOtp] = useState("");
  const [waStep, setWaStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [waExpiresIn, setWaExpiresIn] = useState<number>(0);
  const [waResendIn, setWaResendIn] = useState<number>(0);

  useEffect(() => {
    refreshUser();

    const fetchLastAttendance = async () => {
      try {
        const res = await api.get("/attendance/me");
        const history = res.data || [];

        if (history.length > 0) {
          const last = history[0];
          setIsCheckedIn(last.type !== "CHECK_OUT");
        } else {
          setIsCheckedIn(false);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchLastAttendance();

    const fetchTodaySchedule = async () => {
      try {
        const res = await api.get("/schedule/me");
        const all = res.data || [];
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
        
        const today = all.find((s: any) => format(new Date(s.date), "yyyy-MM-dd") === todayStr);
        const tomorrow = all.find((s: any) => format(new Date(s.date), "yyyy-MM-dd") === tomorrowStr);
        
        setTodaySchedule(today || null);
        setTomorrowSchedule(tomorrow || null);
      } catch (err) {
        console.error(err);
      }
    };

    fetchTodaySchedule();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let t: any;
    if (waStep === 'sent') {
      t = setInterval(() => {
        setWaExpiresIn(v => (v > 0 ? v - 1 : 0));
        setWaResendIn(v => (v > 0 ? v - 1 : 0));
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [waStep]);

  const fetchMyBugReports = async () => {
    try {
      const res = await api.get("/bug-reports/me");
      setMyBugReports(res.data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showBugModal) {
      fetchMyBugReports();
    }
  }, [showBugModal]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "Good Morning", icon: Sun, color: "text-orange-500" };
    if (hour < 18) return { text: "Good Afternoon", icon: Cloud, color: "text-blue-500" };
    return { text: "Good Evening", icon: Moon, color: "text-indigo-500" };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  const handleSendWaCode = async () => {
    try {
      const res = await api.post('/users/wa/send-code', { phone: waPhone });
      const expiresAt = new Date(res.data.expiresAt);
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setWaExpiresIn(diff);
      setWaResendIn(parseInt(process.env.NEXT_PUBLIC_OTP_RESEND_COOLDOWN || '60', 10));
      setWaStep('sent');
      alert('Kode verifikasi dikirim ke WhatsApp Anda.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengirim kode.');
    }
  };

  const handleVerifyWaCode = async () => {
    try {
      await api.post('/users/wa/verify-code', { phone: waPhone, code: waOtp });
      setWaStep('verified');
      await refreshUser();
      alert('Nomor WhatsApp berhasil diverifikasi.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verifikasi gagal.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBugForm({ ...bugForm, imageUrl: res.data.url });
    } catch (err: any) {
      alert("Gagal mengupload gambar.");
      console.error(err);
    }
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/bug-reports", bugForm);
      alert("Terima kasih, laporan Anda sudah dikirim ke Admin.");
      setBugForm({ title: "", description: "", type: "BUG", priority: "MEDIUM", imageUrl: "" });
      fetchMyBugReports();
      setShowBugModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengirim laporan.");
    }
  };

  // Guest Comment Report (Internal)
  const [surveyType, setSurveyType] = useState<string>("HOTEL_GUEST");
  const [surveyRows, setSurveyRows] = useState<any[]>([]);
  const [surveyError, setSurveyError] = useState<string>("");
  const [surveyLoading, setSurveyLoading] = useState<boolean>(false);
  const [selectedSurvey, setSelectedSurvey] = useState<any | null>(null);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [publicSurveyType, setPublicSurveyType] = useState<string>("WISATA");
  const [surveyStartDate, setSurveyStartDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [surveyEndDate, setSurveyEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  const fetchSurveyReport = async () => {
    setSurveyLoading(true);
    setSurveyError("");
    try {
      const params: any = { type: surveyType };
      if (surveyStartDate) params.startDate = surveyStartDate;
      if (surveyEndDate) params.endDate = surveyEndDate;
      const res = await api.get(`/public-survey/report`, { params });
      setSurveyRows(res.data || []);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setSurveyError("Anda tidak memiliki akses melihat report ini.");
      } else {
        setSurveyError("Gagal memuat data report.");
      }
    } finally {
      setSurveyLoading(false);
    }
  };

  const exportSurveyCsv = async () => {
    try {
      const params: any = { type: surveyType };
      if (surveyStartDate) params.startDate = surveyStartDate;
      if (surveyEndDate) params.endDate = surveyEndDate;
      const res = await api.get(`/public-survey/export`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `guest_comment_${surveyType}_${surveyStartDate || 'all'}_${surveyEndDate || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Gagal mengunduh CSV.");
    }
  };

  const exportSurveyExcel = async () => {
    try {
      const params: any = { type: surveyType };
      if (surveyStartDate) params.startDate = surveyStartDate;
      if (surveyEndDate) params.endDate = surveyEndDate;
      const res = await api.get(`/public-survey/export-xlsx`, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `guest_comment_${surveyType}_${surveyStartDate || 'all'}_${surveyEndDate || 'all'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Gagal mengunduh Excel.");
    }
  };

  useEffect(() => {
    if (user) fetchSurveyReport();
  }, [user, surveyType, surveyStartDate, surveyEndDate]);

  useEffect(() => {
    const checkAllowed = async () => {
      try {
        const res = await api.get('/public-survey/allowed');
        const allowed = res.data?.allowedTypes || [];
        setAllowedTypes(allowed);
        
        // If current surveyType is not allowed, switch to first allowed one
        if (allowed.length > 0 && !allowed.includes('ALL') && !allowed.includes(surveyType)) {
          setSurveyType(allowed[0] === 'ALL' ? 'WISATA' : allowed[0]);
        }
      } catch {}
    };
    if (user) checkAllowed();
  }, [user]);

  const getScheduleDisplay = (schedule: any) => {
    if (!schedule) return { title: "No Schedule", time: null, statusClass: "text-gray-500", bgClass: "bg-gray-100 text-gray-500" };

    const isOff = ['OFF', 'Cuti', 'Sakit', 'Izin', 'Alpha'].includes(schedule.shiftName);
    
    if (isOff) {
        let badgeColor = "bg-gray-100 text-gray-700"; 
        if (schedule.shiftName === 'Cuti') badgeColor = "bg-blue-100 text-blue-700";
        if (schedule.shiftName === 'Sakit') badgeColor = "bg-yellow-100 text-yellow-700";
        if (schedule.shiftName === 'Izin') badgeColor = "bg-purple-100 text-purple-700";
        if (schedule.shiftName === 'Alpha') badgeColor = "bg-red-100 text-red-700";

        return {
            title: schedule.shiftName,
            time: null,
            statusClass: "text-gray-900 font-bold",
            bgClass: badgeColor
        };
    }

    return {
        title: schedule.shiftName ? `Shift ${schedule.shiftName}` : "Scheduled",
        time: `${formatWibTime(schedule.shiftStart)} - ${formatWibTime(schedule.shiftEnd)}`,
        statusClass: "text-green-700 font-medium",
        bgClass: "bg-white border border-green-200 text-green-700"
    };
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
    </div>
  );
  if (!user) return null; 

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Welcome Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#0F4D39]/5 to-transparent rounded-bl-full -mr-16 -mt-16 pointer-events-none" />
         
         <div className="relative z-10">
            <div className="flex items-center gap-3 text-sm font-medium text-gray-500 mb-2">
                <span className={`flex items-center gap-1.5 ${greeting.color}`}>
                    <GreetingIcon className="w-4 h-4" />
                    {greeting.text}
                </span>
                <span>•</span>
                <span>{format(currentTime, "EEEE, MMMM do, yyyy")}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                Welcome back, {user.name.split(' ')[0]}!
            </h1>
            <p className="text-gray-500 mt-2 text-lg flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                {user.role} &mdash; {user.department}
            </p>
         </div>

         <div className="flex flex-col sm:flex-row flex-wrap gap-3 relative z-10 w-full md:w-auto">
             <Link href="/attendance" className="w-full sm:w-auto">
                <button className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl font-semibold shadow-lg transition-all ${
                    isCheckedIn 
                    ? 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-700 hover:-translate-y-0.5'
                    : 'bg-[#0F4D39] text-white shadow-[#0F4D39]/20 hover:bg-[#0a3628] hover:-translate-y-0.5'
                }`}>
                    <Clock className="w-5 h-5" />
                    {isCheckedIn ? "Check Out Now" : "Check In Now"}
                </button>
             </Link>
             <Link href="/requests" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 sm:px-5 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all">
                    <FileText className="w-5 h-5" />
                    New Request
                </button>
             </Link>
         </div>
      </div>

      {!user.whatsappVerifiedAt && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800">Verifikasi Nomor WhatsApp</h2>
          <p className="text-gray-600 mt-1">Masukkan nomor WhatsApp aktif Anda untuk menerima kode verifikasi.</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700">Nomor WhatsApp</label>
              <input 
                type="text" 
                value={waPhone} 
                onChange={(e) => setWaPhone(e.target.value)} 
                placeholder="08xxxxxxxxxx atau +62xxxxxxxxxx"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700">Kode OTP</label>
              <input 
                type="text" 
                value={waOtp} 
                onChange={(e) => setWaOtp(e.target.value)} 
                maxLength={6}
                placeholder="6 digit"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                disabled={waStep !== 'sent'}
              />
              {waStep === 'sent' && (
                <p className="text-sm text-gray-500 mt-1">Kadaluarsa dalam {waExpiresIn}s</p>
              )}
            </div>
            <div className="md:col-span-1 flex items-end gap-2">
              <button 
                type="button"
                onClick={handleSendWaCode}
                disabled={waStep === 'sent' && waResendIn > 0}
                className="px-4 py-2.5 rounded-lg bg-[#0F4D39] text-white font-bold hover:bg-[#0a3628]"
              >
                {waStep === 'sent' && waResendIn > 0 ? `Kirim Ulang (${waResendIn}s)` : 'Kirim Kode'}
              </button>
              <button 
                type="button"
                onClick={handleVerifyWaCode}
                disabled={waStep !== 'sent'}
                className="px-4 py-2.5 rounded-lg bg-gray-900 text-white font-bold hover:bg-gray-800"
              >
                Verifikasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Link Section */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full shadow-sm text-[#0F4D39]">
                  <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                  <h3 className="text-lg font-bold text-gray-800">Link Penilaian Pelanggan Anda</h3>
                  <p className="text-sm text-gray-600">Bagikan link ini kepada pelanggan untuk memberikan penilaian terhadap pelayanan Anda.</p>
              </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
               <button 
                  onClick={() => {
                      const url = `${window.location.origin}/customer-feedback?staffId=${user.id}`;
                      navigator.clipboard.writeText(url);
                      alert("Link berhasil disalin!");
                  }}
                  className="flex-1 md:flex-none items-center justify-center gap-2 bg-white text-[#0F4D39] border border-[#0F4D39]/20 px-4 py-2.5 rounded-lg font-semibold hover:bg-emerald-50 transition-all text-sm flex"
               >
                   <Copy className="w-4 h-4" />
                   Salin Link
               </button>
               <a 
                  href={`/customer-feedback?staffId=${user.id}`}
                  target="_blank"
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-lg font-semibold shadow-md shadow-[#0F4D39]/10 hover:bg-[#0a3628] transition-all text-sm"
               >
                   <ExternalLink className="w-4 h-4" />
                   Buka Form
               </a>
          </div>
      </div>

      {/* Public Survey Quick Links (Semua user) */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full shadow-sm text-[#0F4D39]">
                  <FileText className="w-6 h-6" />
              </div>
              <div>
                  <h3 className="text-lg font-bold text-gray-800">Link Survey Publik</h3>
                  <p className="text-sm text-gray-600">Bagikan link survey publik untuk pengunjung.</p>
              </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto items-stretch sm:items-center">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-sm text-gray-700">Jenis</label>
                  <select
                      className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                      value={publicSurveyType}
                      onChange={e => setPublicSurveyType(e.target.value)}
                  >
                      <option value="WISATA">Wisata</option>
                      <option value="THE_PINES">The Pines</option>
                      <option value="THE_CAVE">The Cave</option>
                      <option value="OMAH_BAMBOO">Omah Bamboo</option>
                      <option value="HOTEL_GUEST">Penginapan</option>
                  </select>
              </div>
              <button 
                 onClick={() => {
                    const path = publicSurveyType === 'WISATA'
                      ? '/public-survey/wisata'
                      : publicSurveyType === 'THE_PINES'
                        ? '/public-survey/pines'
                        : publicSurveyType === 'THE_CAVE'
                          ? '/public-survey/cave'
                          : publicSurveyType === 'OMAH_BAMBOO'
                            ? '/public-survey/omah-bamboo'
                            : '/public-survey/hotel-guest';
                    const url = `${window.location.origin}${path}`;
                    navigator.clipboard.writeText(url);
                    alert("Link berhasil disalin!");
                 }}
                 className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-[#0F4D39] border border-[#0F4D39]/20 px-4 py-2.5 rounded-lg font-semibold hover:bg-emerald-50 transition-all text-sm"
              >
                  <Copy className="w-4 h-4" />
                  Salin Link
              </button>
              <a 
                 href={
                   publicSurveyType === 'WISATA' ? '/public-survey/wisata' :
                   publicSurveyType === 'THE_PINES' ? '/public-survey/pines' :
                   publicSurveyType === 'THE_CAVE' ? '/public-survey/cave' :
                   publicSurveyType === 'OMAH_BAMBOO' ? '/public-survey/omah-bamboo' :
                   '/public-survey/hotel-guest'
                 }
                 target="_blank"
                 className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-lg font-semibold shadow-md shadow-[#0F4D39]/10 hover:bg-[#0a3628] transition-all text-sm"
              >
                  <ExternalLink className="w-4 h-4" />
                  Buka Form
              </a>
          </div>
      </div>

      {/* Onboarding Widget (Only if tasks exist) */}
      <OnboardingWidget />

      {/* Report Submit Guest Comment (Internal) */}
      {((user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN') || allowedTypes.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-[#0F4D39] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0F4D39]" />
              Report Submit Guest Comment
              </h2>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full lg:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm text-gray-700">Jenis Survey</label>
                <select
                  className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                  value={surveyType}
                  onChange={e => setSurveyType(e.target.value)}
                >
                  {(['HOTEL_GUEST','THE_CAVE','THE_PINES','OMAH_BAMBOO','WISATA'] as const)
                    .filter(t => (allowedTypes.includes('ALL') || allowedTypes.includes(t) || (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN')))
                    .map(t => (
                      <option key={t} value={t}>
                        {t === 'HOTEL_GUEST' ? 'Penginapan' : t === 'THE_CAVE' ? 'The Cave' : t === 'THE_PINES' ? 'The Pines' : t === 'OMAH_BAMBOO' ? 'Omah Bamboo' : 'Wisata'}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm text-gray-700">Dari</label>
                <input
                  type="date"
                  className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                  value={surveyStartDate}
                  onChange={(e) => setSurveyStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="text-sm text-gray-700">Sampai</label>
                <input
                  type="date"
                  className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
                  value={surveyEndDate}
                  onChange={(e) => setSurveyEndDate(e.target.value)}
                />
              </div>
              <button 
                onClick={exportSurveyCsv}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-[#0F4D39] border border-[#0F4D39]/20 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button 
                onClick={exportSurveyExcel}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0F4D39] text-white border border-[#0F4D39] px-4 py-2 rounded-lg font-semibold hover:bg-[#0a3628] transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>
          {surveyLoading ? (
            <div className="p-4 text-sm text-gray-500">Memuat data...</div>
          ) : surveyError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{surveyError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="p-4 font-semibold text-gray-600">Tanggal</th>
                    <th className="p-4 font-semibold text-gray-600">Nama</th>
                    <th className="p-4 font-semibold text-gray-600">Email</th>
                    <th className="p-4 font-semibold text-gray-600">WhatsApp</th>
                    <th className="p-4 font-semibold text-gray-600">Consent</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {surveyRows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600">{formatWibDateTime(r.createdAt)}</td>
                      <td className="p-4 font-medium text-gray-800">{r.name || "-"}</td>
                      <td className="p-4 text-gray-600">{r.email || "-"}</td>
                      <td className="p-4 text-gray-600">{r.phone || "-"}</td>
                      <td className="p-4">
                        <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                          {r.wantFollowUp ? "FollowUp" : "-"}
                        </span>{" "}
                        <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                          {r.privacyConsent ? "Privacy" : "-"}
                        </span>{" "}
                        <span className="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
                          {r.marketingConsent ? "Marketing" : "-"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => setSelectedSurvey(r)}
                          className="text-[#0F4D39] hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {surveyRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">Belum ada data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail Guest Comment Modal */}
      {selectedSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#0F4D39]">Detail Guest Comment</h2>
              <button 
                onClick={() => setSelectedSurvey(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Waktu</p>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0F4D39]" />
                    {formatWibDateTime(selectedSurvey.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nama</p>
                  <p className="font-semibold text-gray-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0F4D39]" />
                    {selectedSurvey.name || "-"}
                  </p>
                </div>
              </div>
              {/* Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="w-3 h-3 text-gray-400" />
                    {selectedSurvey.email || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">WhatsApp</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-3 h-3 text-gray-400" />
                    {selectedSurvey.phone || "-"}
                  </p>
                </div>
              </div>
              {/* Consents */}
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  {selectedSurvey.wantFollowUp ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                  <span className={`text-sm ${selectedSurvey.wantFollowUp ? 'text-gray-700' : 'text-gray-400'}`}>Bersedia dihubungi kembali</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSurvey.privacyConsent ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                  <span className={`text-sm ${selectedSurvey.privacyConsent ? 'text-gray-700' : 'text-gray-400'}`}>Menyetujui Kebijakan Privasi</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSurvey.marketingConsent ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-300" />}
                  <span className={`text-sm ${selectedSurvey.marketingConsent ? 'text-gray-700' : 'text-gray-400'}`}>Menyetujui Info Promosi (Marketing)</span>
                </div>
              </div>
              {/* Data Payload */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-800 mb-4">Rincian Jawaban</h3>
                <div className="space-y-2">
                  {selectedSurvey.data && Object.entries(selectedSurvey.data).map(([k, v]: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">{k}</span>
                      <span className="font-medium text-gray-800">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                    </div>
                  ))}
                  {!selectedSurvey.data && (
                    <div className="text-sm text-gray-500">Tidak ada data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bug & Feature Request Section (Semua user) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="bg-red-50 p-3 rounded-full text-red-600">
            <Bug className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Laporan Bug & Request Fitur</h3>
            <p className="text-sm text-gray-600">
              Jika menemukan error atau punya ide pengembangan sistem, kirim di sini. Laporan Anda akan langsung masuk ke Admin.
            </p>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <button
            onClick={() => setShowBugModal(true)}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a3628] transition-all"
          >
            <Bug className="w-4 h-4" />
            Buat Laporan
          </button>
        </div>
      </div>

      {/* Analytics Dashboard for HR, GM, Finance, Store, HOD, Supervisor, Staff */}
      {(user.role === 'HR' || user.role === 'GM' || user.role === 'FINANCE' || user.role === 'STORE' || user.role === 'SUPERVISOR' || user.role === 'HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_HOD' || user.role === 'MERCHANDISE_SPV' || user.role === 'STAFF') && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AnalyticsDashboard />
        </div>
      )}

      {/* Announcements Section */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <AnnouncementSection />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column: Stats & Schedule */}
          <div className="xl:col-span-2 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:border-[#0F4D39]/20 transition-all">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Attendance Today</p>
                            <h3 className="text-2xl font-bold mt-2 text-gray-900">Present</h3>
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-medium bg-green-50 w-fit px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                On Time
                            </p>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50">
                        <p className="text-xs text-gray-400">Clocked in at 08:00 AM</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:border-[#0F4D39]/20 transition-all">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-gray-500 text-sm font-medium">Leave Balance</p>
                            <h3 className="text-2xl font-bold mt-2 text-gray-900">{user.leaveQuota ?? 12} Days</h3>
                            <p className="text-xs text-gray-500 mt-1">Annual Leave</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded-xl text-orange-600 group-hover:scale-110 transition-transform">
                            <Coffee className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-50">
                         <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(((user.leaveQuota ?? 12) / 12) * 100, 100)}%` }}></div>
                         </div>
                         <p className="text-xs text-gray-400 mt-2">{Math.round(((user.leaveQuota ?? 12) / 12) * 100)}% remaining</p>
                    </div>
                </div>

                {(user.role === 'HOD' || user.role === 'HR' || user.role === 'GM') ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:border-[#0F4D39]/20 transition-all">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Pending Approvals</p>
                                <h3 className="text-2xl font-bold mt-2 text-gray-900">3</h3>
                                <p className="text-xs text-orange-600 mt-1 font-medium">Action Required</p>
                            </div>
                            <div className="bg-purple-50 p-3 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                                <FileText className="w-6 h-6" />
                            </div>
                        </div>
                         <div className="mt-4 pt-4 border-t border-gray-50">
                            <Link href="/requests?tab=approvals" className="text-xs text-purple-600 font-medium hover:underline flex items-center gap-1">
                                Review Requests <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    </div>
                ) : (
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 group hover:border-[#0F4D39]/20 transition-all">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium">Next Holiday</p>
                                <h3 className="text-2xl font-bold mt-2 text-gray-900">Dec 25</h3>
                                <p className="text-xs text-gray-500 mt-1">Christmas Day</p>
                            </div>
                            <div className="bg-pink-50 p-3 rounded-xl text-pink-600 group-hover:scale-110 transition-transform">
                                <Calendar className="w-6 h-6" />
                            </div>
                        </div>
                         <div className="mt-4 pt-4 border-t border-gray-50">
                            <p className="text-xs text-gray-400">5 days to go</p>
                        </div>
                    </div>
                )}
              </div>

              {/* Schedule Section */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-[#0F4D39]" />
                          My Schedule
                      </h2>
                      <Link href="/schedule" className="text-sm text-[#0F4D39] font-medium hover:underline">
                          View Full Schedule
                      </Link>
                  </div>
                  <div className="p-6">
                      <div className="space-y-4">
                        {/* Today */}
                        {(() => {
                            const { title, time, statusClass, bgClass } = getScheduleDisplay(todaySchedule);
                            return (
                                <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-white border border-green-100 rounded-xl">
                                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-700 font-bold text-lg">
                                        {format(currentTime, "dd")}
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-900">Today</p>
                                                <p className={`text-sm mt-0.5 ${statusClass}`}>
                                                  {title}
                                                </p>
                                            </div>
                                            {time && (
                                              <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${bgClass}`}>
                                                {time}
                                              </span>
                                            )}
                                            {!time && todaySchedule && (
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${bgClass}`}>
                                                    {title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Tomorrow */}
                        {(() => {
                             const { title, time, statusClass, bgClass } = getScheduleDisplay(tomorrowSchedule);
                             const tomorrowDate = addDays(currentTime, 1);
                             return (
                                <div className="flex items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                                    <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 font-bold text-lg">
                                        {format(tomorrowDate, "dd")}
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-900">Tomorrow</p>
                                                <p className={`text-sm mt-0.5 ${statusClass}`}>{title}</p>
                                            </div>
                                            {time && (
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${bgClass}`}>
                                                    {time}
                                                </span>
                                            )}
                                            {!time && tomorrowSchedule && (
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${bgClass}`}>
                                                    {title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                             );
                        })()}
                      </div>
                  </div>
              </div>
          </div>

          {/* Right Column: Notifications & Quick Links */}
          <div className="space-y-8">
               {/* Notifications */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Bell className="w-5 h-5 text-orange-500" />
                          Notifications
                      </h2>
                      <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">New</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                      <div className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-3">
                              <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Leave Request Approved</p>
                                  <p className="text-xs text-gray-500 mt-1">Your annual leave for Dec 25 has been approved by HR.</p>
                                  <p className="text-[10px] text-gray-400 mt-2">2 hours ago</p>
                              </div>
                          </div>
                      </div>
                      <div className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-3">
                              <div className="mt-1">
                                  <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                              </div>
                              <div>
                                  <p className="text-sm font-medium text-gray-900">Team Meeting</p>
                                  <p className="text-xs text-gray-500 mt-1">Monthly evaluation meeting at 2 PM in Meeting Room A.</p>
                                  <p className="text-[10px] text-gray-400 mt-2">Yesterday</p>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                      <button className="text-xs font-semibold text-gray-500 hover:text-gray-700">View All Notifications</button>
                  </div>
               </div>

               {/* Quick Links / Resources */}
               <div className="bg-[#0F4D39] rounded-2xl shadow-lg shadow-[#0F4D39]/20 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-10 -mb-10 blur-xl"></div>
                    
                    <h3 className="text-lg font-bold relative z-10 mb-4">Need Help?</h3>
                    <p className="text-green-100 text-sm mb-6 relative z-10">
                        Check the employee handbook or contact HR for assistance with your requests.
                    </p>
                    
                    <button className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 relative z-10">
                        <AlertCircle className="w-4 h-4" />
                        Contact HR Support
                    </button>
               </div>
          </div>
      </div>

      {/* Bug Report Modal */}
      {showBugModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-500" />
              Laporan Bug / Request Fitur
            </h3>
            <form onSubmit={handleBugSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                  value={bugForm.title}
                  onChange={e => setBugForm({ ...bugForm, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={bugForm.type}
                    onChange={e => setBugForm({ ...bugForm, type: e.target.value })}
                  >
                    <option value="BUG">Bug</option>
                    <option value="FEATURE">Request Fitur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={bugForm.priority}
                    onChange={e => setBugForm({ ...bugForm, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Screenshot (Opsional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-emerald-50 file:text-emerald-700
                      hover:file:bg-emerald-100
                    "
                  />
                </div>
                {bugForm.imageUrl && (
                  <div className="mt-2">
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Gambar berhasil diupload
                    </p>
                    <img 
                      src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${bugForm.imageUrl}`} 
                      alt="Preview" 
                      className="h-20 w-auto rounded border mt-1 object-cover" 
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-32"
                  required
                  value={bugForm.description}
                  onChange={e => setBugForm({ ...bugForm, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBugModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0F4D39] text-white text-sm font-semibold hover:bg-[#0a3628]"
                >
                  Kirim
                </button>
              </div>
            </form>

            {myBugReports.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-bold text-gray-800 mb-3">Riwayat Laporan Saya</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {myBugReports.map((report) => (
                    <div key={report.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-gray-800">{report.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          report.status === 'DONE' ? 'bg-green-100 text-green-700' :
                          report.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          report.status === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {report.status === 'DONE' ? 'Selesai' :
                           report.status === 'IN_PROGRESS' ? 'Sedang Proses' :
                           report.status === 'IN_REVIEW' ? 'Di Review' : 'Open'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mb-1 line-clamp-2">{report.description}</p>
                      {report.imageUrl && (
                        <div className="mb-2">
                           <a 
                             href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${report.imageUrl}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                           >
                             <ExternalLink className="w-3 h-3" /> Lihat Gambar
                           </a>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[10px] text-gray-400">
                        <span>{format(new Date(report.createdAt), 'dd MMM yyyy HH:mm')}</span>
                        <span className="uppercase">{report.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
