"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Home, Calendar, Clock, FileText, User, LogOut, MessageSquare, ShoppingBag, ClipboardList, BookOpen, ClipboardCheck, Users, Archive, BarChart2, Target, Shield, Award, AlertCircle } from 'lucide-react';
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
  ];

  const canManageSchedule = user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_HOD' || user.role === 'MERCHANDISE_SPV';
  if (canManageSchedule) {
      links.push({ name: 'Manage Schedule', href: '/schedule/manage', icon: ClipboardList });
  }

  links.push({ name: 'Requests', href: '/requests', icon: FileText });
   links.push({ name: 'Procurement', href: '/procurement', icon: ShoppingBag });

   const privileged = user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN';
  const isSecurity = String(user.department || '').toLowerCase() === 'security';
  if (privileged || isSecurity) {
      links.push({ name: 'Security Dashboard', href: '/security-dashboard', icon: Shield });
  }

  if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'HOD' || user.role === 'PHOTOGRAPHER_HOD' || user.role === 'MERCHANDISE_HOD' || user.role === 'MERCHANDISE_SPV' || user.role === 'STAFF') {
      links.push({ name: 'Analytics', href: '/analytics', icon: BarChart2 });
  }

  // Voting hidden as it is completed
  // links.push({ name: 'Voting', href: '/voting', icon: Award });

  if (user.role === 'HR') {
      links.push({ name: 'Onboarding', href: '/onboarding', icon: ClipboardList });
  }

  if (user.role === 'STORE' || user.role === 'ADMIN' || user.role === 'GM' || user.role === 'FINANCE') {
      links.push({ name: 'Manual Input', href: '/manual-procurement', icon: Archive });
  }

  links.push({ name: 'The Lodge Learning', href: '/elearning', icon: BookOpen });
  links.push({ name: 'Self Assessment', href: '/self-assessment', icon: ClipboardCheck });
  links.push({ name: 'IDP', href: '/idp', icon: Target });
  links.push({ name: 'Penilaian 360', href: '/review-360', icon: Users });

  // Daily Checklist for HOD, Management, and Assigned Staff
  const canSeeChecklist = user.role.includes('HOD') || 
                         user.role.includes('SPV') || 
                         user.role === 'SUPERVISOR' || 
                         user.role === 'GM' || 
                         user.role === 'ADMIN' || 
                         user.role === 'HR' ||
                         (user.assignedChecklists && user.assignedChecklists.length > 0);
  
  if (canSeeChecklist) {
      links.push({ name: 'Daily Checklist', href: '/hod-checklist', icon: ClipboardCheck });
  }
  
  if (user.rchAccess || user.role === 'ADMIN' || user.role === 'HR' || user.role === 'GM') {
      links.push({ name: 'RCH', href: '/rch', icon: AlertCircle });
  }
  
  // Feedback menu visibility
  const hasSurveyAccess = user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN' || (user.publicSurveyAccesses && user.publicSurveyAccesses.length > 0);
  
  if (hasSurveyAccess) {
      links.push({ name: 'Feedback', href: '/feedback', icon: MessageSquare });
  }

  if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN') {
      links.push({ name: 'Admin', href: '/admin', icon: User });
      links.push({ name: 'Survey Access', href: '/admin/public-survey-access', icon: Users });
  }

  return (
    <div className="h-screen w-64 bg-[#0F4D39] text-white flex flex-col">
      <div className="p-6 text-2xl font-bold border-b border-green-800 flex flex-col items-center">
        <div className="bg-white w-24 h-24 rounded-full mb-3 shadow-lg flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="The Lodge" className="h-14 w-auto object-contain" />
        </div>
        <span className="text-lg">The Lodge Ranger</span>
      </div>
      
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
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
