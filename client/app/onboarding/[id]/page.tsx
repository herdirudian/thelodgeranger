"use client";
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Circle } from 'lucide-react';

export default function OnboardingDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if(id) fetchTasks();
    }, [id]);

    const fetchTasks = async () => {
        try {
            const res = await api.get(`/onboarding/${id}`);
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
            // Flatten to find task or iterate categories? 
            // Data structure from API: { user: {}, tasks: [] }
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

    if (loading) return <div className="p-8">Loading...</div>;
    if (!data) return <div className="p-8">Data not found</div>;

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
        <div className="p-8 max-w-4xl mx-auto">
            <button 
                onClick={() => router.back()}
                className="flex items-center text-gray-600 mb-6 hover:text-gray-900"
            >
                <ArrowLeft size={20} className="mr-2" /> Kembali ke Dashboard
            </button>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border-t-4 border-[#0F4D39]">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{data.user.name}</h1>
                        <p className="text-gray-500">{data.user.department}</p>
                    </div>
                    <div className="text-right">
                         <span className="text-sm text-gray-500">Progress</span>
                         <p className="text-2xl font-bold text-[#0F4D39]">{progress}%</p>
                    </div>
                </div>
                
                <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                         <div 
                            className="bg-green-600 h-3 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {Object.keys(grouped).map((category) => (
                    <div key={category} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b font-bold text-gray-700 uppercase text-sm tracking-wide">
                            {category}
                        </div>
                        <div className="divide-y">
                            {grouped[category].map((task: any) => (
                                <div 
                                    key={task.id} 
                                    className={`p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors cursor-pointer ${task.isCompleted ? 'bg-green-50/50' : ''}`}
                                    onClick={() => toggleTask(task.id, task.isCompleted)}
                                >
                                    <div className={`mt-1 text-gray-400 ${task.isCompleted ? 'text-green-600' : ''}`}>
                                        {task.isCompleted ? <CheckCircle size={24} /> : <Circle size={24} />}
                                    </div>
                                    <div className="flex-1">
                                        <p className={`font-medium ${task.isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                            {task.task}
                                        </p>
                                        {task.notes && <p className="text-sm text-gray-500 mt-1">{task.notes}</p>}
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
