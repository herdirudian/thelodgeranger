"use client";

import { useState, useEffect, Suspense } from "react";
import api from "@/lib/api";
import { Star, X, Shield, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";

function FeedbackForm() {
  const searchParams = useSearchParams();
  const staffIdParam = searchParams.get('staffId');
  
  // Staff State
  const [staffId, setStaffId] = useState(staffIdParam || "");
  const [staffName, setStaffName] = useState("");
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");

  // Ratings
  const [ratingFriendliness, setRatingFriendliness] = useState(0);
  const [ratingExplanation, setRatingExplanation] = useState(0);
  const [ratingHelpfulness, setRatingHelpfulness] = useState(0);
  const [ratingRecommend, setRatingRecommend] = useState(0);

  // Text Inputs
  const [likedAspects, setLikedAspects] = useState("");
  const [improvementAreas, setImprovementAreas] = useState("");

  // Customer Data
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Consents
  const [wantFollowUp, setWantFollowUp] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  useEffect(() => {
    if (staffIdParam) {
        setStaffId(staffIdParam);
        fetchStaffDetails(staffIdParam);
    } else {
        setIsLoadingStaff(false);
        setStaffError("Link tidak valid (ID Karyawan tidak ditemukan).");
    }
  }, [staffIdParam]);

  const fetchStaffDetails = async (id: string) => {
    try {
        const res = await api.get(`/users/public/${id}`);
        setStaffName(res.data.name);
        setIsLoadingStaff(false);
    } catch (err) {
        console.error("Error fetching staff:", err);
        setStaffError("Karyawan tidak ditemukan.");
        setIsLoadingStaff(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!staffId) {
        alert("ID Karyawan tidak valid.");
        return;
    }

    // Basic Validation
    if (!ratingFriendliness || !ratingExplanation || !ratingHelpfulness || !ratingRecommend) {
        alert("Mohon lengkapi semua penilaian bintang.");
        return;
    }
    if (!privacyConsent) {
        alert("Mohon setujui Kebijakan Privasi.");
        return;
    }

    try {
      await api.post("/feedback", {
        staffId: parseInt(staffId),
        ratingFriendliness,
        ratingExplanation,
        ratingHelpfulness,
        ratingRecommend,
        likedAspects,
        improvementAreas,
        customerName,
        customerPhone,
        customerEmail,
        wantFollowUp,
        privacyConsent,
        marketingConsent
      });
      alert("Terima kasih atas masukan Anda!");
      
      // Reset Form (Optional: or redirect)
      window.location.reload();
      
    } catch (err) {
      alert("Error submitting feedback. Please try again.");
      console.error(err);
    }
  };

  const StarRating = ({ value, onChange, label, description }: { value: number, onChange: (v: number) => void, label: string, description?: string }) => (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
        <label className="block text-sm font-bold text-gray-800 mb-1">{label}</label>
        {description && <p className="text-xs text-gray-500 mb-3">{description}</p>}
        <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => onChange(star)}
                    className="focus:outline-none transition-transform hover:scale-110"
                >
                    <Star 
                        className={`w-8 h-8 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                    />
                </button>
            ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium">
             <span>Sangat Buruk</span>
             <span>Sangat Baik</span>
        </div>
    </div>
  );

  if (isLoadingStaff) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
          </div>
      );
  }

  if (staffError) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
                  <div className="text-red-500 mb-4 text-5xl">⚠️</div>
                  <h1 className="text-xl font-bold text-gray-800 mb-2">Terjadi Kesalahan</h1>
                  <p className="text-gray-600">{staffError}</p>
                  <p className="text-xs text-gray-400 mt-4">Silakan scan ulang QR code atau hubungi staf kami.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-100 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen md:min-h-0 md:my-8 md:rounded-2xl md:shadow-xl overflow-hidden pb-12">
        {/* Header */}
        <div className="bg-[#0F4D39] text-white p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/pattern.png')] opacity-10"></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
                    <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                </div>
                <h1 className="text-xl font-bold tracking-wide">The Lodge Maribaya</h1>
                <p className="text-green-100 text-sm mt-1">Survey Kepuasan Pelanggan</p>
                
                {staffName && (
                    <div className="mt-4 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                        <p className="text-xs font-medium text-green-50">Anda menilai pelayanan:</p>
                        <p className="text-lg font-bold text-white">{staffName}</p>
                    </div>
                )}
            </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <StarRating 
                   label="1. Bagaimana keramahan dan sikap tim kami saat melayani Anda?"
                   description="(1 = Sangat mengecewakan, 5 = Sangat ramah & membantu)"
                   value={ratingFriendliness}
                   onChange={setRatingFriendliness}
               />
               
               <StarRating 
                   label="2. Apakah tim kami memberikan penjelasan produk/wahana dengan jelas dan sesuai kebutuhan Anda?"
                   description="(1 = Tidak jelas & tidak sesuai, 5 = Sangat jelas & sesuai kebutuhan)"
                   value={ratingExplanation}
                   onChange={setRatingExplanation}
               />

               <StarRating 
                   label="3. Sejauh mana pelayanan kami membantu dan menjawab kebutuhan Anda selama berkunjung?"
                   description="(1 = Tidak membantu, 5 = Sangat membantu)"
                   value={ratingHelpfulness}
                   onChange={setRatingHelpfulness}
               />

               <StarRating 
                   label="4. Seberapa besar kemungkinan Anda merekomendasikan pelayanan The Lodge Maribaya kepada keluarga atau teman?"
                   description="(1 = Tidak akan merekomendasikan, 5 = Sangat merekomendasikan)"
                   value={ratingRecommend}
                   onChange={setRatingRecommend}
               />

               <div className="space-y-2">
                   <label className="block text-sm font-medium text-gray-700">5. Hal apa yang paling Anda sukai dari pelayanan kami? (Maks. 500 karakter)</label>
                   <textarea 
                       value={likedAspects}
                       onChange={(e) => setLikedAspects(e.target.value)}
                       maxLength={500}
                       className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm"
                       rows={3}
                       placeholder="Tulis di sini..."
                   />
               </div>

               <div className="space-y-2">
                   <label className="block text-sm font-medium text-gray-700">6. Hal apa yang menurut Anda perlu kami tingkatkan agar pelayanan menjadi lebih baik? (Maks. 500 karakter)</label>
                   <textarea 
                       value={improvementAreas}
                       onChange={(e) => setImprovementAreas(e.target.value)}
                       maxLength={500}
                       className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm"
                       rows={3}
                       placeholder="Tulis di sini..."
                   />
               </div>
           
           {/* Section 3: Customer Data */}
           <div className="space-y-4">
               <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                   👤 <span className="text-base">Data Pengunjung</span>
               </h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                       <label className="block text-xs font-bold text-gray-700 uppercase">Nama Anda *</label>
                       <input 
                           type="text" 
                           required
                           value={customerName}
                           onChange={(e) => setCustomerName(e.target.value)}
                           className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent text-sm"
                           placeholder="Nama Lengkap"
                       />
                   </div>
                   <div className="space-y-1">
                       <label className="block text-xs font-bold text-gray-700 uppercase">Nomor WhatsApp *</label>
                       <input 
                           type="tel" 
                           required
                           value={customerPhone}
                           onChange={(e) => setCustomerPhone(e.target.value)}
                           className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent text-sm"
                           placeholder="08xxxxxxxxxx"
                       />
                   </div>
               </div>
               <div className="space-y-1">
                   <label className="block text-xs font-bold text-gray-700 uppercase">Email *</label>
                   <input 
                       type="email" 
                       required
                       value={customerEmail}
                       onChange={(e) => setCustomerEmail(e.target.value)}
                       className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent text-sm"
                       placeholder="email@example.com"
                   />
               </div>
           </div>

           {/* Section 4: Consents */}
           <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
               <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                   🔔 Tindak Lanjut & Persetujuan
               </h2>
               
               <label className="flex items-start gap-3 cursor-pointer group">
                   <div className="relative flex items-center">
                       <input 
                           type="checkbox" 
                           checked={wantFollowUp}
                           onChange={(e) => setWantFollowUp(e.target.checked)}
                           className="peer h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]"
                       />
                   </div>
                   <span className="text-xs text-gray-600 group-hover:text-gray-900">
                       Saya ingin mendapatkan tindak lanjut atas keluhan atau masukan yang saya sampaikan.
                   </span>
               </label>

               <label className="flex items-start gap-3 cursor-pointer group">
                   <div className="relative flex items-center">
                       <input 
                           type="checkbox" 
                           checked={privacyConsent}
                           onChange={(e) => setPrivacyConsent(e.target.checked)}
                           required
                           className="peer h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]"
                       />
                   </div>
                   <div className="flex flex-col">
                        <span className="text-xs text-gray-600 group-hover:text-gray-900">
                            Saya menyetujui pemrosesan data pribadi sesuai dengan Kebijakan Privasi The Lodge Maribaya.
                        </span>
                        <button 
                            type="button" 
                            onClick={(e) => {
                                e.preventDefault();
                                setShowPrivacyModal(true);
                            }} 
                            className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left"
                        >
                            Baca lebih lanjut
                        </button>
                   </div>
               </label>

               <label className="flex items-start gap-3 cursor-pointer group">
                   <div className="relative flex items-center">
                       <input 
                           type="checkbox" 
                           checked={marketingConsent}
                           onChange={(e) => setMarketingConsent(e.target.checked)}
                           className="peer h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]"
                       />
                   </div>
                   <div className="flex flex-col">
                        <span className="text-xs text-gray-600 group-hover:text-gray-900">
                            Saya bersedia menerima informasi promosi dan layanan after-sales dari The Lodge Maribaya.
                        </span>
                        <button 
                            type="button" 
                            onClick={(e) => {
                                e.preventDefault();
                                setShowMarketingModal(true);
                            }} 
                            className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left"
                        >
                            Baca lebih lanjut
                        </button>
                   </div>
               </label>
           </div>

           <button
                type="submit"
                className="w-full bg-[#0F4D39] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
                Kirim Penilaian
            </button>
        </form>

        {/* Privacy Policy Modal */}
        {showPrivacyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-2 text-[#0F4D39]">
                            <Shield className="w-5 h-5" />
                            <h2 className="font-bold text-lg">Kebijakan Privasi</h2>
                        </div>
                        <button 
                            onClick={() => setShowPrivacyModal(false)}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed custom-scrollbar">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                            <h3 className="font-bold text-[#0F4D39] text-base mb-2">Syarat dan Ketentuan Pemrosesan Data Pribadi</h3>
                            <p className="text-[#0F4D39]/80">
                                Untuk menjaga kenyamanan dan melindungi hak Anda sebagai pengunjung, The Lodge Maribaya memproses data pribadi berupa Nama, Nomor WhatsApp, dan Email dengan memperhatikan ketentuan berikut.
                            </p>
                        </div>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                                Persetujuan Pengguna
                            </h4>
                            <p className="pl-7">Kami akan meminta persetujuan Anda secara jelas dan sah sebelum memproses data pribadi, untuk satu atau beberapa tujuan tertentu yang telah kami sampaikan, antara lain untuk keperluan penilaian pelayanan, tindak lanjut keluhan, dan peningkatan kualitas layanan.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                                Keterbukaan Informasi
                            </h4>
                            <div className="pl-7">
                                <p className="mb-2">Setelah Anda memberikan persetujuan, kami akan menjelaskan:</p>
                                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                                    <li>Tujuan pemrosesan data pribadi</li>
                                    <li>Jenis data yang dikumpulkan dan relevansinya</li>
                                    <li>Masa penyimpanan data</li>
                                    <li>Periode dan proses pengolahan data</li>
                                    <li>Hak Anda sebagai pemilik data pribadi</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                                Pemrosesan yang Terbatas dan Sah
                            </h4>
                            <p className="pl-7">Data pribadi Anda akan diproses secara terbatas, spesifik, sah, dan transparan sesuai dengan peraturan perundang-undangan yang berlaku.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">4</span>
                                Akurasi dan Keamanan Data
                            </h4>
                            <p className="pl-7">Kami berupaya memastikan data pribadi yang kami kelola akurat, lengkap, dan terlindungi dari akses, penggunaan, atau pengungkapan yang tidak sah.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">5</span>
                                Kerahasiaan Data
                            </h4>
                            <p className="pl-7">Kerahasiaan data pribadi Anda dijaga dengan baik, dan hanya dapat diakses oleh pihak internal yang berwenang dalam lingkup operasional The Lodge Maribaya.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">6</span>
                                Pengawasan Pihak Terkait
                            </h4>
                            <p className="pl-7">Apabila terdapat pihak ketiga yang terlibat dalam pemrosesan data di bawah kendali kami, The Lodge Maribaya akan melakukan pengawasan untuk memastikan kepatuhan terhadap prinsip perlindungan data pribadi.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">7</span>
                                Langkah Keamanan Teknis dan Operasional
                            </h4>
                            <p className="pl-7">Kami menerapkan langkah-langkah teknis dan operasional yang wajar dan sesuai untuk melindungi data pribadi dari gangguan, penyalahgunaan, maupun pemrosesan yang bertentangan dengan hukum.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">8</span>
                                Masa Penyimpanan Data
                            </h4>
                            <p className="pl-7">Data pribadi yang telah Anda berikan akan disimpan selama masih diperlukan untuk tujuan pemrosesan, atau sampai Anda mengajukan permintaan penghapusan data dan/atau pencabutan persetujuan.</p>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">9</span>
                                Hak Pengguna
                            </h4>
                            <div className="pl-7">
                                <p className="mb-2">Anda berhak untuk:</p>
                                <ul className="list-disc pl-4 space-y-1 text-gray-600">
                                    <li>Mengakses data pribadi Anda</li>
                                    <li>Memperbaiki atau memperbarui data</li>
                                    <li>Meminta penghapusan data</li>
                                    <li>Mencabut persetujuan pemrosesan data</li>
                                </ul>
                            </div>
                        </section>

                        <section>
                            <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                                <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">10</span>
                                Pemberitahuan Insiden Data
                            </h4>
                            <p className="pl-7">Apabila terjadi insiden yang berpotensi mengganggu perlindungan data pribadi, kami akan memberitahukan kepada Anda dan pihak berwenang terkait dalam waktu paling lambat 3 x 24 jam sesuai ketentuan yang berlaku.</p>
                        </section>

                        <div className="mt-8 p-4 bg-gray-100 rounded-xl text-center">
                            <h4 className="font-bold text-gray-800 mb-1">Kontak Layanan Pelanggan</h4>
                            <p className="text-gray-600 text-sm mb-2">Untuk pertanyaan, pengaduan, atau permintaan terkait data pribadi, Anda dapat menghubungi Customer Care The Lodge Maribaya melalui:</p>
                            <a href="https://wa.me/628112264808" target="_blank" className="inline-flex items-center gap-2 text-[#0F4D39] font-bold text-lg hover:underline">
                                📞 0811 2264 808
                            </a>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button 
                            onClick={() => {
                                setShowPrivacyModal(false);
                                setPrivacyConsent(true);
                            }}
                            className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0a3628] transition-colors"
                        >
                            Saya Mengerti & Setuju
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* Marketing Consent Modal */}
        {showMarketingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <div className="flex items-center gap-2 text-[#0F4D39]">
                            <Lock className="w-5 h-5" />
                            <h2 className="font-bold text-lg">Syarat dan Ketentuan</h2>
                        </div>
                        <button 
                            onClick={() => setShowMarketingModal(false)}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed custom-scrollbar">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                            <h3 className="font-bold text-[#0F4D39] text-base mb-2">Penggunaan Informasi Pengunjung</h3>
                            <p className="text-[#0F4D39]/80">
                                Informasi yang Anda berikan kepada The Lodge Maribaya dapat digunakan untuk meningkatkan kualitas pelayanan dan pengalaman Anda selama berkunjung. Secara khusus, informasi tersebut dapat kami gunakan untuk:
                            </p>
                        </div>

                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span>
                                <p>Menghubungi Anda terkait pelayanan, masukan, atau tindak lanjut atas keluhan yang Anda sampaikan;</p>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span>
                                <p>Memfasilitasi partisipasi Anda dalam penilaian, rating, dan ulasan pelayanan dari tim/frontliner The Lodge Maribaya;</p>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span>
                                <p>Mengelola dan meningkatkan kualitas layanan, fasilitas, serta pengalaman pengunjung;</p>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span>
                                <p>Mengirimkan informasi, penawaran promosi, dan program khusus The Lodge Maribaya (jika Anda menyetujui);</p>
                            </li>
                            <li className="flex gap-3">
                                <span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">5</span>
                                <p>Melakukan survei kepuasan pengunjung dan riset internal guna pengembangan layanan ke depan.</p>
                            </li>
                        </ul>

                        <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-center italic text-gray-500">
                            "Seluruh penggunaan informasi dilakukan secara terbatas, aman, dan sesuai dengan kebijakan privasi serta peraturan yang berlaku."
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                        <button 
                            onClick={() => {
                                setShowMarketingModal(false);
                                setMarketingConsent(true);
                            }}
                            className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0a3628] transition-colors"
                        >
                            Saya Mengerti & Setuju
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerFeedbackPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F4D39]"></div>
        </div>
    }>
      <FeedbackForm />
    </Suspense>
  );
}
