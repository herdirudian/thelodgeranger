"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatWibDate, formatWibTime } from "@/lib/wibHelpers";
import {
  PackageSearch,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  MapPin,
  User,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Printer,
  Camera,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
  X,
  UploadCloud,
  Check,
  Building,
  Layers,
  Archive,
  Gift,
  Flame,
  ArrowRight
} from "lucide-react";
import clsx from "clsx";

interface LostAndFoundItem {
  id: number;
  registrationNo: string;
  foundDate: string;
  foundLocation: string;
  finderName: string;
  finderDept: string;
  finderUserId?: number | null;
  category: "VALUABLE" | "HIGH_PERSONAL" | "GENERAL" | "LOW_VALUE" | "PERISHABLE_SEALED" | "PERISHABLE_UNSEALED";
  itemType?: string | null;
  description: string;
  photoUrl?: string | null;
  storageLocation: string;
  expiryDate: string;
  status: "STORED" | "CLAIMED" | "UNCLAIMED";
  claimedDate?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  handoverProofUrl?: string | null;
  handoverStaff?: string | null;
  handoverNotes?: string | null;
  finalAction?: "RETURNED_TO_FINDER" | "DONATED" | "DISPOSED" | null;
  finalActionDate?: string | null;
  finalActionNotes?: string | null;
  finalActionStaff?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: number; name: string; role: string };
  finderUser?: { id: number; name: string; department: string };
}

interface Stats {
  total: number;
  stored: number;
  expiringSoon: number;
  claimed: number;
  unclaimed: number;
}

const CATEGORY_MAP: Record<string, { label: string; retention: string; badgeColor: string; description: string }> = {
  VALUABLE: {
    label: "Valuable Items (Sangat Berharga)",
    retention: "10 Bulan",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    description: "HP, Laptop, Kamera, Dompet, Paspor/ID, Uang Tunai, Emas, Kunci Kendaraan, TWS"
  },
  HIGH_PERSONAL: {
    label: "High-Personal Items (Pribadi Penting)",
    retention: "4 Bulan",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Kacamata Resep, Dokumen/Berkas, Flashdisk/Harddisk, Alat Bantu Dengar, Obat Resep"
  },
  GENERAL: {
    label: "General / Non-Valuable (Umur Panjang)",
    retention: "3 Bulan",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    description: "Pakaian, Jaket, Topi, Sepatu, Mukena, Tumbler, Payung, Tas/Ransel, Helm, Powerbank"
  },
  LOW_VALUE: {
    label: "Low-Value / Accessories (Aksesoris)",
    retention: "1 Bulan",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Kacamata Fashion, Ikat Rambut, Kabel USB, Masker Kain, Bros, Gantungan Kunci, Case HP"
  },
  PERISHABLE_SEALED: {
    label: "Perishable - Sealed (Makanan Tersegel)",
    retention: "3 Hari (Maksimal)",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    description: "Oleh-oleh kemasan utuh, Minuman botol tersegel, Susu kemasan, Makanan kaleng"
  },
  PERISHABLE_UNSEALED: {
    label: "Perishable - Unsealed (Makanan Terbuka)",
    retention: "24 Jam (Maksimal)",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    description: "Sisa makanan/minuman cafe terbuka, Buah potong, Es krim, Makanan basah"
  }
};

const LOCATION_SUGGESTIONS = [
  "Funicular Area",
  "Wahana Swing",
  "Zip Bike Area",
  "Toilet Utama",
  "Toilet Depan",
  "Camping Area / Camp 03",
  "The Mulberry Cafe",
  "Resto Dapur Desa",
  "Sky Tree / Omah Bamboo",
  "Lobby Utama / Ticketing",
  "Area Parkir Atas",
  "Area Parkir Bawah",
  "Mushola",
  "Kids Playground"
];

