"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format, differenceInDays } from "date-fns";
import { formatWibDate, formatWibMonthDay, formatWibTime } from "@/lib/wibHelpers";
import { User, Calendar, Trash2, Edit2, Plus, Download, Bug, Settings2, Info, MessageSquare, Award, Upload, Trophy, BarChart2, Loader2, ImageIcon, ClipboardCheck, Settings, List, ChevronRight, Save } from "lucide-react";
import Link from "next/link";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import clsx from "clsx";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading Admin Dashboard...</div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("staff");

  // Effect to handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    // 'voting' removed from allowed tabs as it is completed
    if (tab && ['staff', 'schedule', 'contracts', 'approval', 'whatsapp', 'wa-settings', 'bugs'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bugReports, setBugReports] = useState<any[]>([]);
  const [approvalConfigs, setApprovalConfigs] = useState<any[]>([]);
  const [selectedApprovalModule, setSelectedApprovalModule] = useState<"REQUEST" | "PROCUREMENT">("REQUEST");
  const [selectedApprovalDepartment, setSelectedApprovalDepartment] = useState<string>("");
  const [editingApprovalConfig, setEditingApprovalConfig] = useState<any | null>(null);
  const [approvalSteps, setApprovalSteps] = useState<{ order: number; role: string }[]>([]);
  const [approvalAssignments, setApprovalAssignments] = useState<{ userId: number; role?: string | null }[]>([]);
  const [isSavingApprovalConfig, setIsSavingApprovalConfig] = useState(false);
  const [showAdvancedAssignments, setShowAdvancedAssignments] = useState(false);
  const [bugStartDate, setBugStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [bugEndDate, setBugEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffTypeFilter, setStaffTypeFilter] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  const [waUsers, setWaUsers] = useState<any[]>([]);
  const [waSearch, setWaSearch] = useState('');
  const [waDept, setWaDept] = useState('');
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [votingResults, setVotingResults] = useState<any[]>([]);
  const [votingLoading, setVotingLoading] = useState(false);
  const [rookiePhotos, setRookiePhotos] = useState<any[]>([]);
  const [rookieCandidateUserId, setRookieCandidateUserId] = useState<string>('');
  const [rookieUploading, setRookieUploading] = useState(false);
  const [isResettingVoting, setIsResettingVoting] = useState(false);
  const [rookieSearch, setRookieSearch] = useState('');
  
  const [waSettings, setWaSettings] = useState({
    WA_BASE_URL: "",
    WA_API_KEY: "",
    WA_SESSION_ID: "",
    WA_FAKE_SEND: "0"
  });
  const [isSavingWaSettings, setIsSavingWaSettings] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [isTestingWa, setIsTestingWa] = useState(false);
  
  const [votingSearch, setVotingSearch] = useState("");
  const [selectedVotingCategory, setSelectedVotingCategory] = useState("");

  const filteredVotingResults = useMemo(() => {
    let filtered = [...votingResults];
    
    if (selectedVotingCategory) {
      filtered = filtered.filter(cat => cat.key === selectedVotingCategory);
    }

    if (votingSearch.trim()) {
      const q = votingSearch.toLowerCase();
      filtered = filtered.map(cat => ({
        ...cat,
        items: (cat.items || []).filter((it: any) => {
          const name = (cat.targetType === 'DEPARTMENT' ? it.candidateDepartment : it.name) || '';
          const dept = it.department || '';
          return name.toLowerCase().includes(q) || dept.toLowerCase().includes(q);
        })
      })).filter(cat => cat.items.length > 0);
    }

    return filtered;
  }, [votingResults, votingSearch, selectedVotingCategory]);

  const waFiltered = waUsers.filter(u => {
    const q = waSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  });
  const waVerifiedCount = waFiltered.filter(u => !!u.whatsappVerifiedAt).length;
  const waUnverifiedCount = waFiltered.length - waVerifiedCount;
  const waPieData = [
    { name: 'Verified', value: waVerifiedCount },
    { name: 'Unverified', value: waUnverifiedCount }
  ];
  const waPieColors = ['#0F4D39', '#D1D5DB'];
  
  // Forms
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [bugForm, setBugForm] = useState({
      title: "",
      description: "",
      type: "BUG",
      priority: "MEDIUM"
  });
  
  // User Form State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formDataUser, setFormDataUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    department: "",
    employmentType: "CONTRACT",
    leaveQuota: 12,
    pdo: 0,
    contractStartDate: "",
    contractEndDate: "",
    rchAccess: false
  });

  // Schedule Form State
  const [formDataSchedule, setFormDataSchedule] = useState({
      userId: "", date: "", shiftStart: "", shiftEnd: "", description: ""
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };
 
  const fetchExpiringContracts = async () => {
    try {
      const res = await api.get("/users/expiring");
      setExpiringUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const params: any = {};
      if (waDept && waDept.trim() !== '') params.department = waDept.trim();
      const res = await api.get("/users/wa/status", { params });
      setWaUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWaSettings = async () => {
    try {
      const res = await api.get("/settings?group=WHATSAPP");
      const settings = res.data;
      const newSettings: any = { ...waSettings };
      settings.forEach((s: any) => {
        // Support migration from old WATZAP keys to new WA keys
        let targetKey = s.key;
        if (s.key === 'WATZAP_BASE_URL') targetKey = 'WA_BASE_URL';
        if (s.key === 'WATZAP_API_KEY') targetKey = 'WA_API_KEY';
        if (s.key === 'WATZAP_FAKE_SEND') targetKey = 'WA_FAKE_SEND';

        if (targetKey in newSettings) {
          newSettings[targetKey] = s.value;
        }
      });
      setWaSettings(newSettings);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWaSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWaSettings(true);
    try {
      const settingsArray = Object.entries(waSettings).map(([key, value]) => ({
        key,
        value,
        group: "WHATSAPP"
      }));
      await api.post("/settings", { settings: settingsArray });
      alert("WhatsApp settings saved successfully");
    } catch (err: any) {
      alert(err.response?.data?.message || "Error saving settings");
    } finally {
      setIsSavingWaSettings(false);
    }
  };

  const handleTestWa = async () => {
    if (!testPhone) return alert("Masukkan nomor HP untuk tes");
    setIsTestingWa(true);
    try {
      const res = await api.post("/settings/test-wa", { phone: testPhone });
      alert(res.data.message);
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengirim pesan tes");
    } finally {
      setIsTestingWa(false);
    }
  };

  const fetchChecklistTemplates = async () => {
    try {
      const res = await api.get("/checklist/templates");
      setChecklistTemplates(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVotingResults = async () => {
    try {
      setVotingLoading(true);
      const res = await api.get("/voting/results");
      setVotingResults(res.data?.results || []);
    } catch (err) {
      console.error(err);
      setVotingResults([]);
    } finally {
      setVotingLoading(false);
    }
  };

  const handleResetVoting = async () => {
    if (!confirm("⚠️ PERINGATAN: Ini akan menghapus SEMUA data suara yang sudah masuk dan mengizinkan semua user untuk voting ulang. Tindakan ini tidak bisa dibatalkan. Lanjutkan?")) {
      return;
    }

    const confirmText = prompt("Ketik 'RESET' untuk mengonfirmasi penghapusan permanen:");
    if (confirmText !== 'RESET') {
      alert("Reset dibatalkan.");
      return;
    }

    setIsResettingVoting(true);
    try {
      const res = await api.post("/voting/admin/reset-all");
      alert(res.data.message);
      await fetchVotingResults();
    } catch (error: any) {
      alert(error.response?.data?.message || "Gagal mereset data voting");
    } finally {
      setIsResettingVoting(false);
    }
  };

  const fetchRookiePhotos = async () => {
    try {
      const res = await api.get("/voting/admin/rookie-photos");
      setRookiePhotos(res.data || []);
    } catch (err) {
      console.error(err);
      setRookiePhotos([]);
    }
  };

  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const toPublicUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // Use dynamic API route for uploads to bypass proxy issues
    if (url.startsWith('/uploads/')) {
      const filename = url.split('/').pop();
      return `${apiUrl}/upload/${filename}`;
    }

    return `${publicBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const handleRookiePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!rookieCandidateUserId) {
      alert("Pilih karyawan dulu.");
      return;
    }

    setRookieUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const url = uploadRes.data?.url;
      if (!url) {
        alert("Upload gagal (url kosong).");
        return;
      }
      await api.post("/voting/admin/rookie-photo", {
        candidateUserId: parseInt(rookieCandidateUserId, 10),
        photoUrl: url
      });
      alert("Foto Best Rookie tersimpan.");
      await fetchRookiePhotos();
      await fetchVotingResults();
    } catch (err: any) {
      alert("Gagal upload/simpan foto: " + (err.response?.data?.message || err.message));
    } finally {
      setRookieUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteRookiePhoto = async (candidateUserId: number) => {
    if (!confirm("Hapus foto Best Rookie untuk karyawan ini?")) return;
    try {
      await api.delete(`/voting/admin/rookie-photo/${candidateUserId}`);
      await fetchRookiePhotos();
      await fetchVotingResults();
    } catch (err: any) {
      alert("Gagal hapus foto: " + (err.response?.data?.message || err.message));
    }
  };
  const exportWhatsAppCSV = () => {
    const headers = ["Name","Department","Role","WhatsAppNumber","VerifiedAt"];
    const rows = waFiltered.map(u => [
      u.name,
      u.department || "",
      u.role,
      u.whatsappNumber || "",
      u.whatsappVerifiedAt ? `${formatWibDate(u.whatsappVerifiedAt)} ${formatWibTime(u.whatsappVerifiedAt)}` : ""
    ]);
    const q = (v: any) => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = [headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_status_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchSchedules = async () => {
    try {
      const res = await api.get("/schedule/all");
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBugReports = async (start?: string, end?: string) => {
    try {
      const params: any = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const res = await api.get("/bug-reports", { params });
      setBugReports(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchApprovalConfigs = async () => {
    try {
      const params: any = {};
      if (selectedApprovalModule) params.module = selectedApprovalModule;
      if (selectedApprovalDepartment) params.department = selectedApprovalDepartment;
      const res = await api.get("/approval-configs", { params });
      setApprovalConfigs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsersForAssignments = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredStaff = users.filter(u => {
    const q = staffSearch.trim().toLowerCase();
    const typeMatch = !staffTypeFilter || u.employmentType === staffTypeFilter;
    
    if (!q) return typeMatch;
    
    const searchMatch = (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );

    return typeMatch && searchMatch;
  });

  const filteredSchedules = schedules.filter(s => {
    const q = scheduleSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.user?.name || '').toLowerCase().includes(q) ||
      (s.user?.department || '').toLowerCase().includes(q)
    );
  });

  const filteredContracts = expiringUsers.filter(u => {
    const q = contractSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!user) return;

    if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN') {
      if (activeTab === 'staff' || activeTab === 'schedule' || activeTab === 'contracts' || activeTab === 'approval') {
        fetchUsers();
      }

      if (activeTab === 'schedule') {
        fetchSchedules();
      } else if (activeTab === 'contracts') {
        fetchExpiringContracts();
      } else if (activeTab === 'approval') {
        fetchApprovalConfigs();
      } else if (activeTab === 'whatsapp') {
        fetchWhatsAppStatus();
      } else if (activeTab === 'wa-settings') {
        fetchWaSettings();
      } else if (activeTab === 'voting') {
        fetchUsers();
        fetchVotingResults();
        fetchRookiePhotos();
      }
      
      if (activeTab === 'staff') {
        fetchChecklistTemplates();
      }
    }

    if (activeTab === 'bugs' && (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN')) {
      fetchBugReports(bugStartDate || undefined, bugEndDate || undefined);
    }
  }, [user, activeTab, selectedApprovalModule, selectedApprovalDepartment, bugStartDate, bugEndDate]);
 
  const exportStaffCSV = () => {
    const headers = ["Name","Email","Role","Department","LeaveQuota","PDO","ContractStart","ContractEnd","CreatedAt"];
    const rows = users.map(u => [
      u.name,
      u.email,
      u.role,
      u.department || "",
      u.leaveQuota ?? 12,
      u.pdo ?? 0,
      u.contractStartDate ? formatWibDate(u.contractStartDate) : "",
      u.contractEndDate ? formatWibDate(u.contractEndDate) : "",
      u.createdAt ? formatWibDate(u.createdAt) + " " + formatWibTime(u.createdAt) : ""
    ]);
    const q = (v: any) => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = [headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `staff_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
 
  const exportScheduleCSV = () => {
    const headers = ["Staff","Department","Date","ShiftStart","ShiftEnd","Description"];
    const rows = schedules.map(s => [
      s.user?.name || "",
      s.user?.department || "",
      s.date ? formatWibDate(s.date) : "",
      s.shiftStart ? formatWibTime(s.shiftStart) : "",
      s.shiftEnd ? formatWibTime(s.shiftEnd) : "",
      s.description || ""
    ]);
    const q = (v: any) => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = [headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedules_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
 
  const exportContractsCSV = () => {
    const headers = ["Name","Department","ContractStart","ContractEnd","DaysRemaining","Status"];
      const rows = expiringUsers.map(u => {
      const days = u.contractEndDate ? differenceInDays(new Date(u.contractEndDate), new Date()) : "";
      const status = typeof days === 'number'
        ? (days < 0 ? 'Expired' : (days < 30 ? 'Expiring Soon' : 'Active'))
        : '';
        return [
        u.name,
        u.department || "",
          u.contractStartDate ? formatWibDate(u.contractStartDate) : "",
          u.contractEndDate ? formatWibDate(u.contractEndDate) : "",
        days,
        status
      ];
    });
    const q = (v: any) => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const csv = [headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contracts_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApplyBugFilter = () => {
    fetchBugReports(bugStartDate || undefined, bugEndDate || undefined);
  };

  const handleResetBugFilter = () => {
    const today = new Date().toISOString().split("T")[0];
    setBugStartDate(today);
    setBugEndDate(today);
    fetchBugReports(today, today);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (editingUser) {
              await api.put(`/users/${editingUser.id}`, formDataUser);
              alert("User updated");
              if (user && editingUser.id === user.id) {
                  await refreshUser();
              }
          } else {
              await api.post("/users", formDataUser);
              alert("User created");
          }
          setShowUserModal(false);
          setEditingUser(null);
          setFormDataUser({ 
            name: "", 
            email: "", 
            password: "", 
            role: "STAFF", 
            department: "", 
            employmentType: "CONTRACT", 
            leaveQuota: 12, 
            pdo: 0, 
            contractStartDate: "", 
            contractEndDate: "",
            rchAccess: false 
          });
          fetchUsers();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error saving user");
      }
  };

  const handleDeleteUser = async (id: number) => {
      if (!confirm("Are you sure?")) return;
      try {
          await api.delete(`/users/${id}`);
          fetchUsers();
      } catch (err) {
          alert("Error deleting user");
      }
  };

  const handleToggleRchAccess = async (user: any) => {
    try {
      await api.put(`/users/${user.id}`, { rchAccess: !user.rchAccess });
      setUsers(users.map(u => u.id === user.id ? { ...u, rchAccess: !u.rchAccess } : u));
    } catch (err: any) {
      alert(err.response?.data?.message || "Error updating RCH access");
    }
  };

  const handleEditUser = (user: any) => {
      setEditingUser(user);
      setFormDataUser({
          name: user.name,
          email: user.email,
          password: "", // Don't fill password
          role: user.role,
          department: user.department || "",
          employmentType: user.employmentType || "CONTRACT",
          leaveQuota: typeof user.leaveQuota === "number" ? user.leaveQuota : 12,
          pdo: typeof user.pdo === "number" ? user.pdo : 0,
          contractStartDate: user.contractStartDate ? new Date(user.contractStartDate).toISOString().split('T')[0] : "",
          contractEndDate: user.contractEndDate ? new Date(user.contractEndDate).toISOString().split('T')[0] : "",
          rchAccess: user.rchAccess || false
      });
      setShowUserModal(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          // Combine date + time
          const start = `${formDataSchedule.date}T${formDataSchedule.shiftStart}:00`;
          const end = `${formDataSchedule.date}T${formDataSchedule.shiftEnd}:00`;
          
          await api.post("/schedule", {
              userId: parseInt(formDataSchedule.userId),
              date: formDataSchedule.date,
              shiftStart: start,
              shiftEnd: end,
              description: formDataSchedule.description
          });
          alert("Schedule created");
          setShowScheduleModal(false);
          setFormDataSchedule({ userId: "", date: "", shiftStart: "", shiftEnd: "", description: "" });
          fetchSchedules();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error creating schedule");
      }
  };

  const handleBugSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.post("/bug-reports", bugForm);
          alert("Laporan berhasil dikirim");
          setBugForm({ title: "", description: "", type: "BUG", priority: "MEDIUM" });
          fetchBugReports();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error mengirim laporan");
      }
  };

  const handleBugStatusUpdate = async (id: number, status: string) => {
    try {
      await api.put(`/bug-reports/${id}/status`, { status });
      fetchBugReports();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengupdate status laporan.");
    }
  };

  const resetApprovalForm = () => {
    setEditingApprovalConfig(null);
    setApprovalSteps([]);
    setApprovalAssignments([]);
    setShowAdvancedAssignments(false);
  };

  const handleEditApprovalConfig = (config: any) => {
    setEditingApprovalConfig(config);
    setSelectedApprovalModule(config.module);
    setSelectedApprovalDepartment(config.department || "");
    setApprovalSteps(
      (config.steps || [])
        .slice()
        .sort((a: any, b: any) => a.order - b.order)
        .map((s: any) => ({ order: s.order, role: s.role }))
    );
    setApprovalAssignments(
      (config.assignments || []).map((a: any) => ({
        userId: a.userId,
        role: a.role || null
      }))
    );
    setShowAdvancedAssignments((config.assignments || []).length > 0);
  };

  const getAvailableRolesForModule = (module: "REQUEST" | "PROCUREMENT") => {
    // Defines sorting order for approval steps
    const commonRoles = [
        "PHOTOGRAPHER_HOD", 
        "MERCHANDISE_HOD", 
        "MERCHANDISE_SPV",
        "HOD", 
        "SUPERVISOR",
        "GM"
    ];

    if (module === "REQUEST") {
      return [...commonRoles.slice(0, 5), "HR", "FINANCE", "GM"]; // Insert HR and FINANCE before GM
    }
    return [...commonRoles.slice(0, 5), "FINANCE", "GM"]; // Insert FINANCE before GM
  };

  const toggleApprovalRole = (role: string) => {
    const availableRoles = getAvailableRolesForModule(selectedApprovalModule);
    const currentRoles = approvalSteps.map(s => s.role);
    const exists = currentRoles.includes(role);
    let nextRoles = exists ? currentRoles.filter(r => r !== role) : [...currentRoles, role];
    nextRoles = availableRoles.filter(r => nextRoles.includes(r));
    const nextSteps = nextRoles.map((r, index) => ({
      order: index + 1,
      role: r
    }));
    setApprovalSteps(nextSteps);
  };

  const handleAddApprovalAssignment = () => {
    if (users.length === 0) return;
    const firstUser = users[0];
    setApprovalAssignments([
      ...approvalAssignments,
      { userId: firstUser.id, role: null }
    ]);
  };

  const handleUpdateApprovalAssignmentUser = (index: number, userId: number) => {
    setApprovalAssignments(
      approvalAssignments.map((a, i) =>
        i === index ? { ...a, userId } : a
      )
    );
  };

  const handleDeleteApprovalConfig = async (id: number) => {
    if (!confirm("Are you sure you want to delete this approval config?")) return;
    try {
      await api.delete(`/approval-configs/${id}`);
      alert("Approval config deleted");
      if (editingApprovalConfig?.id === id) {
          resetApprovalForm();
      }
      fetchApprovalConfigs();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error deleting approval config");
    }
  };

  const handleUpdateApprovalAssignmentRole = (index: number, role: string | null) => {
    setApprovalAssignments(
      approvalAssignments.map((a, i) =>
        i === index ? { ...a, role } : a
      )
    );
  };

  const handleRemoveApprovalAssignment = (index: number) => {
    setApprovalAssignments(
      approvalAssignments.filter((_, i) => i !== index)
    );
  };

  const handleApprovalConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApprovalModule) return;

    const cleanedSteps = approvalSteps
      .filter(s => s.role)
      .sort((a, b) => a.order - b.order)
      .map((s, index) => ({
        order: index + 1,
        role: s.role
      }));

    setIsSavingApprovalConfig(true);
    try {
      const payload: any = {
        module: selectedApprovalModule,
        department: selectedApprovalDepartment || null,
        enabled: true,
        steps: cleanedSteps,
        assignments: approvalAssignments.map(a => ({
          userId: a.userId,
          role: a.role || null,
          department: selectedApprovalDepartment || null
        }))
      };

      if (editingApprovalConfig) {
        await api.put(`/approval-configs/${editingApprovalConfig.id}`, payload);
      } else {
        await api.post(`/approval-configs`, payload);
      }

      alert("Approval config saved");
      resetApprovalForm();
      fetchApprovalConfigs();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error saving approval config");
    } finally {
      setIsSavingApprovalConfig(false);
    }
  };

  if (user?.role !== 'HR' && user?.role !== 'GM' && user?.role !== 'ADMIN') {
      return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 sm:gap-4 border-b">
        <button 
            className={`pb-2 px-4 ${activeTab === 'staff' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('staff')}
        >
            Staff Management
        </button>
        <button 
            className={`pb-2 px-4 ${activeTab === 'schedule' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('schedule')}
        >
            Schedule Management
        </button>
        <button 
            className={`pb-2 px-4 ${activeTab === 'contracts' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('contracts')}
        >
            Contract Expiry
        </button>
        <button 
            className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'approval' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => {
              setActiveTab('approval');
              fetchUsersForAssignments();
            }}
        >
            <Settings2 size={16} />
            Approval Settings
        </button>
        <button 
            className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'whatsapp' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('whatsapp')}
        >
            <MessageSquare size={16} />
            WhatsApp Status
        </button>
        <button 
            className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'wa-settings' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('wa-settings')}
        >
            <Settings size={16} />
            WhatsApp Integration
        </button>
        <button 
            className={`pb-2 px-4 flex items-center gap-2 ${activeTab === 'checklists' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('checklists')}
        >
            <ClipboardCheck size={16} />
            Checklist Manager
        </button>
        <button 
            className={`pb-2 px-4 ${activeTab === 'bugs' ? 'border-b-2 border-[#0F4D39] font-bold text-[#0F4D39]' : 'text-gray-700'}`}
            onClick={() => setActiveTab('bugs')}
        >
            Bug & Feature Requests
        </button>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold">All Staff</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto md:justify-end">
                    <select
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                      value={staffTypeFilter}
                      onChange={e => setStaffTypeFilter(e.target.value)}
                    >
                        <option value="">Semua Tipe</option>
                        <option value="CONTRACT">Karyawan Kontrak</option>
                        <option value="DAILY_WORKER">Daily Worker / Casual</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Search name / email / department..."
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-64"
                      value={staffSearch}
                      onChange={e => setStaffSearch(e.target.value)}
                    />
                    <button 
                      onClick={exportStaffCSV}
                      className="w-full sm:w-auto justify-center border border-[#0F4D39] text-[#0F4D39] bg-white px-4 py-2 rounded flex items-center space-x-2"
                    >
                      <Download size={18} /> <span>Export CSV</span>
                    </button>
                    <button 
                      onClick={() => {
                          setEditingUser(null);
                          setFormDataUser({ name: "", email: "", password: "", role: "STAFF", department: "", employmentType: "CONTRACT", leaveQuota: 12, pdo: 0, contractStartDate: "", contractEndDate: "", rchAccess: false });
                          setShowUserModal(true);
                      }}
                      className="w-full sm:w-auto justify-center bg-[#0F4D39] text-white px-4 py-2 rounded flex items-center space-x-2"
                    >
                        <Plus size={18} /> <span>Add Staff</span>
                    </button>
                  </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">RCH Access</th>
                            <th className="p-3">Leave Quota</th>
                            <th className="p-3">PDO</th>
                            <th className="p-3">Contract End</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStaff.map((u) => (
                            <tr key={u.id} className="border-b">
                                <td className="p-3">
                                    <div className="font-medium text-gray-900">{u.name}</div>
                                    <div className="text-xs text-gray-500">{u.email}</div>
                                </td>
                                <td className="p-3">
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                        u.employmentType === 'DAILY_WORKER' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        {u.employmentType?.replace('_', ' ') || 'CONTRACT'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{u.role}</span>
                                </td>
                                <td className="p-3">{u.department}</td>
                                <td className="p-3">
                                    <button 
                                        onClick={() => handleToggleRchAccess(u)}
                                        className={clsx(
                                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                                            u.rchAccess ? "bg-[#0F4D39]" : "bg-gray-200"
                                        )}
                                    >
                                        <span className={clsx(
                                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                            u.rchAccess ? "translate-x-6" : "translate-x-1"
                                        )} />
                                    </button>
                                </td>
                                <td className="p-3 text-center">{u.leaveQuota ?? 12}</td>
                                <td className="p-3 text-center">{u.pdo ?? 0}</td>
                                <td className="p-3 text-sm">
                                    {u.contractEndDate ? formatWibMonthDay(u.contractEndDate) + ", " + new Date(u.contractEndDate).getFullYear() : '-'}
                                </td>
                                <td className="p-3 flex space-x-2">
                                    <button onClick={() => handleEditUser(u)} className="text-blue-600 hover:text-blue-800"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {/* WHATSAPP TAB */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">Status Nomor WhatsApp</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Cari nama / departemen..."
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48"
                value={waSearch}
                onChange={e => setWaSearch(e.target.value)}
              />
              <select
                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 bg-white"
                value={waDept}
                onChange={e => { setWaDept(e.target.value); fetchWhatsAppStatus(); }}
              >
                <option value="">Semua Departemen</option>
                <option value="Front Office">Front Office</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Public Area">Public Area</option>
                <option value="F&B Service">F&B Service</option>
                <option value="F&B Product">F&B Product</option>
                <option value="Engineering">Engineering</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Cashier">Cashier</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
                <option value="Sales & Business Development">Sales & Business Development</option>
                <option value="IT">IT</option>
                <option value="Security">Security</option>
                <option value="General Affair">General Affair</option>
                <option value="Merchandise">Merchandise</option>
                <option value="Photographer">Photographer</option>
              </select>
              <button 
                onClick={exportWhatsAppCSV}
                className="border border-[#0F4D39] text-[#0F4D39] bg-white px-4 py-2 rounded flex items-center space-x-2"
              >
                <Download size={18} /> <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold">{waFiltered.length}</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-500">Verified</div>
              <div className="text-2xl font-bold text-[#0F4D39]">{waVerifiedCount}</div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-500">Belum Verifikasi</div>
              <div className="text-2xl font-bold text-gray-600">{waUnverifiedCount}</div>
            </div>
          </div>

          <div className="w-full h-48 mb-6">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={waPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
                  {waPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={waPieColors[index % waPieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">Nama</th>
                  <th className="text-left px-4 py-2 border-b">Departemen</th>
                  <th className="text-left px-4 py-2 border-b">Role</th>
                  <th className="text-left px-4 py-2 border-b">Nomor WhatsApp</th>
                  <th className="text-left px-4 py-2 border-b">Verifikasi</th>
                </tr>
              </thead>
              <tbody>
                {waFiltered.map(u => {
                    const verified = !!u.whatsappVerifiedAt;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border-b">{u.name}</td>
                        <td className="px-4 py-2 border-b">{u.department || '-'}</td>
                        <td className="px-4 py-2 border-b">{u.role}</td>
                        <td className="px-4 py-2 border-b">{u.whatsappNumber || '-'}</td>
                        <td className="px-4 py-2 border-b">
                          {verified
                            ? `${formatWibDate(u.whatsappVerifiedAt)} ${formatWibTime(u.whatsappVerifiedAt)}`
                            : 'Belum diverifikasi'}
                        </td>
                      </tr>
                    );
                  })}
                {waUsers.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-center text-gray-500" colSpan={5}>
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHATSAPP SETTINGS TAB */}
      {activeTab === 'wa-settings' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="text-[#0F4D39]" />
            <h2 className="text-xl font-bold">WhatsApp Integration Settings (OpenWA)</h2>
          </div>
          
          <form onSubmit={handleWaSettingsSubmit} className="max-w-2xl space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Pengaturan ini menggunakan server OpenWA milik sendiri. Pastikan API Key dan Session ID sudah benar.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OpenWA Base URL</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-[#0F4D39] focus:border-[#0F4D39]" 
                  placeholder="https://api.anda.id"
                  value={waSettings.WA_BASE_URL} 
                  onChange={e => setWaSettings({...waSettings, WA_BASE_URL: e.target.value})}
                />
                <p className="mt-1 text-xs text-gray-500">Contoh: http://127.0.0.1:2785 atau https://api.thelodgegroup.id</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key (X-API-Key)</label>
                <input 
                  type="password" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-[#0F4D39] focus:border-[#0F4D39]" 
                  placeholder="Masukkan API Key OpenWA"
                  value={waSettings.WA_API_KEY} 
                  onChange={e => setWaSettings({...waSettings, WA_API_KEY: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-[#0F4D39] focus:border-[#0F4D39]" 
                  placeholder="Contoh: my-session"
                  value={waSettings.WA_SESSION_ID} 
                  onChange={e => setWaSettings({...waSettings, WA_SESSION_ID: e.target.value})}
                />
                <p className="mt-1 text-xs text-gray-500">ID Sesi yang aktif di server OpenWA Anda.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode Simulasi (Fake Send)</label>
                <select 
                  className="w-full border border-gray-300 p-2 rounded focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                  value={waSettings.WA_FAKE_SEND}
                  onChange={e => setWaSettings({...waSettings, WA_FAKE_SEND: e.target.value})}
                >
                  <option value="0">OFF (Kirim beneran ke WA)</option>
                  <option value="1">ON (Hanya simulasi, tidak kirim beneran)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">Aktifkan mode simulasi jika ingin mencoba sistem tanpa mengirim pesan beneran.</p>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isSavingWaSettings}
                className="flex items-center gap-2 bg-[#0F4D39] text-white px-6 py-2 rounded font-bold hover:bg-[#0a3a2b] transition-all disabled:opacity-50"
              >
                {isSavingWaSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                Simpan Pengaturan
              </button>
            </div>
          </form>

          <div className="mt-10 pt-10 border-t border-gray-100">
            <h3 className="text-lg font-bold mb-4">Tes Koneksi WhatsApp</h3>
            <p className="text-sm text-gray-500 mb-4">Pastikan Anda sudah klik "Simpan Pengaturan" di atas sebelum melakukan tes.</p>
            <div className="flex gap-2 max-w-md">
              <input 
                type="text" 
                className="flex-1 border border-gray-300 p-2 rounded focus:ring-[#0F4D39] focus:border-[#0F4D39]" 
                placeholder="Contoh: 08123456789"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
              />
              <button 
                onClick={handleTestWa}
                disabled={isTestingWa}
                className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isTestingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare size={16} />}
                Kirim Pesan Tes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold">All Schedules</h2>
                  <div className="flex flex-1 md:flex-none items-center gap-2 justify-end">
                    <input
                      type="text"
                      placeholder="Search staff / department..."
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full md:w-64"
                      value={scheduleSearch}
                      onChange={e => setScheduleSearch(e.target.value)}
                    />
                    <button 
                      onClick={exportScheduleCSV}
                      className="border border-[#0F4D39] text-[#0F4D39] bg-white px-4 py-2 rounded flex items-center space-x-2"
                    >
                      <Download size={18} /> <span>Export CSV</span>
                    </button>
                    <button 
                      onClick={() => setShowScheduleModal(true)}
                      className="bg-[#0F4D39] text-white px-4 py-2 rounded flex items-center space-x-2"
                    >
                        <Plus size={18} /> <span>Assign Schedule</span>
                    </button>
                  </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3">Staff</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Shift</th>
                            <th className="p-3">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSchedules.map((s) => (
                            <tr key={s.id} className="border-b">
                                <td className="p-3 font-medium">
                                    {s.user.name} <span className="text-xs text-gray-700">({s.user.department})</span>
                                </td>
                                <td className="p-3">{formatWibMonthDay(s.date) + ", " + new Date(s.date).getFullYear()}</td>
                                <td className="p-3">
                                    {formatWibTime(s.shiftStart)} - {formatWibTime(s.shiftEnd)}
                                </td>
                                <td className="p-3 text-sm text-gray-700">{s.description || '-'}</td>
                            </tr>
                        ))}
                        {filteredSchedules.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-700">No schedules found</td></tr>
                        )}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {/* CONTRACTS TAB */}
      {activeTab === 'contracts' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold">Expiring Contracts</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto md:justify-end">
                    <input
                      type="text"
                      placeholder="Search name / department..."
                      className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-64"
                      value={contractSearch}
                      onChange={e => setContractSearch(e.target.value)}
                    />
                    <button 
                      onClick={exportContractsCSV}
                      className="w-full sm:w-auto justify-center border border-[#0F4D39] text-[#0F4D39] bg-white px-4 py-2 rounded flex items-center space-x-2"
                    >
                        <Download size={18} /> <span>Export CSV</span>
                    </button>
                  </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">Contract End</th>
                            <th className="p-3">Days Remaining</th>
                            <th className="p-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredContracts.map((u) => {
                            const days = differenceInDays(new Date(u.contractEndDate), new Date());
                            let statusColor = "bg-green-100 text-green-800";
                            if (days < 0) statusColor = "bg-gray-100 text-gray-800";
                            else if (days < 30) statusColor = "bg-red-100 text-red-800";
                            else if (days < 60) statusColor = "bg-yellow-100 text-yellow-800";
                            
                            return (
                                <tr key={u.id} className="border-b">
                                    <td className="p-3 font-medium">{u.name}</td>
                                    <td className="p-3">{u.department}</td>
                                    <td className="p-3">{format(new Date(u.contractEndDate), 'MMM dd, yyyy')}</td>
                                    <td className="p-3">{days} Days</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${statusColor}`}>
                                            {days < 0 ? 'Expired' : (days < 30 ? 'Expiring Soon' : 'Active')}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredContracts.length === 0 && (
                            <tr><td colSpan={5} className="p-4 text-center text-gray-700">No expiring contracts found</td></tr>
                        )}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {/* APPROVAL CONFIG TAB */}
      {activeTab === 'approval' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Approval Settings</h2>
              <p className="text-sm text-gray-600">
                Atur flow approval untuk Request dan Procurement per departemen. Urutan approval
                selalu tetap berdasarkan role (misalnya HOD → SUPERVISOR → HR/FINANCE → GM).
              </p>
              <p className="text-xs text-gray-500">
                Kamu hanya memilih role yang ikut approve, sistem yang menentukan urutannya.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Module</label>
                <select
                  className="w-full border p-2 rounded"
                  value={selectedApprovalModule}
                  onChange={e => setSelectedApprovalModule(e.target.value as "REQUEST" | "PROCUREMENT")}
                >
                  <option value="REQUEST">REQUEST (Cuti / Izin / dll)</option>
                  <option value="PROCUREMENT">PROCUREMENT</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Department (opsional)</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  placeholder="Contoh: Marcomm, F&B, FO"
                  value={selectedApprovalDepartment}
                  onChange={e => setSelectedApprovalDepartment(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Kosongkan untuk config global (berlaku semua departemen).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-gray-100 text-gray-800 rounded"
                  onClick={() => {
                    resetApprovalForm();
                    fetchApprovalConfigs();
                  }}
                >
                  Reset Form
                </button>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-2">Config Aktif</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {approvalConfigs.map((cfg: any) => (
                    <div
                      key={cfg.id}
                      className={`w-full text-left border rounded p-2 text-sm flex justify-between items-center ${
                        editingApprovalConfig?.id === cfg.id ? "border-[#0F4D39] bg-[#0F4D39]/5" : "border-gray-200"
                      }`}
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => handleEditApprovalConfig(cfg)}>
                          <div className="font-semibold">
                            {cfg.module} {cfg.department ? `- ${cfg.department}` : "(Global)"}
                          </div>
                          <div className="text-xs text-gray-600">
                            Steps: {(cfg.steps || []).length} | Assignments: {(cfg.assignments || []).length}
                          </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleEditApprovalConfig(cfg); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-100"
                            title="Edit"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteApprovalConfig(cfg.id); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-100"
                            title="Hapus"
                        >
                            <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {approvalConfigs.length === 0 && (
                    <div className="text-xs text-gray-500">
                      Belum ada config untuk filter ini.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleApprovalConfigSubmit} className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Flow Approval</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-[10px] px-2 py-0.5 text-gray-700">
                      <Info className="w-3 h-3" />
                      Auto-order by role
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Checklist role yang ikut approve. Urutan approval akan mengikuti urutan role
                    standar sistem untuk module ini.
                  </p>
                  <p className="text-[11px] text-gray-400">
                    REQUEST: HOD → SUPERVISOR → HR/FINANCE → GM | PROCUREMENT: HOD → SUPERVISOR → FINANCE → GM
                  </p>
                  <div className="space-y-2">
                    {getAvailableRolesForModule(selectedApprovalModule).map(role => {
                      const checked = approvalSteps.some(s => s.role === role);
                      return (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleApprovalRole(role)}
                          />
                          <span>{role}</span>
                        </label>
                      );
                    })}
                    {approvalSteps.length === 0 && (
                      <div className="text-xs text-gray-500">
                        Belum ada role approval yang dipilih.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold">Assign Approver (opsional)</h3>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedAssignments(!showAdvancedAssignments)}
                      className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded"
                    >
                      {showAdvancedAssignments ? "Tutup Pengaturan Lanjutan" : "Pengaturan Lanjutan"}
                    </button>
                  </div>
                  {!showAdvancedAssignments && (
                    <div className="text-xs text-gray-500">
                      Default: sistem akan kirim ke semua user dengan role di flow approval di atas.
                    </div>
                  )}
                  {showAdvancedAssignments && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          Batasi ke staff tertentu per role jika diperlukan.
                        </p>
                        <button
                          type="button"
                          onClick={handleAddApprovalAssignment}
                          className="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded"
                        >
                          Tambah Approver
                        </button>
                      </div>
                      {approvalAssignments.map((a, index) => {
                        const selectedUser = users.find(u => u.id === a.userId);
                        return (
                          <div key={index} className="flex items-center gap-2">
                            <select
                              className="border p-2 rounded flex-1"
                              value={a.userId}
                              onChange={e => handleUpdateApprovalAssignmentUser(index, parseInt(e.target.value, 10))}
                            >
                              <option value="">Pilih Staff</option>
                              {users.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name} {u.department ? `(${u.department})` : ""}
                                </option>
                              ))}
                            </select>
                            <select
                              className="border p-2 rounded"
                              value={a.role || ""}
                              onChange={e =>
                                handleUpdateApprovalAssignmentRole(index, e.target.value || null)
                              }
                            >
                              <option value="">Ikuti Role User</option>
                              <option value="HOD">HOD</option>
                              <option value="SUPERVISOR">SUPERVISOR</option>
                              <option value="HR">HR</option>
                              <option value="FINANCE">FINANCE</option>
                              <option value="GM">GM</option>
                              <option value="MERCHANDISE_STAFF">MERCHANDISE STAFF</option>
                              <option value="MERCHANDISE_HOD">MERCHANDISE HOD</option>
                              <option value="MERCHANDISE_SPV">MERCHANDISE SPV</option>
                              <option value="PHOTOGRAPHER_STAFF">PHOTOGRAPHER STAFF</option>
                              <option value="PHOTOGRAPHER_HOD">PHOTOGRAPHER HOD</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveApprovalAssignment(index)}
                              className="text-xs text-red-600 px-2 py-1"
                            >
                              Hapus
                            </button>
                          </div>
                        );
                      })}
                      {approvalAssignments.length === 0 && (
                        <div className="text-xs text-gray-500">
                          Jika tidak ada assignment, sistem akan kirim ke semua user dengan role tersebut.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetApprovalForm}
                    className="px-4 py-2 text-gray-700 border rounded"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingApprovalConfig}
                    className="px-4 py-2 bg-[#0F4D39] text-white rounded disabled:opacity-60"
                  >
                    {isSavingApprovalConfig ? "Menyimpan..." : "Simpan Config"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'voting' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Award size={20} className="text-[#0F4D39]" />
               Voting Overview
             </h2>
             <div className="flex flex-wrap items-center gap-3">
               <input
                 type="text"
                 placeholder="Cari karyawan/departemen..."
                 className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48"
                 value={votingSearch}
                 onChange={e => setVotingSearch(e.target.value)}
               />
               <select
                 className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48 bg-white"
                 value={selectedVotingCategory}
                 onChange={e => setSelectedVotingCategory(e.target.value)}
               >
                 <option value="">Semua Kategori</option>
                 {votingResults.map(r => (
                   <option key={r.key} value={r.key}>{r.title}</option>
                 ))}
               </select>
               <button
                 type="button"
                 onClick={() => { fetchVotingResults(); fetchRookiePhotos(); }}
                 className="px-4 py-2 rounded bg-[#0F4D39] text-white text-sm font-bold"
               >
                 Refresh
               </button>
               <button
                 type="button"
                 onClick={handleResetVoting}
                 disabled={isResettingVoting}
                 className="px-4 py-2 rounded bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center gap-2"
               >
                 {isResettingVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={16} />}
                 Reset Semua Voting
               </button>
             </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Winner Summary Section */}
             <div className="lg:col-span-2 bg-gradient-to-br from-[#0F4D39] to-[#1a6b4d] rounded-2xl p-6 text-white shadow-xl mb-2">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                 <Trophy className="text-yellow-400" />
                 Pemenang Voting Teratas (Leaderboard)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {votingResults.map((r: any) => {
                   const winner = r.items && r.items[0];
                   if (!winner || winner.count === 0) return null;
                   return (
                     <div key={r.key} className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 flex items-center gap-4">
                       <div className="relative">
                         {r.key === 'BEST_ROOKIE_OF_THE_YEAR' && winner.photoUrl ? (
                           <img src={toPublicUrl(winner.photoUrl)} className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400 shadow-lg" alt="Winner" />
                         ) : (
                           <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center border-2 border-yellow-400/50">
                             <Award className="text-yellow-400 w-8 h-8" />
                           </div>
                         )}
                         <div className="absolute -top-2 -right-1 bg-yellow-400 text-[#0F4D39] rounded-full p-1 shadow-sm">
                           <Trophy size={12} />
                         </div>
                       </div>
                       <div className="min-w-0">
                         <div className="text-[10px] uppercase font-bold text-white/70 tracking-wider truncate">{r.title}</div>
                         <div className="text-sm font-bold truncate">
                           {r.targetType === 'DEPARTMENT' ? winner.candidateDepartment : winner.name}
                         </div>
                         <div className="text-xs text-yellow-300 font-bold mt-0.5">{winner.count} Suara</div>
                       </div>
                     </div>
                   );
                 })}
                 {votingResults.every((r: any) => !r.items || r.items.length === 0) && (
                   <div className="col-span-full text-center py-4 text-white/60 italic">Belum ada data pemenang.</div>
                 )}
               </div>
             </div>

             <div className="border rounded-xl p-4">
               <div className="font-bold mb-3">Hasil Voting (Rank)</div>
               {votingLoading ? (
                 <div className="text-sm text-gray-600">Memuat...</div>
               ) : (
                 <div className="space-y-4">
                   {filteredVotingResults.map((r: any) => (
                     <div key={r.key} className="border rounded-lg p-3 bg-gray-50/30">
                       <div className="flex justify-between items-start">
                         <div>
                           <div className="text-sm font-bold text-gray-900">{r.title}</div>
                           <div className="text-[10px] text-gray-500 uppercase tracking-tight">{r.group}</div>
                         </div>
                         <div className="bg-[#0F4D39]/10 text-[#0F4D39] text-[10px] font-bold px-2 py-0.5 rounded-full">
                           {r.totalVotes || 0} Votes
                         </div>
                       </div>
                       <div className="mt-3 space-y-2">
                         {(r.items || []).slice(0, 5).map((it: any, idx: number) => (
                           <div key={`${r.key}:${idx}`} className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              {r.key === 'BEST_ROOKIE_OF_THE_YEAR' && it.photoUrl ? (
                                <img
                                  src={toPublicUrl(it.photoUrl)}
                                  alt={it.name || 'Rookie'}
                                  className="w-10 h-10 rounded object-cover border"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100 border" />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm text-gray-900 truncate">
                                  {r.targetType === 'DEPARTMENT' ? it.candidateDepartment : it.name}
                                </div>
                                {r.targetType !== 'DEPARTMENT' && (
                                  <div className="text-xs text-gray-500 truncate">{it.department || '-'}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-sm font-bold text-gray-900">{it.count || 0}</div>
                          </div>
                        ))}
                        {(r.items || []).length === 0 && (
                          <div className="text-xs text-gray-500">Belum ada vote.</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {votingResults.length === 0 && (
                    <div className="text-sm text-gray-600">Tidak ada data.</div>
                  )}
                </div>
              )}
            </div>

            <div className="border rounded-xl p-4">
              <div className="font-bold mb-3">Best Rookie: Foto Kandidat</div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Cari nama karyawan..."
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                  value={rookieSearch}
                  onChange={e => setRookieSearch(e.target.value)}
                />
                <select
                  className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                  value={rookieCandidateUserId}
                  onChange={e => setRookieCandidateUserId(e.target.value)}
                >
                  <option value="">Pilih karyawan</option>
                  {users
                    .filter(u => {
                      const q = rookieSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (u.name || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q);
                    })
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.department ? ` (${u.department})` : ''}
                      </option>
                    ))
                  }
                </select>
                <label className={`flex items-center gap-2 px-4 py-2 rounded border ${rookieUploading ? 'opacity-60' : 'hover:bg-gray-50'} cursor-pointer`}>
                  <Upload size={16} className="text-[#0F4D39]" />
                  <span className="text-sm font-semibold">{rookieUploading ? 'Uploading...' : 'Upload Foto (JPG/PNG)'}</span>
                  <input type="file" className="hidden" onChange={handleRookiePhotoUpload} accept="image/*" disabled={rookieUploading} />
                </label>
              </div>

              <div className="mt-5">
                <div className="text-sm font-bold mb-2">Daftar Foto</div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {rookiePhotos.map((row: any) => (
                    <div key={row.candidateUserId} className="flex items-center justify-between gap-3 border rounded-lg p-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={toPublicUrl(row.photoUrl)}
                          alt={row.candidateUser?.name || 'Photo'}
                          className="w-10 h-10 rounded object-cover border"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{row.candidateUser?.name || `User ${row.candidateUserId}`}</div>
                          <div className="text-xs text-gray-500 truncate">{row.candidateUser?.department || '-'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRookiePhoto(row.candidateUserId)}
                        className="text-red-600 hover:text-red-800 text-xs font-bold px-2 py-1"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                  {rookiePhotos.length === 0 && (
                    <div className="text-xs text-gray-500">Belum ada foto yang di-set.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST TAB */}
      {activeTab === 'checklists' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center space-y-6">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-[#0F4D39]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ClipboardCheck size={40} className="text-[#0F4D39]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Checklist Template Manager</h2>
            <p className="text-gray-500 mt-2">
              Kelola pertanyaan checklist untuk setiap departemen (Parkir, Room, Cashier, dll) secara manual tanpa perlu upload Excel.
            </p>
            <div className="pt-8">
              <Link 
                href="/admin/checklist-manager"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#0F4D39] text-white font-bold rounded-lg hover:bg-[#0a3a2b] transition-all shadow-md hover:shadow-lg"
              >
                Buka Manager Checklist <ChevronRight size={20} className="ml-2" />
              </Link>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-12 text-left">
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50/50">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                <Plus size={16} className="text-[#0F4D39]" /> Input Manual
              </h3>
              <p className="text-xs text-gray-500">Tambah pertanyaan satu per satu sesuai kebutuhan operasional terbaru.</p>
            </div>
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50/50">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                <Settings size={16} className="text-[#0F4D39]" /> Fleksibel
              </h3>
              <p className="text-xs text-gray-500">Ubah urutan, tipe input (Yes/No, Angka, Teks), atau hapus pertanyaan lama kapan saja.</p>
            </div>
            <div className="p-4 border border-gray-100 rounded-lg bg-gray-50/50">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                <List size={16} className="text-[#0F4D39]" /> Per Unit
              </h3>
              <p className="text-xs text-gray-500">Sesuaikan pertanyaan untuk setiap unit (misal: Kamar tertentu atau Outlet tertentu).</p>
            </div>
          </div>
        </div>
      )}

      {/* BUG REPORTS TAB */}
      {activeTab === 'bugs' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex justify-between items-center gap-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                      <Bug size={20} className="text-red-500" />
                      Bug Reports & Feature Requests
                  </h2>
                  <div className="flex items-center gap-2 text-xs">
                      <input
                          type="date"
                          className="border border-gray-300 rounded px-2 py-1"
                          value={bugStartDate}
                          onChange={e => setBugStartDate(e.target.value)}
                      />
                      <span className="text-gray-500">s/d</span>
                      <input
                          type="date"
                          className="border border-gray-300 rounded px-2 py-1"
                          value={bugEndDate}
                          onChange={e => setBugEndDate(e.target.value)}
                      />
                      <button
                          type="button"
                          onClick={handleApplyBugFilter}
                          className="px-3 py-1 rounded bg-[#0F4D39] text-white"
                      >
                          Filter
                      </button>
                      <button
                          type="button"
                          onClick={handleResetBugFilter}
                          className="px-2 py-1 rounded border border-gray-300 text-gray-700"
                      >
                          Reset
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <form onSubmit={handleBugSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium">Judul</label>
                          <input
                              type="text"
                              className="w-full border p-2 rounded"
                              required
                              value={bugForm.title}
                              onChange={e => setBugForm({ ...bugForm, title: e.target.value })}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Jenis</label>
                          <select
                              className="w-full border p-2 rounded"
                              value={bugForm.type}
                              onChange={e => setBugForm({ ...bugForm, type: e.target.value })}
                          >
                              <option value="BUG">Bug</option>
                              <option value="FEATURE">Request Fitur</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Prioritas</label>
                          <select
                              className="w-full border p-2 rounded"
                              value={bugForm.priority}
                              onChange={e => setBugForm({ ...bugForm, priority: e.target.value })}
                          >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Deskripsi</label>
                          <textarea
                              className="w-full border p-2 rounded h-32"
                              required
                              value={bugForm.description}
                              onChange={e => setBugForm({ ...bugForm, description: e.target.value })}
                          />
                      </div>
                      <div className="flex justify-end">
                          <button
                              type="submit"
                              className="bg-[#0F4D39] text-white px-4 py-2 rounded"
                          >
                              Kirim Laporan
                          </button>
                      </div>
                  </form>

                  <div className="overflow-x-auto">
                      <table className="min-w-full text-left">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="p-3">Tanggal</th>
                                  <th className="p-3">Judul</th>
                                  <th className="p-3">Jenis</th>
                                  <th className="p-3">Prioritas</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3">Dari</th>
                              </tr>
                          </thead>
                          <tbody>
                              {bugReports.map((b) => (
                                  <tr key={b.id} className="border-b align-top">
                                      <td className="p-3 text-sm">
                                          {format(new Date(b.createdAt), 'dd MMM yyyy HH:mm')}
                                      </td>
                                      <td className="p-3">
                                          <div className="font-semibold">{b.title}</div>
                                          <div className="text-xs text-gray-600 whitespace-pre-wrap">
                                              {b.description}
                                          </div>
                                          {b.imageUrl && (
                                            <div className="mt-2">
                                                <a 
                                                    href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${b.imageUrl}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="inline-block"
                                                >
                                                    <img 
                                                        src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${b.imageUrl}`} 
                                                        alt="Attachment" 
                                                        className="h-16 w-auto rounded border object-cover hover:opacity-80 transition-opacity" 
                                                    />
                                                </a>
                                            </div>
                                          )}
                                      </td>
                                      <td className="p-3 text-xs">
                                          <span className="px-2 py-1 rounded bg-gray-100">
                                              {b.type}
                                          </span>
                                      </td>
                                      <td className="p-3 text-xs">
                                          <span className="px-2 py-1 rounded bg-gray-100">
                                              {b.priority}
                                          </span>
                                      </td>
                                      <td className="p-3">
                                          <select
                                              value={b.status}
                                              onChange={(e) => handleBugStatusUpdate(b.id, e.target.value)}
                                              className={`px-2 py-1 rounded text-xs border cursor-pointer ${
                                                  b.status === 'DONE' ? 'bg-green-100 text-green-800 border-green-200' :
                                                  b.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                                  b.status === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                  'bg-gray-100 text-gray-800 border-gray-200'
                                              }`}
                                          >
                                              <option value="OPEN">Open</option>
                                              <option value="IN_REVIEW">Sedang di Review</option>
                                              <option value="IN_PROGRESS">Sedang di Proses</option>
                                              <option value="DONE">Selesai</option>
                                          </select>
                                      </td>
                                      <td className="p-3 text-sm">
                                          {b.createdBy?.name || '-'}
                                          {b.createdBy?.department && (
                                              <span className="text-xs text-gray-500 block">
                                                  {b.createdBy.department}
                                              </span>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                              {bugReports.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="p-4 text-center text-gray-700">
                                          Belum ada laporan.
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">{editingUser ? 'Edit User' : 'Add User'}</h3>
                  <form onSubmit={handleUserSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium">Name</label>
                          <input type="text" className="w-full border p-2 rounded" required
                            value={formDataUser.name} onChange={e => setFormDataUser({...formDataUser, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Email</label>
                          <input type="email" className="w-full border p-2 rounded" required
                            value={formDataUser.email} onChange={e => setFormDataUser({...formDataUser, email: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Password {editingUser && '(Leave blank to keep current)'}</label>
                          <input type="password" className="w-full border p-2 rounded" 
                            required={!editingUser}
                            value={formDataUser.password} onChange={e => setFormDataUser({...formDataUser, password: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Role</label>
                            <select className="w-full border p-2 rounded" 
                                value={formDataUser.role} onChange={e => setFormDataUser({...formDataUser, role: e.target.value})}
                            >
                                <option value="STAFF">STAFF</option>
                                <option value="HOD">HOD</option>
                                <option value="HR">HR</option>
                                <option value="GM">GM</option>
                                <option value="SUPERVISOR">SUPERVISOR</option>
                                <option value="FINANCE">FINANCE</option>
                                <option value="STORE">STORE</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="MERCHANDISE_STAFF">MERCHANDISE STAFF</option>
                                <option value="MERCHANDISE_HOD">MERCHANDISE HOD</option>
                                <option value="MERCHANDISE_SPV">MERCHANDISE SPV</option>
                                <option value="PHOTOGRAPHER_STAFF">PHOTOGRAPHER STAFF</option>
                                <option value="PHOTOGRAPHER_HOD">PHOTOGRAPHER HOD</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Department</label>
                            <input type="text" className="w-full border p-2 rounded" 
                                value={formDataUser.department} onChange={e => setFormDataUser({...formDataUser, department: e.target.value})}
                            />
                        </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Employment Type</label>
                          <select className="w-full border p-2 rounded" 
                              value={formDataUser.employmentType} onChange={e => setFormDataUser({...formDataUser, employmentType: e.target.value})}
                          >
                              <option value="CONTRACT">CONTRACT (Karyawan Kontrak)</option>
                              <option value="DAILY_WORKER">DAILY WORKER (Karyawan Harian)</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Leave Quota (Days)</label>
                          <input type="number" className="w-full border p-2 rounded" 
                              value={formDataUser.leaveQuota} onChange={e => setFormDataUser({...formDataUser, leaveQuota: parseInt(e.target.value) || 0})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium">PDO (Days)</label>
                          <input type="number" className="w-full border p-2 rounded" 
                              value={formDataUser.pdo} onChange={e => setFormDataUser({...formDataUser, pdo: parseInt(e.target.value) || 0})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Contract Start</label>
                            <input type="date" className="w-full border p-2 rounded" 
                                value={formDataUser.contractStartDate} onChange={e => setFormDataUser({...formDataUser, contractStartDate: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Contract End</label>
                            <input type="date" className="w-full border p-2 rounded" 
                                value={formDataUser.contractEndDate} onChange={e => setFormDataUser({...formDataUser, contractEndDate: e.target.value})}
                            />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border border-gray-200">
                          <input 
                            type="checkbox" 
                            id="rchAccess"
                            className="w-4 h-4 text-[#0F4D39] border-gray-300 rounded focus:ring-[#0F4D39]"
                            checked={formDataUser.rchAccess} 
                            onChange={e => setFormDataUser({...formDataUser, rchAccess: e.target.checked})}
                          />
                          <label htmlFor="rchAccess" className="text-sm font-medium text-gray-700 cursor-pointer">Izinkan Input RCH (Ranger Customer Handling)</label>
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                          <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-[#0F4D39] text-white rounded">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">Assign Schedule</h3>
                  <form onSubmit={handleScheduleSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium">Staff Member</label>
                          <select className="w-full border p-2 rounded" required
                              value={formDataSchedule.userId} onChange={e => setFormDataSchedule({...formDataSchedule, userId: e.target.value})}
                          >
                              <option value="">Select Staff</option>
                              {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Date</label>
                          <input type="date" className="w-full border p-2 rounded" required
                            value={formDataSchedule.date} onChange={e => setFormDataSchedule({...formDataSchedule, date: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Start Time</label>
                            <input type="time" className="w-full border p-2 rounded" required
                                value={formDataSchedule.shiftStart} onChange={e => setFormDataSchedule({...formDataSchedule, shiftStart: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">End Time</label>
                            <input type="time" className="w-full border p-2 rounded" required
                                value={formDataSchedule.shiftEnd} onChange={e => setFormDataSchedule({...formDataSchedule, shiftEnd: e.target.value})}
                            />
                        </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium">Description (Optional)</label>
                          <input type="text" className="w-full border p-2 rounded" 
                            value={formDataSchedule.description} onChange={e => setFormDataSchedule({...formDataSchedule, description: e.target.value})}
                          />
                      </div>
                      <div className="flex justify-end space-x-2 mt-4">
                          <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-[#0F4D39] text-white rounded">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
