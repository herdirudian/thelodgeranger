"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, Edit2, Trash2, ChevronDown, ChevronRight, 
  Settings, ClipboardCheck, List, Save, X, 
  GripVertical, Loader2, ArrowLeft, Copy
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function ChecklistManagerPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplates, setExpandedTemplates] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);

  // Form states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    department: "",
    dayOfWeek: ""
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    order: 0
  });

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [currentCategoryId, setCurrentCategoryId] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question: "",
    type: "BOOLEAN",
    order: 0,
    isRequired: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/checklist/admin/templates");
      setTemplates(res.data);
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.role === 'GM' || user.role === 'HR')) {
      fetchData();
    }
  }, [user]);

  const toggleTemplate = (id: number) => {
    setExpandedTemplates(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: number) => {
    setExpandedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Template Handlers
  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await api.put(`/checklist/admin/templates/${editingTemplate.id}`, templateForm);
      } else {
        await api.post("/checklist/admin/templates", templateForm);
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateForm({ name: "", department: "", dayOfWeek: "" });
      fetchData();
    } catch (err) {
      alert("Error saving template");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Hapus template ini? Semua kategori dan pertanyaan di dalamnya juga akan terhapus.")) return;
    try {
      await api.delete(`/checklist/admin/templates/${id}`);
      fetchData();
    } catch (err) {
      alert("Error deleting template");
    }
  };

  const handleDuplicateTemplate = async (id: number) => {
    if (!confirm("Duplikat template ini beserta semua kategori dan pertanyaannya?")) return;
    try {
      setLoading(true);
      await api.post(`/checklist/admin/templates/${id}/duplicate`);
      fetchData();
    } catch (err) {
      alert("Error duplicating template");
      setLoading(false);
    }
  };

  // Category Handlers
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/checklist/admin/categories/${editingCategory.id}`, categoryForm);
      } else {
        await api.post("/checklist/admin/categories", { 
          ...categoryForm, 
          templateId: currentTemplateId 
        });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", order: 0 });
      fetchData();
    } catch (err) {
      alert("Error saving category");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Hapus kategori ini? Semua pertanyaan di dalamnya juga akan terhapus.")) return;
    try {
      await api.delete(`/checklist/admin/categories/${id}`);
      fetchData();
    } catch (err) {
      alert("Error deleting category");
    }
  };

  // Question Handlers
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingQuestion) {
        await api.put(`/checklist/admin/questions/${editingQuestion.id}`, questionForm);
      } else {
        await api.post("/checklist/admin/questions", { 
          ...questionForm, 
          categoryId: currentCategoryId 
        });
      }
      setShowQuestionModal(false);
      setEditingQuestion(null);
      setQuestionForm({ question: "", type: "BOOLEAN", order: 0, isRequired: true });
      fetchData();
    } catch (err) {
      alert("Error saving question");
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Hapus pertanyaan ini?")) return;
    try {
      await api.delete(`/checklist/admin/questions/${id}`);
      fetchData();
    } catch (err) {
      alert("Error deleting question");
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'GM' && user.role !== 'HR')) {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="flex items-center text-sm text-gray-500 hover:text-[#0F4D39] transition-colors mb-2">
            <ArrowLeft size={16} className="mr-1" /> Kembali ke Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Manage Checklist Templates</h1>
          <p className="text-gray-500 mt-1">Buat dan edit pertanyaan checklist per departemen secara manual.</p>
        </div>
        <button 
          onClick={() => {
            setEditingTemplate(null);
            setTemplateForm({ name: "", department: "", dayOfWeek: "" });
            setShowTemplateModal(true);
          }}
          className="bg-[#0F4D39] text-white px-5 py-2.5 rounded-lg flex items-center justify-center space-x-2 hover:bg-[#0a3a2b] transition-colors shadow-sm"
        >
          <Plus size={20} /> <span>Create New Template</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <ClipboardCheck className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">Belum ada template checklist. Mulai dengan membuat yang baru.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
              <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div 
                  className="flex items-center flex-1 cursor-pointer"
                  onClick={() => toggleTemplate(template.id)}
                >
                  <div className="mr-3 text-gray-400">
                    {expandedTemplates.includes(template.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center">
                      {template.name}
                      {!template.isActive && <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded uppercase">Inactive</span>}
                    </h3>
                    <div className="text-sm text-gray-500 flex items-center gap-3">
                      <span>{template.department}</span>
                      {template.dayOfWeek && <span className="px-1.5 py-0.5 bg-[#0F4D39]/10 text-[#0F4D39] text-[10px] rounded">{template.dayOfWeek}</span>}
                      <span>• {(template.categories || []).length} Categories</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => {
                      setCurrentTemplateId(template.id);
                      setEditingCategory(null);
                      setCategoryForm({ name: "", order: (template.categories?.length || 0) + 1 });
                      setShowCategoryModal(true);
                    }}
                    className="p-2 text-gray-500 hover:text-[#0F4D39] hover:bg-[#0F4D39]/5 rounded-lg transition-all"
                    title="Add Category"
                  >
                    <Plus size={18} />
                  </button>
                  <button 
                    onClick={() => handleDuplicateTemplate(template.id)}
                    className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                    title="Duplicate Template"
                  >
                    <Copy size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingTemplate(template);
                      setTemplateForm({ 
                        name: template.name, 
                        department: template.department, 
                        dayOfWeek: template.dayOfWeek || "" 
                      });
                      setShowTemplateModal(true);
                    }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {expandedTemplates.includes(template.id) && (
                <div className="bg-gray-50 p-4 space-y-4 border-t border-gray-100">
                  {template.categories?.length === 0 ? (
                    <div className="text-center py-6 text-sm text-gray-400 italic">
                      No categories in this template.
                    </div>
                  ) : (
                    template.categories.map((category: any) => (
                      <div key={category.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-3 flex items-center justify-between bg-gray-50/50">
                          <div 
                            className="flex items-center flex-1 cursor-pointer"
                            onClick={() => toggleCategory(category.id)}
                          >
                            <div className="mr-2 text-gray-400">
                              {expandedCategories.includes(category.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            <span className="font-semibold text-gray-800 text-sm">
                              {category.name}
                              <span className="ml-2 text-[10px] text-gray-400 font-normal">Order: {category.order}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button 
                              onClick={() => {
                                setCurrentCategoryId(category.id);
                                setEditingQuestion(null);
                                setQuestionForm({ question: "", type: "BOOLEAN", order: (category.questions?.length || 0) + 1, isRequired: true });
                                setShowQuestionModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-[#0F4D39] hover:bg-white rounded transition-all"
                              title="Add Question"
                            >
                              <Plus size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingCategory(category);
                                setCategoryForm({ name: category.name, order: category.order });
                                setShowCategoryModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(category.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {expandedCategories.includes(category.id) && (
                          <div className="p-2 space-y-1">
                            {category.questions?.length === 0 ? (
                              <div className="text-center py-4 text-xs text-gray-400 italic">
                                No questions in this category.
                              </div>
                            ) : (
                              category.questions.map((q: any) => (
                                <div key={q.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group transition-colors">
                                  <div className="flex items-center min-w-0 flex-1 mr-4">
                                    <span className="text-xs text-gray-400 mr-2 w-4">{q.order}.</span>
                                    <div className="min-w-0">
                                      <p className="text-sm text-gray-700 truncate">{q.question}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{q.type}</span>
                                        {!q.isRequired && <span className="text-[10px] text-orange-400 italic">Optional</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingQuestion(q);
                                        setQuestionForm({ 
                                          question: q.question, 
                                          type: q.type, 
                                          order: q.order, 
                                          isRequired: q.isRequired 
                                        });
                                        setShowQuestionModal(true);
                                      }}
                                      className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteQuestion(q.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingTemplate ? "Edit Template" : "New Template"}</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleTemplateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Template Name</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all"
                  placeholder="e.g. Daily Parkir Opening"
                  value={templateForm.name}
                  onChange={e => setTemplateForm({...templateForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Department</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all bg-white"
                  value={templateForm.department}
                  onChange={e => setTemplateForm({...templateForm, department: e.target.value})}
                  required
                >
                  <option value="">Select Department</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Cashier">Cashier</option>
                  <option value="Parkir">Parkir</option>
                  <option value="Front Office">Front Office</option>
                  <option value="F&B Service">F&B Service</option>
                  <option value="F&B Product">F&B Product</option>
                  <option value="Engineering">Engineering</option>
                  <option value="IT">IT</option>
                  <option value="Security">Security</option>
                  <option value="General Affair">General Affair</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Day (Optional)</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all bg-white"
                  value={templateForm.dayOfWeek}
                  onChange={e => setTemplateForm({...templateForm, dayOfWeek: e.target.value})}
                >
                  <option value="">Every Day</option>
                  <option value="Senin">Senin</option>
                  <option value="Selasa">Selasa</option>
                  <option value="Rabu">Rabu</option>
                  <option value="Kamis">Kamis</option>
                  <option value="Jumat">Jumat</option>
                  <option value="Sabtu">Sabtu</option>
                  <option value="Minggu">Minggu</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0a3a2b] transition-colors shadow-sm"
                >
                  {editingTemplate ? "Update Template" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingCategory ? "Edit Category" : "New Category"}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Category Name</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all"
                  placeholder="e.g. Kebersihan Area"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Display Order</label>
                <input 
                  type="number" 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all"
                  value={categoryForm.order}
                  onChange={e => setCategoryForm({...categoryForm, order: parseInt(e.target.value) || 0})}
                  required
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0a3a2b] transition-colors shadow-sm"
                >
                  {editingCategory ? "Update Category" : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingQuestion ? "Edit Question" : "New Question"}</h2>
              <button onClick={() => setShowQuestionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleQuestionSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Question Text</label>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all min-h-[100px]"
                  placeholder="e.g. Apakah area parkir sudah disapu?"
                  value={questionForm.question}
                  onChange={e => setQuestionForm({...questionForm, question: e.target.value})}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Input Type</label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all bg-white"
                    value={questionForm.type}
                    onChange={e => setQuestionForm({...questionForm, type: e.target.value})}
                  >
                    <option value="BOOLEAN">Yes / No (Checkbox)</option>
                    <option value="NUMBER">Number / Quantity</option>
                    <option value="TEXT">Short Text</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Display Order</label>
                  <input 
                    type="number" 
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#0F4D39] focus:border-transparent transition-all"
                    value={questionForm.order}
                    onChange={e => setQuestionForm({...questionForm, order: parseInt(e.target.value) || 0})}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 py-2">
                <input 
                  type="checkbox" 
                  id="isRequired"
                  className="w-4 h-4 text-[#0F4D39] rounded border-gray-300 focus:ring-[#0F4D39]"
                  checked={questionForm.isRequired}
                  onChange={e => setQuestionForm({...questionForm, isRequired: e.target.checked})}
                />
                <label htmlFor="isRequired" className="text-sm font-medium text-gray-700">Wajib diisi (Required)</label>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-[#0F4D39] text-white rounded-lg hover:bg-[#0a3a2b] transition-colors shadow-sm"
                >
                  {editingQuestion ? "Update Question" : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