export default function LostAndFoundPage() {
  const { user } = useAuth();

  // Data states
  const [items, setItems] = useState<LostAndFoundItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, stored: 0, expiringSoon: 0, claimed: 0, unclaimed: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showFinalActionModal, setShowFinalActionModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostAndFoundItem | null>(null);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    foundDate: "",
    foundLocation: "",
    finderName: "",
    finderDept: "",
    category: "VALUABLE" as keyof typeof CATEGORY_MAP,
    itemType: "",
    description: "",
    photoUrl: "",
    storageLocation: "Lemari Khusus L&F (Terkunci)"
  });

  const [claimData, setClaimData] = useState({
    ownerName: "",
    ownerPhone: "",
    claimedDate: "",
    handoverProofUrl: "",
    handoverStaff: "",
    handoverNotes: ""
  });

  const [finalActionData, setFinalActionData] = useState({
    finalAction: "RETURNED_TO_FINDER" as "RETURNED_TO_FINDER" | "DONATED" | "DISPOSED",
    finalActionDate: "",
    finalActionNotes: "",
    finalActionStaff: ""
  });

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch items & statistics
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [itemsRes, statsRes] = await Promise.all([
        api.get("/lost-and-found", {
          params: {
            search: search.trim() || undefined,
            status: statusFilter !== "ALL" ? statusFilter : undefined,
            category: categoryFilter !== "ALL" ? categoryFilter : undefined
          }
        }),
        api.get("/lost-and-found/stats")
      ]);

      setItems(itemsRes.data.items || []);
      setStats(statsRes.data || { total: 0, stored: 0, expiringSoon: 0, claimed: 0, unclaimed: 0 });
    } catch (err: any) {
      console.error("Error fetching Lost & Found data:", err);
      setErrorMsg(err.response?.data?.message || "Gagal memuat data Lost & Found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, categoryFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Helper to open Add Modal
  const handleOpenAddModal = () => {
    const now = new Date();
    const nowString = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setFormData({
      foundDate: nowString,
      foundLocation: "",
      finderName: user?.name || "",
      finderDept: user?.department || "Customer Care",
      category: "VALUABLE",
      itemType: "",
      description: "",
      photoUrl: "",
      storageLocation: "Lemari Khusus L&F (Terkunci)"
    });
    setShowAddModal(true);
  };

  // Handle category change in Add Form to suggest storage location
  const handleCategoryChange = (cat: keyof typeof CATEGORY_MAP) => {
    let suggestedStorage = "Rak Gudang L&F";
    if (cat === "VALUABLE") {
      suggestedStorage = "Lemari Khusus L&F (Terkunci)";
    } else if (cat === "PERISHABLE_SEALED" || cat === "PERISHABLE_UNSEALED") {
      suggestedStorage = "Chiller / Area Khusus Penyimpanan Makanan";
    }

    setFormData({
      ...formData,
      category: cat,
      storageLocation: suggestedStorage
    });
  };

  // Upload handler for item photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setFormData(prev => ({ ...prev, photoUrl: res.data.url }));
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengunggah foto");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Upload handler for handover proof photo
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/upload", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setClaimData(prev => ({ ...prev, handoverProofUrl: res.data.url }));
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengunggah bukti serah terima");
    } finally {
      setUploadingProof(false);
    }
  };

  // Handle Add Item Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.foundLocation || !formData.finderName || !formData.description) {
      alert("Mohon lengkapi area penemuan, nama penemu, dan deskripsi barang.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/lost-and-found", formData);
      alert(res.data.message || "Barang temuan berhasil didaftarkan");
      setShowAddModal(false);
      await fetchData();

      // Open print tag modal immediately for user convenience
      if (res.data.item) {
        setSelectedItem(res.data.item);
        setShowPrintModal(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mendaftarkan barang temuan");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Open Claim Modal
  const handleOpenClaimModal = (item: LostAndFoundItem) => {
    setSelectedItem(item);
    const now = new Date();
    const nowString = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setClaimData({
      ownerName: item.ownerName || "",
      ownerPhone: item.ownerPhone || "",
      claimedDate: nowString,
      handoverProofUrl: item.handoverProofUrl || "",
      handoverStaff: user?.name || "",
      handoverNotes: ""
    });
    setShowClaimModal(true);
  };

  // Submit Claim
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!claimData.ownerName || !claimData.ownerPhone || !claimData.handoverStaff) {
      alert("Mohon lengkapi nama pemilik, nomor kontak, dan petugas penyerah.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put(`/lost-and-found/${selectedItem.id}/claim`, claimData);
      alert(res.data.message || "Barang berhasil diserahkan kepada tamu");
      setShowClaimModal(false);
      setShowDetailModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal memproses penyerahan barang");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Open Final Action Modal
  const handleOpenFinalActionModal = (item: LostAndFoundItem) => {
    setSelectedItem(item);
    const now = new Date();
    const nowString = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setFinalActionData({
      finalAction: item.finalAction || "RETURNED_TO_FINDER",
      finalActionDate: nowString,
      finalActionNotes: "",
      finalActionStaff: user?.name || ""
    });
    setShowFinalActionModal(true);
  };

  // Submit Final Action
  const handleFinalActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const res = await api.put(`/lost-and-found/${selectedItem.id}/final-action`, finalActionData);
      alert(res.data.message || "Tindakan akhir berhasil dicatat");
      setShowFinalActionModal(false);
      setShowDetailModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mencatat tindakan akhir");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data barang temuan ini?")) return;
    try {
      const res = await api.delete(`/lost-and-found/${id}`);
      alert(res.data.message || "Data berhasil dihapus");
      setShowDetailModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal menghapus data barang");
    }
  };

  // Print Tag
  const handlePrintTag = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (items.length === 0) {
      alert("Tidak ada data untuk diekspor");
      return;
    }

    const headers = [
      "No. Registrasi (L&F ID)",
      "Tanggal Ditemukan",
      "Area Penemuan",
      "Nama Penemu",
      "Departemen Penemu",
      "Kategori Barang",
      "Jenis Barang",
      "Deskripsi & Kondisi",
      "Tempat Penyimpanan",
      "Batas Waktu Simpan",
      "Status",
      "Nama Pemilik",
      "No. HP Pemilik",
      "Tanggal Pengambilan",
      "Petugas Penyerah",
      "Tindakan Akhir",
      "Tanggal Tindakan Akhir",
      "Catatan Tindakan Akhir"
    ];

    const rows = items.map(it => [
      it.registrationNo,
      formatWibDate(it.foundDate) + " " + formatWibTime(it.foundDate),
      it.foundLocation,
      it.finderName,
      it.finderDept,
      CATEGORY_MAP[it.category]?.label || it.category,
      it.itemType || "-",
      it.description.replace(/"/g, '""'),
      it.storageLocation,
      formatWibDate(it.expiryDate),
      it.status === "STORED" ? "Disimpan" : it.status === "CLAIMED" ? "Dikembalikan" : "Kadaluarsa/Unclaimed",
      it.ownerName || "-",
      it.ownerPhone || "-",
      it.claimedDate ? formatWibDate(it.claimedDate) : "-",
      it.handoverStaff || "-",
      it.finalAction === "RETURNED_TO_FINDER" ? "Diambil Penemu" : it.finalAction === "DONATED" ? "Dihibahkan" : it.finalAction === "DISPOSED" ? "Pemusnahan" : "-",
      it.finalActionDate ? formatWibDate(it.finalActionDate) : "-",
      it.finalActionNotes ? it.finalActionNotes.replace(/"/g, '""') : "-"
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map(r => r.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Lost_and_Found_The_Lodge_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for image URL
  const publicBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";
  const getFullImageUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${publicBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Sisa waktu kalkulasi
  const getRemainingDays = (expiryDate: string) => {
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4D39] uppercase tracking-wider mb-1">
                <span>The Lodge Maribaya</span>
                <span>•</span>
                <span>SOP Penanganan Barang Temuan</span>
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
                <PackageSearch className="text-[#0F4D39]" size={28} />
                <span>Lost & Found Management</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                Pencatatan akurat barang temuan maksimal 1x24 jam, pelabelan fisik terstandarisasi, verifikasi serah terima tamu, dan monitoring masa simpan berkala.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F4D39]"
                title="Unduh data dalam format CSV"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0F4D39]"
              >
                <Plus size={18} />
                <span>Input Barang Temuan</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Disimpan (Aktif)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.stored}</p>
                <span className="text-[11px] text-gray-500">Di lemari & rak L&F</span>
              </div>
              <div className="w-11 h-11 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
                <Archive size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Segera Kadaluarsa</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{stats.expiringSoon}</p>
                <span className="text-[11px] text-amber-700">Masa simpan &lt; 7 hari</span>
              </div>
              <div className="w-11 h-11 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <AlertTriangle size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Dikembalikan</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.claimed}</p>
                <span className="text-[11px] text-emerald-700">Sudah diambil tamu</span>
              </div>
              <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Lewat Masa Simpan</p>
                <p className="text-2xl font-bold text-rose-700 mt-1">{stats.unclaimed}</p>
                <span className="text-[11px] text-gray-500">Siap tindakan akhir</span>
              </div>
              <div className="w-11 h-11 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
                <Clock size={22} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search form */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Cari ID barang, nama barang, area, penemu, atau pemilik..."
                className="w-full pl-10 pr-24 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4D39] focus:border-[#0F4D39]"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-colors"
              >
                Cari
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">Semua Kategori Risiko</option>
                <option value="VALUABLE">Valuable Items (10 Bulan)</option>
                <option value="HIGH_PERSONAL">High-Personal Items (4 Bulan)</option>
                <option value="GENERAL">General Items (3 Bulan)</option>
                <option value="LOW_VALUE">Low-Value / Accessories (1 Bulan)</option>
                <option value="PERISHABLE_SEALED">Perishable Tersegel (3 Hari)</option>
                <option value="PERISHABLE_UNSEALED">Perishable Terbuka (24 Jam)</option>
              </select>

              {/* Status Filter */}
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0F4D39]"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Semua Status</option>
                <option value="STORED">Disimpan (Active)</option>
                <option value="EXPIRING_SOON">Segera Kadaluarsa (&lt; 7 Hari)</option>
                <option value="CLAIMED">Dikembalikan ke Tamu</option>
                <option value="UNCLAIMED">Kadaluarsa / Unclaimed</option>
              </select>

              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    viewMode === "table" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  )}
                  aria-label="Tampilan Tabel"
                >
                  Tabel
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    viewMode === "cards" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
                  )}
                  aria-label="Tampilan Grid Kartu"
                >
                  Grid
                </button>
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchData}
                className="p-2 border border-gray-300 text-gray-600 hover:text-gray-900 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                title="Muat ulang data"
              >
                <RefreshCw size={15} className={clsx(loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-xl border border-gray-200">
            <RefreshCw className="animate-spin text-[#0F4D39] mx-auto mb-3" size={28} />
            <p className="text-sm font-medium text-gray-600">Memuat data Lost & Found...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center bg-white rounded-xl border border-red-200">
            <AlertTriangle className="text-red-500 mx-auto mb-2" size={32} />
            <p className="text-sm font-medium text-red-700">{errorMsg}</p>
            <button
              onClick={fetchData}
              className="mt-3 px-4 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold"
            >
              Coba Lagi
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <PackageSearch className="text-gray-400 mx-auto mb-3" size={40} />
            <h3 className="text-base font-bold text-gray-800">Belum Ada Barang Temuan</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Tidak ada data yang sesuai dengan pencarian atau filter yang dipilih. Tambahkan barang temuan baru melalui tombol di atas.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-[#0F4D39] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2"
            >
              <Plus size={16} /> Input Barang Temuan
            </button>
          </div>
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">ID & Foto</th>
                    <th className="p-3.5">Nama & Deskripsi Barang</th>
                    <th className="p-3.5">Kategori & Risiko</th>
                    <th className="p-3.5">Area & Penemu</th>
                    <th className="p-3.5">Tempat Simpan</th>
                    <th className="p-3.5">Masa Berlaku</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => {
                    const daysRemaining = getRemainingDays(item.expiryDate);
                    const isExpiringSoon = item.status === "STORED" && daysRemaining <= 7 && daysRemaining >= 0;
                    const isPastExpiry = item.status === "STORED" && daysRemaining < 0;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        {/* ID & Foto */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {item.photoUrl ? (
                              <img
                                src={getFullImageUrl(item.photoUrl)}
                                alt={item.itemType || "Barang"}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-2xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                                <PackageSearch size={20} />
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-[#0F4D39] font-mono text-xs block">
                                {item.registrationNo}
                              </span>
                              <span className="text-[11px] text-gray-500 block mt-0.5">
                                {formatWibDate(item.foundDate)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Nama & Deskripsi */}
                        <td className="p-3.5 max-w-xs">
                          <p className="font-bold text-gray-900 text-xs">
                            {item.itemType || "Barang Tanpa Nama"}
                          </p>
                          <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        </td>

                        {/* Kategori & Risiko */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={clsx(
                              "px-2.5 py-1 rounded-full text-[10px] font-semibold border inline-block",
                              CATEGORY_MAP[item.category]?.badgeColor || "bg-gray-100 text-gray-800"
                            )}
                          >
                            {CATEGORY_MAP[item.category]?.label.split(" (")[0]}
                          </span>
                          <span className="block text-[10px] text-gray-500 mt-1">
                            SOP: {CATEGORY_MAP[item.category]?.retention}
                          </span>
                        </td>

                        {/* Area & Penemu */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-gray-900 font-medium">
                            <MapPin size={12} className="text-gray-400" />
                            <span>{item.foundLocation}</span>
                          </div>
                          <span className="text-[11px] text-gray-500 block mt-0.5">
                            Penemu: {item.finderName} ({item.finderDept})
                          </span>
                        </td>

                        {/* Tempat Simpan */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[11px] font-medium border border-gray-200">
                            {item.storageLocation}
                          </span>
                        </td>

                        {/* Masa Berlaku */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-medium text-gray-800 block">
                            s/d {formatWibDate(item.expiryDate)}
                          </span>
                          {item.status === "STORED" && (
                            <span
                              className={clsx(
                                "text-[10px] font-semibold block mt-0.5",
                                isPastExpiry
                                  ? "text-rose-600"
                                  : isExpiringSoon
                                  ? "text-amber-600"
                                  : "text-emerald-700"
                              )}
                            >
                              {isPastExpiry
                                ? "Lewat masa simpan"
                                : isExpiringSoon
                                ? `Sisa ${daysRemaining} hari lagi`
                                : `Aktif (sisa ${daysRemaining} hari)`}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 whitespace-nowrap">
                          {item.status === "STORED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                              Disimpan
                            </span>
                          ) : item.status === "CLAIMED" ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check size={11} />
                                Dikembalikan
                              </span>
                              <span className="block text-[10px] text-gray-500 mt-1">
                                Tamu: {item.ownerName}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                Unclaimed
                              </span>
                              {item.finalAction && (
                                <span className="block text-[10px] text-gray-500 mt-0.5 font-medium">
                                  {item.finalAction === "RETURNED_TO_FINDER"
                                    ? "Diambil Penemu"
                                    : item.finalAction === "DONATED"
                                    ? "Dihibahkan"
                                    : "Pemusnahan"}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="p-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowDetailModal(true);
                              }}
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                              title="Lihat Detail Barang"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setShowPrintModal(true);
                              }}
                              className="p-1.5 text-gray-600 hover:text-[#0F4D39] hover:bg-green-50 rounded-md transition-colors"
                              title="Cetak Tag Label Fisik"
                            >
                              <Printer size={16} />
                            </button>

                            {item.status === "STORED" && (
                              <button
                                type="button"
                                onClick={() => handleOpenClaimModal(item)}
                                className="px-2.5 py-1 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1"
                                title="Serahkan ke Tamu (Klaim)"
                              >
                                <CheckCircle2 size={12} /> Klaim
                              </button>
                            )}

                            {item.status === "UNCLAIMED" && !item.finalAction && (
                              <button
                                type="button"
                                onClick={() => handleOpenFinalActionModal(item)}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold transition-colors"
                                title="Tindakan Akhir Barang Tidak Diambil"
                              >
                                Tindakan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => {
              const daysRemaining = getRemainingDays(item.expiryDate);
              const isExpiringSoon = item.status === "STORED" && daysRemaining <= 7 && daysRemaining >= 0;
              const isPastExpiry = item.status === "STORED" && daysRemaining < 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col hover:border-gray-300 transition-all"
                >
                  {/* Card Image */}
                  <div className="relative h-44 bg-gray-100 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {item.photoUrl ? (
                      <img
                        src={getFullImageUrl(item.photoUrl)}
                        alt={item.itemType || "Foto Barang"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center gap-1">
                        <PackageSearch size={36} />
                        <span className="text-xs">Foto tidak tersedia</span>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-xs font-mono font-bold text-[#0F4D39] shadow-xs">
                      {item.registrationNo}
                    </span>
                    <span
                      className={clsx(
                        "absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold border shadow-xs",
                        CATEGORY_MAP[item.category]?.badgeColor || "bg-gray-100 text-gray-800"
                      )}
                    >
                      {CATEGORY_MAP[item.category]?.label.split(" (")[0]}
                    </span>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-900 text-sm">{item.itemType || "Barang Temuan"}</h3>
                        <span
                          className={clsx(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            item.status === "STORED"
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : item.status === "CLAIMED"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          )}
                        >
                          {item.status === "STORED" ? "Disimpan" : item.status === "CLAIMED" ? "Diklaim" : "Unclaimed"}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-2 mt-1.5">{item.description}</p>

                      <div className="mt-3.5 space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">{item.foundLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">Penemu: {item.finderName} ({item.finderDept})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Archive size={13} className="text-gray-400 shrink-0" />
                          <span className="truncate">Simpan: {item.storageLocation}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400 shrink-0" />
                          <span>Masa Simpan: {formatWibDate(item.expiryDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDetailModal(true);
                        }}
                        className="text-xs font-semibold text-[#0F4D39] hover:underline flex items-center gap-1"
                      >
                        Detail Lengkap <ChevronRight size={14} />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowPrintModal(true);
                          }}
                          className="p-1.5 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md"
                          title="Cetak Tag"
                        >
                          <Printer size={15} />
                        </button>
                        {item.status === "STORED" && (
                          <button
                            type="button"
                            onClick={() => handleOpenClaimModal(item)}
                            className="px-2.5 py-1 bg-[#0F4D39] text-white rounded-md text-xs font-semibold hover:bg-[#0b3829]"
                          >
                            Klaim
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH BARANG TEMUAN (INITIAL INTAKE) */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <PackageSearch className="text-[#0F4D39]" size={22} />
                  <span>Input Barang Temuan (Initial Intake)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Wajib dicatat maksimal 1x24 jam setelah penemuan sesuai SOP The Lodge Maribaya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal & Waktu Ditemukan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal & Waktu Ditemukan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={formData.foundDate}
                    onChange={e => setFormData({ ...formData, foundDate: e.target.value })}
                  />
                </div>

                {/* Nama / Jenis Barang */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama / Jenis Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: iPhone 13 Hitam, Dompet Kulit Coklat"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={formData.itemType}
                    onChange={e => setFormData({ ...formData, itemType: e.target.value })}
                  />
                </div>
              </div>

              {/* Area Penemuan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Area Penemuan <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Ketik lokasi spesifik, contoh: Wahana Swing, Toilet Utama Camp 03"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={formData.foundLocation}
                    onChange={e => setFormData({ ...formData, foundLocation: e.target.value })}
                  />
                  {/* Quick pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {LOCATION_SUGGESTIONS.slice(0, 6).map(loc => (
                      <button
                        type="button"
                        key={loc}
                        onClick={() => setFormData({ ...formData, foundLocation: loc })}
                        className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] transition-colors"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Penemu & Dept */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Staf Penemu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama staf yang menemukan"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={formData.finderName}
                    onChange={e => setFormData({ ...formData, finderName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Departemen Penemu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Customer Care, Security, Housekeeping"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={formData.finderDept}
                    onChange={e => setFormData({ ...formData, finderDept: e.target.value })}
                  />
                </div>
              </div>

              {/* Kategori Barang & Klasifikasi Risiko */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-gray-900">
                  Klasifikasi Kategori & Masa Simpan SOP <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white font-medium focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  value={formData.category}
                  onChange={e => handleCategoryChange(e.target.value as keyof typeof CATEGORY_MAP)}
                >
                  <option value="VALUABLE">1. Valuable Items (Barang Sangat Berharga) - Masa Simpan 10 Bulan</option>
                  <option value="HIGH_PERSONAL">2. High-Personal Items (Barang Pribadi Penting) - Masa Simpan 4 Bulan</option>
                  <option value="GENERAL">3. General / Non-Valuable (Barang Umur Panjang) - Masa Simpan 3 Bulan</option>
                  <option value="LOW_VALUE">4. Low-Value / Accessories (Aksesoris Ringan) - Masa Simpan 1 Bulan</option>
                  <option value="PERISHABLE_SEALED">5. Perishable - Sealed (Makanan Tersegel) - Masa Simpan 3 Hari</option>
                  <option value="PERISHABLE_UNSEALED">6. Perishable - Unsealed (Makanan Terbuka) - Masa Simpan 24 Jam</option>
                </select>
                <p className="text-[11px] text-gray-600">
                  <span className="font-semibold">Contoh barang: </span>
                  {CATEGORY_MAP[formData.category]?.description}
                </p>
              </div>

              {/* Tempat Penyimpanan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tempat Penyimpanan Fisik <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lemari Khusus L&F (Terkunci), Rak No. 2 Gudang L&F"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  required
                  value={formData.storageLocation}
                  onChange={e => setFormData({ ...formData, storageLocation: e.target.value })}
                />
                <span className="text-[11px] text-gray-500 mt-0.5 block">
                  SOP: Valuable Items wajib disimpan dalam lemari terkunci. Standard items di rak tersusun rapi.
                </span>
              </div>

              {/* Deskripsi & Kondisi Barang */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Deskripsi Fisik & Kondisi Obyektif <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan kondisi secara detail: warna, merek, nomor seri jika ada, goresan/kerusakan fisik..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Upload Foto Barang */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Foto Dokumentasi Barang
                </label>
                <div className="flex items-center gap-4">
                  {formData.photoUrl ? (
                    <div className="relative w-20 h-20 rounded-lg border border-gray-300 overflow-hidden group">
                      <img
                        src={getFullImageUrl(formData.photoUrl)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, photoUrl: "" })}
                        className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus foto"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full border-2 border-dashed border-gray-300 hover:border-[#0F4D39] rounded-xl p-4 text-center cursor-pointer transition-colors bg-gray-50/50">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                      />
                      <div className="flex flex-col items-center gap-1 text-gray-600">
                        {uploadingPhoto ? (
                          <RefreshCw size={22} className="animate-spin text-[#0F4D39]" />
                        ) : (
                          <Camera size={22} className="text-[#0F4D39]" />
                        )}
                        <span className="text-xs font-medium">
                          {uploadingPhoto ? "Mengunggah foto..." : "Klik untuk upload foto barang"}
                        </span>
                        <span className="text-[11px] text-gray-400">PNG, JPG, JPEG (Maks. 20MB)</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingPhoto}
                  className="px-5 py-2 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>Simpan & Buat Label Tag</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DETAIL BARANG LENGKAP */}
      {/* ========================================================================= */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#0F4D39] bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    {selectedItem.registrationNo}
                  </span>
                  <span
                    className={clsx(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      selectedItem.status === "STORED"
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : selectedItem.status === "CLAIMED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-rose-100 text-rose-800 border border-rose-200"
                    )}
                  >
                    {selectedItem.status === "STORED" ? "Disimpan" : selectedItem.status === "CLAIMED" ? "Diklaim Tamu" : "Unclaimed"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-1">
                  {selectedItem.itemType || "Barang Temuan"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Photo & Key Info */}
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                {selectedItem.photoUrl ? (
                  <img
                    src={getFullImageUrl(selectedItem.photoUrl)}
                    alt={selectedItem.itemType || "Foto Barang"}
                    className="w-full sm:w-48 h-48 object-cover rounded-xl border border-gray-200 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-full sm:w-48 h-48 bg-gray-100 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-gray-400 shrink-0">
                    <PackageSearch size={32} />
                    <span className="text-xs mt-1">Tidak ada foto</span>
                  </div>
                )}

                <div className="space-y-3 flex-1 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Kategori & Klasifikasi Risiko:</span>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {CATEGORY_MAP[selectedItem.category]?.label || selectedItem.category}
                    </p>
                    <span className="text-[11px] text-gray-500">
                      Standar Retensi SOP: {CATEGORY_MAP[selectedItem.category]?.retention}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 font-medium">Area Penemuan:</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedItem.foundLocation}</p>
                  </div>

                  <div>
                    <span className="text-gray-500 font-medium">Staf Penemu:</span>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {selectedItem.finderName} ({selectedItem.finderDept})
                    </p>
                  </div>

                  <div>
                    <span className="text-gray-500 font-medium">Tempat Penyimpanan Fisik:</span>
                    <p className="font-semibold text-gray-900 mt-0.5">{selectedItem.storageLocation}</p>
                  </div>
                </div>
              </div>

              {/* Deskripsi Barang */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-xs font-bold text-gray-800 block mb-1">
                  Deskripsi & Kondisi Obyektif:
                </span>
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>

              {/* Retention Timeline */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Waktu Ditemukan:</span>
                  <span className="font-semibold text-gray-900">
                    {formatWibDate(selectedItem.foundDate)} {formatWibTime(selectedItem.foundDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Batas Waktu Penyimpanan (Expiry Date):</span>
                  <span className="font-bold text-gray-900">{formatWibDate(selectedItem.expiryDate)}</span>
                </div>
                {selectedItem.status === "STORED" && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600">Status Masa Simpan:</span>
                    <span className="font-bold text-[#0F4D39]">
                      {getRemainingDays(selectedItem.expiryDate) >= 0
                        ? `Sisa ${getRemainingDays(selectedItem.expiryDate)} hari lagi`
                        : "Telah melewati batas waktu penyimpanan"}
                    </span>
                  </div>
                )}
              </div>

              {/* Handover Details if CLAIMED */}
              {selectedItem.status === "CLAIMED" && (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 text-xs space-y-3">
                  <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Informasi Serah Terima Kepada Tamu
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-800">
                    <div>
                      <span className="text-gray-500">Nama Pemilik:</span>
                      <p className="font-semibold">{selectedItem.ownerName || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">No. HP / Kontak:</span>
                      <p className="font-semibold">{selectedItem.ownerPhone || "-"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Tanggal Pengambilan:</span>
                      <p className="font-semibold">
                        {selectedItem.claimedDate ? formatWibDate(selectedItem.claimedDate) : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Petugas Penyerah:</span>
                      <p className="font-semibold">{selectedItem.handoverStaff || "-"}</p>
                    </div>
                  </div>

                  {selectedItem.handoverProofUrl && (
                    <div className="pt-2 border-t border-emerald-200/60">
                      <span className="text-gray-500 block mb-1">Bukti Dokumentasi / Resi:</span>
                      <img
                        src={getFullImageUrl(selectedItem.handoverProofUrl)}
                        alt="Bukti Serah Terima"
                        className="w-32 h-32 object-cover rounded-lg border border-emerald-300"
                      />
                    </div>
                  )}

                  {selectedItem.handoverNotes && (
                    <div className="pt-2 border-t border-emerald-200/60">
                      <span className="text-gray-500 block mb-0.5">Catatan Serah Terima:</span>
                      <p className="text-gray-700">{selectedItem.handoverNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Final Action Details if UNCLAIMED */}
              {selectedItem.status === "UNCLAIMED" && selectedItem.finalAction && (
                <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 text-xs space-y-3">
                  <h4 className="font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Tindakan Akhir Barang Tidak Diambil (Unclaimed)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-800">
                    <div>
                      <span className="text-gray-500">Keputusan Akhir:</span>
                      <p className="font-bold text-rose-800">
                        {selectedItem.finalAction === "RETURNED_TO_FINDER"
                          ? "Diambil Penemu (Apresiasi Kejujuran)"
                          : selectedItem.finalAction === "DONATED"
                          ? "Dihibahkan (Program Sosial Perusahaan)"
                          : "Pemusnahan (Barang Rusak / Kadaluarsa)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Tanggal Eksekusi:</span>
                      <p className="font-semibold">
                        {selectedItem.finalActionDate ? formatWibDate(selectedItem.finalActionDate) : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Petugas Eksekusi:</span>
                      <p className="font-semibold">{selectedItem.finalActionStaff || "-"}</p>
                    </div>
                  </div>
                  {selectedItem.finalActionNotes && (
                    <div className="pt-2 border-t border-rose-200/60">
                      <span className="text-gray-500 block mb-0.5">Catatan Persetujuan:</span>
                      <p className="text-gray-700">{selectedItem.finalActionNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer size={15} /> Cetak Label Tag
                </button>

                {(user?.role === "HR" || user?.role === "GM" || user?.role === "ADMIN") && (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedItem.status === "STORED" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenClaimModal(selectedItem);
                    }}
                    className="px-4 py-2 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 size={15} /> Serahkan ke Tamu (Klaim)
                  </button>
                )}

                {selectedItem.status === "UNCLAIMED" && !selectedItem.finalAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenFinalActionModal(selectedItem);
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Proses Tindakan Akhir
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-white rounded-lg text-xs font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KLAIM & PENYERAHAN BARANG (HANDOVER & CLAIM) */}
      {/* ========================================================================= */}
      {showClaimModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-700" size={20} />
                  <span>Serah Terima Barang ke Tamu (Klaim)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: <span className="font-mono font-bold text-[#0F4D39]">{selectedItem.registrationNo}</span> - {selectedItem.itemType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClaimModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleClaimSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-bold block mb-0.5">Verifikasi Kepemilikan Wajib:</span>
                Minta tamu menjelaskan ciri-ciri fisik spesifik sebelum menyerahkan barang fisik.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nama Lengkap Pemilik / Tamu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Rizka Natasya"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  required
                  value={claimData.ownerName}
                  onChange={e => setClaimData({ ...claimData, ownerName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nomor HP / WhatsApp Pemilik <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  required
                  value={claimData.ownerPhone}
                  onChange={e => setClaimData({ ...claimData, ownerPhone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tanggal & Jam Pengambilan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={claimData.claimedDate}
                    onChange={e => setClaimData({ ...claimData, claimedDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nama Petugas Penyerah <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama staf FO / Supervisor"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                    required
                    value={claimData.handoverStaff}
                    onChange={e => setClaimData({ ...claimData, handoverStaff: e.target.value })}
                  />
                </div>
              </div>

              {/* Bukti Serah Terima Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Bukti Serah Terima (Foto Bersama Tamu / Foto Resi Kurir)
                </label>
                {claimData.handoverProofUrl ? (
                  <div className="relative w-28 h-28 rounded-lg border border-gray-300 overflow-hidden group">
                    <img
                      src={getFullImageUrl(claimData.handoverProofUrl)}
                      alt="Bukti Serah Terima"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setClaimData({ ...claimData, handoverProofUrl: "" })}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="w-full border-2 border-dashed border-gray-300 hover:border-[#0F4D39] rounded-xl p-3 text-center cursor-pointer block bg-gray-50/50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProofUpload}
                      disabled={uploadingProof}
                    />
                    <div className="flex flex-col items-center gap-1 text-gray-600">
                      {uploadingProof ? (
                        <RefreshCw size={18} className="animate-spin text-[#0F4D39]" />
                      ) : (
                        <UploadCloud size={18} className="text-[#0F4D39]" />
                      )}
                      <span className="text-xs font-medium">
                        {uploadingProof ? "Mengunggah..." : "Upload foto serah terima / resi kurir"}
                      </span>
                    </div>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan Serah Terima (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan, identitas KTP/SIM yang diperiksa, no resi kurir..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  value={claimData.handoverNotes}
                  onChange={e => setClaimData({ ...claimData, handoverNotes: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingProof}
                  className="px-5 py-2 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>Konfirmasi Penyerahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TINDAKAN AKHIR BARANG UNCLAIMED */}
      {/* ========================================================================= */}
      {showFinalActionModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={20} />
                  <span>Tindakan Akhir Barang Unclaimed</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: <span className="font-mono font-bold text-[#0F4D39]">{selectedItem.registrationNo}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFinalActionModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFinalActionSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                Barang ini telah melewati batas waktu masa penyimpanan ({CATEGORY_MAP[selectedItem.category]?.retention}). Tentukan tindakan akhir sesuai persetujuan Manajemen / Supervisor.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pilih Tindakan Akhir <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="finalAction"
                      value="RETURNED_TO_FINDER"
                      checked={finalActionData.finalAction === "RETURNED_TO_FINDER"}
                      onChange={() => setFinalActionData({ ...finalActionData, finalAction: "RETURNED_TO_FINDER" })}
                      className="mt-0.5 text-[#0F4D39] focus:ring-[#0F4D39]"
                    />
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">1. Diambil Penemu</span>
                      <span className="text-[11px] text-gray-500">
                        Diserahkan kepada staf penemu asli ({selectedItem.finderName}) sebagai bentuk apresiasi atas kejujuran.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="finalAction"
                      value="DONATED"
                      checked={finalActionData.finalAction === "DONATED"}
                      onChange={() => setFinalActionData({ ...finalActionData, finalAction: "DONATED" })}
                      className="mt-0.5 text-[#0F4D39] focus:ring-[#0F4D39]"
                    />
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">2. Dihibahkan</span>
                      <span className="text-[11px] text-gray-500">
                        Disumbangkan melalui program sosial perusahaan atau panti asuhan.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="finalAction"
                      value="DISPOSED"
                      checked={finalActionData.finalAction === "DISPOSED"}
                      onChange={() => setFinalActionData({ ...finalActionData, finalAction: "DISPOSED" })}
                      className="mt-0.5 text-[#0F4D39] focus:ring-[#0F4D39]"
                    />
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">3. Pemusnahan</span>
                      <span className="text-[11px] text-gray-500">
                        Khusus untuk makanan/minuman kadaluarsa, obat-obatan, atau barang yang rusak parah.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nama Petugas Eksekusi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  required
                  value={finalActionData.finalActionStaff}
                  onChange={e => setFinalActionData({ ...finalActionData, finalActionStaff: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catatan Persetujuan Manajemen (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan nomor berita acara, persetujuan HOD/GM..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-[#0F4D39] focus:outline-none"
                  value={finalActionData.finalActionNotes}
                  onChange={e => setFinalActionData({ ...finalActionData, finalActionNotes: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowFinalActionModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>Simpan Tindakan Akhir</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CETAK LABEL TAG FISIK (PRINT TAG) */}
      {/* ========================================================================= */}
      {showPrintModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 print:hidden">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Printer size={16} /> Label Tag Fisik Barang Temuan
              </h3>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Tag Card */}
            <div className="p-6 bg-white" ref={printRef}>
              <div className="border-2 border-dashed border-gray-800 rounded-xl p-5 bg-white space-y-3">
                <div className="flex items-center justify-between border-b-2 border-gray-800 pb-2">
                  <div>
                    <h2 className="font-extrabold text-sm text-gray-900 tracking-tight">THE LODGE MARIBAYA</h2>
                    <p className="text-[10px] text-gray-600 uppercase font-semibold">Lost & Found Tagging Label</p>
                  </div>
                  <div className="w-9 h-9 border border-gray-300 rounded flex items-center justify-center">
                    <PackageSearch size={22} className="text-[#0F4D39]" />
                  </div>
                </div>

                <div className="text-center py-1 bg-gray-100 rounded border border-gray-300">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block">Nomor Registrasi L&F</span>
                  <span className="font-mono text-lg font-black text-gray-900 tracking-wider">
                    {selectedItem.registrationNo}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-800">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Nama Barang:</span>
                    <span className="font-bold">{selectedItem.itemType || "Barang Temuan"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Kategori:</span>
                    <span className="font-semibold">{selectedItem.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Tgl Ditemukan:</span>
                    <span className="font-semibold">{formatWibDate(selectedItem.foundDate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Lokasi Temu:</span>
                    <span className="font-semibold">{selectedItem.foundLocation}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Penemu & Dept:</span>
                    <span className="font-semibold">{selectedItem.finderName} ({selectedItem.finderDept})</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Tempat Simpan:</span>
                    <span className="font-bold text-[#0F4D39]">{selectedItem.storageLocation}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-300 flex justify-between items-end text-[9px] text-gray-500">
                  <span>Masa Simpan s/d: {formatWibDate(selectedItem.expiryDate)}</span>
                  <span className="border-t border-gray-400 pt-1 px-3 text-center">Paraf Staf</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-3 print:hidden">
                Gunting dan tempelkan label ini pada plastik / pembungkus barang fisik.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-white rounded-lg text-xs font-medium"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handlePrintTag}
                className="px-4 py-2 bg-[#0F4D39] hover:bg-[#0b3829] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Printer size={15} /> Cetak Label Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
