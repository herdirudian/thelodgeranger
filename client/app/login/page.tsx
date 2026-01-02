"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Mail, Lock, ArrowRight, Loader2, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Reset Password State
  const [resetStep, setResetStep] = useState(0); // 0: Login, 1: Email, 2: Code, 3: New Password
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // UI State
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const res = await api.post("/auth/signin", { email, password });
      login(res.data.accessToken, res.data);
    } catch (err: any) {
      console.error("Login Error Details:", err.response?.data);
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
        await api.post("/auth/forgot-password", { email: resetEmail });
        setSuccess("Verification code sent to your email.");
        setResetStep(2);
    } catch (err: any) {
        setError(err.response?.data?.message || "Failed to send code.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
        await api.post("/auth/verify-reset-code", { email: resetEmail, code: resetCode });
        setSuccess("Code verified. Please enter new password.");
        setResetStep(3);
    } catch (err: any) {
        setError(err.response?.data?.message || "Invalid code.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
        await api.post("/auth/reset-password", { email: resetEmail, code: resetCode, newPassword });
        setSuccess("Password reset successfully. Please login.");
        setResetStep(0);
        // Clear reset state
        setResetEmail("");
        setResetCode("");
        setNewPassword("");
    } catch (err: any) {
        setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F4D39] relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>

      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md relative z-10 mx-4 animate-in fade-in zoom-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="The Lodge" className="h-24 w-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 text-center">
                {resetStep === 0 ? "Welcome Back" : 
                 resetStep === 1 ? "Reset Password" :
                 resetStep === 2 ? "Verify Code" : "New Password"}
            </h1>
            <p className="text-gray-500 text-sm mt-1 text-center">
                {resetStep === 0 ? "Sign in to The Lodge Ranger" :
                 resetStep === 1 ? "Enter your email to receive a code" :
                 resetStep === 2 ? "Enter the 6-digit code sent to your email" : "Create a new secure password"}
            </p>
        </div>

        {/* Alerts */}
        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                {error}
            </div>
        )}
        {success && (
            <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-6 text-sm flex items-center gap-2 border border-green-100 animate-in slide-in-from-top-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                {success}
            </div>
        )}

        {/* Forms */}
        {resetStep === 0 && (
            <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Email Address</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Mail className="h-5 w-5" />
                    </div>
                    <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all bg-gray-50 focus:bg-white"
                    placeholder="name@company.com"
                    required
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Password</label>
                    <button type="button" onClick={() => { setResetStep(1); setError(""); setSuccess(""); }} className="text-xs text-[#0F4D39] hover:underline font-medium">Forgot password?</button>
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Lock className="h-5 w-5" />
                    </div>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                    required
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-[#0F4D39]/20 text-sm font-bold text-white bg-[#0F4D39] hover:bg-[#0a3628] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4D39] transition-all disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : <><ArrowRight className="w-4 h-4" /> Sign In</>}
            </button>
            </form>
        )}

        {resetStep === 1 && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Email Address</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Mail className="h-5 w-5" />
                        </div>
                        <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all bg-gray-50 focus:bg-white"
                        placeholder="name@company.com"
                        required
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-[#0F4D39]/20 text-sm font-bold text-white bg-[#0F4D39] hover:bg-[#0a3628] transition-all disabled:opacity-70"
                >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <>Send Code</>}
                </button>
                <button type="button" onClick={() => setResetStep(0)} className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-2 flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
            </form>
        )}

        {resetStep === 2 && (
             <form onSubmit={handleVerifyCode} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">Verification Code</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <input
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all bg-gray-50 focus:bg-white tracking-widest text-center text-lg font-bold"
                        placeholder="000000"
                        maxLength={6}
                        required
                        />
                    </div>
                    <p className="text-xs text-gray-500 text-center">Check your email {resetEmail} for the code.</p>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-[#0F4D39]/20 text-sm font-bold text-white bg-[#0F4D39] hover:bg-[#0a3628] transition-all disabled:opacity-70"
                >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : <>Verify Code</>}
                </button>
                 <button type="button" onClick={() => setResetStep(1)} className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-2 flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Change Email
                </button>
            </form>
        )}

        {resetStep === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">New Password</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <KeyRound className="h-5 w-5" />
                        </div>
                        <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all bg-gray-50 focus:bg-white"
                        placeholder="••••••••"
                        required
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-[#0F4D39]/20 text-sm font-bold text-white bg-[#0F4D39] hover:bg-[#0a3628] transition-all disabled:opacity-70"
                >
                    {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting...</> : <>Reset Password</>}
                </button>
            </form>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} The Lodge Maribaya. All rights reserved.
        </p>
      </div>
    </div>
  );
}
