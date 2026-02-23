"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { ClipboardList, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function OnboardingWidget() {
    const [progress, setProgress] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasTasks, setHasTasks] = useState(false);

    useEffect(() => {
        const fetchOnboarding = async () => {
            try {
                const res = await api.get('/onboarding/me');
                const tasks = res.data.tasks || [];
                
                if (tasks.length > 0) {
                    setHasTasks(true);
                    const completed = tasks.filter((t: any) => t.isCompleted).length;
                    const percent = Math.round((completed / tasks.length) * 100);
                    setProgress(percent);
                }
            } catch (error) {
                // If 404 or other error, assume no tasks or not authorized (e.g. not staff)
                console.log("No onboarding tasks found or error fetching");
            } finally {
                setLoading(false);
            }
        };

        fetchOnboarding();
    }, []);

    if (loading || !hasTasks) return null;
    
    // Don't show if 100% complete? 
    // Maybe show a "Good Job" card for a while? 
    // For now, let's always show it if tasks exist, so they can refer back.
    
    const isComplete = progress === 100;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        <ClipboardList size={20} />
                    </div>
                    <h3 className="font-bold text-gray-800">Onboarding Checklist</h3>
                </div>
                <Link href="/my-onboarding" className="text-sm font-medium text-[#0F4D39] hover:underline flex items-center">
                    Buka Checklist <ChevronRight size={16} />
                </Link>
            </div>

            {isComplete ? (
                <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3 border border-green-100">
                    <CheckCircle2 className="text-green-600" size={24} />
                    <div>
                        <p className="font-bold text-green-800">Onboarding Selesai!</p>
                        <p className="text-sm text-green-600">Semua checklist telah terpenuhi.</p>
                    </div>
                </div>
            ) : (
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-sm text-gray-500">Progress Anda</span>
                        <span className="text-lg font-bold text-[#0F4D39]">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div 
                            className="bg-[#0F4D39] h-2.5 rounded-full transition-all duration-1000" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Segera lengkapi data administrasi dan fasilitas Anda.</p>
                </div>
            )}
        </div>
    );
}
