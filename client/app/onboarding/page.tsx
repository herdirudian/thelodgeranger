"use client";
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function OnboardingDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/onboarding/stats');
            setStats(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInit = async (userId: number) => {
        try {
            if(!confirm('Mulai proses onboarding untuk karyawan ini?')) return;
            await api.post(`/onboarding/${userId}/init`);
            fetchStats();
        } catch (error) {
            alert('Error initializing');
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold mb-6 text-[#0F4D39]">Onboarding Karyawan Baru</h1>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="md:hidden divide-y">
                    {stats.map((staff) => (
                        <div key={staff.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold text-gray-900">{staff.name}</p>
                                    <p className="text-sm text-gray-500">{staff.department || '-'}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    staff.onboarding.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                    staff.onboarding.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {staff.onboarding.status}
                                </span>
                            </div>
                            <div className="mt-3 text-sm text-gray-600">
                                Mulai Kontrak: {staff.contractStartDate ? format(new Date(staff.contractStartDate), 'd MMM yyyy') : '-'}
                            </div>
                            <div className="mt-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-green-600 h-2 rounded-full transition-all"
                                            style={{ width: `${staff.onboarding.progress}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-600">{staff.onboarding.progress}%</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {staff.onboarding.completed}/{staff.onboarding.total} Tasks
                                </div>
                            </div>
                            <div className="mt-4">
                                {staff.onboarding.status === 'Not Started' ? (
                                    <button
                                        onClick={() => handleInit(staff.id)}
                                        className="w-full border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50"
                                    >
                                        Start Onboarding
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => router.push(`/onboarding/${staff.id}`)}
                                        className="w-full bg-[#0F4D39] text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[#0a3d2e]"
                                    >
                                        View Checklist
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden md:block">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 text-left">Nama</th>
                                <th className="p-4 text-left">Departemen</th>
                                <th className="p-4 text-left">Mulai Kontrak</th>
                                <th className="p-4 text-left">Progress</th>
                                <th className="p-4 text-left">Status</th>
                                <th className="p-4 text-left">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {stats.map((staff) => (
                                <tr key={staff.id} className="hover:bg-gray-50">
                                    <td className="p-4 font-medium">{staff.name}</td>
                                    <td className="p-4">{staff.department || '-'}</td>
                                    <td className="p-4">{staff.contractStartDate ? format(new Date(staff.contractStartDate), 'd MMM yyyy') : '-'}</td>
                                    <td className="p-4 w-48">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-green-600 h-2 rounded-full transition-all"
                                                    style={{ width: `${staff.onboarding.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-600">{staff.onboarding.progress}%</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {staff.onboarding.completed}/{staff.onboarding.total} Tasks
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            staff.onboarding.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                            staff.onboarding.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {staff.onboarding.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {staff.onboarding.status === 'Not Started' ? (
                                            <button 
                                                onClick={() => handleInit(staff.id)}
                                                className="text-blue-600 hover:underline text-sm font-medium"
                                            >
                                                Start Onboarding
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => router.push(`/onboarding/${staff.id}`)}
                                                className="bg-[#0F4D39] text-white px-3 py-1 rounded text-sm hover:bg-[#0a3d2e]"
                                            >
                                                View Checklist
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {stats.length === 0 && !loading && (
                    <div className="p-8 text-center text-gray-500">
                        Belum ada data karyawan baru.
                    </div>
                )}
            </div>
        </div>
    );
}
