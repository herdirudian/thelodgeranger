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
  const [staffList, setStaffList] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState<any>({}); // { userId: { day: 'M' } }
  const [department, setDepartment] = useState("");

  // Approval State
  const [monthlySchedules, setMonthlySchedules] = useState<any[]>([]);

  useEffect(() => {
    fetchUserAndData();
  }, []);

  useEffect(() => {
      if (activeTab === 'approvals') {
          fetchMonthlySchedules();
      }
  }, [activeTab]);

  const fetchUserAndData = async () => {
    try {
      const meRes = await api.get("/auth/me");
      setRole(meRes.data.role);
      setDepartment(meRes.data.department);

      if (['HOD', 'HR', 'GM'].includes(meRes.data.role)) {
         // Fetch staff for this department (or all for GM/HR?)
         // Ideally backend should provide a "my-staff" endpoint or filter users.
         // For now, let's assume we can get users.
         // We might need a new endpoint `GET /users/staff` or similar.
         // Or use `GET /attendance/team` logic which fetches users.
         // Let's assume we have an endpoint or can mock/filter from a general user list if available.
         // Since I didn't create a `GET /users` endpoint, I'll use a new one or existing one.
         // Let's create `GET /users` in backend later. For now, I'll try to use what I have.
         // I'll add `GET /users` to auth route or user route.
         
         const usersRes = await api.get("/users?department=" + meRes.data.department); 
         setStaffList(usersRes.data);
      } else {
         router.push("/schedule");
      }
    } catch (err) {
      console.error(err);
      // router.push("/login");
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

  const handleShiftChange = (userId: number, day: number, value: string) => {
      setScheduleData((prev: any) => ({
          ...prev,
          [userId]: {
              ...(prev[userId] || {}),
              [day]: value
          }
      }));
  };

  const handleSubmit = async () => {
      try {
          const [year, month] = selectedMonth.split('-');
          
          // Transform scheduleData to array format expected by backend
          // scheduleData: { 1: { 1: 'M', 2: 'A' } }
          const formattedData = Object.entries(scheduleData).map(([userId, shifts]) => ({
              userId,
              shifts
          }));

          await api.post("/schedule/monthly", {
              department,
              month,
              year,
              data: formattedData
          });
          
          alert("Schedule submitted for approval!");
          setActiveTab('approvals');
          fetchMonthlySchedules();
      } catch (err: any) {
          alert(err.response?.data?.message || "Error submitting schedule");
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

  const getDaysArray = () => {
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = getDaysInMonth(new Date(parseInt(year), parseInt(month) - 1));
      return Array.from({ length: daysInMonth }, (_, i) => i + 1);
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
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Manage Schedules</h1>
            <p className="text-sm text-gray-800">Logged in as: <span className="font-bold">{role}</span> {department && `(${department})`}</p>
        </div>
        <div className="space-x-2">
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
        </div>
      </div>

      {activeTab === 'create' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              <div className="mb-4 flex items-center space-x-4">
                  <label className="font-bold">Select Month:</label>
                  <input 
                      type="month" 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border p-2 rounded"
                  />
                  <span className="text-gray-800">Department: {department}</span>
              </div>

              <table className="min-w-full text-xs border-collapse">
                  <thead>
                      <tr>
                          <th className="border p-2 min-w-[150px] sticky left-0 bg-white z-10">Staff Name</th>
                          {getDaysArray().map(day => (
                              <th key={day} className="border p-1 w-10 text-center">{day}</th>
                          ))}
                      </tr>
                  </thead>
                  <tbody>
                      {staffList.map(staff => (
                          <tr key={staff.id}>
                              <td className="border p-2 font-medium sticky left-0 bg-white z-10">{staff.name}</td>
                              {getDaysArray().map(day => (
                                  <td key={day} className="border p-0">
                                      <select 
                                          className="w-full h-full p-1 bg-transparent focus:bg-blue-50 outline-none text-center appearance-none"
                                          value={scheduleData[staff.id]?.[day] || ''}
                                          onChange={(e) => handleShiftChange(staff.id, day, e.target.value)}
                                      >
                                          <option value="">-</option>
                                          <option value="M">M</option>
                                          <option value="A">A</option>
                                          <option value="N">N</option>
                                          <option value="OFF">OFF</option>
                                      </select>
                                  </td>
                              ))}
                          </tr>
                      ))}
                  </tbody>
              </table>

              <div className="mt-6 flex justify-end">
                  <button 
                      onClick={handleSubmit}
                      className="bg-[#0F4D39] text-white px-6 py-2 rounded hover:bg-[#0a3628]"
                  >
                      Submit Schedule
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'approvals' && (
          <div className="space-y-4">
              {monthlySchedules.map(schedule => (
                  <div key={schedule.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex justify-between items-start">
                          <div>
                              <h3 className="font-bold text-lg">
                                  {schedule.department} - {format(new Date(schedule.year, schedule.month - 1), 'MMMM yyyy')}
                              </h3>
                              <p className="text-sm text-gray-800">Created by: {schedule.createdByUser.name}</p>
                              <div className="mt-2 flex space-x-2">
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
                          
                          <div className="flex flex-col space-y-2">
                              <div className="space-x-2">
                                  {/* Logic for showing Approve buttons */}
                                  {/* If I am HR and status is PENDING_HR */}
                                  {role === 'HR' && schedule.status === 'PENDING_HR' && (
                                      <>
                                          <button onClick={() => handleApprove(schedule.id, 'APPROVE')} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Approve</button>
                                          <button onClick={() => handleApprove(schedule.id, 'REJECT')} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Reject</button>
                                      </>
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
