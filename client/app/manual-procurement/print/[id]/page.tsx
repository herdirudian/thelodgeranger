"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";

export default function PrintProcurementPage() {
    const params = useParams();
    const printId = typeof params?.id === 'string' ? params.id : '';
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`/manual-procurement/${printId}`);
                setData(res.data);
            } catch (error) {
                console.error("Error fetching data:", error);
                alert("Gagal memuat data.");
            } finally {
                setLoading(false);
            }
        };

        if (printId) {
            fetchData();
        }
    }, [printId]);

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen"><Loader2 className="animate-spin" /></div>;
    }

    if (!data) return <div className="p-8 text-center text-red-500">Data tidak ditemukan</div>;

    return (
        <div className="bg-white min-h-screen text-black p-8 max-w-[210mm] mx-auto">
            {/* No-Print Controls */}
            <div className="print:hidden mb-6 flex justify-end">
                <button 
                    onClick={() => window.print()}
                    className="bg-[#0F4D39] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#0A3628]"
                >
                    <Printer size={18} /> Cetak PDF
                </button>
            </div>

            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold text-[#0F4D39]">THE LODGE MARIBAYA</h1>
                        <p className="text-sm text-gray-600">Jl. Maribaya No. 149/252, Lembang, Bandung</p>
                        <p className="text-sm text-gray-600">Procurement Request Form</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold uppercase tracking-wider">Permintaan Barang</h2>
                    <p className="font-mono text-lg mt-1">{data.requestNumber}</p>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-8 text-sm">
                <div className="flex">
                    <span className="w-32 font-bold text-gray-600">Departemen:</span>
                    <span className="font-semibold">{data.department}</span>
                </div>
                <div className="flex">
                    <span className="w-32 font-bold text-gray-600">Tanggal:</span>
                    <span>{new Date(data.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="flex">
                    <span className="w-32 font-bold text-gray-600">Dibuat Oleh:</span>
                    <span>{data.createdBy?.name || '-'}</span>
                </div>
                <div className="flex">
                    <span className="w-32 font-bold text-gray-600">Status:</span>
                    <span className="uppercase font-bold border px-2 rounded border-gray-300">{data.status}</span>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border border-gray-300 p-2 text-center w-12">No</th>
                            <th className="border border-gray-300 p-2 text-left">Nama Barang</th>
                            <th className="border border-gray-300 p-2 text-center w-20">Qty</th>
                            <th className="border border-gray-300 p-2 text-center w-20">Satuan</th>
                            <th className="border border-gray-300 p-2 text-right w-32">Harga Satuan</th>
                            <th className="border border-gray-300 p-2 text-right w-36">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item: any, index: number) => (
                            <tr key={index}>
                                <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                                <td className="border border-gray-300 p-2">{item.itemName}</td>
                                <td className="border border-gray-300 p-2 text-center">{item.quantity}</td>
                                <td className="border border-gray-300 p-2 text-center">{item.unit}</td>
                                <td className="border border-gray-300 p-2 text-right">Rp {item.price.toLocaleString('id-ID')}</td>
                                <td className="border border-gray-300 p-2 text-right">Rp {item.total.toLocaleString('id-ID')}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50 font-bold">
                            <td colSpan={5} className="border border-gray-300 p-2 text-right">TOTAL ESTIMASI</td>
                            <td className="border border-gray-300 p-2 text-right">Rp {data.totalAmount.toLocaleString('id-ID')}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Description */}
            {data.description && (
                <div className="mb-8 border border-gray-300 rounded p-4">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm">Keterangan / Catatan:</h3>
                    <p className="text-gray-800 text-sm whitespace-pre-wrap">{data.description}</p>
                </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-12 page-break-inside-avoid">
                {/* Finance Signature */}
                <div className="border border-gray-300 rounded-lg p-4 text-center h-40 flex flex-col justify-between">
                    <div className="text-xs font-bold text-gray-500 uppercase">Disetujui Finance</div>
                    
                    {data.financeApproved ? (
                        <div className="flex flex-col items-center justify-center flex-1">
                            <div className="border-2 border-green-600 text-green-600 rounded-full px-4 py-1 font-bold text-sm transform -rotate-12 opacity-80 mb-1">
                                APPROVED
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {data.financeApprovedAt ? new Date(data.financeApprovedAt).toLocaleString('id-ID') : 'Verified'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center flex-1 text-gray-300 text-xs italic">
                            (Belum Disetujui)
                        </div>
                    )}
                    
                    <div className="border-t border-gray-300 pt-2 mt-2">
                        <p className="font-bold text-sm">Finance Dept.</p>
                    </div>
                </div>

                {/* GM Signature */}
                <div className="border border-gray-300 rounded-lg p-4 text-center h-40 flex flex-col justify-between">
                    <div className="text-xs font-bold text-gray-500 uppercase">Disetujui GM</div>
                    
                    {data.gmApproved ? (
                        <div className="flex flex-col items-center justify-center flex-1">
                            <div className="border-2 border-blue-600 text-blue-600 rounded-full px-4 py-1 font-bold text-sm transform -rotate-12 opacity-80 mb-1">
                                APPROVED
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {data.gmApprovedAt ? new Date(data.gmApprovedAt).toLocaleString('id-ID') : 'Verified'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center flex-1 text-gray-300 text-xs italic">
                            (Belum Disetujui)
                        </div>
                    )}
                    
                    <div className="border-t border-gray-300 pt-2 mt-2">
                        <p className="font-bold text-sm">General Manager</p>
                    </div>
                </div>

                {/* Purchasing/Store Signature */}
                <div className="border border-gray-300 rounded-lg p-4 text-center h-40 flex flex-col justify-between">
                    <div className="text-xs font-bold text-gray-500 uppercase">Dibelanjakan Oleh</div>
                    
                    {data.purchased ? (
                        <div className="flex flex-col items-center justify-center flex-1">
                            <div className="border-2 border-purple-600 text-purple-600 rounded-full px-4 py-1 font-bold text-sm transform -rotate-12 opacity-80 mb-1">
                                PURCHASED
                            </div>
                            <span className="text-[10px] text-gray-400">
                                {data.purchasedAt ? new Date(data.purchasedAt).toLocaleString('id-ID') : 'Verified'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center flex-1 text-gray-300 text-xs italic">
                            (Belum Dibelanjakan)
                        </div>
                    )}
                    
                    <div className="border-t border-gray-300 pt-2 mt-2">
                        <p className="font-bold text-sm">Procurement/Store</p>
                    </div>
                </div>
            </div>

             <div className="mt-8 text-center text-[10px] text-gray-400 print:fixed print:bottom-4 print:left-0 print:right-0">
                Dicetak dari The Lodge Ranger System pada {new Date().toLocaleString('id-ID')}
            </div>
        </div>
    );
}
