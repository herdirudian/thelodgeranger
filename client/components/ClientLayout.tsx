"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const pathname = usePathname();
    const isPublicPage = pathname === "/login" || pathname === "/customer-feedback";
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

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
                            {user && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsProfileOpen(prev => !prev)}
                                        className="w-9 h-9 rounded-full bg-[#0F4D39] text-white flex items-center justify-center font-bold text-sm"
                                    >
                                        {user.name?.charAt(0)}
                                    </button>
                                    {isProfileOpen && (
                                        <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
                                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                                                <div className="w-10 h-10 rounded-full bg-[#0F4D39] text-white flex items-center justify-center font-bold">
                                                    {user.name?.charAt(0)}
                                                </div>
                                                <div className="text-sm">
                                                    <p className="font-semibold text-gray-900">{user.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {user.role}
                                                        {user.department ? ` • ${user.department}` : ""}
                                                    </p>
                                                    {user.email && (
                                                        <p className="text-xs text-gray-400 mt-0.5">
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="px-4 py-3 space-y-1 border-b border-gray-100">
                                                {typeof user.leaveQuota !== "undefined" && (
                                                    <p className="text-xs text-gray-500">
                                                        Kuota Cuti: <span className="font-semibold text-gray-700">{user.leaveQuota} hari</span>
                                                    </p>
                                                )}
                                                {typeof user.pdo !== "undefined" && (
                                                    <p className="text-xs text-gray-500">
                                                        PDO: <span className="font-semibold text-gray-700">{user.pdo} hari</span>
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={logout}
                                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <span>Logout</span>
                                                <LogOut size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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
                flex-1 flex flex-col transition-all duration-300 
                ${!isPublicPage ? 'pt-20 md:pt-0 md:ml-64 bg-gray-50' : 'w-full'}
            `}>
                {!isPublicPage && (
                    <div className="hidden md:flex sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4 justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 capitalize">
                            {pathname === '/' ? 'Dashboard' : pathname.split('/')[1] || 'Dashboard'}
                        </h2>
                        <div className="flex items-center gap-6">
                            <NotificationBell />
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsProfileOpen(prev => !prev)}
                                    className="flex items-center gap-3 pl-6 border-l border-gray-200 hover:bg-gray-50 rounded-full py-1 pr-2"
                                >
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                                        <p className="text-xs text-gray-500">{user?.role}</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-[#0F4D39] text-white flex items-center justify-center font-bold">
                                        {user?.name?.charAt(0)}
                                    </div>
                                </button>
                                {isProfileOpen && (
                                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30">
                                        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                                            <div className="w-10 h-10 rounded-full bg-[#0F4D39] text-white flex items-center justify-center font-bold">
                                                {user?.name?.charAt(0)}
                                            </div>
                                            <div className="text-sm">
                                                <p className="font-semibold text-gray-900">{user?.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {user?.role}
                                                    {user?.department ? ` • ${user.department}` : ""}
                                                </p>
                                                {user?.email && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {user.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 space-y-1 border-b border-gray-100">
                                            {typeof user?.leaveQuota !== "undefined" && (
                                                <p className="text-xs text-gray-500">
                                                    Kuota Cuti: <span className="font-semibold text-gray-700">{user?.leaveQuota} hari</span>
                                                </p>
                                            )}
                                            {typeof user?.pdo !== "undefined" && (
                                                <p className="text-xs text-gray-500">
                                                    PDO: <span className="font-semibold text-gray-700">{user?.pdo} hari</span>
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={logout}
                                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                        >
                                            <span>Logout</span>
                                            <LogOut size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <div className={`${!isPublicPage ? "p-4 md:p-8" : ""} flex-1`}>
                    {children}
                </div>

                {!isPublicPage && (
                    <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-200 bg-gray-50 mt-auto">
                        <p className="font-semibold text-[#0F4D39]">The Lodge Ranger System</p>
                        <p>Versi 1.0.1</p>
                    </footer>
                )}
            </main>
        </div>
    );
}
