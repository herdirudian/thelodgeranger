"use client";
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Circle } from 'lucide-react';

export default function MyOnboardingPage() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const res = await api.get('/onboarding/me');
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = async (taskId: number, currentStatus: boolean) => {
        try {
            // Optimistic update
            const newData = {...data};
            const taskIndex = newData.tasks.findIndex((t:any) => t.id === taskId);
            if(taskIndex >= 0) {
                newData.tasks[taskIndex].isCompleted = !currentStatus;
                setData(newData);
            }

            await api.put(`/onboarding/task/${taskId}`, {
                isCompleted: !currentStatus
            });
        } catch (error) {
            console.error(error);
            fetchTasks(); // Revert on error
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
        </div>
    );

    if (!data || data.tasks.length === 0) return (
        <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-gray-700">Tidak ada data Onboarding</h2>
            <p className="text-gray-500 mt-2">Hubungi HRD jika Anda adalah karyawan baru.</p>
            <button 
                onClick={() => router.push('/dashboard')}
                className="mt-4 bg-[#0F4D39] text-white px-4 py-2 rounded-lg"
            >
                Kembali ke Dashboard
            </button>
        </div>
    );

    // Group by category
    const grouped = data.tasks.reduce((acc: any, task: any) => {
        if (!acc[task.category]) acc[task.category] = [];
        acc[task.category].push(task);
        return acc;
    }, {});

    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((t:any) => t.isCompleted).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen">
            <button 
                onClick={() => router.push('/dashboard')}
                className="flex items-center text-gray-600 mb-6 hover:text-gray-900"
            >
                <ArrowLeft size={20} className="mr-2" /> Kembali ke Dashboard
            </button>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-t-4 border-[#0F4D39]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Selamat Datang, {data.user.name.split(' ')[0]}!</h1>
                        <p className="text-gray-500">Berikut adalah status onboarding Anda. Mohon konfirmasi ke HRD jika sudah menyelesaikan tugas.</p>
                    </div>
                    <div className="text-left md:text-right w-full md:w-auto bg-green-50 p-3 rounded-lg border border-green-100">
                         <span className="text-xs text-green-700 font-bold uppercase tracking-wider">Progress Anda</span>
                         <p className="text-3xl font-bold text-[#0F4D39]">{progress}%</p>
                    </div>
                </div>
                
                <div className="mt-6 flex items-center gap-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                         <div 
                            className="bg-gradient-to-r from-emerald-500 to-[#0F4D39] h-3 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-right">{completedTasks}/{totalTasks}</span>
                </div>
            </div>

            <div className="space-y-6">
                {Object.keys(grouped).map((category) => (
                    <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b font-bold text-gray-700 uppercase text-sm tracking-wide flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#0F4D39]"></div>
                            {category}
                        </div>
                        <div className="divide-y divide-gray-100">
                            {grouped[category].map((task: any) => (
                                <div 
                                    key={task.id} 
                                    className={`p-4 flex items-start gap-4 transition-colors ${task.isCompleted ? 'bg-green-50/30' : ''}`}
                                >
                                    <div className={`mt-1 transition-colors ${task.isCompleted ? 'text-green-600' : 'text-gray-300'}`}>
                                        {task.isCompleted ? <CheckCircle size={24} className="fill-green-100" /> : <Circle size={24} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium transition-all ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                            {task.task}
                                        </p>
                                        {task.notes && <p className="text-sm text-gray-500 mt-1 italic">{task.notes}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
