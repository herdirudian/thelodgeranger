"use client";

import { useEffect, useState } from "react";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, Cell, PieChart, Pie, Cell as PieCell
} from "recharts";
import { Clock, Users, Calendar, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

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

interface DashboardStats {
    gmStats?: {
        totalSpending: number;
        spendingByDept: { name: string; value: number }[];
        pendingApprovals: number;
    };
    storeStats?: {
        itemsToFulfill: number;
        lowStockItems: any[];
    };
    myStats?: {
        pendingRequests: number;
    };
}

const COLORS = ['#0F4D39', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6'];

export default function AnalyticsDashboard() {
    const { user, loading: authLoading } = useAuth();
    const [attendanceStats, setAttendanceStats] = useState<AttendanceStat[]>([]);
    const [lateEmployees, setLateEmployees] = useState<LateEmployee[]>([]);
    const [requestTrends, setRequestTrends] = useState<RequestTrend[]>([]);
    const [recapStats, setRecapStats] = useState<RecapStats | null>(null);
    const [approvedHistory, setApprovedHistory] = useState<ApprovedHistory[]>([]);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            try {
                const promises = [];
                
                // Fetch General Dashboard Stats (GM, Store, MyStats)
                promises.push(api.get("/dashboard/stats"));

                // Fetch Analytics for HR, GM, ADMIN, SUPERVISOR, and HOD (HOD restricted server-side)
                if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'HOD' || user.role === 'MERCHANDISE_HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_SPV') {
                    promises.push(api.get("/analytics/attendance-stats"));
                    promises.push(api.get("/analytics/lateness"));
                    promises.push(api.get("/analytics/request-trends"));
                    promises.push(api.get("/analytics/recap"));
                    promises.push(api.get("/analytics/approved-history"));
                }

                const results = await Promise.all(promises);
                
                setDashboardStats(results[0].data);

                if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'HOD' || user.role === 'MERCHANDISE_HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_SPV') {
                    setAttendanceStats(results[1].data);
                    setLateEmployees(results[2].data);
                    setRequestTrends(results[3].data);
                    setRecapStats(results[4].data);
                    setApprovedHistory(results[5].data);
                }

            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            if (user) {
                fetchData();
            } else {
                setLoading(false);
            }
        }
    }, [user, authLoading]);

    if (loading || authLoading) return <div className="p-4 text-gray-500">Loading analytics data...</div>;

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">
                {user?.role === 'STORE' ? 'Inventory Dashboard' : 'Analytics & Overview'}
            </h2>

            {/* GM / Finance Stats */}
            {dashboardStats?.gmStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#0F4D39]">
                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Spending (This Month)</h3>
                        <p className="text-3xl font-bold text-[#0F4D39] mt-2">
                            Rp {dashboardStats.gmStats.totalSpending.toLocaleString('id-ID')}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Pending Approvals</h3>
                        <p className="text-3xl font-bold text-gray-800 mt-2">
                            {dashboardStats.gmStats.pendingApprovals}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Waiting for review</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-gray-500 text-sm font-medium mb-2">Spending by Department</h3>
                        <div className="h-32">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={dashboardStats.gmStats.spendingByDept} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={30} 
                                        outerRadius={50} 
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {dashboardStats.gmStats.spendingByDept.map((entry, index) => (
                                            <PieCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value?: number | string) => `Rp ${Number(value ?? 0).toLocaleString('id-ID')}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Store Stats */}
            {dashboardStats?.storeStats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Items to Fulfill</h3>
                            <p className="text-3xl font-bold text-gray-800 mt-2">
                                {dashboardStats.storeStats.itemsToFulfill}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Approved requests ready for pickup</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                            <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Low Stock Alerts</h3>
                            <p className="text-3xl font-bold text-red-600 mt-2">
                                {dashboardStats.storeStats.lowStockItems.length}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Items below minimum level</p>
                        </div>
                    </div>

                    {/* Low Stock Table */}
                    {dashboardStats.storeStats.lowStockItems.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700">Low Stock Inventory</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Min Level</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {dashboardStats.storeStats.lowStockItems.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                                                <td className="px-4 py-2 text-sm text-right text-red-600 font-bold">{item.currentStock}</td>
                                                <td className="px-4 py-2 text-sm text-right text-gray-500">{item.minStockLevel}</td>
                                                <td className="px-4 py-2 text-sm text-gray-500">{item.unit}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(user?.role === 'HR' || user?.role === 'GM' || user?.role === 'ADMIN' || user?.role === 'SUPERVISOR' || user?.role === 'HOD' || user?.role === 'PHOTOGRAPHER_HOD' || user?.role === 'MERCHANDISE_HOD' || user?.role === 'MERCHANDISE_SPV') && (
                <div className="space-y-8">
                    {/* Recap Cards */}
                    {recapStats && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#0F4D39]">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Overtime</h3>
                                        <p className="text-2xl font-bold text-[#0F4D39] mt-1">{recapStats.overtimeHours} Hours</p>
                                        <p className="text-xs text-gray-400 mt-1">{recapStats.period}</p>
                                    </div>
                                    <Clock className="w-8 h-8 text-[#0F4D39]/20" />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Total Check-ins</h3>
                                        <p className="text-2xl font-bold text-gray-800 mt-1">{recapStats.attendanceCount}</p>
                                        <p className="text-xs text-gray-400 mt-1">{recapStats.period}</p>
                                    </div>
                                    <Users className="w-8 h-8 text-blue-500/20" />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Leaves Taken</h3>
                                        <p className="text-2xl font-bold text-gray-800 mt-1">{recapStats.requests.leave}</p>
                                        <p className="text-xs text-gray-400 mt-1">{recapStats.period}</p>
                                    </div>
                                    <Calendar className="w-8 h-8 text-orange-500/20" />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">Sick / Permission</h3>
                                        <p className="text-2xl font-bold text-gray-800 mt-1">{recapStats.requests.sick + recapStats.requests.permission}</p>
                                        <p className="text-xs text-gray-400 mt-1">{recapStats.period}</p>
                                    </div>
                                    <Activity className="w-8 h-8 text-red-500/20" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 1. Attendance by Department */}
                        <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Daily Attendance Rate by Department</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceStats} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="department" type="category" width={100} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="percentage" name="Attendance %" fill="#0F4D39" radius={[0, 4, 4, 0]}>
                                        {attendanceStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.percentage < 50 ? '#ef4444' : '#0F4D39'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Frequent Latecomers */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Top Frequent Latecomers (Last 30 Days)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dept</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Late Count</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {lateEmployees.map((emp) => (
                                        <tr key={emp.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600 font-bold">{emp.lateCount}</td>
                                        </tr>
                                    ))}
                                    {lateEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">No late records found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. Request Trends */}
                    <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Leave & Permission Trends (Last 6 Months)</h3>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={requestTrends}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="SICK" name="Sick" stroke="#ef4444" strokeWidth={2} />
                                    <Line type="monotone" dataKey="PERMISSION" name="Permission" stroke="#f59e0b" strokeWidth={2} />
                                    <Line type="monotone" dataKey="LEAVE" name="Annual Leave" stroke="#3b82f6" strokeWidth={2} />
                                    <Line type="monotone" dataKey="EXTERNAL_DUTY" name="External Duty" stroke="#8b5cf6" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 4. Approved History Detail */}
                    <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">Detailed Approved History (Izin, Cuti, etc.)</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Path</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {approvedHistory.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{item.employeeName}</div>
                                                <div className="text-xs text-gray-500">{item.department}</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    item.type === 'SICK' ? 'bg-red-100 text-red-800' :
                                                    item.type === 'LEAVE' ? 'bg-blue-100 text-blue-800' :
                                                    item.type === 'PERMISSION' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-purple-100 text-purple-800'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {new Date(item.startDate).toLocaleDateString('id-ID')} - {new Date(item.endDate).toLocaleDateString('id-ID')}
                                                </div>
                                                <div className="text-xs text-gray-500">{item.quantity} days/hours</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-gray-500 max-w-xs truncate" title={item.reason}>
                                                    {item.reason}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col space-y-1">
                                                    {item.approvals.length > 0 ? (
                                                        item.approvals.map((app, idx) => (
                                                            <div key={idx} className="flex items-center text-xs text-green-600">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
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
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                                                No fully approved requests found in this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
}
