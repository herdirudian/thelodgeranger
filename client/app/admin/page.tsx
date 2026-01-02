"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { User, Calendar, Trash2, Edit2, Plus } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");
  
  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  
  // Forms
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // User Form State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formDataUser, setFormDataUser] = useState({
      name: "", email: "", password: "", role: "STAFF", department: "", leaveQuota: 12
  });

  // Schedule Form State
  const [formDataSchedule, setFormDataSchedule] = useState({
      userId: "", date: "", shiftStart: "", shiftEnd: "", description: ""
  });

  useEffect(() => {
    if (user?.role === 'HR' || user?.role === 'GM') {
        fetchUsers();
        if (activeTab === 'schedule') {
            fetchSchedules();
        }
    }
  }, [user, activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await api.get("/schedule/all");
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          if (editingUser) {
              await api.put(`/users/${editingUser.id}`, formDataUser);
              alert("User updated");
          } else {
              await api.post("/users", formDataUser);
              alert("User created");
          }
          setShowUserModal(false);
          setEditingUser(null);
          setFormDataUser({ name: "", email: "", password: "", role: "STAFF", department: "" });
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

  const handleEditUser = (user: any) => {
      setEditingUser(user);
      setFormDataUser({
          name: user.name,
          email: user.email,
          password: "", // Don't fill password
          role: user.role,
          department: user.department || "",
          leaveQuota: user.leaveQuota || 12
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

  if (user?.role !== 'HR' && user?.role !== 'GM') {
      return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
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
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between mb-4">
                  <h2 className="text-xl font-bold">All Staff</h2>
                  <button 
                    onClick={() => {
                        setEditingUser(null);
                        setFormDataUser({ name: "", email: "", password: "", role: "STAFF", department: "" });
                        setShowUserModal(true);
                    }}
                    className="bg-[#0F4D39] text-white px-4 py-2 rounded flex items-center space-x-2"
                  >
                      <Plus size={18} /> <span>Add Staff</span>
                  </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3">Name</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">Leave Quota</th>
                            <th className="p-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-b">
                                <td className="p-3 font-medium">{u.name}</td>
                                <td className="p-3">{u.email}</td>
                                <td className="p-3">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{u.role}</span>
                                </td>
                                <td className="p-3">{u.department}</td>
                                <td className="p-3 text-center">{u.leaveQuota || 12}</td>
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

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div className="flex justify-between mb-4">
                  <h2 className="text-xl font-bold">All Schedules</h2>
                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="bg-[#0F4D39] text-white px-4 py-2 rounded flex items-center space-x-2"
                  >
                      <Plus size={18} /> <span>Assign Schedule</span>
                  </button>
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
                        {schedules.map((s) => (
                            <tr key={s.id} className="border-b">
                                <td className="p-3 font-medium">
                                    {s.user.name} <span className="text-xs text-gray-700">({s.user.department})</span>
                                </td>
                                <td className="p-3">{format(new Date(s.date), 'MMM dd, yyyy')}</td>
                                <td className="p-3">
                                    {format(new Date(s.shiftStart), 'HH:mm')} - {format(new Date(s.shiftEnd), 'HH:mm')}
                                </td>
                                <td className="p-3 text-sm text-gray-700">{s.description || '-'}</td>
                            </tr>
                        ))}
                         {schedules.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-700">No schedules found</td></tr>
                        )}
                    </tbody>
                </table>
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
                          <label className="block text-sm font-medium">Leave Quota (Days)</label>
                          <input type="number" className="w-full border p-2 rounded" 
                              value={formDataUser.leaveQuota} onChange={e => setFormDataUser({...formDataUser, leaveQuota: parseInt(e.target.value) || 0})}
                          />
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
