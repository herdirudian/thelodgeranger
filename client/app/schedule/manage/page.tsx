"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format, getDaysInMonth } from "date-fns";
import { useRouter } from "next/navigation";
import PdfPreviewModal from "@/components/PdfPreviewModal";

export default function ManageSchedulePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'approvals'>('create');
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create State
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Persist selected month to prevent reset on refresh
  useEffect(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('last_selected_month');
          if (saved) {
              setSelectedMonth(saved);
          }
      }
  }, []);

  useEffect(() => {
      if (selectedMonth) {
          localStorage.setItem('last_selected_month', selectedMonth);
      }
  }, [selectedMonth]);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState<any>({});
  const [inchargePerDay, setInchargePerDay] = useState<any>({});
  const [locationPalette, setLocationPalette] = useState<any>({});
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [colleaguesMap, setColleaguesMap] = useState<Record<number, { id: number; name: string; department?: string }>>({});
  const normalizeDept = (s: string | undefined | null) => (s || '').trim().toLowerCase();
  const [clipboard, setClipboard] = useState<{
      shifts: any;
      locations: any;
      sourceName: string;
  } | null>(null);

  // Approval State
  const [monthlySchedules, setMonthlySchedules] = useState<any[]>([]);
  const [currentMonthlySchedule, setCurrentMonthlySchedule] = useState<any | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    fetchUserAndData();
  }, []);

  useEffect(() => {
    const loadColleagues = async () => {
      try {
        const res = await api.get("/users/colleagues");
        const map: Record<number, { id: number; name: string; department?: string }> = {};
        (res.data || []).forEach((u: any) => {
          map[parseInt(u.id)] = { id: parseInt(u.id), name: u.name, department: u.department };
        });
        setColleaguesMap(map);
        console.log("Colleagues map loaded:", Object.keys(map).length);
      } catch (e) {
        console.error("Failed to load colleagues list", e);
      }
    };
    loadColleagues();
  }, []);

  useEffect(() => {
    const loadStaff = async () => {
      if (!department) return;
      console.log("Loading staff for department:", department);
      try {
        const usersRes = await api.get("/users?department=" + encodeURIComponent(department));
        const raw = usersRes.data || [];
        console.log("Raw users from API:", raw.length);
        
        // Use loose filtering for robustness
        const filtered = raw.filter((u: any) => normalizeDept(u.department) === normalizeDept(department));
        console.log("Filtered users (loose):", filtered.length);
        
        if (filtered.length > 0) {
          setStaffList(filtered);
        } else {
          console.log("No users found for dept via direct API, trying fallback all users...");
          // Fallback: fetch all users and filter client-side
          const allRes = await api.get("/users");
          const all = Array.isArray(allRes.data) ? allRes.data : [];
          console.log("Total users fetched for fallback:", all.length);
          const byDept = all.filter((u: any) => normalizeDept(u.department) === normalizeDept(department));
          console.log("Fallback filtered users count:", byDept.length);
          setStaffList(byDept);
        }
      } catch (e) {
        console.error("Error loading staff:", e);
        // Secondary Fallback if API fails
        try {
          const allRes = await api.get("/users");
          const all = Array.isArray(allRes.data) ? allRes.data : [];
          const byDept = all.filter((u: any) => normalizeDept(u.department) === normalizeDept(department));
          setStaffList(byDept);
        } catch (e2) {
          console.error("Critical error: fallback staff load failed", e2);
        }
      }
    };
    loadStaff();
  }, [department]);

  useEffect(() => {
      setIsDataLoaded(false);
      setScheduleData({});
      setInchargePerDay({});
      setLocationPalette({});
      setCurrentMonthlySchedule(null);
      if (!department) return;

      const loadExisting = async () => {
          try {
              const [yearStr, monthStr] = selectedMonth.split('-');
              const year = parseInt(yearStr, 10);
              const month = parseInt(monthStr, 10);

              const res = await api.get("/schedule/monthly");
              const schedules = res.data || [];

              const existing = schedules.find((item: any) => 
                  normalizeDept(item.department) === normalizeDept(department) &&
                  item.year === year &&
                  item.month === month
              );

              // 1. Try to load from Local Storage first (Draft)
              const draftKey = `draft_schedule_${department}_${selectedMonth}`;
              let loadedFromDraft = false;

              if (!existing || existing.status === 'DRAFT') {
                  const savedDraft = localStorage.getItem(draftKey);
                  
                  if (savedDraft) {
                      try {
                          const parsed = JSON.parse(savedDraft);
                          setScheduleData(parsed.scheduleData || {});
                          setInchargePerDay(parsed.inchargePerDay || {});
                          setLocationPalette(parsed.locationPalette || {});
                          if (existing) {
                              setCurrentMonthlySchedule(existing);
                          }
                          console.log("Restored draft from local storage");
                          loadedFromDraft = true;
                      } catch (e) {
                          console.error("Failed to parse draft from local storage", e);
                      }
                  }
              } else {
                  // Untuk jadwal yang sudah disubmit (bukan DRAFT), abaikan draft lokal lama
                  localStorage.removeItem(draftKey);
              }
              // 2. If no draft (or failed to load), load from Server
              let serverData = existing?.data;
              
              // Robust JSON parsing (handle double stringification if any)
              if (typeof serverData === 'string') {
                  try {
                      serverData = JSON.parse(serverData);
                      // If it's still a string after first parse, try again (just in case)
                      if (typeof serverData === 'string') {
                          serverData = JSON.parse(serverData);
                      }
                  } catch (e) {
                      console.error("Failed to parse server data", e);
                  }
              }

              let loadedFromServer = false;

              if (!loadedFromDraft && existing) {
                  console.log("Loading from server data:", serverData);
                  
                  // Handle New Format (Object)
                  if (serverData && !Array.isArray(serverData) && (serverData.scheduleData || Object.keys(serverData).length === 0)) {
                       // Ensure keys are consistent (if needed), but usually JS handles string/number keys fine.
                       // We'll trust the object structure but log it.
                       setScheduleData(serverData.scheduleData || {});
                       setInchargePerDay(serverData.inchargePerDay || {});
                       setLocationPalette(serverData.locationPalette || {});
                       setCurrentMonthlySchedule(existing);
                       loadedFromServer = true;
                       
                       // HYDRATE LOCAL STORAGE FROM SERVER (SYNC)
                       if (existing.status === 'DRAFT') {
                            const draftKey = `draft_schedule_${department}_${selectedMonth}`;
                            localStorage.setItem(draftKey, JSON.stringify(serverData));
                       }

                       console.log("Applied server data (New Format)");
                  }
                  // Handle Legacy Format (Array)
                  else if (Array.isArray(serverData)) {
                      const nextScheduleData: any = {};
                      const nextIncharge: any = {};

                      serverData.forEach((entry: any) => {
                          const rawUserId = entry.userId;
                          const userId = typeof rawUserId === "string" ? parseInt(rawUserId, 10) : rawUserId;
                          if (!userId) return;
                          nextScheduleData[userId] = entry.shifts || {};
                          nextIncharge[userId] = entry.locations || {};
                      });

                      setScheduleData(nextScheduleData);
                      setInchargePerDay(nextIncharge);
                      setCurrentMonthlySchedule(existing);
                      loadedFromServer = true;
                      console.log("Applied server data (Legacy Format)");
                  }
              }

              if (!loadedFromDraft && existing && !loadedFromServer && existing.status === 'APPROVED') {
                  try {
                      const gridRes = await api.get(`/schedule/monthly/${existing.id}/grid`);
                      const gridData = gridRes.data || {};
                      setScheduleData(gridData.scheduleData || {});
                      setInchargePerDay(gridData.inchargePerDay || {});
                      setLocationPalette(gridData.locationPalette || {});
                      setCurrentMonthlySchedule(existing);
                      console.log("Applied data from running attendance grid");
                  } catch (e) {
                      console.error("Failed to load grid data from running attendance", e);
                  }
              }
          } catch (error) {
              console.error(error);
          } finally {
              setIsDataLoaded(true);
          }
      };

      loadExisting();
  }, [selectedMonth, department]);

  // Autosave Effect
  useEffect(() => {
      if (!isDataLoaded || !department || !selectedMonth) return;

      const draftKey = `draft_schedule_${department}_${selectedMonth}`;
      const dataToSave = {
          scheduleData,
          inchargePerDay,
          locationPalette
      };
      
      localStorage.setItem(draftKey, JSON.stringify(dataToSave));
  }, [scheduleData, inchargePerDay, locationPalette, department, selectedMonth, isDataLoaded]);

  useEffect(() => {
      if (activeTab === 'approvals') {
          fetchMonthlySchedules();
      }
  }, [activeTab]);

  const fetchUserAndData = async () => {
    try {
      const meRes = await api.get("/auth/me");
      const userRole = meRes.data.role;
      const userDept = meRes.data.department || "";
      setRole(userRole);
      setDepartment(userDept);

      const allowedRoles = ['HOD', 'HR', 'GM', 'SUPERVISOR', 'ADMIN', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'];
      if (allowedRoles.includes(userRole)) {
         if (userRole === 'HR' || userRole === 'GM' || userRole === 'ADMIN') {
           try {
             const deptRes = await api.get("/analytics/departments");
             const list = Array.isArray(deptRes.data) ? deptRes.data : [];
             setDepartments(list);
             if (!userDept && list.length > 0) {
               setDepartment(list[0]);
             }
           } catch (e) {
             console.error(e);
           }
         }

         try {
             const schedRes = await api.get("/schedule/monthly");
             const schedules = schedRes.data || [];
             const myDeptSchedules = schedules.filter((s: any) => s.department === userDept);
            
             const activeWork = myDeptSchedules.find((s: any) => s.status === 'DRAFT') 
                             || myDeptSchedules.find((s: any) => s.status.startsWith('PENDING'));
                            
             if (activeWork) {
                 const m = String(activeWork.month).padStart(2, '0');
                 const y = activeWork.year;
                 const draftMonth = `${y}-${m}`;
                
                 if (typeof window !== 'undefined' && !localStorage.getItem('last_selected_month')) {
                     setSelectedMonth(draftMonth);
                 }
             }
         } catch (e) {
             console.error("Auto-select month failed", e);
         }
      } else {
         router.push("/schedule");
      }
    } catch (err) {
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const fetchMonthlySchedules = async () => {
      try {
          const res = await api.get("/schedule/monthly");
          setMonthlySchedules(res.data);
      } catch (err) {
          console.error(err);
      }
  };

  const getScheduleDates = () => {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr); // 1-12

      // Create dates from 21st of prev month to 20th of current month
      // Previous Month:
      // If month is 1 (Jan), prev is Dec (12) of year-1
      const prevMonthDate = new Date(year, month - 2, 21); // Month is 0-indexed in Date constructor
      const currentMonthDate = new Date(year, month - 1, 20);

      const dates = [];
      const currentDate = new Date(prevMonthDate);

      while (currentDate <= currentMonthDate) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
      }
      return dates;
  };

  const scheduleDates = getScheduleDates();
  const staffDisplayList = (staffList && staffList.length > 0)
    ? staffList
    : (() => {
        const ids = Object.keys(scheduleData || {}).map(k => parseInt(k, 10)).filter(n => !isNaN(n));
        const uniqueIds = Array.from(new Set(ids));
        const allowedIds = uniqueIds.filter(id => normalizeDept(colleaguesMap[id]?.department) === normalizeDept(department));
        return allowedIds.map(id => ({
          id,
          name: colleaguesMap[id]?.name || `Staff #${id}`,
          role: ''
        }));
      })();

  const handleShiftChange = (userId: number, dateStr: string, value: string) => {
      setScheduleData((prev: any) => ({
          ...prev,
          [userId]: {
              ...(prev[userId] || {}),
              [dateStr]: value
          }
      }));
  };
  const palette = [
    { bg: 'bg-green-50', text: 'text-green-700' },
    { bg: 'bg-blue-50', text: 'text-blue-700' },
    { bg: 'bg-orange-50', text: 'text-orange-700' },
    { bg: 'bg-purple-50', text: 'text-purple-700' },
    { bg: 'bg-teal-50', text: 'text-teal-700' },
    { bg: 'bg-pink-50', text: 'text-pink-700' },
    { bg: 'bg-amber-50', text: 'text-amber-700' },
    { bg: 'bg-lime-50', text: 'text-lime-700' },
    { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700' }
  ];
  const getClassesForLocation = (name: string) => {
    const key = (name || '').trim().toLowerCase();
    if (!key) return { bg: '', text: '' };
    if (locationPalette[key]) return locationPalette[key];
    const idx = Object.keys(locationPalette).length % palette.length;
    const classes = palette[idx];
    setLocationPalette((prev: any) => ({ ...prev, [key]: classes }));
    return classes;
  };
  const handleLocationChange = (userId: number, dateStr: string, value: string) => {
    setInchargePerDay((prev: any) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [dateStr]: value
      }
    }));
  };

  const getCellBg = (userId: number, dateStr: string) => {
    const name = inchargePerDay[userId]?.[dateStr] || '';
    return getClassesForLocation(name).bg;
  };

  // --- Helper Functions: Copy/Paste/Clear/Fill ---
  const handleCopyRow = (userId: number, name: string) => {
      setClipboard({
          shifts: { ...scheduleData[userId] },
          locations: { ...inchargePerDay[userId] },
          sourceName: name
      });
  };

  const handlePasteRow = (targetUserId: number) => {
      if (!clipboard) return;
      
      if (!confirm(`Paste schedule from ${clipboard.sourceName}? This will overwrite existing data for this row.`)) return;

      setScheduleData((prev: any) => ({
          ...prev,
          [targetUserId]: { ...clipboard.shifts }
      }));
      setInchargePerDay((prev: any) => ({
          ...prev,
          [targetUserId]: { ...clipboard.locations }
      }));
  };

  const handleClearRow = (userId: number) => {
      if (!confirm("Are you sure you want to clear this entire row?")) return;
      
      setScheduleData((prev: any) => {
          const next = { ...prev };
          delete next[userId];
          return next;
      });
      setInchargePerDay((prev: any) => {
          const next = { ...prev };
          delete next[userId];
          return next;
      });
  };

  const handleFillEmpty = (userId: number, value: string) => {
      if (!confirm(`Fill ENTIRE row with '${value}'? This will OVERWRITE existing data.`)) return;

      const newShifts = { ...(scheduleData[userId] || {}) };
      scheduleDates.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          newShifts[dateStr] = value;
      });

      setScheduleData((prev: any) => ({
          ...prev,
          [userId]: newShifts
      }));
  };

  const handlePromptFill = (userId: number) => {
      const val = prompt("Masukkan kode shift untuk mengisi SATU BARIS (contoh: M, A, N, OFF):", "M");
      if (!val) return;
      handleFillEmpty(userId, val.toUpperCase());
  };

  // Double click to fill row
  const handleDoubleClickCell = (userId: number, value: string) => {
      if (!value) return; 
      if (!confirm(`Isi SELURUH baris dengan '${value}'? Data yang ada akan ditimpa.`)) return;

      const newShifts = { ...(scheduleData[userId] || {}) };
      scheduleDates.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          newShifts[dateStr] = value;
      });

      setScheduleData((prev: any) => ({
          ...prev,
          [userId]: newShifts
      }));
  };

  const handleDoubleClickLocation = (userId: number, value: string) => {
      if (!value) return;
      if (!confirm(`Isi SELURUH lokasi dengan '${value}'? Data yang ada akan ditimpa.`)) return;

      const newLocations = { ...(inchargePerDay[userId] || {}) };
      scheduleDates.forEach(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          newLocations[dateStr] = value;
      });
      setInchargePerDay((prev: any) => ({
          ...prev,
          [userId]: newLocations
      }));
  };

  const handleSubmit = async (isDraft = false) => {
      try {
          const [year, month] = selectedMonth.split('-');
          
          let dataToSend;

          if (isDraft) {
            dataToSend = {
              scheduleData,
              inchargePerDay,
              locationPalette
            };
          } else {
            dataToSend = Object.entries(scheduleData).map(([userId, shifts]) => ({
              userId,
              shifts,
              locations: inchargePerDay[userId as any] || {}
            }));
          }

          const isHrOverride = !isDraft && role === 'HR' && currentMonthlySchedule && currentMonthlySchedule.status === 'APPROVED';

          let res;
          if (isHrOverride) {
            res = await api.post(`/schedule/monthly/${currentMonthlySchedule.id}/hr-adjust`, {
              data: dataToSend
            });
          } else {
            res = await api.post("/schedule/monthly", {
                department,
                month,
                year,
                data: dataToSend,
                isDraft
            });
          }

          // Clear local storage draft ONLY if submitting for real
          if (!isDraft) {
            localStorage.removeItem(`draft_schedule_${department}_${selectedMonth}`);
          }

          if (isDraft) {
            alert("Draft saved successfully!");
            setCurrentMonthlySchedule(res.data);
          } else if (isHrOverride) {
            alert("Schedule berhasil diadjust oleh HR dan langsung diterapkan.");
            setCurrentMonthlySchedule(res.data.schedule || res.data);
            fetchMonthlySchedules();
          } else {
            alert("Schedule submitted successfully!");
            fetchMonthlySchedules();
            setActiveTab('approvals');
          }
      } catch (err: any) {
          alert(err.response?.data?.message || "Error creating schedule");
      }
  };

  const handleApprove = async (id: number, action: 'APPROVE' | 'REJECT') => {
      const reason = action === 'REJECT' ? prompt("Enter rejection reason:") : null;
      if (action === 'REJECT' && !reason) return;

      try {
          await api.post(`/schedule/monthly/${id}/approve`, {
              action,
              reason
          });
          alert(`Schedule ${action}D!`);
          fetchMonthlySchedules();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error updating schedule");
      }
  };

  const handleRefreshShifts = async (id: number) => {
      if (!confirm("Fitur ini akan memperbaiki jam shift yang salah (misal M6 jadi 10:00-18:00) tanpa mengubah status approval. Lanjutkan?")) return;
      try {
          await api.post(`/schedule/monthly/${id}/refresh`);
          alert("Jadwal berhasil diperbaiki.");
      } catch (e) {
          console.error(e);
          alert("Gagal memperbaiki jadwal.");
      }
  };

  const handleSyncRequests = async (id: number) => {
      if (!confirm("Fitur ini akan menarik data Izin/Sakit/Cuti yang sudah disetujui sebelumnya ke dalam jadwal ini. Lanjutkan?")) return;
      try {
          const res = await api.post(`/schedule/monthly/${id}/sync-requests`);
          alert(res.data.message);
          fetchMonthlySchedules(); // Refresh UI to show updated data
      } catch (err: any) {
          alert(err.response?.data?.message || "Error syncing requests");
      }
  };

  const handleSyncAllActive = async () => {
      if (!confirm("Sync semua monthly schedule aktif di periode berjalan?")) return;
      try {
          const res = await api.post(`/schedule/monthly/sync-all`, { department });
          const { message, errors } = res.data || {};
          let detail = message || "Sync All completed";
          if (Array.isArray(errors) && errors.length > 0) {
              const list = errors.slice(0, 5).map((e: any) => `ID ${e.id}: ${e.message}`).join('\n');
              detail += `\nDetail (top 5):\n${list}`;
              console.warn('Sync All errors:', errors);
          }
          alert(detail);
          fetchMonthlySchedules();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error syncing all monthly schedules");
      }
  };
  const handleReviseSchedule = async (id: number) => {
      if (!confirm("Apakah Anda yakin ingin mengembalikan status jadwal ini menjadi DRAFT agar HOD bisa merevisi? Data yang ada TIDAK akan dihapus.")) return;
      try {
          await api.post(`/schedule/monthly/${id}/revise`);
          alert("Status jadwal berhasil dikembalikan ke DRAFT. HOD sekarang dapat melakukan revisi.");
          fetchMonthlySchedules(); // Refresh list
      } catch (e) {
          console.error(e);
          alert("Gagal merevisi jadwal.");
      }
  };

  const handleDownloadPDF = async (id: number) => {
      try {
          const res = await api.get(`/schedule/monthly/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `schedule-${id}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          alert("Error downloading PDF");
      }
  };

  const isEditable = !currentMonthlySchedule 
    || currentMonthlySchedule.status === 'REJECTED' 
    || currentMonthlySchedule.status === 'DRAFT'
    || (role === 'HR' && currentMonthlySchedule.status === 'APPROVED');

  const handlePreviewPDF = async (id: number) => {
      try {
          const res = await api.get(`/schedule/monthly/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          setPreviewUrl(url);
          setShowPreview(true);
      } catch (err) {
          alert("Error previewing PDF");
      }
  };


  const handleSyncFromServer = async () => {
      if (!confirm("Ambil data terbaru dari server? Data yang belum disave di browser ini akan tertimpa.")) return;
      
      try {
          // Clear local storage for this month
          const draftKey = `draft_schedule_${department}_${selectedMonth}`;
          localStorage.removeItem(draftKey);
          
          // Trigger reload
          setIsDataLoaded(false);
          // Calling fetchUserAndData or just triggering the effect by toggling a dummy state?
          // Easiest is to manually call the load logic or just reload page.
          // But better:
          window.location.reload(); 
      } catch (e) {
          alert("Gagal sinkronisasi");
      }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <PdfPreviewModal 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        pdfUrl={previewUrl} 
        title="Schedule Preview"
      />
      <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Manage Schedules</h1>
            <p className="text-sm text-gray-800">
              Logged in as: <span className="font-bold">{role}</span> {department && `(${department})`}
            </p>
            {(role === 'HR' || role === 'GM' || role === 'ADMIN') && (
              <span className="inline-flex items-center mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Adjust Schedule &mdash; pilih departemen dan ubah jadwal seluruh karyawan
              </span>
            )}
        </div>
        <div className="flex flex-col space-y-2 md:space-x-2 md:space-y-0 md:flex-row">
            <button 
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded ${activeTab === 'create' ? 'bg-[#0F4D39] text-white' : 'bg-gray-200'}`}
            >
                Create Schedule
            </button>
            <button 
                onClick={() => setActiveTab('approvals')}
                className={`px-4 py-2 rounded ${activeTab === 'approvals' ? 'bg-[#0F4D39] text-white' : 'bg-gray-200'}`}
            >
                Approvals / History
            </button>
            {(role === 'HR' || role === 'GM' || role === 'ADMIN') && (
              <button 
                 onClick={handleSyncAllActive}
                 className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                 Sync All Active
              </button>
            )}
        </div>
      </div>

      {activeTab === 'create' && (
          <div className="bg-white p-2 md:p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto max-w-[calc(100vw-16px)] md:max-w-[calc(100vw-40px)] lg:max-w-[calc(100vw-280px)]">
              <div className="mb-4 flex flex-col space-y-2">
                  <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
                      <label className="font-bold">Select Month:</label>
                      <input 
                          type="month" 
                          value={selectedMonth} 
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="border p-2 rounded"
                      />
                      {((role === 'HR' || role === 'GM' || role === 'ADMIN') && departments.length > 0) ? (
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="border p-2 rounded"
                        >
                          {departments.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-800">Department: {department}</span>
                      )}
                      {scheduleDates.length > 0 && (
                          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md text-sm border border-blue-100">
                              Periode: <b>{format(scheduleDates[0], 'd MMM yyyy')}</b> - <b>{format(scheduleDates[scheduleDates.length - 1], 'd MMM yyyy')}</b>
                          </span>
                      )}
                  </div>
                  {currentMonthlySchedule && currentMonthlySchedule.status !== 'REJECTED' && currentMonthlySchedule.status !== 'DRAFT' && role !== 'HR' && (
                      <div className="text-xs px-3 py-2 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-100 inline-flex items-center justify-between">
                          <span>
                              Jadwal bulan ini sudah disubmit dengan status <b>{currentMonthlySchedule.status}</b> sehingga tidak bisa diubah.
                          </span>
                      </div>
                  )}
                  {currentMonthlySchedule && currentMonthlySchedule.status === 'APPROVED' && role === 'HR' && (
                      <div className="text-xs px-3 py-2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100 inline-flex items-center justify-between">
                          <span>
                              Jadwal bulan ini berstatus <b>APPROVED</b>. Perubahan yang Anda lakukan akan langsung diterapkan tanpa approval ulang.
                          </span>
                      </div>
                  )}
                  {currentMonthlySchedule && currentMonthlySchedule.status === 'DRAFT' && (
                      <div className="text-xs px-3 py-2 rounded-md bg-blue-50 text-blue-800 border border-blue-100 inline-flex items-center justify-between">
                          <span>
                              Status saat ini: <b>DRAFT</b>. Anda dapat melanjutkan pengisian jadwal.
                          </span>
                      </div>
                  )}
                  {currentMonthlySchedule && currentMonthlySchedule.status === 'REJECTED' && (
                      <div className="text-xs px-3 py-2 rounded-md bg-red-50 text-red-800 border border-red-100 inline-flex flex-col space-y-1">
                          <span>
                              Jadwal bulan ini <b>DITOLAK</b>. Silakan revisi dan submit ulang.
                          </span>
                          {currentMonthlySchedule.rejectionReason && (
                              <span>Alasan penolakan: {currentMonthlySchedule.rejectionReason}</span>
                          )}
                      </div>
                  )}
              </div>

              <div className="overflow-x-auto w-full relative border rounded-lg max-h-[70vh] overflow-y-auto">
              <table className="min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-50">
                      <tr>
                          <th className="border p-2 min-w-[150px] sticky left-0 top-0 bg-white z-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] outline outline-1 outline-gray-200">
                              <div className="flex justify-between items-center">
                                  <span>Staff Name</span>
                                  {clipboard && (
                                      <span className="text-[10px] font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                          Copied: {clipboard.sourceName}
                                      </span>
                                  )}
                              </div>
                          </th>
                          {scheduleDates.map(date => {
                              const isRed = date.getDay() === 0 || date.getDay() === 6; // Sunday or Saturday
                              return (
                                  <th key={date.toISOString()} className={`border p-1 w-[40px] min-w-[40px] text-center sticky top-0 z-40 ${isRed ? 'text-red-600 bg-red-50' : 'bg-white'} outline outline-1 outline-gray-200`}>
                                      <div className="text-xs uppercase leading-none">{format(date, 'EEE')}</div>
                                      <div className="text-sm leading-tight">{format(date, 'd')}</div>
                                  </th>
                              );
                          })}
                          <th className="border p-0.5 w-10 sticky top-0 z-40 bg-white font-bold text-center text-green-700 text-xs outline outline-1 outline-gray-200">H</th>
                          <th className="border p-0.5 w-10 sticky top-0 z-40 bg-white font-bold text-center text-gray-600 text-xs outline outline-1 outline-gray-200">O</th>
                          <th className="border p-0.5 w-10 sticky top-0 z-40 bg-white font-bold text-center text-blue-600 text-xs outline outline-1 outline-gray-200">C</th>
                          <th className="border p-0.5 w-10 sticky top-0 z-40 bg-white font-bold text-center text-yellow-600 text-xs outline outline-1 outline-gray-200">S</th>
                          <th className="border p-0.5 w-10 sticky top-0 z-40 bg-white font-bold text-center text-purple-600 text-xs outline outline-1 outline-gray-200">I</th>
                      </tr>
                  </thead>
                  <tbody>
                      {staffDisplayList.map(staff => (
                          <tr key={staff.id} className="bg-white hover:bg-gray-50">
                              <td className="border p-2 sticky left-0 bg-white z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                  <div className="font-medium text-gray-800">{staff.name}</div>
                                  <div className="text-[10px] text-gray-500">{staff.role}</div>
                                  
                                  {/* Action Buttons */}
                                  <div className="mt-2 flex flex-wrap gap-1">
                                      <button 
                                          onClick={() => handleCopyRow(staff.id, staff.name)}
                                          title="Copy Row"
                                          className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600"
                                      >
                                          📋
                                      </button>
                                      {clipboard && (
                                          <button 
                                              onClick={() => handlePasteRow(staff.id)}
                                              title="Paste Row"
                                              className="p-1 bg-blue-100 hover:bg-blue-200 rounded text-xs text-blue-600"
                                          >
                                              💾
                                          </button>
                                      )}
                                          <button 
                                              onClick={() => handlePromptFill(staff.id)}
                                              title="Fill Empty Row"
                                              className="p-1 bg-green-100 hover:bg-green-200 rounded text-xs text-green-600"
                                          >
                                              Fill...
                                          </button>
                                          <button 
                                          onClick={() => handleClearRow(staff.id)}
                                          title="Clear Row"
                                          className="p-1 bg-red-50 hover:bg-red-100 rounded text-xs text-red-400"
                                      >
                                          ✕
                                      </button>
                                  </div>
                              </td>
                              {scheduleDates.map(date => {
                                  const dateStr = format(date, 'yyyy-MM-dd');
                                  const isRed = date.getDay() === 0 || date.getDay() === 6;
                                  return (
                                      <td key={dateStr} className={`border p-1 ${isRed ? 'bg-red-50' : ''} ${getCellBg(staff.id, dateStr)}`}>
                                          <div className="flex flex-col space-y-1" onDoubleClick={() => handleDoubleClickCell(staff.id, scheduleData[staff.id]?.[dateStr])}>
                                          <select 
                                              value={scheduleData[staff.id]?.[dateStr] || ''}
                                              onChange={(e) => handleShiftChange(staff.id, dateStr, e.target.value)}
                                              className={`w-full text-center border-none focus:ring-0 px-0 py-0.5 text-xs font-bold uppercase ${
                                                  scheduleData[staff.id]?.[dateStr] === 'OFF' ? 'text-red-500' : 
                                                  scheduleData[staff.id]?.[dateStr] ? 'text-blue-600' : 'text-gray-400'
                                              } bg-transparent appearance-none h-7`}
                                              disabled={!isEditable}
                                        >
                                                <option value="">-</option>
                                                <option value="M1">M1</option>
                                                <option value="M2">M2</option>
                                                <option value="M3">M3</option>
                                                <option value="M4">M4</option>
                                                <option value="M5">M5</option>
                                                <option value="M6">M6</option>
                                                <option value="A1">A1</option>
                                                <option value="A2">A2</option>
                                                <option value="A3">A3</option>
                                                <option value="N1">N1</option>
                                                <option value="N2">N2</option>
                                                <option value="PDO">PDO</option>
                                                <option value="OFF">OFF</option>
                                                <option value="C">C</option>
                                                <option value="S">S</option>
                                                <option value="I">I</option>
                                                <option value="E">E</option>
                                            </select>
                                              <input
                                                  className="w-full px-0.5 py-0 border rounded-[2px] text-[11px] text-center disabled:bg-gray-100 disabled:text-gray-400 h-6 leading-none bg-white/50"
                                                  placeholder="Loc"
                                                  value={inchargePerDay[staff.id]?.[dateStr] || ''}
                                                  onChange={(e) => handleLocationChange(staff.id, dateStr, e.target.value)}
                                                  onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClickLocation(staff.id, inchargePerDay[staff.id]?.[dateStr]); }}
                                                  disabled={!isEditable}
                                              />
                                          </div>
                                      </td>
                                  );
                              })}
                              {/* Summary Columns */}
                              <td className="border p-1 text-center font-bold text-xs bg-green-50 text-green-800">
                                  {scheduleDates.reduce((count, date) => {
                                      const val = scheduleData[staff.id]?.[format(date, 'yyyy-MM-dd')];
                                      return (val && (val.startsWith('M') || val.startsWith('A') || val.startsWith('N') || val === 'E' || val === 'PDO')) ? count + 1 : count;
                                  }, 0)}
                              </td>
                              <td className="border p-1 text-center font-bold text-xs bg-gray-50 text-gray-800">
                                  {scheduleDates.reduce((count, date) => {
                                      const val = scheduleData[staff.id]?.[format(date, 'yyyy-MM-dd')];
                                      return (val === 'OFF') ? count + 1 : count;
                                  }, 0)}
                              </td>
                              <td className="border p-1 text-center font-bold text-xs bg-blue-50 text-blue-800">
                                  {scheduleDates.reduce((count, date) => {
                                      const val = scheduleData[staff.id]?.[format(date, 'yyyy-MM-dd')];
                                      return (val === 'C') ? count + 1 : count;
                                  }, 0)}
                              </td>
                              <td className="border p-1 text-center font-bold text-xs bg-yellow-50 text-yellow-800">
                                  {scheduleDates.reduce((count, date) => {
                                      const val = scheduleData[staff.id]?.[format(date, 'yyyy-MM-dd')];
                                      return (val === 'S') ? count + 1 : count;
                                  }, 0)}
                              </td>
                              <td className="border p-1 text-center font-bold text-xs bg-purple-50 text-purple-800">
                                  {scheduleDates.reduce((count, date) => {
                                      const val = scheduleData[staff.id]?.[format(date, 'yyyy-MM-dd')];
                                      return (val === 'I') ? count + 1 : count;
                                  }, 0)}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-col space-y-2 md:flex-row md:justify-end md:space-x-4 md:space-y-0">
            <button
                onClick={handleSyncFromServer}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
                🔄 Sinkronkan (Reset ke Server)
            </button>

            <button
              onClick={() => handleSubmit(true)}
                      className={`px-6 py-2 rounded border border-[#0F4D39] text-[#0F4D39] hover:bg-gray-50 ${!isEditable ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isEditable}
                  >
                      Save Draft
                  </button>
                  <button 
                      onClick={() => handleSubmit(false)}
                      className={`px-6 py-2 rounded ${isEditable ? 'bg-[#0F4D39] text-white hover:bg-[#0a3628]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      disabled={!isEditable}
                  >
                      Submit Schedule
                  </button>
              </div>

              {/* Shift Codes Legend */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-4">Keterangan Kode Shift (Legend)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M1</span>
                          <span className="text-gray-600">06:00 - 15:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M2</span>
                          <span className="text-gray-600">07:00 - 16:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M3</span>
                          <span className="text-gray-600">07:00 - 19:00 <span className="text-red-500 font-semibold">(Security)</span></span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M4</span>
                          <span className="text-gray-600">08:00 - 17:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M5</span>
                          <span className="text-gray-600">09:00 - 18:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">M6</span>
                          <span className="text-gray-600">10:00 - 19:00</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">A1</span>
                          <span className="text-gray-600">12:00 - 21:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">A2</span>
                          <span className="text-gray-600">13:00 - 22:00</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">A3</span>
                          <span className="text-gray-600">15:00 - 24:00</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">N1</span>
                          <span className="text-gray-600">19:00 - 07:00 <span className="text-red-500 font-semibold">(Security)</span></span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-gray-100 px-2 py-1 rounded w-10 text-center">N2</span>
                          <span className="text-gray-600">23:00 - 08:00</span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-red-50 text-red-700 border border-red-100 px-2 py-1 rounded w-10 text-center">OFF</span>
                          <span className="text-gray-600">Libur</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded w-10 text-center">PDO</span>
                          <span className="text-gray-600">Pending Day Off (Dianggap hadir)</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded w-10 text-center">C</span>
                          <span className="text-gray-600">Cuti</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-1 rounded w-10 text-center">S</span>
                          <span className="text-gray-600">Sakit</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded w-10 text-center">I</span>
                          <span className="text-gray-600">Izin</span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded w-10 text-center">E</span>
                          <span className="text-gray-600">Extra Manpower</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'approvals' && (
          <div className="space-y-4">
              {monthlySchedules.map(schedule => (
                  <div key={schedule.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-start md:space-y-0">
                          <div>
                              <h3 className="font-bold text-lg">
                                  {schedule.department} - {format(new Date(schedule.year, schedule.month - 1), 'MMMM yyyy')}
                              </h3>
                              <p className="text-sm text-gray-800">Created by: {schedule.createdByUser.name}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                  <span className={`px-2 py-1 rounded text-xs ${schedule.hodApproved ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                      HOD: {schedule.hodApproved ? 'Approved' : 'Pending'}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs ${schedule.hrApproved ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                      HR: {schedule.hrApproved ? 'Approved' : 'Pending'}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs ${schedule.gmApproved ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                      GM: {schedule.gmApproved ? 'Approved' : 'Pending'}
                                  </span>
                              </div>
                              <p className="mt-2 font-semibold">Status: {schedule.status}</p>
                          </div>
                          
                          <div className="flex flex-col space-y-2 md:items-end">
                              <div className="space-x-2">
                                  {/* Logic for showing Approve buttons */}
                                  {/* If I am HR and status is PENDING_HR */}
                                  {role === 'HR' && schedule.status === 'PENDING_HR' && (
                                      <>
                                          <button onClick={() => handleApprove(schedule.id, 'APPROVE')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Approve</button>
                                          <button onClick={() => handleApprove(schedule.id, 'REJECT')} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Reject</button>
                                      </>
                                  )}
                                  
                                  {role === 'HR' && schedule.status === 'APPROVED' && (
                                      <button 
                                          onClick={() => handleReviseSchedule(schedule.id)} 
                                          className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                                      >
                                          Revisi Schedule (To Draft)
                                      </button>
                                  )}
                                  
                                  {/* If I am GM and status is PENDING_GM */}
                                  {role === 'GM' && schedule.status === 'PENDING_GM' && (
                                      <>
                                          <button onClick={() => handleApprove(schedule.id, 'APPROVE')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Approve</button>
                                          <button onClick={() => handleApprove(schedule.id, 'REJECT')} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Reject</button>
                                      </>
                                  )}
                              </div>

                              <div className="flex space-x-2 justify-end">
                                  {schedule.status === 'APPROVED' && (
                                      <>
                                          <button
                                              onClick={() => handleSyncRequests(schedule.id)}
                                              className="text-purple-600 hover:text-purple-800 text-sm underline"
                                              title="Tarik data Izin/Sakit/Cuti yang sudah approved ke jadwal"
                                          >
                                              Sync Approved Requests
                                          </button>
                                          <button
                                              onClick={() => handleRefreshShifts(schedule.id)}
                                              className="text-orange-600 hover:text-orange-800 text-sm underline"
                                          >
                                              Refresh Shifts
                                          </button>
                                      </>
                                  )}
                                  <button
                                      onClick={() => handlePreviewPDF(schedule.id)}
                                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                                  >
                                      Preview PDF
                                  </button>
                                  <button
                                      onClick={() => handleDownloadPDF(schedule.id)}
                                      className="text-green-600 hover:text-green-800 text-sm underline"
                                  >
                                      Download PDF
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              ))}
              {monthlySchedules.length === 0 && <p>No schedules found.</p>}
          </div>
      )}
    </div>
  );
}
