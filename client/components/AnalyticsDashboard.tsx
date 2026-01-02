"use client";

import { useEffect, useState } from "react";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, Cell, PieChart, Pie, Cell as PieCell
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

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
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            try {
                const promises = [];
                
                // Fetch General Dashboard Stats (GM, Store, MyStats)
                promises.push(api.get("/dashboard/stats"));

                // Fetch HR Analytics only if HR or GM
                if (user.role === 'HR' || user.role === 'GM') {
                    promises.push(api.get("/analytics/attendance-stats"));
                    promises.push(api.get("/analytics/lateness"));
                    promises.push(api.get("/analytics/request-trends"));
                }

                const results = await Promise.all(promises);
                
                setDashboardStats(results[0].data);

                if (user.role === 'HR' || user.role === 'GM') {
                    setAttendanceStats(results[1].data);
                    setLateEmployees(results[2].data);
                    setRequestTrends(results[3].data);
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
                                    <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} />
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

            {/* HR Analytics (Only for HR/GM) */}
            {(user?.role === 'HR' || user?.role === 'GM') && (
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
                </div>
            )}
        </div>
    );
}
