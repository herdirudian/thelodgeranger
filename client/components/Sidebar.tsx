"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Home, Calendar, Clock, FileText, User, LogOut, MessageSquare, ShoppingBag } from 'lucide-react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';

const Sidebar = ({ onClose }: { onClose?: () => void }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Attendance', href: '/attendance', icon: Clock },
    { name: 'Schedule', href: '/schedule', icon: Calendar },
    { name: 'Requests', href: '/requests', icon: FileText },
    { name: 'Procurement', href: '/procurement', icon: ShoppingBag },
  ];

  if (user.role === 'HR' || user.role === 'GM' || user.role === 'HOD') {
      // Add more specific links if needed, e.g., "Team" or "Approvals"
      // But they are likely sub-pages or sections in dashboard/requests
  }
  
  if (user.role === 'HR' || user.role === 'GM') {
      links.push({ name: 'Feedback', href: '/feedback', icon: MessageSquare });
      links.push({ name: 'Admin', href: '/admin', icon: User });
  }

  return (
    <div className="h-full w-64 bg-[#0F4D39] text-white flex flex-col">
      <div className="p-6 text-2xl font-bold border-b border-green-800 flex flex-col items-center">
        <div className="bg-white w-24 h-24 rounded-full mb-3 shadow-lg flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="The Lodge" className="h-14 w-auto object-contain" />
        </div>
        <span className="text-lg">The Lodge Ranger</span>
      </div>
      
      <div className="flex-1 p-4 space-y-2">
        {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
                <Link 
                    key={link.name} 
                    href={link.href}
                    onClick={onClose}
                    className={clsx(
                        "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                        isActive ? "bg-white/10" : "hover:bg-white/5"
                    )}
                >
                    <Icon size={20} />
                    <span>{link.name}</span>
                </Link>
            )
        })}
      </div>

      <div className="p-4 border-t border-green-800">
        <div className="flex items-center space-x-3 mb-4">
            <div className="bg-white/20 p-2 rounded-full">
                <User size={20} />
            </div>
            <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-gray-200">{user.role}</p>
            </div>
        </div>
        <button 
            onClick={logout}
            className="flex items-center space-x-2 text-red-200 hover:text-red-100 w-full"
        >
            <LogOut size={18} />
            <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
