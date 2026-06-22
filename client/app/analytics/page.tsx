"use client";

import { useEffect, useState } from "react";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell as PieCell
} from "recharts";
import { Clock, Users, Calendar, Activity, ArrowLeft, Filter, RefreshCw, Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RecapStats {
    period: string;
    overtimeHours: number;
    attendanceCount: number;
    requests: {
        sick: number;
        leave: number;
        permission: number;
        external: number;
    }
}

interface AttendanceStat {
    department: string;
    totalStaff: number;
    present: number;
    percentage: number;
    isMultiDay?: boolean;
}

interface LateEmployee {
    id: number;
    name: string;
    department: string;
    role: string;
    lateCount: number;
}

interface RequestTrend {
    month: string;
    SICK: number;
    PERMISSION: number;
    LEAVE: number;
    EXTERNAL_DUTY: number;
}

interface EmployeeRecap {
    id: number;
    name: string;
    department: string;
    role: string;
    scheduledDays: number;
    attendanceCount: number;
    overtimeHours: number;
    sick: number;
    permission: number;
    leave: number;
    pdo: number;
    external: number;
}

interface ApprovedHistory {
    id: number;
    employeeName: string;
    department: string;
    type: string;
    startDate: string;
    endDate: string;
    quantity: number;
    reason: string;
    createdAt: string;
    approvals: {
        step: string;
        approver: string;
        status: string;
        updatedAt: string;
    }[];
}

export default function AnalyticsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    
    // Filters
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedDept, setSelectedDept] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
    const [lateEmployees, setLateEmployees] = useState<LateEmployee[]>([]);
    const [requestTrends, setRequestTrends] = useState<RequestTrend[]>([]);
    const [recapStats, setRecapStats] = useState<RecapStats | null>(null);
    const [employeeRecaps, setEmployeeRecaps] = useState<EmployeeRecap[]>([]);
    const [approvedHistory, setApprovedHistory] = useState<ApprovedHistory[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch Departments
    useEffect(() => {
        if (user && (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'MERCHANDISE_SPV' || user.role === 'HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_HOD')) {
            api.get('/analytics/departments')
               .then(res => setDepartments(res.data))
               .catch(err => console.error("Failed to load departments", err));
        }
    }, [user]);

    useEffect(() => {
        if (!authLoading && user) {
            if (user.role !== 'HR' && user.role !== 'GM' && user.role !== 'ADMIN' && user.role !== 'SUPERVISOR' && user.role !== 'MERCHANDISE_SPV' && user.role !== 'HOD' && user.role !== 'PHOTOGRAPHER_HOD' && user.role !== 'MERCHANDISE_HOD' && user.role !== 'STAFF') {
                router.push('/dashboard');
                return;
            }

            const fetchData = async () => {
                setLoading(true);
                try {
                    const params = {
                        department: selectedDept,
                        startDate: startDate || undefined,
                        endDate: endDate || undefined
                    };

                    const [resAtt, resLate, resTrend, resRecap, resEmpRecap, resHistory] = await Promise.all([
                        api.get("/analytics/attendance-stats", { params }),
                        api.get("/analytics/lateness", { params }),
                        api.get("/analytics/request-trends", { params }),
                        api.get("/analytics/recap", { params }),
                        api.get("/analytics/employee-recap", { params }),
                        api.get("/analytics/approved-history", { params })
                    ]);

                    setAttendanceStats(resAtt.data);
                    setLateEmployees(resLate.data);
                    setRequestTrends(resTrend.data);
                    setRecapStats(resRecap.data);
                    setEmployeeRecaps(resEmpRecap.data);
                    setApprovedHistory(resHistory.data);
                } catch (error) {
                    console.error("Error fetching analytics:", error);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }
    }, [user, authLoading, router, selectedDept, startDate, endDate]);

    if (loading && !recapStats) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
        </div>
    );

    const isMultiDayAttendance = attendanceStats.length > 0 && attendanceStats[0].isMultiDay;

    const handleExport = async () => {
        try {
            const params = {
                department: selectedDept,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };
            
            const response = await api.get('/analytics/export', { 
                params,
                responseType: 'blob' 
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `recap_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export data.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-8 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Analytics & Recap</h1>
                    <p className="text-gray-500">Operational Overview for {recapStats?.period}</p>
                </div>
                <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-[#0F4D39]">
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex items-center gap-2 text-[#0F4D39] font-medium mr-2">
                    <Filter size={20} />
                    <span>Filters</span>
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                    <select 
                        value={selectedDept} 
                        onChange={e => setSelectedDept(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39] block w-full p-2.5 min-w-[150px]"
                    >
                        <option value="ALL">All Departments</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39] block w-full p-2.5"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#0F4D39] focus:border-[#0F4D39] block w-full p-2.5"
                    />
                </div>

                <button 
                    onClick={() => { setStartDate(''); setEndDate(''); setSelectedDept('ALL'); }}
                    className="text-sm text-gray-500 hover:text-red-500 pb-2 px-2 flex items-center gap-1"
                >
                    <RefreshCw size={14} /> Reset
                </button>

                <button 
                    onClick={handleExport}
                    className="ml-auto flex items-center gap-2 bg-[#0F4D39] text-white px-4 py-2 rounded-lg hover:bg-[#0F4D39]/90 transition-colors shadow-sm"
                >
                    <Download size={16} />
                    <span>Export CSV</span>
                </button>
            </div>

            {/* Recap Cards */}
            {recapStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Overtime</h3>
                                <p className="text-3xl font-bold text-[#0F4D39] mt-2">{recapStats.overtimeHours} <span className="text-sm font-normal text-gray-500">hrs</span></p>
                            </div>
                            <div className="p-3 bg-[#0F4D39]/10 rounded-lg">
                                <Clock className="w-6 h-6 text-[#0F4D39]" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Check-ins</h3>
                                <p className="text-3xl font-bold text-blue-600 mt-2">{recapStats.attendanceCount}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Leaves Taken</h3>
                                <p className="text-3xl font-bold text-orange-600 mt-2">{recapStats.requests.leave}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <Calendar className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Sick / Permission</h3>
                                <p className="text-3xl font-bold text-red-600 mt-2">{recapStats.requests.sick + recapStats.requests.permission}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-lg">
                                <Activity className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Attendance by Department */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">
                        {isMultiDayAttendance ? "Total Attendance Count" : "Daily Attendance Rate"}
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attendanceStats} layout="vertical" margin={{ left: 20, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={isMultiDayAttendance ? ['auto', 'auto'] : [0, 100]} hide />
                                <YAxis dataKey="department" type="category" width={100} tick={{fontSize: 12}} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Bar 
                                    dataKey={isMultiDayAttendance ? "present" : "percentage"} 
                                    name={isMultiDayAttendance ? "Total Check-ins" : "Attendance %"} 
                                    fill="#0F4D39" 
                                    radius={[0, 4, 4, 0]} 
                                    barSize={20} 
                                    background={{ fill: '#f3f4f6' }} 
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Request Trends */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Absence Trends</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={requestTrends}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                <Legend wrapperStyle={{paddingTop: '20px'}} />
                                <Line type="monotone" dataKey="SICK" name="Sick" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                <Line type="monotone" dataKey="PERMISSION" name="Permission" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                <Line type="monotone" dataKey="LEAVE" name="Leave" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. Frequent Latecomers */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Top Latecomers</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Late Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-500/10">
                            {lateEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{emp.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            {emp.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                            {emp.lateCount} times
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {lateEmployees.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        No late records found in the last 30 days. Good job team! 🎉
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Detailed Approved History */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Detailed Approved History (Izin, Cuti, etc.)</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Approval Path</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-500/10">
                            {approvedHistory.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{item.employeeName}</div>
                                        <div className="text-xs text-gray-500">{item.department}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            item.type === 'SICK' ? 'bg-red-100 text-red-800' :
                                            item.type === 'LEAVE' ? 'bg-blue-100 text-blue-800' :
                                            item.type === 'PERMISSION' ? 'bg-orange-100 text-orange-800' :
                                            'bg-purple-100 text-purple-800'
                                        }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {new Date(item.startDate).toLocaleDateString('id-ID')} - {new Date(item.endDate).toLocaleDateString('id-ID')}
                                        </div>
                                        <div className="text-xs text-gray-500">{item.quantity} days/hours</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-500 max-w-xs truncate" title={item.reason}>
                                            {item.reason}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col space-y-1">
                                            {item.approvals.length > 0 ? (
                                                item.approvals.map((app, idx) => (
                                                    <div key={idx} className="flex items-center text-xs text-green-600 font-medium">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                                                        <span>{app.step}: {app.approver}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-gray-400 italic">Legacy Approval</div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {approvedHistory.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No fully approved requests found for the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. Detailed Employee Recap */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Detailed Employee Performance</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Scheduled</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Present</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Overtime</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Sick</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Permit</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Leave</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">PDO</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ext. Duty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-500/10">
                            {employeeRecaps.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#0F4D39]/10 flex items-center justify-center text-[#0F4D39] font-bold text-xs">
                                                {emp.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{emp.name}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{emp.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-700">{emp.scheduledDays}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-[#0F4D39] font-bold">{emp.attendanceCount}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">{emp.overtimeHours} h</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <p className={`font-bold ${emp.sick > 0 ? "text-red-500" : "text-gray-400"}`}>{emp.sick}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <p className={`font-bold ${emp.permission > 0 ? "text-orange-500" : "text-gray-400"}`}>{emp.permission}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <p className={`font-bold ${emp.leave > 0 ? "text-blue-500" : "text-gray-400"}`}>{emp.leave}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <p className={`font-bold ${emp.pdo > 0 ? "text-purple-500" : "text-gray-400"}`}>{emp.pdo}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                        <p className={`font-bold ${emp.external > 0 ? "text-indigo-500" : "text-gray-400"}`}>{emp.external}</p>
                                    </td>
                                </tr>
                            ))}
                            {employeeRecaps.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                        No employee records found for the selected criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
