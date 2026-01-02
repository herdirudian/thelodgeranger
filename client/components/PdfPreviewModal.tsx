"use client";

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title?: string;
}

export default function PdfPreviewModal({ isOpen, onClose, pdfUrl, title = "PDF Preview" }: PdfPreviewModalProps) {
  if (!isOpen || !pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-700 hover:text-gray-900 text-2xl">&times;</button>
        </div>
        <div className="flex-1 p-0 overflow-hidden bg-gray-100 relative">
             <iframe 
                src={pdfUrl} 
                className="w-full h-full border-0" 
                title="PDF Preview"
             />
        </div>
        <div className="p-4 border-t flex justify-end space-x-2">
           <a 
             href={pdfUrl} 
             download="document.pdf"
             className="bg-[#0F4D39] text-white px-4 py-2 rounded hover:bg-[#0a3628] flex items-center"
           >
             Download
           </a>
           <button 
             onClick={onClose}
             className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
}
