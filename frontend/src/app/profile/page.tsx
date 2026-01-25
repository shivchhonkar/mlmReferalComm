"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { User, Camera, Save, Upload, Building, Phone, Mail, Globe, MapPin, CreditCard, FileText, Settings, ShoppingBag, Cog } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { apiFetch } from "@/lib/apiClient";

interface UserProfile {
  id: string;
  mobile: string;
  countryCode: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  isBlocked: boolean;
  referralCode: string;
  
  // Business Settings
  businessName?: string;
  companyPhone?: string;
  companyEmail?: string;
  website?: string;
  billingAddress?: string;
  state?: string;
  pincode?: string;
  city?: string;
  language?: string;
  businessType?: string;
  industryType?: string;
  businessDescription?: string;
  gstin?: string;
  panNumber?: string;
  isGSTRegistered?: boolean;
  enableEInvoicing?: boolean;
  enableTDS?: boolean;
  enableTCS?: boolean;
  businessLogo?: string;
  signature?: string;
  currencyCode?: string;
  currencySymbol?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("basic");
  const [successMessage, setSuccessMessage] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Form states for different sections
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    email: "",
  });

  const [companyInfo, setCompanyInfo] = useState({
    businessName: "",
    companyPhone: "",
    companyEmail: "",
    website: "",
    businessDescription: "",
  });

  const [addressInfo, setAddressInfo] = useState({
    billingAddress: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [businessSettings, setBusinessSettings] = useState({
    businessType: "",
    industryType: "",
    language: "",
    currencyCode: "INR",
    currencySymbol: "₹",
  });

  const [taxSettings, setTaxSettings] = useState({
    gstin: "",
    panNumber: "",
    isGSTRegistered: false,
    enableEInvoicing: false,
    enableTDS: false,
    enableTCS: false,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiFetch("/api/profile");
      const data = await res.json();
      setProfile(data.user);
      
      // Initialize form states
      setBasicInfo({
        name: data.user.name || "",
        email: data.user.email || "",
      });
      
      setCompanyInfo({
        businessName: data.user.businessName || "",
        companyPhone: data.user.companyPhone || "",
        companyEmail: data.user.companyEmail || "",
        website: data.user.website || "",
        businessDescription: data.user.businessDescription || "",
      });
      
      setAddressInfo({
        billingAddress: data.user.billingAddress || "",
        city: data.user.city || "",
        state: data.user.state || "",
        pincode: data.user.pincode || "",
      });
      
      setBusinessSettings({
        businessType: data.user.businessType || "",
        industryType: data.user.industryType || "",
        language: data.user.language || "",
        currencyCode: data.user.currencyCode || "INR",
        currencySymbol: data.user.currencySymbol || "₹",
      });
      
      setTaxSettings({
        gstin: data.user.gstin || "",
        panNumber: data.user.panNumber || "",
        isGSTRegistered: data.user.isGSTRegistered || false,
        enableEInvoicing: data.user.enableEInvoicing || false,
        enableTDS: data.user.enableTDS || false,
        enableTCS: data.user.enableTCS || false,
      });
      
      if (data.user.profileImage) {
        setImagePreview(data.user.profileImage);
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfileImage = async () => {
    if (!profileImage) {
      alert('Please select an image first');
      return;
    }
    
    const formData = new FormData();
    formData.append("image", profileImage);
    
    try {
      console.log('Uploading image:', profileImage.name, 'Size:', profileImage.size);
      
      // Use fetch directly for FormData uploads (apiFetch may interfere with multipart/form-data)
      const res = await fetch("/api/upload/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "accept": "application/json"
        }
        // Don't set Content-Type - let the browser set it with boundary for multipart/form-data
      });
      
      const body = await res.json();
      console.log('Upload response:', body, 'Status:', res.status);
      
      if (!res.ok) {
        throw new Error(body.error || "Upload failed");
      }
      
      setSuccessMessage("Profile image uploaded successfully!");
      setProfileImage(null);
      setTimeout(() => setSuccessMessage(""), 3000);
      
      // Reload profile to get updated image
      await loadProfile();
      
      // Trigger profile update event to refresh navbar
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert(`Failed to upload profile image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveBasicInfo = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/basic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basicInfo),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMessage(data.message);
        await loadProfile();
        
        // Trigger profile update event to refresh navbar
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated'));
        }
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update basic info:", error);
      alert("Failed to update basic information");
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyInfo = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyInfo),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMessage(data.message);
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update company info:", error);
      alert("Failed to update company information");
    } finally {
      setSaving(false);
    }
  };

  const saveAddressInfo = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addressInfo),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMessage(data.message);
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update address info:", error);
      alert("Failed to update address information");
    } finally {
      setSaving(false);
    }
  };

  const saveBusinessSettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(businessSettings),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMessage(data.message);
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update business settings:", error);
      alert("Failed to update business settings");
    } finally {
      setSaving(false);
    }
  };

  const saveTaxSettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taxSettings),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMessage(data.message);
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update tax settings:", error);
      alert("Failed to update tax settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img 
                      src={
                        imagePreview.startsWith('http') 
                          ? imagePreview 
                          : imagePreview.startsWith('/uploads')
                          ? `http://localhost:4000${imagePreview}`
                          : imagePreview // base64 data URL
                      }
                      alt="Profile" 
                      className="w-20 h-20 rounded-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load image:', imagePreview);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <User className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1 cursor-pointer hover:bg-blue-700">
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{profile?.name}</h1>
                <p className="text-gray-600">{profile?.email}</p>
                <p className="text-sm text-gray-500">{profile?.mobile}</p>
              </div>
            </div>
            {profileImage && (
              <button
                onClick={uploadProfileImage}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Image
              </button>
            )}
            <div className="flex gap-3">
              <Link
                href="/orders"
                className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-medium"
              >
                <ShoppingBag className="w-4 h-4" />
                Orders
              </Link>
              <Link
                href="/settings"
                className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 font-medium"
              >
                <Cog className="w-4 h-4" />
                Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: "basic", label: "Basic Info", icon: User },
                { id: "company", label: "Company Info", icon: Building },
                { id: "address", label: "Address", icon: MapPin },
                { id: "business", label: "Business Settings", icon: Settings },
                { id: "tax", label: "Tax & Compliance", icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeSection === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <tab.icon className="w-4 h-4 inline mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Sections */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* Basic Info Section */}
          {activeSection === "basic" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={basicInfo.name}
                    onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={basicInfo.email}
                    onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={saveBasicInfo}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Company Info Section */}
          {activeSection === "company" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
                  <input
                    type="text"
                    value={companyInfo.businessName}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, businessName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Phone</label>
                  <input
                    type="tel"
                    value={companyInfo.companyPhone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, companyPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Email</label>
                  <input
                    type="email"
                    value={companyInfo.companyEmail}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, companyEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={companyInfo.website}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Description</label>
                <textarea
                  value={companyInfo.businessDescription}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, businessDescription: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="mt-6">
                <button
                  onClick={saveCompanyInfo}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Address Section */}
          {activeSection === "address" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Address Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Billing Address</label>
                  <textarea
                    value={addressInfo.billingAddress}
                    onChange={(e) => setAddressInfo({ ...addressInfo, billingAddress: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    value={addressInfo.city}
                    onChange={(e) => setAddressInfo({ ...addressInfo, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={addressInfo.state}
                    onChange={(e) => setAddressInfo({ ...addressInfo, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    value={addressInfo.pincode}
                    onChange={(e) => setAddressInfo({ ...addressInfo, pincode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={saveAddressInfo}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Business Settings Section */}
          {activeSection === "business" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Business Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                  <input
                    type="text"
                    value={businessSettings.businessType}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, businessType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry Type</label>
                  <input
                    type="text"
                    value={businessSettings.industryType}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, industryType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                  <input
                    type="text"
                    value={businessSettings.language}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency Code</label>
                  <select
                    value={businessSettings.currencyCode}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, currencyCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="mt-6">
                <button
                  onClick={saveBusinessSettings}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Tax Settings Section */}
          {activeSection === "tax" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Tax & Compliance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GSTIN</label>
                  <input
                    type="text"
                    value={taxSettings.gstin}
                    onChange={(e) => setTaxSettings({ ...taxSettings, gstin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Number</label>
                  <input
                    type="text"
                    value={taxSettings.panNumber}
                    onChange={(e) => setTaxSettings({ ...taxSettings, panNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taxSettings.isGSTRegistered}
                    onChange={(e) => setTaxSettings({ ...taxSettings, isGSTRegistered: e.target.checked })}
                    className="mr-2"
                  />
                  GST Registered
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taxSettings.enableEInvoicing}
                    onChange={(e) => setTaxSettings({ ...taxSettings, enableEInvoicing: e.target.checked })}
                    className="mr-2"
                  />
                  Enable E-Invoicing
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taxSettings.enableTDS}
                    onChange={(e) => setTaxSettings({ ...taxSettings, enableTDS: e.target.checked })}
                    className="mr-2"
                  />
                  Enable TDS
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taxSettings.enableTCS}
                    onChange={(e) => setTaxSettings({ ...taxSettings, enableTCS: e.target.checked })}
                    className="mr-2"
                  />
                  Enable TCS
                </label>
              </div>
              <div className="mt-6">
                <button
                  onClick={saveTaxSettings}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
