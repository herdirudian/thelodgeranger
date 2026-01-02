"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import AnnouncementSection from "@/components/AnnouncementSection";
import { 
  Clock, 
  Calendar, 
  Users, 
  FileText, 
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
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, loading, refreshUser } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    refreshUser(); // Ensure quota is up to date
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "Good Morning", icon: Sun, color: "text-orange-500" };
    if (hour < 18) return { text: "Good Afternoon", icon: Cloud, color: "text-blue-500" };
    return { text: "Good Evening", icon: Moon, color: "text-indigo-500" };
  };

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
    </div>
  );
  if (!user) return null; 

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-8">
      {/* Welcome Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
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

         <div className="flex flex-wrap gap-3 relative z-10">
             <Link href="/attendance">
                <button className="flex items-center gap-2 bg-[#0F4D39] text-white px-5 py-3 rounded-xl font-semibold shadow-lg shadow-[#0F4D39]/20 hover:bg-[#0a3628] hover:-translate-y-0.5 transition-all">
                    <Clock className="w-5 h-5" />
                    Clock In/Out
                </button>
             </Link>
             <Link href="/requests">
                <button className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-5 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all">
                    <FileText className="w-5 h-5" />
                    New Request
                </button>
             </Link>
         </div>
      </div>

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

      {/* Analytics Dashboard for HR, GM, Finance, Store */}
      {(user.role === 'HR' || user.role === 'GM' || user.role === 'FINANCE' || user.role === 'STORE') && (
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
                        <div className="flex items-center p-4 bg-gradient-to-r from-green-50 to-white border border-green-100 rounded-xl">
                            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-700 font-bold text-lg">
                                {format(currentTime, "dd")}
                            </div>
                            <div className="ml-4 flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-900">Today</p>
                                        <p className="text-sm text-green-700 font-medium mt-0.5">Morning Shift</p>
                                    </div>
                                    <span className="bg-white border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                        08:00 - 17:00
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                            <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500 font-bold text-lg">
                                {parseInt(format(currentTime, "dd")) + 1}
                            </div>
                            <div className="ml-4 flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-gray-900">Tomorrow</p>
                                        <p className="text-sm text-gray-500 mt-0.5">Morning Shift</p>
                                    </div>
                                    <span className="bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                                        08:00 - 17:00
                                    </span>
                                </div>
                            </div>
                        </div>
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
    </div>
  );
}
