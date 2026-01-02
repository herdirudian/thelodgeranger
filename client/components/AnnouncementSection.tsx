"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { format } from "date-fns";
import { 
    Megaphone, 
    Calendar, 
    FileText, 
    Image as ImageIcon, 
    Trash2, 
    Plus, 
    X, 
    Upload,
    ExternalLink,
    Edit2
} from "lucide-react";

interface Announcement {
    id: number;
    title: string;
    date: string;
    description: string;
    imageUrl?: string;
    pdfUrl?: string;
    author: {
        name: string;
        role: string;
    };
    targetType: string;
    targetIds?: any;
    createdAt: string;
}

interface User {
    id: number;
    name: string;
    role: string;
    department?: string;
}

export default function AnnouncementSection() {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [description, setDescription] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    
    // Target State
    const [targetType, setTargetType] = useState("ALL"); // ALL, ROLE, USER
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [userList, setUserList] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const isAuthorized = user?.role === 'HR' || user?.role === 'GM';

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    // Fetch user list when "USER" target type is selected
    useEffect(() => {
        if (targetType === 'USER' && userList.length === 0 && isAuthorized) {
            fetchUsers();
        }
    }, [targetType, isAuthorized]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await api.get("/users"); 
            setUserList(res.data);
        } catch (error) {
            console.error("Error fetching users:", error);
            // Fallback for demo if API fails or returns nothing
            // setUserList([{id: 1, name: "Test User", role: "STAFF"}]); 
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await api.get("/announcements");
            setAnnouncements(res.data);
        } catch (error) {
            console.error("Error fetching announcements:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (announcement: Announcement) => {
        setEditingId(announcement.id);
        setTitle(announcement.title);
        setDate(format(new Date(announcement.date), "yyyy-MM-dd"));
        setDescription(announcement.description);
        setTargetType(announcement.targetType);
        
        if (announcement.targetType === 'ROLE' && announcement.targetIds) {
            try {
                const roles = JSON.parse(announcement.targetIds);
                setSelectedRoles(Array.isArray(roles) ? roles : []);
            } catch (e) { setSelectedRoles([]); }
        } else {
            setSelectedRoles([]);
        }

        if (announcement.targetType === 'USER' && announcement.targetIds) {
             try {
                const ids = JSON.parse(announcement.targetIds);
                setSelectedUsers(Array.isArray(ids) ? ids.map((id: string) => parseInt(id)) : []);
            } catch (e) { setSelectedUsers([]); }
        } else {
            setSelectedUsers([]);
        }

        setShowForm(true);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setTitle("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setDescription("");
        setImageFile(null);
        setPdfFile(null);
        setTargetType("ALL");
        setSelectedRoles([]);
        setSelectedUsers([]);
        setShowForm(false);
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append("title", title);
            formData.append("date", date);
            formData.append("description", description);
            if (imageFile) formData.append("image", imageFile);
            if (pdfFile) formData.append("pdf", pdfFile);

            // Target data
            formData.append("targetType", targetType);
            let targetIds = null;
            if (targetType === 'ROLE') targetIds = selectedRoles;
            if (targetType === 'USER') targetIds = selectedUsers;
            
            if (targetIds) {
                formData.append("targetIds", JSON.stringify(targetIds));
            }

            if (editingId) {
                await api.put(`/announcements/${editingId}`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            } else {
                await api.post("/announcements", formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            }

            // Reset form and refresh list
            resetForm();
            fetchAnnouncements();
        } catch (error) {
            console.error("Error creating/updating announcement:", error);
            alert("Failed to save announcement.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this announcement?")) return;

        try {
            await api.delete(`/announcements/${id}`);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            console.error("Error deleting announcement:", error);
            alert("Failed to delete announcement.");
        }
    };

    const toggleRole = (role: string) => {
        setSelectedRoles(prev => 
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const toggleUser = (userId: number) => {
        setSelectedUsers(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    if (loading) return <div className="p-4 text-center">Loading announcements...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-white">
                <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-orange-600" />
                    <h2 className="font-semibold text-gray-800">Pengumuman</h2>
                </div>
                {isAuthorized && (
                    <button 
                        onClick={() => {
                            if (showForm) {
                                resetForm();
                            } else {
                                setShowForm(true);
                            }
                        }}
                        className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition flex items-center gap-1"
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showForm ? "Batal" : "Buat Baru"}
                    </button>
                )}
            </div>

            {/* Creation Form */}
            {showForm && (
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-700">
                                {editingId ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
                            </h3>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Judul Pengumuman</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                required
                            />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                                <input 
                                    type="date" 
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    required
                                />
                            </div>
                            
                            {/* Target Audience Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kirim Ke</label>
                                <select 
                                    value={targetType}
                                    onChange={(e) => setTargetType(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="ALL">Semua (All)</option>
                                    <option value="ROLE">Berdasarkan Role (All HOD/Staff)</option>
                                    <option value="USER">Pilihan User Tertentu (Specific)</option>
                                </select>
                            </div>
                        </div>

                        {/* Conditional Inputs for Target */}
                        {targetType === 'ROLE' && (
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Role:</label>
                                <div className="flex gap-4">
                                    {['HOD', 'STAFF', 'HR', 'GM'].map(role => (
                                        <label key={role} className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedRoles.includes(role)}
                                                onChange={() => toggleRole(role)}
                                                className="rounded text-orange-600 focus:ring-orange-500"
                                            />
                                            <span className="text-sm">{role}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {targetType === 'USER' && (
                            <div className="p-3 bg-white rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih User:</label>
                                {loadingUsers ? (
                                    <p className="text-xs text-gray-500">Loading users...</p>
                                ) : userList.length === 0 ? (
                                    <p className="text-xs text-red-500">Tidak ada user ditemukan.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {userList.map(u => (
                                            <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedUsers.includes(u.id)}
                                                    onChange={() => toggleUser(u.id)}
                                                    className="rounded text-orange-600 focus:ring-orange-500"
                                                />
                                                <span className="text-sm truncate" title={u.name}>{u.name} ({u.role})</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gambar (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                                    />
                                </div>
                                {editingId && !imageFile && (
                                    <p className="text-xs text-gray-500 mt-1">Biarkan kosong jika tidak ingin mengubah gambar.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">PDF Document (Optional)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        accept="application/pdf"
                                        onChange={(e) => setPdfFile(e.target.files ? e.target.files[0] : null)}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                                    />
                                </div>
                                {editingId && !pdfFile && (
                                    <p className="text-xs text-gray-500 mt-1">Biarkan kosong jika tidak ingin mengubah PDF.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 gap-2">
                            <button 
                                type="button"
                                onClick={resetForm}
                                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={submitting}
                                className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                            >
                                {submitting ? "Menyimpan..." : (editingId ? "Simpan Perubahan" : "Post Pengumuman")}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            <div className="divide-y divide-gray-100">
                {announcements.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Belum ada pengumuman saat ini.
                    </div>
                ) : (
                    announcements.map((announcement) => (
                        <div key={announcement.id} className="p-4 hover:bg-gray-50 transition group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg">{announcement.title}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {format(new Date(announcement.date), "dd MMM yyyy")}
                                        </span>
                                        <span>•</span>
                                        <span>Oleh: {announcement.author.name} ({announcement.author.role})</span>
                                        {/* Target Badge */}
                                        {announcement.targetType !== 'ALL' && (
                                            <>
                                                <span>•</span>
                                                <span className="text-orange-600 text-xs px-2 py-0.5 bg-orange-50 rounded-full border border-orange-100">
                                                    {announcement.targetType === 'ROLE' ? 'Group Tertentu' : 'Private'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isAuthorized && (
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                                        <button 
                                            onClick={() => handleEdit(announcement)}
                                            className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition"
                                            title="Edit Pengumuman"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(announcement.id)}
                                            className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition"
                                            title="Hapus Pengumuman"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <p className="text-gray-600 mb-4 whitespace-pre-wrap">{announcement.description}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {announcement.imageUrl && (
                                    <a 
                                        href={`http://localhost:5000${announcement.imageUrl}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="block group relative rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-200"
                                    >
                                        <div className="h-48 w-full bg-gray-100 relative">
                                            <img 
                                                src={`http://localhost:5000${announcement.imageUrl}`} 
                                                alt={announcement.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2 shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                    <ExternalLink className="w-4 h-4 text-gray-700" />
                                                    <span className="text-sm font-medium text-gray-700">Buka Gambar</span>
                                                </div>
                                            </div>
                                        </div>
                                    </a>
                                )}

                                {announcement.pdfUrl && (
                                    <a 
                                        href={`http://localhost:5000${announcement.pdfUrl}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="block group relative rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-200"
                                    >
                                        <div className="h-48 bg-gray-50 relative border-b border-gray-100 group-hover:bg-gray-100 transition-colors">
                                            <div className="absolute inset-0 overflow-hidden opacity-50 pointer-events-none">
                                                <object
                                                    data={`http://localhost:5000${announcement.pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                                    type="application/pdf"
                                                    className="w-full h-[150%] -mt-10" // Trick to show top part without toolbar
                                                >
                                                </object>
                                            </div>
                                            
                                            {/* Clean Overlay */}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] group-hover:bg-white/40 transition-all">
                                                <div className="p-3 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                                    <FileText className="w-6 h-6 text-red-600" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">Lihat Dokumen PDF</span>
                                                <span className="text-xs text-gray-500 mt-1">Klik untuk membuka</span>
                                            </div>
                                        </div>
                                    </a>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
