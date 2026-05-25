"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, User, Phone, Ticket } from "lucide-react";
import { completeGoogleProfile } from "@/lib/googleAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAppDispatch } from "@/store/hooks";
import { setUserProfile } from "@/store/slices/userSlice";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const brandGradient = "linear-gradient(90deg, #22C55E 0%, #0EA5E9 100%)";

function GoogleCompleteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const [pendingToken, setPendingToken] = useState("");
  const [name, setName] = useState(searchParams.get("name") || "");
  const [fullName, setFullName] = useState(searchParams.get("name") || "");
  const [email] = useState(searchParams.get("email") || "");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("referralCode") || "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const redirectPath = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    const token =
      sessionStorage.getItem("google_pending_token") ||
      searchParams.get("pendingToken") ||
      "";
    if (!token) {
      showErrorToast("Google sign-in session expired. Please try again.");
      router.replace("/login");
      return;
    }
    setPendingToken(token);
  }, [router, searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;

    if (!acceptedTerms) {
      showErrorToast("Please accept the terms and conditions");
      return;
    }

    setLoading(true);
    try {
      await completeGoogleProfile({
        pendingToken,
        name: name.trim(),
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        countryCode,
        referralCode: referralCode.trim() || undefined,
        acceptedTerms: true,
      });

      sessionStorage.removeItem("google_pending_token");
      showSuccessToast("Account created! Redirecting...");

      await new Promise((resolve) => setTimeout(resolve, 50));

      let userRole = "user";
      try {
        const meRes = await apiFetch("/api/me");
        const meBody = await readApiBody(meRes);
        const meJson = meBody.json as { user?: { role?: string } } | null;
        if (meRes.ok && meJson?.user) {
          dispatch(setUserProfile(meJson.user as Parameters<typeof setUserProfile>[0]));
          userRole = meJson.user.role ?? "user";
        }
      } catch {
        // ignore
      }

      const isAdminRole = ["super_admin", "admin", "moderator"].includes(userRole);
      router.push(isAdminRole ? "/dashboard/admin" : redirectPath);
      router.refresh();
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : "Failed to complete sign up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="border-b border-[var(--gray-200)] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
          <Link
            prefetch={false}
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--gray-700)] hover:text-[var(--gray-900)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-2xl border border-[var(--gray-200)] bg-white shadow-sm">
          <div className="h-1 w-full" style={{ background: brandGradient }} />
          <div className="p-6 sm:p-8">
            <h1 className="text-2xl text-[var(--gray-900)]">Complete your profile</h1>
            <p className="mt-2 text-sm text-[var(--gray-700)]">
              One more step to finish signing up with Google
              {email ? ` (${email})` : ""}.
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[var(--gray-800)]">Name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[var(--gray-800)]">
                  Full name (as per documents)
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[var(--gray-800)]">Mobile number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-18 max-w-18 rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-2 py-3 text-sm"
                  >
                    <option value="+91">+91</option>
                    <option value="+1">+1</option>
                  </select>
                  <div className="relative flex-1">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      type="tel"
                      required
                      pattern="[0-9]{10,15}"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-[var(--gray-800)]">
                  Referral code <span className="font-normal text-[var(--gray-500)]">(optional)</span>
                </label>
                <div className="relative">
                  <Ticket className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                  <input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--primary)]"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                />
                <span className="text-[var(--gray-700)]">I accept the Terms &amp; Conditions</span>
              </label>

              <button
                type="submit"
                disabled={loading || !pendingToken}
                className="inline-flex w-full h-12 items-center justify-center rounded-xl text-sm text-white disabled:opacity-60"
                style={{ background: brandGradient }}
              >
                {loading ? "Creating account..." : "Finish sign up"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoogleCompletePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-600">Loading...</div>}>
      <GoogleCompleteForm />
    </Suspense>
  );
}
