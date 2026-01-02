import React, { forwardRef } from 'react';
import { format } from 'date-fns';

interface ProcurementInvoiceProps {
  data: any;
}

export const ProcurementInvoice = forwardRef<HTMLDivElement, ProcurementInvoiceProps>(({ data }, ref) => {
  if (!data) return null;

  const totalAmount = data.items?.reduce((acc: number, item: any) => {
    return acc + (item.totalPrice || (item.quantity * item.unitPrice));
  }, 0) || 0;

  return (
    <div ref={ref} className="p-8 bg-white max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#0F4D39]">PURCHASE REQUEST</h1>
          <p className="text-gray-500 mt-1">The Lodge Ranger</p>
        </div>
        <div className="text-right">
          <p className="text-gray-600">Request ID: <span className="font-bold text-gray-900">#{data.id}</span></p>
          <p className="text-gray-600">Date: <span className="font-medium text-gray-900">{format(new Date(data.createdAt), 'dd MMMM yyyy')}</span></p>
          <p className="text-gray-600">Status: <span className="font-bold uppercase text-[#0F4D39]">{data.status?.replace(/_/g, ' ')}</span></p>
        </div>
      </div>

      {/* Requester Info */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2">Requester Information</h2>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{data.user?.name || 'N/A'}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Department/Role</p>
                <p className="font-medium">{data.user?.role || 'N/A'}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Required Date</p>
                <p className="font-medium">{data.requiredDate ? format(new Date(data.requiredDate), 'dd MMMM yyyy') : 'N/A'}</p>
            </div>
            <div>
                <p className="text-sm text-gray-500">Justification</p>
                <p className="font-medium">{data.reason || '-'}</p>
            </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Items Requested</h2>
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-[#0F4D39] text-white">
              <th className="p-3 text-left text-sm border border-gray-300">No</th>
              <th className="p-3 text-left text-sm border border-gray-300">Item Name</th>
              <th className="p-3 text-left text-sm border border-gray-300">Description</th>
              <th className="p-3 text-center text-sm border border-gray-300">Category</th>
              <th className="p-3 text-center text-sm border border-gray-300">Qty</th>
              <th className="p-3 text-right text-sm border border-gray-300">Unit Price</th>
              <th className="p-3 text-right text-sm border border-gray-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items?.map((item: any, index: number) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="p-3 text-center text-sm border border-gray-200">{index + 1}</td>
                <td className="p-3 text-sm border border-gray-200 font-medium">{item.itemName}</td>
                <td className="p-3 text-sm border border-gray-200 text-gray-600">{item.description || '-'}</td>
                <td className="p-3 text-center text-sm border border-gray-200">{item.category}</td>
                <td className="p-3 text-center text-sm border border-gray-200">{item.quantity}</td>
                <td className="p-3 text-right text-sm border border-gray-200">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.unitPrice)}
                </td>
                <td className="p-3 text-right text-sm border border-gray-200 font-bold">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.totalPrice || (item.quantity * item.unitPrice))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
                <td colSpan={6} className="p-3 text-right font-bold text-gray-900 border border-gray-200">Grand Total</td>
                <td className="p-3 text-right font-bold text-[#0F4D39] border border-gray-200">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalAmount)}
                </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Approval Section */}
      <div className="mt-12 pt-6 border-t-2 border-gray-100">
        <h3 className="text-sm font-bold text-gray-500 mb-6 uppercase tracking-wider">Approvals</h3>
        <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
                <p className="text-xs text-gray-400 mb-8">Requested By</p>
                <div className="h-16 border-b border-gray-300 mb-2 flex items-end justify-center pb-2">
                    <span className="font-bold text-gray-800">{data.user?.name}</span>
                </div>
                <p className="text-xs text-gray-500">Date: {format(new Date(data.createdAt), 'dd/MM/yyyy')}</p>
            </div>
            
            <div className="text-center">
                <p className="text-xs text-gray-400 mb-8">HOD Approval</p>
                <div className="h-16 border-b border-gray-300 mb-2 flex items-end justify-center pb-2">
                    {data.hodApproved ? <span className="font-bold text-[#0F4D39]">APPROVED</span> : <span className="text-gray-300">Pending</span>}
                </div>
                {data.hodNote && <p className="text-[10px] text-gray-500 mt-1 italic">"{data.hodNote}"</p>}
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-400 mb-8">Supervisor Operational</p>
                <div className="h-16 border-b border-gray-300 mb-2 flex items-end justify-center pb-2">
                    {data.spvApproved ? <span className="font-bold text-[#0F4D39]">APPROVED</span> : <span className="text-gray-300">Pending</span>}
                </div>
                {data.spvNote && <p className="text-[10px] text-gray-500 mt-1 italic">"{data.spvNote}"</p>}
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-400 mb-8">Finance Approval</p>
                <div className="h-16 border-b border-gray-300 mb-2 flex items-end justify-center pb-2">
                    {data.financeApproved ? <span className="font-bold text-[#0F4D39]">APPROVED</span> : <span className="text-gray-300">Pending</span>}
                </div>
                {data.financeNote && <p className="text-[10px] text-gray-500 mt-1 italic">"{data.financeNote}"</p>}
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-400 mb-8">GM Approval</p>
                <div className="h-16 border-b border-gray-300 mb-2 flex items-end justify-center pb-2">
                    {data.status === 'APPROVED' ? <span className="font-bold text-[#0F4D39]">APPROVED</span> : <span className="text-gray-300">Pending</span>}
                </div>
                {data.gmNote && <p className="text-[10px] text-gray-500 mt-1 italic">"{data.gmNote}"</p>}
            </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4">
        <p>Generated by The Lodge Ranger System on {format(new Date(), 'dd MMMM yyyy HH:mm')}</p>
      </div>
    </div>
  );
});

ProcurementInvoice.displayName = 'ProcurementInvoice';
