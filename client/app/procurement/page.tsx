"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { 
  ShoppingBag, 
  PlusCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Briefcase, 
  ArrowRight,
  Filter,
  Check,
  X,
  FileText,
  DollarSign,
  Upload,
  Image as ImageIcon,
  Eye,
  Printer
} from "lucide-react";
import { useReactToPrint } from 'react-to-print';
import { ProcurementInvoice } from "@/components/ProcurementInvoice";
import { useRef } from "react";

export default function ProcurementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("my-requests");
  const [myProcurements, setMyProcurements] = useState<any[]>([]);
  const [pendingProcurements, setPendingProcurements] = useState<any[]>([]);
  const [historyProcurements, setHistoryProcurements] = useState<any[]>([]);
  
  // Form State
  const [items, setItems] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({
      itemName: "",
      description: "",
      imageUrl: "",
      category: "ATK",
      customCategory: "",
      quantity: "",
      unitPrice: ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const [reason, setReason] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  
  // Approval Modal State
  const [approvalModal, setApprovalModal] = useState({
      isOpen: false,
      requestId: 0,
      action: 'APPROVE' as 'APPROVE' | 'REJECT',
      note: '',
      request: null as any
  });

  // Preview & Print State
  const [previewModal, setPreviewModal] = useState({
      isOpen: false,
      data: null as any
  });
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
      contentRef: printRef,
      documentTitle: `Procurement_${previewModal.data?.id || 'Request'}`,
  });

  useEffect(() => {
    fetchMyProcurements();
  }, []);

  useEffect(() => {
    if (user && (user.role === 'HOD' || user.role === 'SUPERVISOR' || user.role === 'FINANCE' || user.role === 'GM' || user.role === 'STORE')) {
        fetchPendingProcurements();
        if (user.role !== 'STORE') {
            fetchHistoryProcurements();
        }
    }
  }, [user]);

  const fetchMyProcurements = async () => {
    try {
      const res = await api.get("/procurement/me");
      setMyProcurements(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingProcurements = async () => {
    try {
      const res = await api.get("/procurement/pending");
      setPendingProcurements(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistoryProcurements = async () => {
    try {
      const res = await api.get("/procurement/history");
      setHistoryProcurements(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!newItem.itemName || !newItem.quantity || !newItem.unitPrice) {
        alert("Please fill in all item details");
        return;
    }

    const finalCategory = newItem.category === "Lainnya" && newItem.customCategory 
        ? newItem.customCategory 
        : newItem.category;

    setItems([...items, { ...newItem, category: finalCategory }]);
    setNewItem({
        itemName: "",
        description: "",
        imageUrl: "",
        category: "ATK",
        customCategory: "",
        quantity: "",
        unitPrice: ""
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
        const res = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        setNewItem({ ...newItem, imageUrl: res.data.url });
    } catch (err) {
        alert("Error uploading file");
        console.error(err);
    } finally {
        setIsUploading(false);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
        alert("Please add at least one item.");
        return;
    }
    try {
      await api.post("/procurement", {
          items,
          reason,
          requiredDate
      });
      alert("Procurement request submitted successfully!");
      fetchMyProcurements();
      setActiveTab('my-requests');
      
      // Reset form
      setItems([]);
      setNewItem({
        itemName: "",
        category: "ATK",
        quantity: "",
        unitPrice: ""
      });
      setReason("");
      setRequiredDate("");
      
    } catch (err: any) {
      alert("Error submitting request: " + (err.response?.data?.message || err.message));
    }
  };

  const handleApproval = (id: number, action: 'APPROVE' | 'REJECT') => {
      const req = pendingProcurements.find(r => r.id === id) || historyProcurements.find(r => r.id === id);
      setApprovalModal({
          isOpen: true,
          requestId: id,
          action,
          note: '',
          request: req
      });
  };

  const submitApproval = async () => {
      try {
          const { requestId, action, note } = approvalModal;
          if (action === 'REJECT' && !note) {
              alert("Please provide a reason for rejection.");
              return;
          }
          
          await api.put(`/procurement/${requestId}/approval`, { action, reason: note });
          alert(`Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`);
          setApprovalModal({ ...approvalModal, isOpen: false });
          fetchPendingProcurements();
          fetchHistoryProcurements();
      } catch (err: any) {
          alert("Error processing request: " + (err.response?.data?.message || err.message));
      }
  };

  const canApprove = user?.role === 'HOD' || user?.role === 'SUPERVISOR' || user?.role === 'FINANCE' || user?.role === 'GM' || user?.role === 'STORE';
  const isStore = user?.role === 'STORE';

  const getStatusBadge = (status: string) => {
      const colors: any = {
          APPROVED: 'bg-green-100 text-green-700 border-green-200',
          REJECTED: 'bg-red-100 text-red-700 border-red-200',
          PENDING_HOD: 'bg-orange-100 text-orange-700 border-orange-200',
          PENDING_SUPERVISOR: 'bg-blue-100 text-blue-700 border-blue-200',
          PENDING_FINANCE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
          PENDING_GM: 'bg-purple-100 text-purple-700 border-purple-200'
      };
      const color = colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
      return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}>
              {status.replace(/_/g, ' ')}
          </span>
      );
  };

  // Calculate Total Price
  const totalPrice = items.reduce((acc, item) => {
      return acc + (parseInt(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-[#0F4D39]/10 rounded-lg">
                    <ShoppingBag className="w-8 h-8 text-[#0F4D39]" />
                </div>
                Procurement
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Manage operational item requests.</p>
        </div>
        
        <button 
            onClick={() => setActiveTab('new-request')}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-[#0F4D39] hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2"
        >
            <PlusCircle className="w-5 h-5" />
            New Request
        </button>
      </div>

      {/* Modern Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button 
            onClick={() => setActiveTab('my-requests')}
            className={`${
              activeTab === 'my-requests'
                ? 'border-[#0F4D39] text-[#0F4D39]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
          >
            <User className="w-4 h-4" />
            My Requests
          </button>
          
          {canApprove && (
            <>
                <button 
                    onClick={() => setActiveTab('approvals')}
                    className={`${
                    activeTab === 'approvals'
                        ? 'border-[#0F4D39] text-[#0F4D39]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                    <CheckCircle className="w-4 h-4" />
                    {isStore ? 'Pending Fulfillment' : 'Pending Approvals'}
                    {pendingProcurements.length > 0 && (
                        <span className="ml-1 bg-red-100 text-red-600 py-0.5 px-2.5 rounded-full text-xs font-bold">
                            {pendingProcurements.length}
                        </span>
                    )}
                </button>
          {!isStore && (
            <button 
                onClick={() => setActiveTab('history')}
                className={`${
                activeTab === 'history'
                    ? 'border-[#0F4D39] text-[#0F4D39]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
            >
                <Clock className="w-4 h-4" />
                Approval History
            </button>
          )}
            </>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        
        {/* New Request Form */}
        {activeTab === 'new-request' && (
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-[#0F4D39]" />
                    Create Procurement Request
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Items List */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">Items</h3>
                            <span className="text-sm text-gray-500">{items.length} items added</span>
                        </div>
                        
                        {items.length > 0 && (
                            <div className="bg-gray-50 rounded-xl overflow-x-auto border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {items.map((item, index) => (
                                            <tr key={index}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <div className="font-medium">{item.itemName}</div>
                                                    {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                                                    {item.imageUrl && (
                                                        <a href={`http://localhost:5000${item.imageUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                                            <ImageIcon className="w-3 h-3" /> View Image
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.quantity}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{parseInt(item.unitPrice).toLocaleString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                                                    {(parseInt(item.quantity) * parseFloat(item.unitPrice)).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-600 hover:text-red-900">
                                                        <XCircle className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Add Item Form */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                            <h4 className="text-sm font-medium text-gray-700 mb-4">Add New Item</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
                                    <input type="text" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none" 
                                        value={newItem.itemName} onChange={e => setNewItem({...newItem, itemName: e.target.value})} placeholder="e.g. Paper"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                                    <input type="text" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none" 
                                        value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} placeholder="e.g. A4 Size, 70gsm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                    <select className="w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none"
                                        value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                                    >
                                        <option value="ATK">ATK</option>
                                        <option value="Operasional">Operasional</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Event">Event</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                    {newItem.category === 'Lainnya' && (
                                        <input 
                                            type="text" 
                                            className="mt-2 w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none"
                                            placeholder="Specify Category"
                                            value={newItem.customCategory}
                                            onChange={e => setNewItem({...newItem, customCategory: e.target.value})}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Image (Optional)</label>
                                    <div className="flex items-center gap-2">
                                        <label className="cursor-pointer px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-sm flex items-center gap-2 text-gray-600">
                                            <Upload className="w-4 h-4" />
                                            {isUploading ? "Uploading..." : "Upload"}
                                            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                                        </label>
                                        {newItem.imageUrl && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3"/> Uploaded</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                                    <input type="number" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none" 
                                        value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price</label>
                                    <input type="number" className="w-full p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#0F4D39] outline-none" 
                                        value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: e.target.value})} placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <button type="button" onClick={handleAddItem} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                                    Add Item
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
                        <span className="text-gray-600 font-medium">Total Estimated Cost:</span>
                        <span className="text-xl font-bold text-[#0F4D39]">
                            IDR {totalPrice.toLocaleString()}
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Required Date</label>
                        <input type="date" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent outline-none transition-all" 
                            required value={requiredDate} onChange={e => setRequiredDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reason / Justification</label>
                        <textarea className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent outline-none transition-all" 
                            required rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this item needed?"
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setActiveTab('my-requests')} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors">
                            Cancel
                        </button>
                        <button type="submit" className="px-6 py-2.5 bg-[#0F4D39] text-white font-medium rounded-xl hover:bg-[#0a3628] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        )}

        {/* My Requests List */}
        {activeTab === 'my-requests' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Summary</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {myProcurements.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{req.items?.length || 0} Items</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                            {req.items?.map((i: any) => i.itemName).join(", ")}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {Array.from(new Set(req.items?.map((i: any) => i.category))).join(", ")}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        IDR {req.totalPrice?.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {req.requiredDate ? format(new Date(req.requiredDate), 'dd MMM yyyy') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(req.status)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button 
                                            onClick={() => setPreviewModal({ isOpen: true, data: req })}
                                            className="text-gray-400 hover:text-[#0F4D39] transition-colors p-2 rounded-full hover:bg-gray-100"
                                            title="View Details & Print"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* Approvals & History List */}
        {(activeTab === 'approvals' || activeTab === 'history') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Summary</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {(activeTab === 'approvals' ? pendingProcurements : historyProcurements).map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{req.user.name}</div>
                                        <div className="text-xs text-gray-500">{req.user.department}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{req.items?.length || 0} Items</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                            {req.items?.map((i: any) => i.itemName).join(", ")}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-gray-700">IDR {req.totalPrice.toLocaleString()}</td>
                                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setPreviewModal({ isOpen: true, data: req })}
                                                className="text-gray-400 hover:text-[#0F4D39] transition-colors p-2 rounded-full hover:bg-gray-100"
                                                title="View Details & Print"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            {activeTab === 'approvals' && (
                                                <>
                                                    <button onClick={() => handleApproval(req.id, 'APPROVE')} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 border border-green-200">
                                                        <Check className="w-3 h-3" /> Approve
                                                    </button>
                                                    <button onClick={() => handleApproval(req.id, 'REJECT')} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200">
                                                        <X className="w-3 h-3" /> Reject
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                             {(activeTab === 'approvals' ? pendingProcurements : historyProcurements).length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No records found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>

      {/* Approval Preview Modal */}
       {approvalModal.isOpen && approvalModal.request && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className={`px-6 py-4 border-b flex justify-between items-center ${
                       approvalModal.action === 'APPROVE' ? 'bg-green-50' : 'bg-red-50'
                   }`}>
                       <h3 className={`text-lg font-bold ${
                           approvalModal.action === 'APPROVE' ? 'text-green-800' : 'text-red-800'
                       }`}>
                           {approvalModal.action === 'APPROVE' ? 'Approve Procurement' : 'Reject Procurement'}
                       </h3>
                       <button onClick={() => setApprovalModal({ ...approvalModal, isOpen: false })} className="text-gray-500 hover:text-gray-700">
                           <X className="w-5 h-5" />
                       </button>
                   </div>
                   
                   <div className="p-6 space-y-4">
                       {/* Request Preview */}
                       <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                           <div className="flex justify-between">
                               <span className="text-gray-500">Requester:</span>
                               <span className="font-medium text-gray-900">{approvalModal.request.user?.name} ({approvalModal.request.user?.department})</span>
                           </div>
                           
                           <div className="border-t border-gray-200 pt-2 mt-2">
                               <span className="text-gray-500 block mb-2">Items:</span>
                               <ul className="space-y-1 max-h-[150px] overflow-y-auto">
                                   {approvalModal.request.items?.map((item: any, idx: number) => (
                                       <li key={idx} className="flex justify-between text-gray-900">
                                           <span>{item.itemName} ({item.quantity}x)</span>
                                           <span>IDR {(item.quantity * item.unitPrice).toLocaleString()}</span>
                                       </li>
                                   ))}
                               </ul>
                           </div>

                           <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                               <span className="text-gray-700 font-bold">Total Cost:</span>
                               <span className="font-bold text-[#0F4D39]">IDR {approvalModal.request.totalPrice.toLocaleString()}</span>
                           </div>
                           <div className="pt-2 border-t border-gray-200 mt-2">
                               <span className="text-gray-500 block mb-1">Reason:</span>
                               <p className="text-gray-800 italic">{approvalModal.request.reason}</p>
                           </div>
                       </div>
 
                       {/* Note Input */}
                       <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">
                               {approvalModal.action === 'APPROVE' ? 'Add Note (Optional)' : 'Rejection Reason (Required)'}
                           </label>
                           <textarea
                               className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent outline-none transition-all"
                               rows={3}
                               placeholder={approvalModal.action === 'APPROVE' ? "Add a note..." : "Why is this request being rejected?"}
                               value={approvalModal.note}
                               onChange={e => setApprovalModal({ ...approvalModal, note: e.target.value })}
                           ></textarea>
                       </div>
                   </div>
 
                   <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                       <button 
                           onClick={() => setApprovalModal({ ...approvalModal, isOpen: false })}
                           className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                       >
                           Cancel
                       </button>
                       <button 
                           onClick={submitApproval}
                           className={`px-4 py-2 text-white font-medium rounded-lg shadow-lg transition-all transform active:scale-95 flex items-center gap-2 ${
                               approvalModal.action === 'APPROVE' 
                                   ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                                   : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                           }`}
                       >
                           {approvalModal.action === 'APPROVE' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                           Confirm {approvalModal.action === 'APPROVE' ? 'Approval' : 'Rejection'}
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Print/Preview Modal */}
       {previewModal.isOpen && previewModal.data && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#0F4D39]/10 rounded-lg">
                                <FileText className="w-5 h-5 text-[#0F4D39]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Request Preview</h3>
                                <p className="text-xs text-gray-500">ID: #{previewModal.data.id}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handlePrint()}
                                className="flex items-center gap-2 px-4 py-2 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0a3628] transition-colors shadow-lg shadow-[#0F4D39]/20"
                            >
                                <Printer className="w-4 h-4" />
                                Print / Save PDF
                            </button>
                            <button 
                                onClick={() => setPreviewModal({ isOpen: false, data: null })}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Modal Content - Scrollable */}
                    <div className="flex-1 overflow-auto bg-gray-100 p-4 md:p-8">
                        <div className="shadow-lg min-w-[800px] md:min-w-0">
                            <ProcurementInvoice ref={printRef} data={previewModal.data} />
                        </div>
                    </div>
                </div>
            </div>
       )}
    </div>
  );
}
