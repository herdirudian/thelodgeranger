"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import { 
  FileText, 
  PlusCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  User, 
  Briefcase, 
  ArrowRight,
  Filter,
  Download,
  Eye,
  ChevronDown,
  MapPin,
  Camera,
  Check,
  X
} from "lucide-react";

export default function RequestsPage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState("my-requests");
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingAttendance, setPendingAttendance] = useState<any[]>([]);
  const [historyRequests, setHistoryRequests] = useState<any[]>([]);
  const [historyAttendance, setHistoryAttendance] = useState<any[]>([]);
  
  // PDF Preview State
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [colleagues, setColleagues] = useState<any[]>([]);
  
  // Modal State for Photo Proof
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState("LEAVE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  
  // Approval Modal State
  const [approvalModal, setApprovalModal] = useState({
      isOpen: false,
      requestId: 0,
      action: 'APPROVE' as 'APPROVE' | 'REJECT',
      note: '',
      request: null as any
  });
  
  // New Fields
  const [returnDate, setReturnDate] = useState("");
  const [replacementName, setReplacementName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");

  useEffect(() => {
    refreshUser();
    fetchMyRequests();
    fetchColleagues();
  }, []);

  useEffect(() => {
    if (user && (user.role === 'HOD' || user.role === 'HR' || user.role === 'GM')) {
        fetchPendingRequests();
        fetchPendingAttendance();
        fetchHistoryRequests();
        fetchHistoryAttendance();
    }
  }, [user]);

  const fetchColleagues = async () => {
      try {
          const res = await api.get("/users/colleagues");
          setColleagues(res.data);
      } catch (err) {
          console.error("Error fetching colleagues", err);
      }
  };

  const fetchMyRequests = async () => {
    try {
      const res = await api.get("/requests/me");
      setMyRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get("/requests/pending");
      setPendingRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingAttendance = async () => {
    try {
      const res = await api.get("/attendance/pending");
      setPendingAttendance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistoryRequests = async () => {
    try {
      const res = await api.get("/requests/history");
      setHistoryRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistoryAttendance = async () => {
    try {
      const res = await api.get("/attendance/history");
      setHistoryAttendance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Basic payload
      const payload: any = { type, reason };
      
      // Conditional payload construction
      if (type === 'ADD_MANPOWER') {
          payload.startDate = startDate; // Tanggal Tambah
          payload.endDate = startDate;   // Same as start
          payload.newEmployeeName = newEmployeeName;
          payload.targetDepartment = targetDepartment;
      } else if (type === 'SHIFT_EXCHANGE') {
          payload.startDate = startDate;
          payload.endDate = startDate;
          payload.replacementName = replacementName;
      } else if (type === 'OVERTIME') {
          payload.startDate = startDate;
          payload.endDate = startDate;
          payload.startTime = startTime;
          payload.endTime = endTime;
      } else {
          // Leave, Permission, Sick, Off, External Duty
          payload.startDate = startDate;
          payload.endDate = endDate || startDate; // Default single day if end missing
          
          if (type === 'LEAVE') {
              const requestedQty = parseInt(quantity);
              const currentQuota = user?.leaveQuota || 0;
              if (requestedQty > currentQuota) {
                 alert(`Insufficient leave quota. You have ${currentQuota} days remaining.`);
                 return;
              }
              payload.returnDate = returnDate;
              payload.replacementName = replacementName;
              payload.quantity = quantity;
          } else if (type === 'UNPAID_LEAVE') {
              payload.returnDate = returnDate;
              payload.replacementName = replacementName;
              payload.quantity = quantity;
          } else if (type === 'SICK' || type === 'PERMISSION' || type === 'OFF') {
              payload.replacementName = replacementName;
          }
      }

      await api.post("/requests", payload);
      alert("Request submitted successfully!");
      fetchMyRequests();
      setActiveTab('my-requests');
      
      // Reset form
      setReason("");
      setStartDate("");
      setEndDate("");
      setReturnDate("");
      setReplacementName("");
      setQuantity("");
      setStartTime("");
      setEndTime("");
      setNewEmployeeName("");
      setTargetDepartment("");
      
    } catch (err: any) {
      alert("Error submitting request: " + (err.response?.data?.message || err.message));
    }
  };

  const handleApproval = (id: number, action: 'APPROVE' | 'REJECT') => {
      const req = pendingRequests.find(r => r.id === id) || historyRequests.find(r => r.id === id);
      setApprovalModal({
          isOpen: true,
          requestId: id,
          action,
          note: '',
          request: req
      });
  };

  const submitApproval = async () => {
      try {
          const { requestId, action, note } = approvalModal;
          if (action === 'REJECT' && !note) {
              alert("Please provide a reason for rejection.");
              return;
          }
          
          await api.put(`/requests/${requestId}/approval`, { action, reason: note });
          alert(`Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`);
          setApprovalModal({ ...approvalModal, isOpen: false });
          fetchPendingRequests();
          fetchHistoryRequests();
      } catch (err: any) {
          alert("Error processing request: " + (err.response?.data?.message || err.message));
      }
  };

  const handleAttendanceApproval = async (id: number, action: 'APPROVE' | 'REJECT') => {
    try {
        const reason = action === 'REJECT' ? prompt("Enter rejection reason:") : null;
        if (action === 'REJECT' && !reason) return; // Cancelled

        // Map action to status expected by backend
        const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

        await api.put(`/attendance/${id}/status`, { status, reason });
        alert(`Attendance Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`);
        fetchPendingAttendance();
        // Maybe fetch history if we had attendance history here
    } catch (err: any) {
        alert("Error processing attendance approval: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDownloadPDF = async (id: number) => {
      try {
          const res = await api.get(`/requests/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `request-${id}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          alert("Error downloading PDF");
      }
  };

  const handlePreviewPDF = async (id: number) => {
      try {
          const res = await api.get(`/requests/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          window.open(url, '_blank');
      } catch (err) {
          alert("Error previewing PDF");
      }
  };

  const handleDownloadAttendancePDF = async (id: number) => {
      try {
          const res = await api.get(`/attendance/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `attendance-${id}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          alert("Error downloading PDF");
      }
  };

  const handlePreviewAttendancePDF = async (id: number) => {
      try {
          const res = await api.get(`/attendance/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          window.open(url, '_blank');
      } catch (err) {
          alert("Error previewing PDF");
      }
  };

  const canApprove = user?.role === 'HOD' || user?.role === 'HR' || user?.role === 'GM';

  const getStatusBadge = (status: string) => {
      const colors: any = {
          APPROVED: 'bg-green-100 text-green-700 border-green-200',
          REJECTED: 'bg-red-100 text-red-700 border-red-200',
          PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          PENDING_HOD: 'bg-orange-100 text-orange-700 border-orange-200',
          PENDING_HR: 'bg-blue-100 text-blue-700 border-blue-200',
          PENDING_GM: 'bg-purple-100 text-purple-700 border-purple-200'
      };
      const color = colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
      return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}>
              {status.replace(/_/g, ' ')}
          </span>
      );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-[#0F4D39]/10 rounded-lg">
                    <FileText className="w-8 h-8 text-[#0F4D39]" />
                </div>
                Request Management
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Submit requests and manage approvals.</p>
        </div>
        
        <button 
            onClick={() => setActiveTab('new-request')}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-[#0F4D39] hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2"
        >
            <PlusCircle className="w-5 h-5" />
            New Request
        </button>
      </div>

      {/* Modern Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('my-requests')}
            className={`${
              activeTab === 'my-requests'
                ? 'border-[#0F4D39] text-[#0F4D39]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
          >
            <User className="w-4 h-4" />
            My Requests
          </button>
          
          {canApprove && (
            <>
                <button 
                    onClick={() => setActiveTab('approvals')}
                    className={`${
                    activeTab === 'approvals'
                        ? 'border-[#0F4D39] text-[#0F4D39]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Pending Approvals
                    {pendingRequests.length > 0 && (
                        <span className="ml-1 bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-xs font-bold">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`${
                    activeTab === 'history'
                        ? 'border-[#0F4D39] text-[#0F4D39]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                    <Clock className="w-4 h-4" />
                    Approval History
                </button>
            </>
          )}
        </nav>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {activeTab === 'new-request' && (
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-xl font-bold text-gray-800">Submit New Request</h2>
                        <p className="text-gray-500 text-sm mt-1">Fill in the details below to submit your request.</p>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">Request Category</label>
                            <div className="relative">
                                <Briefcase className="absolute top-3 left-3 w-5 h-5 text-gray-400" />
                                <select 
                                    value={type} 
                                    onChange={(e) => setType(e.target.value)}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] appearance-none bg-white transition-all"
                                >
                                    <option value="LEAVE">Cuti Tahunan (Annual Leave)</option>
                                    <option value="ADD_MANPOWER">Izin Tambah Man Power</option>
                                    <option value="SHIFT_EXCHANGE">Form Tukar Jadwal (Shift Exchange)</option>
                                    <option value="SICK">Sakit (Sick Leave)</option>
                                    <option value="PERMISSION">Izin (Permission)</option>
                                    <option value="OFF">Off Day</option>
                                    <option value="OVERTIME">Lembur (Overtime)</option>
                                    <option value="EXTERNAL_DUTY">Dinas Luar (External Duty)</option>
                                </select>
                                <ChevronDown className="absolute top-4 right-4 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-6">
                            {/* DYNAMIC FIELDS BASED ON TYPE */}
                            
                            {(type === 'LEAVE' || type === 'UNPAID_LEAVE') && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Return to Work Date</label>
                                        <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Replacement Staff</label>
                                        <select 
                                            value={replacementName} 
                                            onChange={(e) => setReplacementName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                                            required
                                        >
                                            <option value="">Select Colleague</option>
                                            <option value="Tidak ada pengganti">No Replacement Needed</option>
                                            {colleagues.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Days Taken (QTY)
                                            {type === 'LEAVE' && <span className="text-sm text-[#0F4D39] font-bold ml-2">(Sisa Cuti: {user?.leaveQuota || 0} hari)</span>}
                                        </label>
                                        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                </>
                            )}

                            {type === 'ADD_MANPOWER' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">New Employee Name / Role</label>
                                        <input type="text" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Required Date</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Target Department</label>
                                        <input type="text" value={targetDepartment} onChange={(e) => setTargetDepartment(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                </>
                            )}

                            {type === 'SHIFT_EXCHANGE' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Exchange Date</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Replacement Staff</label>
                                        <select 
                                            value={replacementName} 
                                            onChange={(e) => setReplacementName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                                            required
                                        >
                                            <option value="">Select Colleague</option>
                                            <option value="Tidak ada pengganti">No Replacement Needed</option>
                                            {colleagues.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {type === 'SICK' && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Start Date</label>
                                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">End Date</label>
                                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Replacement Staff</label>
                                        <select 
                                            value={replacementName} 
                                            onChange={(e) => setReplacementName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                                            required
                                        >
                                            <option value="">Select Colleague</option>
                                            <option value="Tidak ada pengganti">No Replacement Needed</option>
                                            {colleagues.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {(type === 'PERMISSION' || type === 'OFF') && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">{type === 'OFF' ? 'Off Date' : 'Permission Date'}</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Replacement Staff</label>
                                        <select 
                                            value={replacementName} 
                                            onChange={(e) => setReplacementName(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                                            required
                                        >
                                            <option value="">Select Colleague</option>
                                            <option value="Tidak ada pengganti">No Replacement Needed</option>
                                            {colleagues.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            {type === 'OVERTIME' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">Overtime Date</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Start Time</label>
                                            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">End Time</label>
                                            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {type === 'EXTERNAL_DUTY' && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Duty Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all" required />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    {type === 'SICK' ? 'Reason / Diagnosis' : 'Reason / Details'}
                                </label>
                                <textarea 
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] min-h-[100px] resize-none transition-all"
                                    rows={3}
                                    required
                                    placeholder="Please provide details..."
                                />
                            </div>
                        </div>
                        
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                className="w-full md:w-auto px-8 py-3 bg-[#0F4D39] text-white rounded-xl font-bold hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowRight className="w-5 h-5" />
                                Submit Request
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {activeTab === 'my-requests' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                 {/* Mobile Card View */}
                 <div className="md:hidden">
                    {myRequests.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {myRequests.map((req) => (
                                <div key={req.id} className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-bold text-gray-900 block">{req.type.replace(/_/g, ' ')}</span>
                                            <span className="text-sm text-gray-500">{format(new Date(req.startDate), 'MMM dd, yyyy')}</span>
                                        </div>
                                        {getStatusBadge(req.status)}
                                    </div>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        {req.reason}
                                    </p>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            onClick={() => handlePreviewPDF(req.id)}
                                            className="text-sm text-gray-600 flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-lg"
                                        >
                                            <Eye className="w-4 h-4" /> Preview
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPDF(req.id)}
                                            className="text-sm text-gray-600 flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-lg"
                                        >
                                            <Download className="w-4 h-4" /> Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                             <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                             <p>No requests found</p>
                        </div>
                    )}
                 </div>

                 <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {myRequests.length > 0 ? (
                                myRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-medium text-gray-900">{req.type.replace(/_/g, ' ')}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(req.startDate), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                            {req.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handlePreviewPDF(req.id)}
                                                    className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                    title="Preview PDF"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPDF(req.id)}
                                                    className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="bg-gray-50 p-4 rounded-full mb-3">
                                                <FileText className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p>No requests found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {(activeTab === 'approvals' || activeTab === 'history') && (
            <div className="space-y-8">
                {/* External Duty Approvals Section */}
                {(activeTab === 'approvals' || activeTab === 'history') && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-white">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-2 rounded-lg text-orange-700">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-gray-800">
                                        {activeTab === 'approvals' ? 'External Duty Check-ins' : 'External Duty History'}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        {activeTab === 'approvals' ? 'Requires your approval' : 'Past approvals'}
                                    </p>
                                </div>
                            </div>
                            {activeTab === 'approvals' && (
                                <span className="bg-orange-100 text-orange-700 py-1 px-3 rounded-full text-xs font-bold">
                                    {pendingAttendance.length} Pending
                                </span>
                            )}
                        </div>
                        {/* Mobile Card View */}
                        <div className="md:hidden">
                            {(activeTab === 'approvals' ? pendingAttendance : historyAttendance).length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {(activeTab === 'approvals' ? pendingAttendance : historyAttendance).map((att) => (
                                        <div key={att.id} className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                                                        {att.user?.name?.substring(0, 2).toUpperCase() || 'US'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{att.user?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-gray-500">{att.user?.department || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                {getStatusBadge(att.status)}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="block text-xs text-gray-500">Date</span>
                                                    <span className="font-medium">{att.timestamp ? format(new Date(att.timestamp), 'MMM dd, yyyy') : '-'}</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="block text-xs text-gray-500">Time</span>
                                                    <span className="font-medium">{att.timestamp ? format(new Date(att.timestamp), 'HH:mm') : '-'}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <MapPin className="w-4 h-4 text-gray-400" />
                                                <span className="truncate">{att.location || 'No location'}</span>
                                            </div>

                                            {att.photoUrl && (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedPhoto(att.photoUrl);
                                                        setShowPhotoModal(true);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Camera className="w-4 h-4" />
                                                    View Photo Proof
                                                </button>
                                            )}

                                            {(activeTab === 'approvals' || activeTab === 'history') && (
                                                <div className="pt-2 flex justify-end gap-2">
                                                    {activeTab === 'approvals' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleAttendanceApproval(att.id, 'APPROVE')}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200"
                                                            >
                                                                <Check className="w-4 h-4" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleAttendanceApproval(att.id, 'REJECT')}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-200"
                                                            >
                                                                <X className="w-4 h-4" /> Reject
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handlePreviewAttendancePDF(att.id)}
                                                                className="flex-1 flex items-center justify-center gap-1 bg-gray-100 py-2 rounded-lg text-sm"
                                                            >
                                                                <Eye className="w-4 h-4" /> Preview
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadAttendancePDF(att.id)}
                                                                className="flex-1 flex items-center justify-center gap-1 bg-gray-100 py-2 rounded-lg text-sm"
                                                            >
                                                                <Download className="w-4 h-4" /> Download
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-500">
                                    <MapPin className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                    <p>{activeTab === 'approvals' ? 'No external duty requests pending' : 'No external duty history found'}</p>
                                </div>
                            )}
                        </div>

                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proof</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        {(activeTab === 'approvals' || activeTab === 'history') && (
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(activeTab === 'approvals' ? pendingAttendance : historyAttendance).length > 0 ? (
                                        (activeTab === 'approvals' ? pendingAttendance : historyAttendance).map((att) => (
                                            <tr key={att.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs">
                                                            {att.user?.name?.substring(0, 2).toUpperCase() || 'US'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{att.user?.name || 'Unknown'}</p>
                                                            <p className="text-xs text-gray-500">{att.user?.department || 'N/A'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {att.timestamp ? format(new Date(att.timestamp), 'MMM dd, yyyy') : '-'}
                                                        </span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {att.timestamp ? format(new Date(att.timestamp), 'HH:mm') : '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    <div className="flex items-center gap-1.5" title={att.location}>
                                                        <MapPin className="w-4 h-4 text-gray-400" />
                                                        <span className="truncate max-w-[150px]">{att.location || 'No location'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {att.photoUrl ? (
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedPhoto(att.photoUrl);
                                                                setShowPhotoModal(true);
                                                            }}
                                                            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                            View Photo
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs italic">No photo</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {getStatusBadge(att.status)}
                                                </td>
                                                {(activeTab === 'approvals' || activeTab === 'history') && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {activeTab === 'approvals' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAttendanceApproval(att.id, 'APPROVE')}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-200"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAttendanceApproval(att.id, 'REJECT')}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handlePreviewAttendancePDF(att.id)}
                                                                    className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                                    title="Preview PDF"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDownloadAttendancePDF(att.id)}
                                                                    className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                                    title="Download PDF"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                )}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="bg-gray-50 p-4 rounded-full mb-3">
                                                        <MapPin className="w-8 h-8 text-gray-300" />
                                                    </div>
                                                    <p>{activeTab === 'approvals' ? 'No external duty requests pending' : 'No external duty history found'}</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* General Requests Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h2 className="font-bold text-gray-800">
                            {activeTab === 'approvals' ? 'General Requests (Leave, Overtime, etc.)' : 'Approval History'}
                        </h2>
                         {activeTab === 'approvals' && (
                            <span className="bg-blue-100 text-blue-700 py-1 px-3 rounded-full text-xs font-bold">
                                {pendingRequests.length} Pending
                            </span>
                        )}
                    </div>
                    {/* Mobile Card View */}
                    <div className="md:hidden">
                        {(activeTab === 'approvals' ? pendingRequests : historyRequests).length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {(activeTab === 'approvals' ? pendingRequests : historyRequests).map((req) => (
                                    <div key={req.id} className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#0F4D39]/10 flex items-center justify-center text-[#0F4D39] font-bold text-sm">
                                                    {req.user?.name?.substring(0, 2).toUpperCase() || 'US'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{req.user?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{req.user?.department || 'N/A'}</p>
                                                </div>
                                            </div>
                                            {getStatusBadge(req.status)}
                                        </div>
                                        
                                        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Type</span>
                                                <span className="font-medium">{req.type.replace(/_/g, ' ')}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Date</span>
                                                <span className="font-medium">{format(new Date(req.startDate), 'MMM dd, yyyy')}</span>
                                            </div>
                                            {(req.hodNote || req.hrNote || req.gmNote || req.rejectionReason) && (
                                                <div className="pt-2 border-t border-gray-200 mt-2 space-y-1">
                                                    <span className="text-xs font-semibold text-gray-500 block">Notes:</span>
                                                    {req.hodNote && <p className="text-xs text-gray-600"><span className="font-bold">HOD:</span> {req.hodNote}</p>}
                                                    {req.hrNote && <p className="text-xs text-gray-600"><span className="font-bold">HR:</span> {req.hrNote}</p>}
                                                    {req.gmNote && <p className="text-xs text-gray-600"><span className="font-bold">GM:</span> {req.gmNote}</p>}
                                                    {req.rejectionReason && <p className="text-xs text-red-600"><span className="font-bold">Rejected:</span> {req.rejectionReason}</p>}
                                                </div>
                                            )}
                                        </div>

                                        {(activeTab === 'approvals' || activeTab === 'history') && (
                                            <div className="pt-2 flex justify-end gap-2">
                                                {activeTab === 'approvals' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproval(req.id, 'APPROVE')}
                                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200"
                                                        >
                                                            <Check className="w-4 h-4" /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproval(req.id, 'REJECT')}
                                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold border border-red-200"
                                                        >
                                                            <X className="w-4 h-4" /> Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handlePreviewPDF(req.id)}
                                                            className="flex-1 flex items-center justify-center gap-1 bg-gray-100 py-2 rounded-lg text-sm"
                                                        >
                                                            <Eye className="w-4 h-4" /> Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadPDF(req.id)}
                                                            className="flex-1 flex items-center justify-center gap-1 bg-gray-100 py-2 rounded-lg text-sm"
                                                        >
                                                            <Download className="w-4 h-4" /> Download
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                <p>No records found</p>
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
                                    {(activeTab === 'approvals' || activeTab === 'history') && (
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(activeTab === 'approvals' ? pendingRequests : historyRequests).map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#0F4D39]/10 flex items-center justify-center text-[#0F4D39] font-bold text-xs">
                                                    {req.user?.name?.substring(0, 2).toUpperCase() || 'US'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{req.user?.name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{req.user?.department || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-700">{req.type.replace(/_/g, ' ')}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {format(new Date(req.startDate), 'MMM dd, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm max-w-xs">
                                            <div className="space-y-1">
                                                {req.hodNote && <p className="text-gray-600 truncate" title={`HOD: ${req.hodNote}`}><span className="font-bold text-xs">HOD:</span> {req.hodNote}</p>}
                                                {req.hrNote && <p className="text-gray-600 truncate" title={`HR: ${req.hrNote}`}><span className="font-bold text-xs">HR:</span> {req.hrNote}</p>}
                                                {req.gmNote && <p className="text-gray-600 truncate" title={`GM: ${req.gmNote}`}><span className="font-bold text-xs">GM:</span> {req.gmNote}</p>}
                                                {req.rejectionReason && <p className="text-red-600 truncate" title={`Reason: ${req.rejectionReason}`}><span className="font-bold text-xs">Reason:</span> {req.rejectionReason}</p>}
                                                {(!req.hodNote && !req.hrNote && !req.gmNote && !req.rejectionReason) && <span className="text-gray-400 text-xs italic">No notes</span>}
                                            </div>
                                        </td>
                                        {(activeTab === 'approvals' || activeTab === 'history') && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    {activeTab === 'approvals' ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproval(req.id, 'APPROVE')}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-200"
                                                            >
                                                                <Check className="w-3 h-3" />
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleApproval(req.id, 'REJECT')}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                                                            >
                                                                <X className="w-3 h-3" />
                                                                Reject
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handlePreviewPDF(req.id)}
                                                                className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                                title="Preview PDF"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadPDF(req.id)}
                                                                className="text-gray-400 hover:text-[#0F4D39] p-2 hover:bg-[#0F4D39]/10 rounded-lg transition-colors"
                                                                title="Download PDF"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {(activeTab === 'approvals' ? pendingRequests : historyRequests).length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                                    <FileText className="w-8 h-8 text-gray-300" />
                                                </div>
                                                <p>No records found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>
      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowPhotoModal(false)}>
            <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
                <button 
                    className="absolute -top-12 right-0 md:-right-12 text-white hover:text-gray-300 transition-colors"
                    onClick={() => setShowPhotoModal(false)}
                >
                    <X className="w-8 h-8" />
                </button>
                <img 
                    src={selectedPhoto.startsWith('http') ? selectedPhoto : `${(process.env.NEXT_PUBLIC_API_URL || '').replace('/api', '')}${selectedPhoto}`}
                    alt="Proof" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>
      )}
      {/* Approval Preview Modal */}
      {approvalModal.isOpen && approvalModal.request && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className={`px-6 py-4 border-b flex justify-between items-center ${
                      approvalModal.action === 'APPROVE' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                      <h3 className={`text-lg font-bold ${
                          approvalModal.action === 'APPROVE' ? 'text-green-800' : 'text-red-800'
                      }`}>
                          {approvalModal.action === 'APPROVE' ? 'Approve Request' : 'Reject Request'}
                      </h3>
                      <button onClick={() => setApprovalModal({ ...approvalModal, isOpen: false })} className="text-gray-500 hover:text-gray-700">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      {/* Request Preview */}
                      <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                          <div className="flex justify-between">
                              <span className="text-gray-500">Staff:</span>
                              <span className="font-medium text-gray-900">{approvalModal.request.user?.name}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-gray-500">Department:</span>
                              <span className="font-medium text-gray-900">{approvalModal.request.user?.department}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-gray-500">Type:</span>
                              <span className="font-medium text-gray-900">{approvalModal.request.type?.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-gray-500">Dates:</span>
                              <span className="font-medium text-gray-900">
                                  {format(new Date(approvalModal.request.startDate), 'MMM dd')} - {format(new Date(approvalModal.request.endDate), 'MMM dd, yyyy')}
                              </span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 mt-2">
                              <span className="text-gray-500 block mb-1">Reason:</span>
                              <p className="text-gray-800 italic">{approvalModal.request.reason}</p>
                          </div>
                      </div>

                      {/* Note Input */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                              {approvalModal.action === 'APPROVE' ? 'Add Note (Optional)' : 'Rejection Reason (Required)'}
                          </label>
                          <textarea
                              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent outline-none transition-all"
                              rows={3}
                              placeholder={approvalModal.action === 'APPROVE' ? "Add a note..." : "Why is this request being rejected?"}
                              value={approvalModal.note}
                              onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })}
                          ></textarea>
                      </div>
                  </div>

                  <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                      <button 
                          onClick={() => setApprovalModal({ ...approvalModal, isOpen: false })}
                          className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={submitApproval}
                          className={`px-4 py-2 text-white font-medium rounded-lg shadow-lg transition-all transform active:scale-95 flex items-center gap-2 ${
                              approvalModal.action === 'APPROVE' 
                                  ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                                  : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                          }`}
                      >
                          {approvalModal.action === 'APPROVE' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          Confirm {approvalModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
