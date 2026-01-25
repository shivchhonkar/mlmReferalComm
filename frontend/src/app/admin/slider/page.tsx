"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import { 
  Image as ImageIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import ImageUpload from "@/app/_components/ImageUpload";
import SliderInlineEdit from "@/app/_components/SliderInlineEdit";

type Slider = {
  _id: string;
  title: string;
  description?: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AdminSliderPage() {
  useAuth({ requireAdmin: true });
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [imageUploadKey, setImageUploadKey] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    order: 0,
    isActive: true
  });

  async function loadSliders() {
    try {
      setError(null);
      const res = await apiFetch("/api/admin/sliders");
      const body = await readApiBody(res);
      if (!res.ok) throw new Error((body.json as any)?.error ?? "Failed to load sliders");
      setSliders((body.json as any)?.sliders || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sliders");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSliders() {
    setIsRefreshing(true);
    setSuccess(null);
    setError(null);
    await loadSliders();
    setSuccess("Sliders refreshed successfully!");
    setTimeout(() => setSuccess(null), 3000);
    setIsRefreshing(false);
  }

  useEffect(() => {
    loadSliders();
  }, []);

  async function createSlider(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch("/api/admin/sliders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          order: sliders.length
        })
      });
      const body = await readApiBody(res);
      if (!res.ok) throw new Error((body.json as any)?.error ?? "Failed to create slider");
      
      setSuccess("Slider created successfully!");
      setFormData({ title: "", description: "", imageUrl: "", order: 0, isActive: true });
      // Force ImageUpload component to reset by changing its key
      setImageUploadKey(prev => prev + 1);
      await loadSliders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create slider");
    } finally {
      setBusy(false);
    }
  }

  async function updateSlider(id: string, updates: Partial<Slider>) {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/admin/sliders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const body = await readApiBody(res);
      if (!res.ok) throw new Error((body.json as any)?.error ?? "Failed to update slider");
      
      setSuccess("Slider updated successfully!");
      setEditingId(null);
      await loadSliders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update slider");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSlider(id: string) {
    if (!confirm("Are you sure you want to delete this slider?")) return;
    
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiFetch(`/api/admin/sliders/${id}`, {
        method: "DELETE"
      });
      const body = await readApiBody(res);
      if (!res.ok) throw new Error((body.json as any)?.error ?? "Failed to delete slider");
      
      setSuccess("Slider deleted successfully!");
      await loadSliders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete slider");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(slider: Slider) {
    await updateSlider(slider._id, { isActive: !slider.isActive });
  }

  async function reorderSliders(reorderedSliders: { id: string; order: number }[]) {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Sending reorder data:', { sliders: reorderedSliders });
      const res = await apiFetch("/api/admin/sliders/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sliders: reorderedSliders })
      });
      const body = await readApiBody(res);
      console.log('Response:', res.status, body);
      if (!res.ok) throw new Error((body.json as any)?.error ?? "Failed to reorder sliders");
      
      setSuccess("Sliders reordered successfully!");
      await loadSliders();
    } catch (err: unknown) {
      console.error('Reorder error:', err);
      setError(err instanceof Error ? err.message : "Failed to reorder sliders");
    } finally {
      setBusy(false);
    }
  }

  function moveSliderUp(index: number) {
    if (index === 0) return;
    const newSliders = [...sliders];
    [newSliders[index], newSliders[index - 1]] = [newSliders[index - 1], newSliders[index]];
    const reordered = newSliders.map((slider, idx) => ({ id: slider._id.toString(), order: idx }));
    reorderSliders(reordered);
  }

  function moveSliderDown(index: number) {
    if (index === sliders.length - 1) return;
    const newSliders = [...sliders];
    [newSliders[index], newSliders[index + 1]] = [newSliders[index + 1], newSliders[index]];
    const reordered = newSliders.map((slider, idx) => ({ id: slider._id.toString(), order: idx }));
    reorderSliders(reordered);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sliders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-gray-500 flex items-center justify-center text-white">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-gray-600 bg-clip-text text-transparent">
                Slider Management
              </h1>
            </div>
            <p className="text-sm text-gray-600 ml-15">
              Manage home page slider images and content
            </p>
          </div>
          <div className="flex gap-3">
            <Link 
              className="glass-panel rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-lg border border-blue-200" 
              prefetch={false}
              href="/admin/services"
            >
              Services
            </Link>
            <Link 
              className="glass-panel rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:scale-105 hover:shadow-lg border border-blue-200" 
              prefetch={false}
              href="/dashboard"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 glass-panel animate-shake rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Create New Slider */}
        <div className="glass-panel rounded-2xl border border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-xl">Create New Slider</h2>
          </div>
          
          <form onSubmit={createSlider} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full glass-panel rounded-lg border border-blue-200 px-4 py-2 font-medium transition-all focus:ring-2 focus:ring-purple-500"
                placeholder="Enter slider title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image *
              </label>
              <ImageUpload
                key={imageUploadKey}
                onImageSelect={(imageUrl) => setFormData({ ...formData, imageUrl })}
                currentImage={formData.imageUrl}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                maxLength={500}
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full glass-panel rounded-lg border border-blue-200 px-4 py-2 font-medium transition-all focus:ring-2 focus:ring-purple-500"
                placeholder="Enter slider description (optional)"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
              >
                {busy ? "Creating..." : "Create Slider"}
              </button>
            </div>
          </form>
        </div>

        {/* Sliders List */}
        <div className="glass-panel rounded-2xl border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-xl">All Sliders</h2>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Success Message */}
              {success && (
                <div className="flex items-center gap-2 glass-panel rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}
              
              {/* Refresh Button */}
              <button
                onClick={refreshSliders}
                disabled={isRefreshing}
                className="flex items-center gap-2 glass-panel rounded-xl px-4 py-2 text-sm font-medium transition-all hover:scale-105 hover:shadow-lg border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh all sliders"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Image Tabs */}
          {sliders.length > 0 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {sliders.map((slider, index) => (
                <button
                  key={slider._id}
                  onClick={() => setActiveImageId(slider._id)}
                  className={`flex-shrink-0 relative px-4 py-2 rounded-lg border transition-all ${
                    activeImageId === slider._id
                      ? 'bg-blue-500 text-white border-purple-500 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-6 rounded overflow-hidden bg-gray-100">
                      <img
                        src={slider.imageUrl}
                        alt={slider.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='24' viewBox='0 0 32 24'%3E%3Crect width='32' height='24' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280' font-family='sans-serif' font-size='8'%3ENo img%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium truncate max-w-20">
                      {slider.title || `Slider ${index + 1}`}
                    </span>
                    {slider.isActive && (
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    )}
                  </div>
                  {activeImageId === slider._id && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {sliders.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600">No sliders created yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sliders.map((slider, index) => (
                <div 
                  key={slider._id} 
                  className={`border rounded-lg p-4 transition-all ${
                    activeImageId === slider._id
                      ? 'border-purple-500 bg-blue-50/50 shadow-lg'
                      : 'border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Image Preview */}
                    <div className="w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                      <img
                        src={slider.imageUrl}
                        alt={slider.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='64' viewBox='0 0 96 64'%3E%3Crect width='96' height='64' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280' font-family='sans-serif' font-size='12'%3ENo image%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      {/* Active Indicator */}
                      {activeImageId === slider._id && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1">
                      {editingId === slider._id ? (
                        <SliderInlineEdit
                          slider={slider}
                          onSave={(updatedSlider) => updateSlider(slider._id, updatedSlider)}
                          onCancel={() => {
                            setEditingId(null);
                            loadSliders();
                          }}
                          busy={busy}
                        />
                      ) : (
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 mb-1">
                            {slider.title}
                          </h3>
                          {slider.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {slider.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-700">
                            <span>Order: {slider.order}</span>
                            <span>Status: {slider.isActive ? "Active" : "Inactive"}</span>
                            <span>Created: {new Date(slider.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveSliderUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSliderDown(index)}
                          disabled={index === sliders.length - 1}
                          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      
                      {editingId === slider._id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updateSlider(slider._id, slider)}
                            disabled={busy}
                            className="p-1 rounded hover:bg-green-100 text-green-600"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              loadSliders();
                            }}
                            className="p-1 rounded hover:bg-red-100 text-red-600"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingId(slider._id)}
                            disabled={busy}
                            className="p-1 rounded hover:bg-blue-100 text-blue-600"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(slider)}
                            disabled={busy}
                            className="p-1 rounded hover:bg-yellow-100 text-yellow-600"
                            title={slider.isActive ? "Deactivate" : "Activate"}
                          >
                            {slider.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteSlider(slider._id)}
                            disabled={busy}
                            className="p-1 rounded hover:bg-red-100 text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
