"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import PdfPreviewModal from "@/components/PdfPreviewModal";
import { 
  MapPin, 
  Camera, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  X, 
  Send,
  History,
  FileCheck,
  ChevronRight,
  Clock,
  Calendar
} from "lucide-react";

export default function AttendancePage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [isExternal, setIsExternal] = useState(true); 
  const [photo, setPhoto] = useState<File | null>(null);

  // Camera Refs and State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get("/attendance/me");
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      setStatus("Locating...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setStatus("Location found");
        },
        (error) => {
          setStatus("Error getting location: " + error.message);
        }
      );
    } else {
      setStatus("Geolocation is not supported by this browser.");
    }
  };

  const startCamera = async () => {
      setIsCameraOpen(true);
      setCapturedImage(null);
      setPhoto(null);
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: "environment" } 
          });
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
          }
      } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Could not access camera. Please allow camera permissions.");
          setIsCameraOpen(false);
      }
  };

  const stopCamera = () => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
      setIsCameraOpen(false);
  };

  const capturePhoto = () => {
      if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const context = canvas.getContext('2d');
          if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              const dataUrl = canvas.toDataURL('image/jpeg');
              setCapturedImage(dataUrl);
              
              fetch(dataUrl)
                  .then(res => res.blob())
                  .then(blob => {
                      const file = new File([blob], "attendance-photo.jpg", { type: "image/jpeg" });
                      setPhoto(file);
                  });
              
              stopCamera();
          }
      }
  };

  const retakePhoto = () => {
      setCapturedImage(null);
      setPhoto(null);
      startCamera();
  };

  const handleClockIn = async () => {
    if (isExternal) {
        if (!location) {
            alert("Location is required for External Duty");
            return;
        }
        if (!photo) {
            alert("Photo is required for External Duty");
            return;
        }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("type", isExternal ? "EXTERNAL_DUTY" : "CHECK_IN");
      if (location) {
          formData.append("latitude", location.lat.toString());
          formData.append("longitude", location.lng.toString());
      }
      formData.append("location", isExternal ? "External Location (GPS)" : "Office");
      if (notes) formData.append("notes", notes);
      if (photo) formData.append("photo", photo);

      await api.post("/attendance", formData, {
          headers: {
              'Content-Type': 'multipart/form-data',
          },
      });
      alert("Clocked in successfully!");
      fetchHistory();
      
      setPhoto(null);
      setCapturedImage(null);
      setNotes("");
      stopCamera();
      setLocation(null);
      setStatus("");

    } catch (err: any) {
      alert(err.response?.data?.message || "Error clocking in");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (id: number) => {
      try {
          const res = await api.get(`/attendance/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `attendance-${id}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
      } catch (err) {
          alert("Error downloading PDF");
      }
  };

  const handlePreviewPDF = async (id: number) => {
      try {
          const res = await api.get(`/attendance/${id}/pdf`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          setPreviewUrl(url);
          setShowPreview(true);
      } catch (err) {
          alert("Error previewing PDF");
      }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PdfPreviewModal 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        pdfUrl={previewUrl} 
        title="Attendance Preview"
      />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-[#0F4D39]/10 rounded-lg">
                    <FileCheck className="w-8 h-8 text-[#0F4D39]" />
                </div>
                Attendance
            </h1>
            <p className="text-gray-500 mt-2 text-lg">Manage your external duty and check-ins efficiently.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: Submission Form */}
        <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden transition-all hover:shadow-2xl hover:shadow-gray-200/50 duration-300">
                <div className="bg-gradient-to-r from-[#0F4D39] to-[#1a6b52] px-8 py-6 text-white flex items-center justify-between">
                    <div>
                        <h2 className="font-bold text-xl flex items-center gap-2">
                            External Duty Check-in
                        </h2>
                        <p className="text-[#8ecbb7] text-sm mt-1">Submit your location and proof</p>
                    </div>
                    <span className="bg-white/20 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border border-white/10 shadow-sm">
                        GPS Active
                    </span>
                </div>
                
                <div className="p-8 space-y-8">
                    {/* Step 1: Location */}
                    <div className="relative pl-4 border-l-2 border-gray-100 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-white ring-2 ring-blue-500/20"></div>
                        <label className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 block">
                            1. Location Verification
                        </label>
                        
                        {!location ? (
                            <button 
                                onClick={getLocation}
                                className="w-full py-10 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all group duration-300"
                            >
                                <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:bg-blue-100 group-hover:scale-110 transition-all duration-300">
                                    <MapPin className="w-8 h-8 text-blue-500" />
                                </div>
                                <span className="font-semibold text-lg">Get GPS Location</span>
                                <span className="text-sm text-gray-400 mt-1">Tap to verify your current position</span>
                                {status && <span className="text-sm text-blue-500 mt-3 font-medium animate-pulse">{status}</span>}
                            </button>
                        ) : (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white p-3 rounded-full shadow-sm border border-green-100">
                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-base font-bold text-green-900">Location Verified</p>
                                        <p className="text-sm text-green-700 font-mono mt-0.5 flex items-center gap-2">
                                            <MapPin className="w-3 h-3" />
                                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={getLocation} 
                                    className="text-gray-400 hover:text-gray-600 hover:bg-white/50 p-2.5 rounded-xl transition-all"
                                    title="Refresh Location"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Photo */}
                    <div className="relative pl-4 border-l-2 border-gray-100 pb-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-100 border-2 border-white ring-2 ring-indigo-500/20"></div>
                        <label className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 block">
                            2. Photo Proof
                        </label>

                        {!isCameraOpen && !capturedImage && (
                            <button 
                                onClick={startCamera}
                                className="w-full py-10 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:border-[#0F4D39] hover:text-[#0F4D39] hover:bg-green-50/50 transition-all group duration-300"
                            >
                                <div className="bg-green-50 p-4 rounded-full mb-4 group-hover:bg-green-100 group-hover:scale-110 transition-all duration-300">
                                    <Camera className="w-8 h-8 text-[#0F4D39]" />
                                </div>
                                <span className="font-semibold text-lg">Take Photo</span>
                                <span className="text-sm text-gray-400 mt-1">Capture a photo of your surroundings</span>
                            </button>
                        )}

                        {isCameraOpen && (
                            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center shadow-lg">
                                <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-8">
                                    <button 
                                        onClick={stopCamera}
                                        className="bg-white/20 text-white rounded-full p-4 hover:bg-white/30 backdrop-blur-md transition-all"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={capturePhoto}
                                        className="bg-white rounded-full p-1.5 shadow-xl hover:scale-105 transition-transform active:scale-95"
                                    >
                                        <div className="w-16 h-16 rounded-full border-4 border-[#0F4D39] bg-white flex items-center justify-center">
                                            <div className="w-12 h-12 rounded-full bg-[#0F4D39]"></div>
                                        </div>
                                    </button>
                                    <div className="w-14"></div> {/* Spacer for balance */}
                                </div>
                            </div>
                        )}

                        {capturedImage && (
                            <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-md group">
                                <img src={capturedImage} alt="Captured" className="w-full h-72 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-sm">
                                    <button 
                                        onClick={retakePhoto}
                                        className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-xl hover:bg-gray-50 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        Retake Photo
                                    </button>
                                </div>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Step 3: Notes */}
                    <div className="relative pl-4">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-orange-100 border-2 border-white ring-2 ring-orange-500/20"></div>
                        <label className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 block">
                            3. Activity Notes
                        </label>
                        <div className="relative group">
                            <div className="absolute top-4 left-4 p-1.5 bg-gray-100 rounded-lg group-focus-within:bg-[#0F4D39]/10 transition-colors">
                                <FileText className="w-5 h-5 text-gray-400 group-focus-within:text-[#0F4D39]" />
                            </div>
                            <textarea 
                                placeholder="Describe your activity, meeting details, or location specifics..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full pl-14 pr-4 py-4 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#0F4D39]/10 focus:border-[#0F4D39] min-h-[120px] resize-none text-base transition-all placeholder:text-gray-400 bg-gray-50/50 focus:bg-white"
                            />
                        </div>
                    </div>

                    <button 
                        onClick={handleClockIn}
                        disabled={loading || !location || !photo}
                        className={`w-full py-5 rounded-2xl font-bold text-lg text-white transition-all flex items-center justify-center gap-3 shadow-xl ${
                            loading || !location || !photo
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                                : 'bg-[#0F4D39] hover:bg-[#0a3628] hover:shadow-2xl hover:shadow-[#0F4D39]/30 hover:-translate-y-1'
                        }`}
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-6 h-6 animate-spin" />
                                Processing Request...
                            </>
                        ) : (
                            <>
                                <Send className="w-6 h-6" />
                                Submit Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* Right Column: History */}
        <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-8">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 backdrop-blur-sm flex items-center justify-between z-10">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2.5 text-lg">
                        <History className="w-5 h-5 text-gray-500" />
                        Recent History
                    </h2>
                    <span className="text-xs font-medium px-2.5 py-1 bg-gray-200/60 rounded-full text-gray-600">
                        {history.length} Records
                    </span>
                </div>
                
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {history.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {history.map((record, index) => (
                                <div key={record.id} className="p-5 hover:bg-gray-50 transition-all duration-200 group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex gap-3">
                                            <div className={`p-2 rounded-xl h-fit ${
                                                record.type === 'CHECK_IN' ? 'bg-green-100 text-green-700' : 
                                                record.type === 'EXTERNAL_DUTY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {record.type === 'CHECK_IN' ? <Clock className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{format(new Date(record.timestamp), 'MMM dd, yyyy')}</p>
                                                <p className="text-sm text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {format(new Date(record.timestamp), 'HH:mm')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                record.type === 'CHECK_IN' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                record.type === 'EXTERNAL_DUTY' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                                {record.type.replace('_', ' ')}
                                            </span>
                                            {/* Status Badge */}
                                            {record.status && (
                                                 <span className={`text-[10px] font-bold ${
                                                    record.status === 'APPROVED' ? 'text-green-600' : 
                                                    record.status.includes('REJECTED') ? 'text-red-600' : 'text-orange-500'
                                                }`}>
                                                    {record.status.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-2 text-sm text-gray-600 mb-4 bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                                        <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                                        <span className="leading-relaxed">{record.location || 'Unknown Location'}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handlePreviewPDF(record.id)}
                                            className="py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPDF(record.id)}
                                            className="py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                                        >
                                            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                            <div className="bg-gray-50 p-4 rounded-full mb-4">
                                <History className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-gray-900 font-semibold">No history yet</h3>
                            <p className="text-sm text-gray-500 mt-1">Your attendance records will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
