"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash, Save, FileText, Edit, Eye, X, Download, Check, XCircle, Printer, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

interface ManualItem {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export default function ManualProcurementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  
  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState({
    department: "",
    date: new Date().toISOString().split('T')[0],
    requestNumber: "",
    description: "",
    totalAmount: 0
  });

  const [items, setItems] = useState<ManualItem[]>([
    { itemName: "", quantity: 1, unit: "", price: 0, total: 0 }
  ]);
  const [history, setHistory] = useState<any[]>([]);

  const departments = [
    "HR", "FINANCE", "MARKETING", "OPERATIONAL", "IT", 
    "MERCHANDISE", "PHOTOGRAPHER", "GENERAL", "F&B", "FO", "ENGINEERING", "SECURITY"
  ];

  const fetchHistory = async () => {
    try {
      const res = await api.get('/manual-procurement');
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    // Calculate totals whenever items change
    const newTotal = items.reduce((sum, item) => sum + item.total, 0);
    setFormData(prev => ({ ...prev, totalAmount: newTotal }));
  }, [items]);

  const handleItemChange = (index: number, field: keyof ManualItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    // Recalculate total for this item
    if (field === 'quantity' || field === 'price') {
      item.total = item.quantity * item.price;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { itemName: "", quantity: 1, unit: "", price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleEdit = (item: any) => {
    setEditId(item.id);
    setFormData({
      department: item.department,
      date: new Date(item.date).toISOString().split('T')[0],
      requestNumber: item.requestNumber,
      description: item.description || "",
      totalAmount: item.totalAmount
    });
    setItems(item.items.map((i: any) => ({
      itemName: i.itemName,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price,
      total: i.total
    })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setFormData({
      department: "",
      date: new Date().toISOString().split('T')[0],
      requestNumber: "",
      description: "",
      totalAmount: 0
    });
    setItems([{ itemName: "", quantity: 1, unit: "", price: 0, total: 0 }]);
  };

  const handlePreview = (item: any) => {
    setPreviewItem(item);
    setShowPreviewModal(true);
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/manual-procurement/export', {
        params: {
          startDate: exportDateRange.start,
          endDate: exportDateRange.end
        }
      });

      // Generate CSV content
      const rows = [];
      // Header
      rows.push(['Tanggal', 'No. Pengajuan', 'Departemen', 'Keterangan', 'Total Estimasi', 'Dibuat Oleh', 'Item Pengajuan', 'QTY', 'Satuan', 'Harga', 'Total Item'].join(','));

      res.data.forEach((procurement: any) => {
        procurement.items.forEach((item: any) => {
          rows.push([
            new Date(procurement.date).toLocaleDateString('id-ID'),
            procurement.requestNumber,
            procurement.department,
            procurement.description || '',
            procurement.totalAmount,
            procurement.createdBy.name,
            item.itemName,
            item.quantity,
            item.unit,
            item.price,
            item.total
          ].map((value: any) => `"${value}"`).join(','));
        });
      });

      const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `riwayat-input-manual-${exportDateRange.start}-${exportDateRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowExportModal(false);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Gagal mengekspor data.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editId) {
        await api.put(`/manual-procurement/${editId}`, {
          ...formData,
          items
        });
        alert("Data berhasil diperbarui!");
      } else {
        await api.post('/manual-procurement', {
          ...formData,
          items
        });
        alert("Data berhasil disimpan!");
      }
      
      cancelEdit(); // Reset form
      fetchHistory();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Gagal menyimpan data.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (id: number, action: 'APPROVE' | 'REJECT') => {
      const reason = action === 'REJECT' ? prompt("Enter rejection reason:") : "";
      if (action === 'REJECT' && !reason) return;

      try {
          await api.put(`/manual-procurement/${id}/approval`, { action, reason });
          alert(`Successfully ${action.toLowerCase()}ed!`);
          fetchHistory();
      } catch (error: any) {
          alert(error.response?.data?.message || "Error processing approval");
      }
  };

  const handleMarkPurchased = async (id: number) => {
      if (!confirm("Tandai pengajuan ini sebagai sudah dibelanjakan/selesai?")) return;

      try {
          await api.put(`/manual-procurement/${id}/status`, { status: 'PURCHASED' });
          alert("Berhasil ditandai sebagai dibelanjakan!");
          fetchHistory();
      } catch (error: any) {
          alert(error.response?.data?.message || "Gagal mengupdate status");
      }
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'APPROVED': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Approved</span>;
          case 'REJECTED': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">Rejected</span>;
          case 'PENDING_FINANCE': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">Pending Finance</span>;
          case 'PENDING_GM': return <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">Pending GM</span>;
          case 'PURCHASED': 
          case 'COMPLETED': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">Purchased</span>;
          default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status || 'Pending'}</span>;
      }
  };

  if (!user) return null;

  if (user.role !== 'STORE' && user.role !== 'ADMIN' && user.role !== 'GM' && user.role !== 'FINANCE') {
      return <div className="p-8 text-center text-red-500">Access Denied. Only STORE, FINANCE, GM & ADMIN roles can access this page.</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-[#0F4D39]" />
            Input Pengajuan Manual (Sebelumnya)
          </h1>
          <p className="text-gray-500">Masukan data pengajuan lama secara manual</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`bg-white p-6 rounded-xl shadow-sm border ${editId ? 'border-[#0F4D39] ring-1 ring-[#0F4D39]' : 'border-gray-100'} space-y-6 relative`}>
        {editId && (
            <div className="absolute top-0 right-0 bg-[#0F4D39] text-white text-xs px-3 py-1 rounded-bl-xl rounded-tr-xl font-medium">
                Sedang Mengedit Data
            </div>
        )}

        {/* Header Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
            <select
              className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
              value={formData.department}
              onChange={e => setFormData({ ...formData, department: e.target.value })}
              required
            >
              <option value="">Pilih Departemen</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
            <input
              type="date"
              className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. Pengajuan</label>
            <input
              type="text"
              className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
              value={formData.requestNumber}
              onChange={e => setFormData({ ...formData, requestNumber: e.target.value })}
              placeholder="Contoh: 001/REQ/XI/2024"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Estimasi</label>
            <div className="w-full border p-2 rounded bg-gray-50 font-bold text-right">
              Rp {formData.totalAmount.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
          <textarea
            className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
            value={formData.description || ''}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase">
              <tr>
                <th className="p-3">Item Pengajuan</th>
                <th className="p-3 w-24">QTY</th>
                <th className="p-3 w-32">Satuan</th>
                <th className="p-3 w-40">Harga</th>
                <th className="p-3 w-40">Total</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full border p-1 rounded"
                      value={item.itemName}
                      onChange={e => handleItemChange(index, 'itemName', e.target.value)}
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      className="w-full border p-1 rounded"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      className="w-full border p-1 rounded"
                      value={item.unit}
                      onChange={e => handleItemChange(index, 'unit', e.target.value)}
                      placeholder="Pcs/Unit"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      className="w-full border p-1 rounded"
                      value={item.price}
                      onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </td>
                  <td className="p-2 text-right font-medium">
                    Rp {item.total.toLocaleString('id-ID')}
                  </td>
                  <td className="p-2 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:bg-red-50 p-1 rounded"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 text-[#0F4D39] font-medium hover:bg-green-50 px-3 py-2 rounded"
          >
            <Plus size={18} /> Tambah Item
          </button>

          <div className="flex gap-2">
            {editId && (
                <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex items-center gap-2 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                    <X size={18} /> Batal
                </button>
            )}
            <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-[#0F4D39] text-white px-6 py-2 rounded-lg hover:bg-[#0A3628] disabled:opacity-50"
            >
                <Save size={18} /> {loading ? 'Menyimpan...' : (editId ? 'Perbarui Data' : 'Simpan Data')}
            </button>
          </div>
        </div>

      </form>

      {/* History Table */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Riwayat Input Manual</h2>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 text-sm bg-green-50 text-[#0F4D39] px-3 py-1.5 rounded-lg hover:bg-green-100 border border-green-200 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3">Tanggal</th>
                <th className="p-3">No. Pengajuan</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3">Total Estimasi</th>
                <th className="p-3">Status</th>
                <th className="p-3">Dibuat Oleh</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">Belum ada data.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 font-medium">{item.requestNumber}</td>
                    <td className="p-3">{item.department}</td>
                    <td className="p-3 text-gray-600 truncate max-w-xs">{item.description}</td>
                    <td className="p-3 font-semibold text-[#0F4D39]">
                      Rp {item.totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                        {item.createdBy?.name || '-'}
                    </td>
                    <td className="p-3 flex justify-center gap-2">
                        {/* Approval Buttons */}
                        {((user.role === 'FINANCE' && item.status === 'PENDING_FINANCE') || 
                          ((user.role === 'GM' || user.role === 'ADMIN') && item.status === 'PENDING_GM')) && (
                            <>
                                <button 
                                    onClick={() => handleApproval(item.id, 'APPROVE')}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Approve"
                                >
                                    <Check size={18} />
                                </button>
                                <button 
                                    onClick={() => handleApproval(item.id, 'REJECT')}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Reject"
                                >
                                    <XCircle size={18} />
                                </button>
                            </>
                        )}

                        {/* Mark as Purchased (Only for Store/Admin/GM if Approved) */}
                        {(item.status === 'APPROVED' && (user.role === 'STORE' || user.role === 'ADMIN' || user.role === 'GM')) && (
                            <button 
                                onClick={() => handleMarkPurchased(item.id)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Tandai Dibelanjakan"
                            >
                                <ShoppingBag size={18} />
                            </button>
                        )}

                        {/* Print/Preview PDF (If Approved or Purchased) */}
                        {(item.status === 'APPROVED' || item.status === 'PURCHASED' || item.status === 'COMPLETED') && (
                            <a 
                                href={`/manual-procurement/print/${item.id}`}
                                target="_blank"
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Print PDF"
                            >
                                <Printer size={18} />
                            </a>
                        )}

                        <button 
                            onClick={() => handlePreview(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Preview Detail"
                        >
                            <Eye size={18} />
                        </button>
                        <button 
                            onClick={() => handleEdit(item)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit Data"
                        >
                            <Edit size={18} />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="text-[#0F4D39]" />
                Detail Pengajuan Manual
              </h2>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 uppercase">No. Pengajuan</p>
                  <p className="font-semibold">{previewItem.requestNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Tanggal</p>
                  <p className="font-semibold">{new Date(previewItem.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Departemen</p>
                  <p className="font-semibold">{previewItem.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Total Estimasi</p>
                  <p className="font-semibold text-[#0F4D39]">Rp {previewItem.totalAmount.toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Keterangan:</p>
                <p className="text-gray-600 bg-white border p-3 rounded-lg">
                  {previewItem.description || '-'}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Item Pengajuan:</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 text-left">Item</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-center">Satuan</th>
                        <th className="p-3 text-right">Harga</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewItem.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-3">{item.itemName}</td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-center">{item.unit}</td>
                          <td className="p-3 text-right">Rp {item.price.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right font-medium">Rp {item.total.toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold">
                        <tr>
                            <td colSpan={4} className="p-3 text-right">Total Akhir</td>
                            <td className="p-3 text-right text-[#0F4D39]">Rp {previewItem.totalAmount.toLocaleString('id-ID')}</td>
                        </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-right pt-4 border-t">
                Dibuat oleh: {previewItem.createdBy?.name || '-'} pada {new Date(previewItem.createdAt).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
               <button
                  onClick={() => {
                      setShowPreviewModal(false);
                      handleEdit(previewItem);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 font-medium"
               >
                 <Edit size={16} /> Edit Data Ini
               </button>
               <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
               >
                 Tutup
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Download className="text-[#0F4D39]" />
                Export Data
              </h2>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
                  value={exportDateRange.start}
                  onChange={e => setExportDateRange({ ...exportDateRange, start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-[#0F4D39] outline-none"
                  value={exportDateRange.end}
                  onChange={e => setExportDateRange({ ...exportDateRange, end: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
               <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
               >
                 Batal
               </button>
               <button
                  onClick={handleExport}
                  className="px-4 py-2 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0A3628] font-medium"
               >
                 Export CSV
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
