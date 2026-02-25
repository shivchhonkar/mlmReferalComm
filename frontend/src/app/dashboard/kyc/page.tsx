"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCheck, Upload, Plus, Trash2, Users, MapPin, ArrowLeft, ArrowRight, CheckCircle2, Shield } from "lucide-react";
import { showSuccessToast, showErrorToast, showWarningToast } from "@/lib/toast";
import { apiFetch, readApiBody } from "@/lib/apiClient";

interface KYCData {
  fullName: string;
  fatherName: string;
  address: string;
  dob: string;
  occupation: string;
  incomeSlab: string;
  profileImage?: string;
  panNumber: string;
  panDocument?: string;
  aadhaarNumber: string;
  aadhaarDocument?: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankName: string;
  bankAddress: string;
  bankIfsc: string;
  bankDocument?: string;
  nominees: Array<{
    relation: string;
    name: string;
    dob: string;
    mobile: string;
  }>;
}

const incomeSlabs = [
  "Below 3 LPA",
  "3-5 LPA", 
  "5-8 LPA",
  "8-12 LPA",
  "12-20 LPA",
  "20-30 LPA",
  "Above 30 LPA"
];

const occupations = [
  "Salaried Employee",
  "Self Employed",
  "Business Owner", 
  "Professional",
  "Agriculturist",
  "Retired",
  "Student",
  "Other"
];

function parseBackendValidationError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Array<{ path?: string[]; message?: string; minimum?: number, code?: string }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const messages = parsed.map((p) => {
        const field = p.path?.[0] ?? "field";
        const name = field === "aadhaarNumber" ? "Aadhaar number" : field === "bankIfsc" ? "IFSC code" : field === "panNumber" ? "PAN number" : field;
        if (p.code === "too_small" && p.minimum !== undefined) {
          return `${name} must be at least ${p.minimum} characters`;
        }
        return p.message ? `${name}: ${p.message}` : `${name} is invalid`;
      });
      return messages.join(". ");
    }
  } catch {
    // not JSON, use as-is
  }
  return raw;
}

type KYCStatus = "pending" | "submitted" | "verified" | "rejected";

