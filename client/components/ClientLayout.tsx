"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();
    const isPublicPage = pathname === "/login" || pathname === "/customer-feedback";
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-gray-100">
            {!isPublicPage && (
                <>
                    {/* Mobile Header */}
                    <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-4 z-20 flex items-center justify-between shadow-sm h-16">
                        <div className="flex items-center gap-2">
                             <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
                             <span className="font-bold text-[#0F4D39]">The Lodge Ranger</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <NotificationBell />
                            <button 
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Container */}
                    <div className={`
                        fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out
                        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        md:translate-x-0 md:block
                    `}>
                        <Sidebar onClose={() => setIsSidebarOpen(false)} />
                    </div>

                    {/* Overlay */}
                    {isSidebarOpen && (
                        <div 
                            className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}
                </>
            )}
            
            <main className={`
                flex-1 transition-all duration-300 
                ${!isPublicPage ? 'pt-20 md:pt-0 md:ml-64 bg-gray-50' : 'w-full'}
            `}>
                {!isPublicPage && (
                    <div className="hidden md:flex sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 capitalize">
                            {pathname === '/' ? 'Dashboard' : pathname.split('/')[1] || 'Dashboard'}
                        </h2>
                        <div className="flex items-center gap-6">
                            <NotificationBell />
                            <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                    <p className="text-xs text-gray-500">{user?.role}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-[#0F4D39] text-white flex items-center justify-center font-bold">
                                    {user?.name?.charAt(0)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
