"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Star, Shield, X, Lock } from "lucide-react";

export default function WisataSurveyPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [ticketEase, setTicketEase] = useState<number>(0);
  const [scenery, setScenery] = useState<number>(0);
  const [cleanliness, setCleanliness] = useState<number>(0);
  const [staffFriendliness, setStaffFriendliness] = useState<number>(0);
  const [recommend, setRecommend] = useState<number>(0);
  const [overall, setOverall] = useState<number>(0);
  const [priceSatisfaction, setPriceSatisfaction] = useState<number>(0);

  const [memorableMoment, setMemorableMoment] = useState("");
  const [futureHope, setFutureHope] = useState("");
  const [comment, setComment] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [wantFollowUp, setWantFollowUp] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const stars = [1,2,3,4,5];
  const StarRow = ({ label, hint, value, onChange, error }: { label: string; hint: string; value: number; onChange: (v: number)=>void; error?: boolean }) => (
    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
      <label className={`block text-sm font-bold mb-1 ${error ? 'text-red-600' : 'text-gray-800'}`}>{label}</label>
      <p className="text-xs text-gray-500 mb-3">{hint}</p>
      <div className="flex gap-2">
        {stars.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star className={`w-8 h-8 ${s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium">
        <span>Sangat Buruk</span>
        <span>Sangat Baik</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">Harus diisi</p>}
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const invalid =
      ticketEase < 1 ||
      scenery < 1 ||
      cleanliness < 1 ||
      staffFriendliness < 1 ||
      recommend < 1 ||
      overall < 1 ||
      priceSatisfaction < 1;
    if (invalid) {
      setShowErrors(true);
      alert("Mohon isi semua penilaian bintang (1–5).");
      return;
    }
    setLoading(true);
    try {
      await api.post("/public-survey/WISATA", {
        data: {
          ticketEase,
          scenery,
          cleanliness,
          staffFriendliness,
          recommend,
          overall,
          priceSatisfaction,
          memorableMoment,
          futureHope,
          comment
        },
        name,
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
            Terima kasih atas penilaian dan masukan Anda untuk pengalaman wisata di The Lodge Maribaya.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-gray-100 font-sans">
      <div className="max-w-md mx-auto bg-white min-h-screen md:min-h-0 md:my-8 md:rounded-2xl md:shadow-xl overflow-hidden pb-12">
        <div className="bg-[#0F4D39] text-white p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg">
              <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">The Lodge Maribaya</h1>
            <p className="text-green-100 text-sm mt-1">Guest Comment • Wisata</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <StarRow label="Kemudahan & efisiensi proses pembelian tiket masuk" hint="(1 = Sangat tidak mudah, 5 = Sangat mudah & efisien)" value={ticketEase} onChange={setTicketEase} error={showErrors && ticketEase < 1} />
          <StarRow label="Keindahan alam dan pemandangan (hutan pinus)" hint="(1 = Tidak menarik, 5 = Sangat indah & memukau)" value={scenery} onChange={setScenery} error={showErrors && scenery < 1} />
          <StarRow label="Kebersihan & kerapihan fasilitas umum" hint="(1 = Sangat kotor, 5 = Sangat bersih & rapi)" value={cleanliness} onChange={setCleanliness} error={showErrors && cleanliness < 1} />
          <StarRow label="Responsivitas & keramahan staf/petugas" hint="(1 = Tidak ramah/tidak responsif, 5 = Sangat ramah & responsif)" value={staffFriendliness} onChange={setStaffFriendliness} error={showErrors && staffFriendliness < 1} />
          <StarRow label="Apakah Anda akan merekomendasikan The Lodge?" hint="(1 = Tidak akan, 5 = Sangat akan merekomendasikan)" value={recommend} onChange={setRecommend} error={showErrors && recommend < 1} />
          <StarRow label="Penilaian pengalaman wisata secara keseluruhan" hint="(1 = Sangat buruk, 5 = Sangat baik)" value={overall} onChange={setOverall} error={showErrors && overall < 1} />
          <StarRow label="Kepuasan terhadap harga tiket masuk" hint="(1 = Sangat tidak puas, 5 = Sangat puas)" value={priceSatisfaction} onChange={setPriceSatisfaction} error={showErrors && priceSatisfaction < 1} />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Momen paling berkesan (Maks. 500 karakter)</label>
            <textarea className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" rows={3} maxLength={500} value={memorableMoment} onChange={(e)=>setMemorableMoment(e.target.value)} placeholder="Tulis di sini..." />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Harapan Anda terhadap The Lodge Maribaya (Maks. 500 karakter)</label>
            <textarea className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" rows={3} maxLength={500} value={futureHope} onChange={(e)=>setFutureHope(e.target.value)} placeholder="Tulis di sini..." />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Saran & Masukan (Opsional)</label>
            <textarea className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" rows={3} value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Tulis di sini..." />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Data Pengunjung</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" placeholder="Nama" value={name} onChange={(e)=>setName(e.target.value)} />
              <input className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <input className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all text-sm" placeholder="WhatsApp" value={phone} onChange={(e)=>setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={wantFollowUp} onChange={(e)=>setWantFollowUp(e.target.checked)} />
              <span className="text-sm">Bersedia dihubungi kembali</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={privacyConsent} onChange={(e)=>setPrivacyConsent(e.target.checked)} />
              <span className="text-sm">Menyetujui Kebijakan Privasi</span>
              <button type="button" onClick={()=>setShowPrivacyModal(true)} className="text-xs text-[#0F4D39] underline">Baca lebih lanjut</button>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={marketingConsent} onChange={(e)=>setMarketingConsent(e.target.checked)} />
              <span className="text-sm">Menyetujui Info Promosi (Marketing)</span>
              <button type="button" onClick={()=>setShowMarketingModal(true)} className="text-xs text-[#0F4D39] underline">Baca lebih lanjut</button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0F4D39] text-white py-3 rounded-lg font-bold hover:bg-[#0a3628]"
          >
            {loading ? "Mengirim..." : "Kirim"}
          </button>
        </form>

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
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                  <h3 className="font-bold text-[#0F4D39] text-base mb-2">Syarat dan Ketentuan Pemrosesan Data Pribadi</h3>
                  <p className="text-[#0F4D39]/80">Untuk menjaga kenyamanan dan melindungi hak Anda sebagai pengunjung, The Lodge Maribaya memproses data pribadi berupa Nama, Nomor WhatsApp, dan Email dengan memperhatikan ketentuan berikut.</p>
                </div>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>Persetujuan Pengguna</h4><p className="pl-7">Kami akan meminta persetujuan Anda secara jelas dan sah sebelum memproses data pribadi, untuk satu atau beberapa tujuan tertentu yang telah kami sampaikan, antara lain untuk keperluan penilaian pelayanan, tindak lanjut keluhan, dan peningkatan kualitas layanan.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>Keterbukaan Informasi</h4><div className="pl-7"><p className="mb-2">Setelah Anda memberikan persetujuan, kami akan menjelaskan:</p><ul className="list-disc pl-4 space-y-1 text-gray-600"><li>Tujuan pemrosesan data pribadi</li><li>Jenis data yang dikumpulkan dan relevansinya</li><li>Masa penyimpanan data</li><li>Periode dan proses pengolahan data</li><li>Hak Anda sebagai pemilik data pribadi</li></ul></div></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>Pemrosesan yang Terbatas dan Sah</h4><p className="pl-7">Data pribadi Anda akan diproses secara terbatas, spesifik, sah, dan transparan sesuai dengan peraturan perundang-undangan yang berlaku.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">4</span>Akurasi dan Keamanan Data</h4><p className="pl-7">Kami berupaya memastikan data pribadi yang kami kelola akurat, lengkap, dan terlindungi dari akses, penggunaan, atau pengungkapan yang tidak sah.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">5</span>Kerahasiaan Data</h4><p className="pl-7">Kerahasiaan data pribadi Anda dijaga dengan baik, dan hanya dapat diakses oleh pihak internal yang berwenang dalam lingkup operasional The Lodge Maribaya.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">6</span>Pengawasan Pihak Terkait</h4><p className="pl-7">Apabila terdapat pihak ketiga yang terlibat dalam pemrosesan data di bawah kendali kami, The Lodge Maribaya akan melakukan pengawasan untuk memastikan kepatuhan terhadap prinsip perlindungan data pribadi.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">7</span>Langkah Keamanan Teknis dan Operasional</h4><p className="pl-7">Kami menerapkan langkah-langkah teknis dan operasional yang wajar dan sesuai untuk melindungi data pribadi dari gangguan, penyalahgunaan, maupun pemrosesan yang bertentangan dengan hukum.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">8</span>Masa Penyimpanan Data</h4><p className="pl-7">Data pribadi yang telah Anda berikan akan disimpan selama masih diperlukan untuk tujuan pemrosesan, atau sampai Anda mengajukan permintaan penghapusan data dan/atau pencabutan persetujuan.</p></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">9</span>Hak Pengguna</h4><div className="pl-7"><p className="mb-2">Anda berhak untuk:</p><ul className="list-disc pl-4 space-y-1 text-gray-600"><li>Mengakses data pribadi Anda</li><li>Memperbaiki atau memperbarui data</li><li>Meminta penghapusan data</li><li>Mencabut persetujuan pemrosesan data</li></ul></div></section>
                <section><h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><span className="bg-[#0F4D39] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">10</span>Pemberitahuan Insiden Data</h4><p className="pl-7">Apabila terjadi insiden yang berpotensi mengganggu perlindungan data pribadi, kami akan memberitahukan kepada Anda dan pihak berwenang terkait dalam waktu paling lambat 3 x 24 jam sesuai ketentuan yang berlaku.</p></section>
                <div className="mt-8 p-4 bg-gray-100 rounded-xl text-center">
                  <h4 className="font-bold text-gray-800 mb-1">Kontak Layanan Pelanggan</h4>
                  <p className="text-gray-600 text-sm mb-2">Untuk pertanyaan, pengaduan, atau permintaan terkait data pribadi, Anda dapat menghubungi Customer Care The Lodge Maribaya melalui:</p>
                  <a href="https://wa.me/628112264808" target="_blank" className="inline-flex items-center gap-2 text-[#0F4D39] font-bold text-lg hover:underline">📞 0811 2264 808</a>
                </div>
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
                <div className="flex items-center gap-2 text-[#0F4D39]">
                  <Lock className="w-5 h-5" />
                  <h2 className="font-bold text-lg">Syarat dan Ketentuan</h2>
                </div>
                <button onClick={()=>setShowMarketingModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                  <h3 className="font-bold text-[#0F4D39] text-base mb-2">Penggunaan Informasi Pengunjung</h3>
                  <p className="text-[#0F4D39]/80">Informasi yang Anda berikan kepada The Lodge Maribaya dapat digunakan untuk meningkatkan kualitas pelayanan dan pengalaman Anda selama berkunjung. Secara khusus, informasi tersebut dapat kami gunakan untuk:</p>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">1</span><p>Menghubungi Anda terkait pelayanan, masukan, atau tindak lanjut atas keluhan yang Anda sampaikan;</p></li>
                  <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">2</span><p>Memfasilitasi partisipasi Anda dalam penilaian, rating, dan ulasan pelayanan dari tim/frontliner The Lodge Maribaya;</p></li>
                  <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">3</span><p>Mengelola dan meningkatkan kualitas layanan, fasilitas, serta pengalaman pengunjung;</p></li>
                  <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">4</span><p>Mengirimkan informasi, penawaran promosi, dan program khusus The Lodge Maribaya (jika Anda menyetujui);</p></li>
                  <li className="flex gap-3"><span className="bg-[#0F4D39] text-white w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">5</span><p>Melakukan survei kepuasan pengunjung dan riset internal guna pengembangan layanan ke depan.</p></li>
                </ul>
                <div className="mt-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-center italic text-gray-500">"Seluruh penggunaan informasi dilakukan secara terbatas, aman, dan sesuai dengan kebijakan privasi serta peraturan yang berlaku."</div>
              </div>
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button onClick={()=>{ setShowMarketingModal(false); setMarketingConsent(true); }} className="bg-[#0F4D39] text-white px-6 py-2 rounded-lg font-bold hover:bg-[#0a3628] transition-colors">Saya Mengerti & Setuju</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
