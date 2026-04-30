"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Shield, X, Lock } from "lucide-react";

const options = ["Sangat jelas", "Jelas", "Kurang jelas", "Tidak jelas"];
const optVar = ["Sangat bervariasi", "Variasi", "Kurang variasi", "Tidak variasi"];
const optSvc = ["Sangat baik", "Baik", "Kurang baik", "Tidak baik"];
const optTaste = ["Sangat enak", "Enak", "Kurang enak", "Tidak enak"];
const optClean = ["Sangat bersih", "Bersih", "Kurang bersih", "Tidak bersih"];

export default function PinesSurveyPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [direction, setDirection] = useState("");
  const [variety, setVariety] = useState("");
  const [service, setService] = useState("");
  const [taste, setTaste] = useState("");
  const [cleanliness, setCleanliness] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wantFollowUp, setWantFollowUp] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.post("/public-survey/THE_PINES", {
        data: {
          direction,
          variety,
          service,
          taste,
          cleanliness,
          comment
        },
        name,
        address,
        email,
        phone,
        wantFollowUp,
        privacyConsent,
        marketingConsent
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
        <div className="max-w-md w-full bg-white rounded-2xl shadow p-6 text-center space-y-3">
          <h1 className="text-xl font-bold text-gray-800">Terima kasih</h1>
          <p className="text-sm text-gray-600">
            Terima kasih atas saran dan kritik Anda untuk The Pines Cafe.
          </p>
        </div>
      </div>
    );
  }

  const renderRow = (label: string, values: string[], value: string, setter: (v: string) => void) => (
    <div className="space-y-2">
      <p className="font-medium text-sm text-gray-800">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {values.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setter(v)}
            className={`border rounded px-3 py-2 text-left ${value === v ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700"}`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white md:bg-gray-100 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen md:min-h-0 md:my-8 md:rounded-2xl md:shadow-xl overflow-hidden pb-12">
        <div className="bg-[#0F4D39] text-white p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/pattern.png')] opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">The Lodge Maribaya</h1>
            <p className="text-green-100 text-sm mt-1">Guest Comment • The Pines Cafe</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {renderRow("Bagaimana petunjuk ke The Pines Cafe?", options, direction, setDirection)}
          {renderRow("Variasi makanan dan minuman?", optVar, variety, setVariety)}
          {renderRow("Pelayanan dan kecepatan melayani?", optSvc, service, setService)}
          {renderRow("Rasa makanan dan minuman?", optTaste, taste, setTaste)}
          {renderRow("Kebersihan area makan?", optClean, cleanliness, setCleanliness)}

          <div className="space-y-2">
            <p className="font-medium text-sm text-gray-800">Komentar untuk kami:</p>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm min-h-[100px]"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="font-medium text-sm text-gray-800">Data Anda untuk info promo:</p>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Alamat" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-sm text-[#0F4D39]">Tindak Lanjut & Persetujuan</p>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={wantFollowUp} onChange={e=>setWantFollowUp(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Saya ingin mendapatkan tindak lanjut atas keluhan atau masukan yang saya sampaikan.</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={privacyConsent} onChange={e=>setPrivacyConsent(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-600 group-hover:text-gray-900">Saya menyetujui pemrosesan data pribadi sesuai dengan Kebijakan Privasi The Lodge Maribaya.</span>
                <button type="button" onClick={()=>setShowPrivacyModal(true)} className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left">Baca lebih lanjut</button>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" checked={marketingConsent} onChange={e=>setMarketingConsent(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#0F4D39] focus:ring-[#0F4D39]" />
              <div className="flex flex-col">
                <span className="text-xs text-gray-600 group-hover:text-gray-900">Saya bersedia menerima informasi promosi dan layanan after-sales dari The Lodge Maribaya.</span>
                <button type="button" onClick={()=>setShowMarketingModal(true)} className="text-[10px] text-[#0F4D39] underline mt-0.5 text-left">Baca lebih lanjut</button>
              </div>
            </label>
          </div>

          {showPrivacyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2 text-[#0F4D39]">
                    <Shield className="w-5 h-5" />
                    <h2 className="font-bold text-lg">Kebijakan Privasi</h2>
                  </div>
                  <button onClick={()=>setShowPrivacyModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed custom-scrollbar">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                    <h3 className="font-bold text-[#0F4D39] text-base mb-2">Syarat dan Ketentuan Pemrosesan Data Pribadi</h3>
                    <p className="text-[#0F4D39]/80">Untuk menjaga kenyamanan dan melindungi hak Anda sebagai pengunjung, The Lodge Maribaya memproses data pribadi berupa Nama, Nomor WhatsApp, dan Email dengan memperhatikan ketentuan berikut.</p>
                  </div>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>Persetujuan Pengguna</h4><p className="pl-7">Kami akan meminta persetujuan Anda secara jelas dan sah sebelum memproses data pribadi...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>Keterbukaan Informasi</h4><div className="pl-7"><p className="mb-2">Setelah Anda memberikan persetujuan, kami akan menjelaskan:</p><ul className="list-disc pl-4 space-y-1 text-gray-600"><li>Tujuan pemrosesan data pribadi</li><li>Jenis data yang dikumpulkan dan relevansinya</li><li>Masa penyimpanan data</li><li>Periode dan proses pengolahan data</li><li>Hak Anda sebagai pemilik data pribadi</li></ul></div></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>Pemrosesan yang Terbatas dan Sah</h4><p className="pl-7">Data pribadi Anda akan diproses secara terbatas, spesifik, sah, dan transparan...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">4</span>Akurasi dan Keamanan Data</h4><p className="pl-7">Kami berupaya memastikan data pribadi yang kami kelola akurat, lengkap, dan terlindungi...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">5</span>Kerahasiaan Data</h4><p className="pl-7">Kerahasiaan data pribadi Anda dijaga dengan baik...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">6</span>Pengawasan Pihak Terkait</h4><p className="pl-7">Apabila terdapat pihak ketiga yang terlibat dalam pemrosesan data...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">7</span>Langkah Keamanan Teknis dan Operasional</h4><p className="pl-7">Kami menerapkan langkah-langkah teknis dan operasional yang wajar...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">8</span>Masa Penyimpanan Data</h4><p className="pl-7">Data pribadi disimpan selama diperlukan atau hingga Anda meminta penghapusan...</p></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">9</span>Hak Pengguna</h4><div className="pl-7"><p className="mb-2">Anda berhak untuk:</p><ul className="list-disc pl-4 space-y-1 text-gray-600"><li>Mengakses data pribadi Anda</li><li>Memperbaiki atau memperbarui data</li><li>Meminta penghapusan data</li><li>Mencabut persetujuan pemrosesan data</li></ul></div></section>
                  <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">10</span>Pemberitahuan Insiden Data</h4><p className="pl-7">Jika terjadi insiden yang berpotensi mengganggu perlindungan data pribadi, kami akan memberitahukan paling lambat 3x24 jam.</p></section>
                  <div className="mt-2 p-4 bg-gray-100 rounded-xl text-center"><h4 className="font-bold text-gray-800 mb-1">Kontak Layanan Pelanggan</h4><p className="text-gray-600 text-sm mb-2">Untuk pertanyaan/pengaduan terkait data pribadi, hubungi Customer Care:</p><a href="https://wa.me/628112264808" target="_blank" className="inline-flex items-center gap-2 text-[#0F4D39] font-bold hover:underline">📞 0811 2264 808</a></div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button onClick={()=>{ setShowPrivacyModal(false); setPrivacyConsent(true); }} className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0a3628] transition-colors">Saya Mengerti & Setuju</button>
                </div>
              </div>
            </div>
          )}

          {showMarketingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2 text-[#0F4D39]"><Lock className="w-5 h-5" /><h2 className="font-bold text-lg">Syarat dan Ketentuan</h2></div>
                  <button onClick={()=>setShowMarketingModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed custom-scrollbar">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4"><h3 className="font-bold text-[#0F4D39] text-base mb-2">Penggunaan Informasi Pengunjung</h3><p className="text-[#0F4D39]/80">Informasi yang Anda berikan kepada The Lodge Maribaya dapat digunakan untuk meningkatkan kualitas pelayanan...</p></div>
                  <ul className="space-y-4">
                    <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span><p>Menghubungi Anda terkait pelayanan, masukan, atau tindak lanjut atas keluhan yang Anda sampaikan;</p></li>
                    <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span><p>Memfasilitasi partisipasi Anda dalam penilaian, rating, dan ulasan pelayanan;</p></li>
                    <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span><p>Mengelola dan meningkatkan kualitas layanan, fasilitas, serta pengalaman pengunjung;</p></li>
                    <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span><p>Mengirimkan informasi, penawaran promosi, dan program khusus The Lodge Maribaya (jika Anda menyetujui);</p></li>
                    <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">5</span><p>Melakukan survei kepuasan pengunjung dan riset internal untuk pengembangan layanan.</p></li>
                  </ul>
                  <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-center italic text-gray-500">"Seluruh penggunaan informasi dilakukan secara terbatas, aman, dan sesuai dengan kebijakan privasi serta peraturan yang berlaku."</div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end"><button onClick={()=>{ setShowMarketingModal(false); setMarketingConsent(true); }} className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0a3628] transition-colors">Saya Mengerti & Setuju</button></div>
              </div>
            </div>
          )}
          {showPrivacyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <h2 className="font-bold text-lg text-[#0F4D39]">Kebijakan Privasi</h2>
                  <button onClick={()=>setShowPrivacyModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
                </div>
                <div className="p-6 overflow-y-auto text-sm text-gray-700 leading-relaxed">
                  <p>Informasi yang Anda berikan digunakan untuk meningkatkan kualitas pelayanan dan pengalaman Anda selama berkunjung. Kami melindungi data pribadi sesuai ketentuan yang berlaku.</p>
                  <ul className="list-disc pl-6 mt-3 space-y-2">
                    <li>Penggunaan terbatas untuk layanan pelanggan dan peningkatan layanan.</li>
                    <li>Hak akses, koreksi, dan penghapusan data sesuai peraturan.</li>
                    <li>Pemberitahuan insiden data dalam waktu 3x24 jam jika diperlukan.</li>
                  </ul>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button onClick={()=>{ setShowPrivacyModal(false); setPrivacyConsent(true); }} className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold">Saya Mengerti & Setuju</button>
                </div>
              </div>
            </div>
          )}

          {showMarketingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <h2 className="font-bold text-lg text-[#0F4D39]">Syarat & Ketentuan Informasi Promosi</h2>
                  <button onClick={()=>setShowMarketingModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">✕</button>
                </div>
                <div className="p-6 overflow-y-auto text-sm text-gray-700 leading-relaxed">
                  <p>Kami dapat menghubungi Anda untuk memberikan informasi promo dan layanan after-sales jika Anda menyetujui.</p>
                  <ul className="list-disc pl-6 mt-3 space-y-2">
                    <li>Konten terbatas pada informasi layanan dan program resmi.</li>
                    <li>Anda dapat berhenti kapan saja melalui kanal yang tersedia.</li>
                  </ul>
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button onClick={()=>{ setShowMarketingModal(false); setMarketingConsent(true); }} className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold">Saya Mengerti & Setuju</button>
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-[#0F4D39] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
            {loading ? "Mengirim..." : "Kirim"}
          </button>
        </form>
      </div>
    </div>
  );
}
