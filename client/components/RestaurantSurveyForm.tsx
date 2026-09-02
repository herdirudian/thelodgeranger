"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Shield, X, Lock } from "lucide-react";

interface RestaurantSurveyFormProps {
  title: string; // e.g. "GUEST COMMENT THE PINES"
  subtitle: string; // e.g. "Guest Comment • The Pines"
  surveyType: "THE_PINES" | "THE_CAVE" | "OMAH_BAMBOO";
  thankYouMessage: string;
}

const RATING_SECTIONS = [
  {
    category: "FOOD & BEVERAGE",
    items: [
      { key: "Taste & Quality", label: "Taste & Quality" },
      { key: "Presentation", label: "Presentation" },
      { key: "Portion", label: "Portion" },
      { key: "Speed of service", label: "Speed of service" },
    ],
  },
  {
    category: "SERVICE & HOSPITALITY",
    items: [
      { key: "Friendliness", label: "Friendliness" },
      { key: "Responsiveness", label: "Responsiveness" },
      { key: "Professionalism", label: "Professionalism" },
    ],
  },
  {
    category: "AMBIENCE & COMFORT",
    items: [
      { key: "Cleanliness", label: "Cleanliness" },
      { key: "Ambience", label: "Ambience" },
    ],
  },
];

export default function RestaurantSurveyForm({
  title,
  subtitle,
  surveyType,
  thankYouMessage,
}: RestaurantSurveyFormProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Personal Info
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // Ratings (1 to 5)
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallExperience, setOverallExperience] = useState<number>(0);

  // Text inputs
  const [favoriteMenu, setFavoriteMenu] = useState("");
  const [notes, setNotes] = useState("");

  // Consents & Modals
  const [wantFollowUp, setWantFollowUp] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const handleRatingChange = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Check ratings
    const allRatingKeys = RATING_SECTIONS.flatMap((s) => s.items.map((i) => i.key));
    const missingRatings = allRatingKeys.filter((k) => !ratings[k]);
    if (missingRatings.length > 0 || !overallExperience) {
      alert("Mohon lengkapi semua penilaian rating (1 - 5).");
      return;
    }

    if (!privacyConsent) {
      alert("Mohon setujui Kebijakan Privasi.");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/public-survey/${surveyType}`, {
        data: {
          ...ratings,
          "Overall Experience": overallExperience,
          "Favorite Menu": favoriteMenu,
          "Notes": notes,
        },
        name,
        phone,
        wantFollowUp,
        privacyConsent,
        marketingConsent,
      });
      setDone(true);
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengirim survey.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 font-bold text-2xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Terima Kasih!</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {thankYouMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-100 font-sans py-0 md:py-8">
      <div className="max-w-xl mx-auto bg-white min-h-screen md:min-h-0 md:rounded-2xl md:shadow-xl overflow-hidden pb-12">
        {/* Header */}
        <div className="bg-[#0F4D39] text-white p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/pattern.png')] opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">{title}</h1>
            <p className="text-green-100 text-xs mt-1 uppercase tracking-wider">{subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* PERSONAL INFO */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                NAME :
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                PHONE :
              </label>
              <input
                type="tel"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent"
                placeholder="Nomor Telepon / WhatsApp"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* RATING SECTIONS */}
          {RATING_SECTIONS.map((sec) => (
            <div key={sec.category} className="space-y-3">
              <h2 className="text-xs font-extrabold text-[#0F4D39] uppercase tracking-wider border-b border-emerald-100 pb-1">
                {sec.category}
              </h2>
              <div className="space-y-2">
                {sec.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <span className="text-sm font-medium text-gray-800">
                      {item.label}
                    </span>
                    <div className="flex gap-2 justify-end">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleRatingChange(item.key, num)}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                            ratings[item.key] === num
                              ? "bg-[#0F4D39] text-white shadow-md scale-105"
                              : "bg-white text-gray-600 border border-gray-200 hover:border-[#0F4D39] hover:text-[#0F4D39]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* OVERALL EXPERIENCE */}
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold text-[#0F4D39] uppercase tracking-wider border-b border-emerald-100 pb-1">
              OVERALL EXPERIENCE
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
              <span className="text-sm font-bold text-gray-800">
                OVERALL EXPERIENCE
              </span>
              <div className="flex gap-2 justify-end">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setOverallExperience(num)}
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                      overallExperience === num
                        ? "bg-[#0F4D39] text-white shadow-md scale-105"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-[#0F4D39] hover:text-[#0F4D39]"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* FAVORITE MENU */}
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-[#0F4D39] uppercase tracking-wider">
              FAVORITE MENU :
            </label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent"
              placeholder="Tuliskan menu favorit Anda..."
              value={favoriteMenu}
              onChange={(e) => setFavoriteMenu(e.target.value)}
            />
          </div>

          {/* NOTES */}
          <div className="space-y-1">
            <label className="block text-xs font-extrabold text-[#0F4D39] uppercase tracking-wider">
              NOTES :
            </label>
            <textarea
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent"
              placeholder="Tuliskan catatan atau masukan Anda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* CONSENTS & PRIVACY */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-sm text-[#0F4D39]">
              Tindak Lanjut & Persetujuan
            </p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={wantFollowUp}
                onChange={(e) => setWantFollowUp(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39] mt-0.5"
              />
              <span className="text-xs text-gray-700 group-hover:text-gray-900">
                Saya ingin mendapatkan tindak lanjut atas keluhan atau masukan yang saya sampaikan.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                required
                className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39] mt-0.5"
              />
              <div className="flex flex-col">
                <span className="text-xs text-gray-700 group-hover:text-gray-900">
                  Saya menyetujui pemrosesan data pribadi sesuai dengan Kebijakan Privasi The Lodge Maribaya.
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left font-semibold"
                >
                  Baca lebih lanjut
                </button>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39] mt-0.5"
              />
              <div className="flex flex-col">
                <span className="text-xs text-gray-700 group-hover:text-gray-900">
                  Saya bersedia menerima informasi promosi dan layanan after-sales dari The Lodge Maribaya.
                </span>
                <button
                  type="button"
                  onClick={() => setShowMarketingModal(true)}
                  className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left font-semibold"
                >
                  Baca lebih lanjut
                </button>
              </div>
            </label>
          </div>

          {/* Privacy Modal */}
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
                    <h3 className="font-bold text-[#0F4D39] text-base mb-2">
                      Syarat dan Ketentuan Pemrosesan Data Pribadi
                    </h3>
                    <p className="text-[#0F4D39]/80">
                      Untuk menjaga kenyamanan dan melindungi hak Anda sebagai pengunjung, The Lodge Maribaya memproses data pribadi berupa Nama dan Nomor Telepon dengan memperhatikan ketentuan berikut.
                    </p>
                  </div>
                  <section>
                    <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                      Persetujuan Pengguna
                    </h4>
                    <p className="pl-7">Kami akan meminta persetujuan Anda secara jelas dan sah sebelum memproses data pribadi...</p>
                  </section>
                  <section>
                    <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                      Keterbukaan Informasi
                    </h4>
                    <div className="pl-7">
                      <p className="mb-2">Setelah Anda memberikan persetujuan, kami akan menjelaskan tujuan pemrosesan data pribadi...</p>
                    </div>
                  </section>
                  <div className="mt-2 p-4 bg-gray-100 rounded-xl text-center">
                    <h4 className="font-bold text-gray-800 mb-1">Kontak Layanan Pelanggan</h4>
                    <a href="https://wa.me/628112264808" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#0F4D39] font-bold hover:underline">
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

          {/* Marketing Modal */}
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
                    <h3 className="font-bold text-[#0F4D39] text-base mb-2">
                      Penggunaan Informasi Pengunjung
                    </h3>
                    <p className="text-[#0F4D39]/80">
                      Informasi yang Anda berikan dapat kami gunakan untuk meningkatkan pelayanan dan pengalaman Anda selama berkunjung.
                    </p>
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

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0F4D39] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Mengirim..." : "Kirim"}
          </button>
        </form>
      </div>
    </div>
  );
}