export default function KYCPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kycLoading, setKycLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [kycRejectionReason, setKycRejectionReason] = useState<string | null>(null);
  const [formData, setFormData] = useState<KYCData>({
    fullName: "",
    fatherName: "",
    address: "",
    dob: "",
    occupation: "",
    incomeSlab: "",
    panNumber: "",
    aadhaarNumber: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankName: "",
    bankAddress: "",
    bankIfsc: "",
    nominees: []
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch existing KYC data to pre-fill form
  useEffect(() => {
    if (!user || authLoading) return;
    const fetchKyc = async () => {
      setKycLoading(true);
      try {
        const res = await apiFetch("/api/kyc", { method: "GET" });
        const body = await readApiBody(res);
        const data = body.json as { kyc?: Record<string, unknown> };
        if (res.ok && data?.kyc) {
          const k = data.kyc as Record<string, unknown>;
          const status = (k.kycStatus as KYCStatus) || "pending";
          setKycStatus(status);
          setKycRejectionReason((k.kycRejectionReason as string) || null);
          setFormData({
            fullName: String(k.fullName ?? ""),
            fatherName: String(k.fatherName ?? ""),
            address: String(k.address ?? ""),
            dob: String(k.dob ?? ""),
            occupation: String(k.occupation ?? ""),
            incomeSlab: String(k.incomeSlab ?? ""),
            profileImage: k.profileImage as string | undefined,
            panNumber: String(k.panNumber ?? ""),
            panDocument: k.panDocument as string | undefined,
            aadhaarNumber: String(k.aadhaarNumber ?? ""),
            aadhaarDocument: k.aadhaarDocument as string | undefined,
            bankAccountName: String(k.bankAccountName ?? ""),
            bankAccountNumber: String(k.bankAccountNumber ?? ""),
            bankName: String(k.bankName ?? ""),
            bankAddress: String(k.bankAddress ?? ""),
            bankIfsc: String(k.bankIfsc ?? ""),
            bankDocument: k.bankDocument as string | undefined,
            nominees: Array.isArray(k.nominees)
              ? (k.nominees as Array<{ relation?: string; name?: string; dob?: string; mobile?: string }>).map((n) => ({
                  relation: String(n.relation ?? ""),
                  name: String(n.name ?? ""),
                  dob: String(n.dob ?? ""),
                  mobile: String(n.mobile ?? ""),
                }))
              : [],
          });
        }
      } catch {
        // Ignore - form stays empty for new users
      } finally {
        setKycLoading(false);
      }
    };
    fetchKyc();
  }, [user, authLoading, router]);

  const handleInputChange = (field: keyof KYCData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNomineeChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      nominees: prev.nominees.map((nominee, i) => 
        i === index ? { ...nominee, [field]: value } : nominee
      )
    }));
  };

  const addNominee = () => {
    setFormData(prev => ({
      ...prev,
      nominees: [...prev.nominees, {
        relation: "",
        name: "",
        dob: "",
        mobile: ""
      }]
    }));
  };

  const removeNominee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      nominees: prev.nominees.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = (field: string, file: File) => {
    // In a real implementation, you would upload the file to a storage service
    // For now, we'll just simulate it with a URL
    const mockUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, [field]: mockUrl }));
  };

  const aadhaarDigits = (formData.aadhaarNumber || "").replace(/\D/g, "");
  const panClean = (formData.panNumber || "").trim().toUpperCase();
  const ifscClean = (formData.bankIfsc || "").trim().toUpperCase();

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.fullName && formData.dob && formData.occupation && formData.incomeSlab && formData.address);
      case 2:
        return panClean !=="" && aadhaarDigits !=="" ;

      case 3:
        return !!(
          formData.bankAccountName &&
          formData.bankAccountNumber &&
          formData.bankName &&
          formData.bankAddress &&
          ifscClean.length > 8
        );
      case 4:
        return formData.nominees.length > 0 && formData.nominees.every(n => n.relation && n.name && n.dob && n.mobile);
      default:
        return false;
    }
  };

  const getPayloadValidationError = (): string | null => {
    if (panClean.length !== 10) return "PAN number must be exactly 10 characters.";
    if (aadhaarDigits.length !== 12) return "Aadhaar number must be exactly 12 digits.";
    if (ifscClean.length !== 11) return "IFSC code must be exactly 11 characters.";
    return null;
  };

  const handleSubmit = async () => {
    const payloadErr = getPayloadValidationError();
    if (payloadErr) {
      setError(payloadErr);
      showWarningToast(payloadErr);
      return;
    }
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      showWarningToast("Please complete all steps and fill required fields.");
      setError("Please complete all steps. Check Personal, Documents, Bank, and Nominees.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        panNumber: panClean,
        aadhaarNumber: aadhaarDigits,
        bankIfsc: ifscClean,
      };
      const response = await apiFetch("/api/kyc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await readApiBody(response);
      const data = body.json as { error?: string };
      if (!response.ok) {
        const raw = data?.error ?? body.text ?? "Failed to submit KYC";
        const friendly = parseBackendValidationError(raw);
        throw new Error(friendly);
      }

      showSuccessToast("KYC submitted successfully!");
      setSuccess(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["Personal", "Documents", "Bank", "Nominees"];

  const isSubmitted = kycStatus === "submitted";
  const isVerified = kycStatus === "verified";
  const isFormReadOnly = isSubmitted || isVerified;

  if (authLoading || kycLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-zinc-200" />
          <div className="h-4 w-3/4 rounded bg-zinc-100" />
          <div className="rounded-2xl border border-zinc-200 bg-white p-8">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-zinc-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <FileCheck className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">KYC Submitted Successfully</h1>
          <p className="mt-3 text-zinc-600">
            Your application is under review. We will notify you once verification is complete.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              Go to Profile
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Your KYC Verification</h1>
              <p className="mt-0.5 text-sm text-zinc-600">
                Complete verification to access all platform features
              </p>
            </div>
          </div>
          {/* KYC Status Badge */}
          {!kycLoading && kycStatus && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</span>
              {kycStatus === "verified" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Approved
                </span>
              ) : kycStatus === "submitted" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                  <FileCheck className="h-4 w-4" />
                  Submitted for approval
                </span>
              ) : kycStatus === "rejected" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
                  Rejected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700">
                  Pending
                </span>
              )}
              {kycStatus === "rejected" && kycRejectionReason && (
                <p className="max-w-xs text-xs text-red-600">Reason: {kycRejectionReason}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition ${
                step === currentStep
                  ? "bg-emerald-600 text-white"
                  : step < currentStep
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {step < currentStep ? <CheckCircle2 className="h-5 w-5" /> : step}
            </div>
            <span className={`hidden text-xs font-medium sm:block ${step <= currentStep ? "text-zinc-900" : "text-zinc-500"}`}>
              {stepLabels[step - 1]}
            </span>
            {step < 4 && <div className="ml-1 h-0.5 flex-1 rounded bg-zinc-200" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900">Personal Information</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Father&apos;s Name</label>
                <input
                  type="text"
                  value={formData.fatherName}
                  onChange={(e) => handleInputChange("fatherName", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="Father&apos;s name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleInputChange("dob", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Occupation *</label>
                <select
                  value={formData.occupation}
                  onChange={(e) => handleInputChange("occupation", e.target.value)}
                  disabled={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                >
                  <option value="">Select occupation</option>
                  {occupations.map((occ) => (
                    <option key={occ} value={occ}>{occ}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Income Slab *</label>
                <select
                  value={formData.incomeSlab}
                  onChange={(e) => handleInputChange("incomeSlab", e.target.value)}
                  disabled={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                >
                  <option value="">Select income slab</option>
                  {incomeSlabs.map((slab) => (
                    <option key={slab} value={slab}>{slab}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Profile Image</label>
                <div className="flex items-center gap-3">
                  {!isFormReadOnly && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload("profileImage", e.target.files[0])}
                        className="hidden"
                        id="profileImage"
                      />
                      <label
                        htmlFor="profileImage"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Photo
                      </label>
                    </>
                  )}
                  {(formData.profileImage || isFormReadOnly) && (
                    <span className="text-sm font-medium text-emerald-600">{formData.profileImage ? "Uploaded" : "—"}</span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Address *</label>
              <textarea
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                readOnly={isFormReadOnly}
                rows={3}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                placeholder="Complete address"
              />
            </div>
          </div>
        )}

        {/* Step 2: Documents */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900">Identity Documents</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">PAN Number *</label>
                <input
                  type="text"
                  value={formData.panNumber}
                  onChange={(e) => handleInputChange("panNumber", e.target.value.toUpperCase())}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="10 characters (e.g. ABCDE1234F)"
                  maxLength={10}
                />
                <p className="mt-1 text-xs text-zinc-500">{formData.panNumber.trim().length}/10 characters</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">PAN Document</label>
                <div className="flex items-center gap-3">
                  {!isFormReadOnly && (
                    <>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("panDocument", e.target.files[0])} className="hidden" id="panDocument" />
                      <label htmlFor="panDocument" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                        <Upload className="h-4 w-4" /> Upload PAN
                      </label>
                    </>
                  )}
                  {formData.panDocument && <span className="text-sm font-medium text-emerald-600">Uploaded</span>}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Aadhaar Number *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.aadhaarNumber}
                  onChange={(e) => handleInputChange("aadhaarNumber", e.target.value.replace(/\D/g, ""))}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="12 digits (numbers only)"
                  maxLength={12}
                />
                <p className="mt-1 text-xs text-zinc-500">{formData.aadhaarNumber.replace(/\D/g, "").length}/12 digits</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Aadhaar Document</label>
                <div className="flex items-center gap-3">
                  {!isFormReadOnly && (
                    <>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("aadhaarDocument", e.target.files[0])} className="hidden" id="aadhaarDocument" />
                      <label htmlFor="aadhaarDocument" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                        <Upload className="h-4 w-4" /> Upload Aadhaar
                      </label>
                    </>
                  )}
                  {formData.aadhaarDocument && <span className="text-sm font-medium text-emerald-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Bank Details */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900">Bank Details</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Account Holder Name *</label>
                <input
                  type="text"
                  value={formData.bankAccountName}
                  onChange={(e) => handleInputChange("bankAccountName", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="As per bank record"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Account Number *</label>
                <input
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={(e) => handleInputChange("bankAccountNumber", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="Bank account number"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">Bank Name *</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => handleInputChange("bankName", e.target.value)}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="Name of bank"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">IFSC Code *</label>
                <input
                  type="text"
                  value={formData.bankIfsc}
                  onChange={(e) => handleInputChange("bankIfsc", e.target.value.toUpperCase())}
                  readOnly={isFormReadOnly}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 font-mono text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                  placeholder="11 characters (e.g. SBIN0001234)"
                  maxLength={11}
                />
                <p className="mt-1 text-xs text-zinc-500">{formData.bankIfsc.trim().length}/11 characters</p>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Bank Address *</label>
              <textarea
                value={formData.bankAddress}
                onChange={(e) => handleInputChange("bankAddress", e.target.value)}
                readOnly={isFormReadOnly}
                rows={3}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                placeholder="Branch address"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700">Bank Document (optional)</label>
              <div className="flex items-center gap-3">
                {!isFormReadOnly && (
                  <>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && handleFileUpload("bankDocument", e.target.files[0])} className="hidden" id="bankDocument" />
                    <label htmlFor="bankDocument" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
                      <Upload className="h-4 w-4" /> Upload
                    </label>
                  </>
                )}
                {formData.bankDocument && <span className="text-sm font-medium text-emerald-600">Uploaded</span>}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Nominees */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Nominee Details</h2>
              {!isFormReadOnly && (
                <button
                  type="button"
                  onClick={addNominee}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Nominee
                </button>
              )}
            </div>
            {formData.nominees.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-zinc-400" />
                <p className="text-sm text-zinc-600">Add at least one nominee to proceed</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.nominees.map((nominee, index) => (
                  <div key={index} className="rounded-xl border border-zinc-200 bg-zinc-50/30 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-medium text-zinc-900">Nominee {index + 1}</h3>
                      {!isFormReadOnly && formData.nominees.length > 1 && (
                        <button type="button" onClick={() => removeNominee(index)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Name *</label>
                        <input
                          type="text"
                          value={nominee.name}
                          onChange={(e) => handleNomineeChange(index, "name", e.target.value)}
                          readOnly={isFormReadOnly}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                          placeholder="Nominee name"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Relation *</label>
                        <input
                          type="text"
                          value={nominee.relation}
                          onChange={(e) => handleNomineeChange(index, "relation", e.target.value)}
                          readOnly={isFormReadOnly}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                          placeholder="e.g. Spouse, Son, Daughter"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Date of Birth *</label>
                        <input
                          type="date"
                          value={nominee.dob}
                          onChange={(e) => handleNomineeChange(index, "dob", e.target.value)}
                          readOnly={isFormReadOnly}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Mobile *</label>
                        <input
                          type="tel"
                          value={nominee.mobile}
                          onChange={(e) => handleNomineeChange(index, "mobile", e.target.value.replace(/\D/g, ""))}
                          readOnly={isFormReadOnly}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:bg-zinc-50 disabled:text-zinc-600"
                          placeholder="10 digit mobile"
                          maxLength={10}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-6">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </button>
          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={isFormReadOnly ? false : !validateStep(currentStep)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : isFormReadOnly ? (
            <div className="flex items-center gap-3">
              {isVerified ? (
                <>
                  <p className="text-sm font-medium text-emerald-700">Your KYC has been approved.</p>
                  <Link
                    href="/dashboard/profile"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Go to Profile
                  </Link>
                </>
              ) : (
                <p className="text-sm font-medium text-amber-700">Your KYC is under review. You cannot make changes at this time.</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!validateStep(currentStep) || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting…
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4" />
                  {kycStatus === "rejected" ? "Resubmit KYC" : "Submit KYC"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
