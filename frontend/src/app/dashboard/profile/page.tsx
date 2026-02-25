"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  User,
  Camera,
  Save,
  Upload,
  Building,
  MapPin,
  CreditCard,
  Settings,
  ShoppingBag,
  Cog,
  CheckCircle2,
  ChevronRight,
  Copy,
  Loader2,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

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

const tabs = [
  { id: "basic", label: "Basic Info", icon: User, desc: "Name and contact email" },
  { id: "company", label: "Company Info", icon: Building, desc: "Business details and branding" },
  { id: "address", label: "Address", icon: MapPin, desc: "Billing and shipping address" },
  { id: "business", label: "Business Settings", icon: Settings, desc: "Language, currency & preferences" },
  { id: "tax", label: "Tax & Compliance", icon: CreditCard, desc: "GSTIN, PAN and invoicing" },
] as const;

function getImageUrl(src: string): string {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000");
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof tabs)[number]["id"]>("basic");
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

  // ---------------------------
  // ✅ Frontend validation: companyEmail + website
  // ---------------------------
  const [companyErrors, setCompanyErrors] = useState<{
    companyEmail?: string;
    website?: string;
  }>({});

  // Same strict-ish email pattern as backend error output (good enough for FE validation)
  const emailRegex =
    /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

  function isValidEmail(v: string) {
    const s = v.trim();
    if (!s) return true; // optional
    return emailRegex.test(s);
  }

  function normalizeWebsite(v: string) {
    const s = v.trim();
    if (!s) return "";
    // If user types "billint.com" or "www.billint.com" -> add https://
    if (!/^https?:\/\//i.test(s)) return `https://${s}`;
    return s;
  }

  function isValidUrl(v: string) {
    const s = v.trim();
    if (!s) return true; // optional
    try {
      const url = new URL(s);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateCompanyInfo(next?: typeof companyInfo) {
    const values = next ?? companyInfo;
    const nextErrors: { companyEmail?: string; website?: string } = {};

    const emailVal = values.companyEmail?.trim() ?? "";
    if (emailVal && !isValidEmail(emailVal)) {
      nextErrors.companyEmail = "Please enter a valid email (e.g. support@company.com).";
    }

    const siteVal = values.website?.trim() ?? "";
    if (siteVal) {
      const normalized = normalizeWebsite(siteVal);
      if (!isValidUrl(normalized)) {
        nextErrors.website = "Please enter a valid website URL (e.g. https://example.com).";
      }
    }

    setCompanyErrors(nextErrors);
    return nextErrors;
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // validate company fields once (so existing invalid values show immediately)
      setTimeout(() => validateCompanyInfo(), 0);
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
      showErrorToast("Please select an image first");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("image", profileImage);

    try {
      // Use fetch directly for FormData uploads (apiFetch may interfere with multipart/form-data)
      const res = await fetch("/api/upload/profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          accept: "application/json",
        },
        // Don't set Content-Type - let the browser set it with boundary for multipart/form-data
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || "Upload failed");
      }

      setSuccessMessage("Profile image uploaded successfully!");
      setProfileImage(null);
      showSuccessToast("Profile image uploaded successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);

      // Reload profile to get updated image
      await loadProfile();

      // Trigger profile update event to refresh navbar
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("profileUpdated"));
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
      showErrorToast(
        `Failed to upload profile image: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setSaving(false);
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
        showSuccessToast(data.message || "Basic information updated successfully");
        await loadProfile();

        // Trigger profile update event to refresh navbar
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("profileUpdated"));
        }
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update basic info:", error);
      showErrorToast("Failed to update basic information");
    } finally {
      setSaving(false);
    }
  };

  const saveCompanyInfo = async () => {
    // ✅ validate before saving
    const errs = validateCompanyInfo();
    if (Object.keys(errs).length > 0) {
      showErrorToast("Please fix Company Email / Website before saving");
      return;
    }

    // ✅ normalize before sending
    const payload = {
      ...companyInfo,
      companyEmail: companyInfo.companyEmail.trim(),
      website: companyInfo.website ? normalizeWebsite(companyInfo.website) : "",
    };

    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(data.message);
        showSuccessToast(data.message || "Company information updated successfully");
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update company info:", error);
      showErrorToast("Failed to update company information");
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
        showSuccessToast(data.message || "Address information updated successfully");
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update address info:", error);
      showErrorToast("Failed to update address information");
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
        showSuccessToast(data.message || "Business settings updated successfully");
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update business settings:", error);
      showErrorToast("Failed to update business settings");
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
        showSuccessToast(data.message || "Tax settings updated successfully");
        await loadProfile();
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("Failed to update tax settings:", error);
      showErrorToast("Failed to update tax settings");
    } finally {
      setSaving(false);
    }
  };

  const copyReferralCode = () => {
    if (profile?.referralCode) {
      navigator.clipboard.writeText(profile.referralCode);
      showSuccessToast("Referral code copied!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex gap-4">
                <div className="h-20 w-20 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-48 rounded bg-slate-200" />
                  <div className="h-4 w-32 rounded bg-slate-100" />
                  <div className="h-4 w-40 rounded bg-slate-100" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="space-y-4">
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-10 w-32 rounded-lg bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-emerald-600 transition">
            Dashboard
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">Profile</span>
        </nav>

        {/* Header Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 p-[2px] ring-2 ring-white shadow-lg">
                  <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-white">
                    {imagePreview ? (
                      <img
                        src={getImageUrl(imagePreview)}
                        alt="Profile"
                        className="h-full w-full rounded-xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <User className="h-12 w-12 text-emerald-600" />
                    )}
                  </div>
                </div>

                <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-gradient-to-r from-emerald-600 to-sky-600 shadow-md transition hover:scale-105 hover:shadow-lg">
                  <Camera className="h-4 w-4 text-white" />
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>

              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl truncate">{profile?.name || "Profile"}</h1>
                <p className="mt-0.5 text-sm text-slate-600 truncate">{profile?.email || "—"}</p>
                <p className="text-sm text-slate-500">{profile?.mobile || "—"}</p>
                {profile?.referralCode && (
                  <button
                    type="button"
                    onClick={copyReferralCode}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <span>{profile.referralCode}</span>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {profileImage && (
                <button
                  onClick={uploadProfileImage}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Image
                </button>
              )}

              <Link
                href="/dashboard/orders"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Orders
              </Link>

              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
              >
                <Cog className="h-4 w-4 text-sky-600" />
                Settings
              </Link>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
          </div>
        )}

        {/* Tabs + Content */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <nav className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/80" aria-label="Profile sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeSection === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={[
                    "flex shrink-0 flex-col items-start gap-0.5 border-b-2 px-5 py-4 text-left transition sm:flex-row sm:items-center sm:gap-2 hover:cursor-pointer",
                    active
                      ? "border-emerald-600 bg-white text-emerald-700 shadow-sm"
                      : "border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900",
                  ].join(" ")}
                  type="button"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-600" : "text-slate-500"}`} />
                  <span className="text-sm font-semibold">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="p-6 sm:p-8">
          {/* Basic Info */}
          {activeSection === "basic" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
                <p className="mt-1 text-sm text-slate-500">Update your name and contact email.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Full Name</label>
                  <input
                    type="text"
                    value={basicInfo.name}
                    onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={basicInfo.email}
                    onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={saveBasicInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 hover:cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Company */}
          {activeSection === "company" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Company Information</h2>
                <p className="mt-1 text-sm text-slate-500">Business details for invoices and communications.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Business Name</label>
                  <input
                    type="text"
                    value={companyInfo.businessName}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, businessName: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Company Phone</label>
                  <input
                    type="tel"
                    value={companyInfo.companyPhone}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, companyPhone: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                {/* ✅ Company Email with validation */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Company Email</label>
                  <input
                    type="email"
                    value={companyInfo.companyEmail}
                    onChange={(e) => {
                      const next = { ...companyInfo, companyEmail: e.target.value };
                      setCompanyInfo(next);
                      validateCompanyInfo(next);
                    }}
                    onBlur={() => {
                      const trimmed = companyInfo.companyEmail.trim();
                      if (trimmed !== companyInfo.companyEmail) {
                        const next = { ...companyInfo, companyEmail: trimmed };
                        setCompanyInfo(next);
                        validateCompanyInfo(next);
                      } else {
                        validateCompanyInfo();
                      }
                    }}
                    className={[
                      "w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:ring-2 focus:bg-white",
                      companyErrors.companyEmail
                        ? "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                        : "border-zinc-200 focus:border-sky-400 focus:ring-sky-500/20",
                    ].join(" ")}
                  />
                  {companyErrors.companyEmail ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{companyErrors.companyEmail}</p>
                  ) : null}
                </div>

                {/* ✅ Website with validation + normalization */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Website</label>
                  <input
                    type="url"
                    value={companyInfo.website}
                    onChange={(e) => {
                      const next = { ...companyInfo, website: e.target.value };
                      setCompanyInfo(next);
                      validateCompanyInfo(next);
                    }}
                    onBlur={() => {
                      const normalized = normalizeWebsite(companyInfo.website);
                      if (normalized !== companyInfo.website) {
                        const next = { ...companyInfo, website: normalized };
                        setCompanyInfo(next);
                        validateCompanyInfo(next);
                      } else {
                        validateCompanyInfo();
                      }
                    }}
                    placeholder="https://example.com"
                    className={[
                      "w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:ring-2 focus:bg-white",
                      companyErrors.website
                        ? "border-red-300 focus:border-red-400 focus:ring-red-500/20"
                        : "border-zinc-200 focus:border-sky-400 focus:ring-sky-500/20",
                    ].join(" ")}
                  />
                  {companyErrors.website ? (
                    <p className="mt-1.5 text-xs font-semibold text-red-600">{companyErrors.website}</p>
                  ) : (
                    <p className="mt-1.5 text-xs text-zinc-500">Tip: include https://</p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Business Description</label>
                <textarea
                  value={companyInfo.businessDescription}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, businessDescription: e.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={saveCompanyInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Address */}
          {activeSection === "address" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Address Information</h2>
                <p className="mt-1 text-sm text-slate-500">Billing and shipping address for orders.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Billing Address</label>
                  <textarea
                    value={addressInfo.billingAddress}
                    onChange={(e) => setAddressInfo({ ...addressInfo, billingAddress: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">City</label>
                  <input
                    type="text"
                    value={addressInfo.city}
                    onChange={(e) => setAddressInfo({ ...addressInfo, city: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">State</label>
                  <input
                    type="text"
                    value={addressInfo.state}
                    onChange={(e) => setAddressInfo({ ...addressInfo, state: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Pincode</label>
                  <input
                    type="text"
                    value={addressInfo.pincode}
                    onChange={(e) => setAddressInfo({ ...addressInfo, pincode: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={saveAddressInfo}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Business Settings */}
          {activeSection === "business" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Business Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Language, currency, and business type.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Business Type</label>
                  <input
                    type="text"
                    value={businessSettings.businessType}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, businessType: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Industry Type</label>
                  <input
                    type="text"
                    value={businessSettings.industryType}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, industryType: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Language</label>
                  <input
                    type="text"
                    value={businessSettings.language}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, language: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Currency Code</label>
                  <select
                    value={businessSettings.currencyCode}
                    onChange={(e) => setBusinessSettings({ ...businessSettings, currencyCode: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={saveBusinessSettings}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* Tax */}
          {activeSection === "tax" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tax & Compliance</h2>
                <p className="mt-1 text-sm text-slate-500">GSTIN, PAN, and invoicing settings.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">GSTIN</label>
                  <input
                    type="text"
                    value={taxSettings.gstin}
                    onChange={(e) => setTaxSettings({ ...taxSettings, gstin: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">PAN Number</label>
                  <input
                    type="text"
                    value={taxSettings.panNumber}
                    onChange={(e) => setTaxSettings({ ...taxSettings, panNumber: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:bg-white"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { key: "isGSTRegistered", label: "GST Registered" },
                  { key: "enableEInvoicing", label: "Enable E-Invoicing" },
                  { key: "enableTDS", label: "Enable TDS" },
                  { key: "enableTCS", label: "Enable TCS" },
                ].map((x) => (
                  <label
                    key={x.key}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={(taxSettings as any)[x.key]}
                      onChange={(e) => setTaxSettings({ ...taxSettings, [x.key]: e.target.checked } as any)}
                      className="h-4 w-4"
                    />
                    {x.label}
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={saveTaxSettings}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
