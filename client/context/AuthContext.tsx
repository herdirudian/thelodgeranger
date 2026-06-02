"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'STAFF' | 'HOD' | 'HR' | 'GM' | 'FINANCE' | 'STORE' | 'SUPERVISOR' | 'ADMIN' | 'MERCHANDISE_STAFF' | 'MERCHANDISE_HOD' | 'MERCHANDISE_SPV' | 'PHOTOGRAPHER_STAFF' | 'PHOTOGRAPHER_HOD';
  employmentType?: 'CONTRACT' | 'DAILY_WORKER';
  department?: string;
  checklistTemplateId?: number | null;
  leaveQuota?: number;
  pdo?: number;
  whatsappNumber?: string | null;
  whatsappVerifiedAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
      try {
          const token = localStorage.getItem('token');
          if (!token) return;
          
          const res = await api.get('/auth/me');
          const userData = res.data;
          
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
      } catch (err) {
          console.error("Failed to refresh user data", err);
          // If token is invalid, maybe logout? For now just log error.
      }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
          setUser(JSON.parse(userData));
          // Fetch fresh data in background
          await refreshUser();
        }
        setLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  }, [router]);

  // Auto Logout Logic
  useEffect(() => {
    if (!user) return;

    // 30 minutes in milliseconds
    const INACTIVITY_LIMIT = 30 * 60 * 1000; 
    let lastActivity = Date.now();

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const checkActivity = () => {
      if (Date.now() - lastActivity > INACTIVITY_LIMIT) {
        alert("Sesi Anda telah berakhir karena tidak aktif selama 30 menit. Silakan login kembali.");
        logout();
      }
    };

    const intervalId = setInterval(checkActivity, 60000); // Check every minute

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
