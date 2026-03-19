"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { Gift, ArrowLeft, UserPlus, User, Mail, LockKeyhole, Ticket, Phone } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { setUserProfile } from "@/store/slices/userSlice";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

const brandGradient = "linear-gradient(90deg, #22C55E 0%, #0EA5E9 100%)";

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [name, setName] = useState("");
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendSignupOtp() {
    if (!mobile.trim()) {
      showErrorToast("Please enter mobile number first");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await apiFetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), countryCode }),
      });
      const body = await readApiBody(res);
      const data = body.json as { success?: boolean; error?: string; otp?: string };
      if (!res.ok || !data?.success) {
        showErrorToast(data?.error || "Failed to send OTP");
        return;
      }
      setOtpSent(true);
      setOtpVerified(false);
      setOtp("");
      setOtpTimer(60);
      if (data?.otp) {
        showSuccessToast(`OTP sent (testing): ${data.otp}`);
      } else {
        showSuccessToast("OTP sent successfully");
      }
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifySignupOtp() {
    if (otp.length !== 6) {
      showErrorToast("Please enter 6-digit OTP");
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: mobile.trim(), otp }),
      });
      const body = await readApiBody(res);
      const data = body.json as { success?: boolean; error?: string };
      if (!res.ok || !data?.success) {
        showErrorToast(data?.error || "Invalid OTP");
        setOtpVerified(false);
        return;
      }
      setOtpVerified(true);
      showSuccessToast("OTP verified");
    } catch (e) {
      showErrorToast(e instanceof Error ? e.message : "Failed to verify OTP");
      setOtpVerified(false);
    } finally {
      setVerifyingOtp(false);
    }
  }

  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setTimeout(() => setOtpTimer((p) => Math.max(0, p - 1)), 1000);
    return () => clearTimeout(id);
  }, [otpTimer]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate fields before checking existence
      if (!mobile.trim()) {
        showErrorToast("Please enter your mobile number");
        return;
      }
      if (!email.trim()) {
        showErrorToast("Please enter your email address");
        return;
      }
      if (!name.trim()) {
        showErrorToast("Please enter your name");
        return;
      }
      if (!fullName.trim()) {
        showErrorToast("Please enter your full name");
        return;
      }
      if (password.length < 8) {
        showErrorToast("Password must be at least 8 characters long");
        return;
      }
      if (!acceptedTerms) {
        showErrorToast("Please accept the terms and conditions");
        return;
      }

      // Check if mobile already exists
      const checkMobileRes = await apiFetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone: mobile.trim() }),
      });

      const checkMobileBody = await readApiBody(checkMobileRes);
      const checkMobileData = checkMobileBody.json as any;

      if (checkMobileRes.ok && checkMobileData.exists) {
        showErrorToast(`The mobile number ${mobile} is already registered. Please use a different number or login to your existing account.`);
        return;
      }

      // Check if email already exists
      const checkEmailRes = await apiFetch("/api/auth/check-exists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone: email.trim() }),
      });

      const checkEmailBody = await readApiBody(checkEmailRes);
      const checkEmailData = checkEmailBody.json as any;

      if (checkEmailRes.ok && checkEmailData.exists) {
        showErrorToast(`The email address ${email} is already registered. Please use a different email or login to your existing account.`);
        return;
      }

      // Proceed with registration
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          fullName, 
          mobile, 
          email: email.trim(), 
          password, 
          referralCode, 
          acceptedTerms,
          countryCode
        }),
      });

      const body = await readApiBody(res);
      const data = body.json as { error?: string; message?: string } | null;
      
      if (!res.ok) {
        // Extract user-friendly error message
        const errorMsg = data?.error || data?.message || body.text || "Registration failed. Please check your information and try again.";
        showErrorToast(errorMsg);
        return;
      }

      showSuccessToast("Registration successful! Redirecting...");

      // Give browser a beat to persist the cookie (if your backend sets cookie)
      await new Promise((resolve) => setTimeout(resolve, 50));

      let userRole = "user";
      try {
        const meRes = await apiFetch("/api/me");
        const meBody = await readApiBody(meRes);
        const meJson = meBody.json as { user?: any } | null;
        if (meRes.ok) {
          dispatch(setUserProfile(meJson?.user ?? null));
          userRole = meJson?.user?.role ?? "user";
        }
      } catch {
        // ignore
      }

      router.push(userRole === "admin" ? "/dashboard/admin" : "/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      {/* Top subtle header strip */}
      <div className="border-b border-[var(--gray-200)] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link
            prefetch={false}
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--gray-700)] hover:text-[var(--gray-900)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <Link
            prefetch={false}
            href="/login"
            className="text-sm  text-[var(--primary)] hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mx-auto w-full max-w-md animate-slide-up">
          <div className="overflow-hidden rounded-2xl border border-[var(--gray-200)] bg-white shadow-sm">
            {/* Brand strip */}
            <div className="h-1 w-full" style={{ background: brandGradient }} />

            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="text-center space-y-3">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ background: "linear-gradient(135deg, #22C55E 0%, #0EA5E9 100%)" }}
                >
                  <UserPlus className="h-7 w-7" />
                </div>

                {/* <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-1 text-xs  text-[var(--gray-700)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  Create your account
                </div> */}

                <h1 className="text-2xl  text-[var(--gray-900)]">
                  Join Sambhariya Marketing 
                </h1>
                <p className="text-sm text-[var(--gray-700)]">
                  Start earning together with your network.
                </p>
              </div>

                {/* Optional OTP verification (for testing can be skipped) */}
                <div className="space-y-2 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-[var(--gray-800)]">
                      Mobile OTP Verification <span className="text-[var(--gray-500)] font-normal">(Optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={sendSignupOtp}
                      disabled={sendingOtp || !mobile.trim()}
                      className="rounded-lg border border-[var(--gray-300)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--gray-700)] hover:bg-[var(--gray-100)] hover:cursor-pointer disabled:opacity-60"
                    >
                      {sendingOtp ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
                    </button>
                  </div>

                  {otpSent && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        className="w-48 rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm text-[var(--gray-900)]"
                      />
                      <button
                        type="button"
                        onClick={verifySignupOtp}
                        disabled={verifyingOtp || otp.length !== 6}
                        className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 hover:cursor-pointer disabled:opacity-60"
                      >
                        {verifyingOtp ? "Verifying..." : "Verify OTP"}
                      </button>
                      {otpTimer > 0 && (
                        <span className="text-xs text-[var(--gray-500)]">Resend in {otpTimer}s</span>
                      )}
                      {otpVerified && (
                        <span className="text-xs font-semibold text-emerald-700">Verified</span>
                      )}
                    </div>
                  )}

                  {!otpVerified && (
                    <p className="text-xs text-[var(--gray-600)]">
                      OTP is optional for now. You can continue signup without verifying.
                    </p>
                  )}
                </div>

              {/* Error */}
              {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm font-bold text-red-800">Registration failed</div>
                  <p className="mt-1 text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Form */}
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                {/* Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-bold text-[var(--gray-800)]">
                    Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Enter your name"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-bold text-[var(--gray-800)]">
                    Full Name (as per documents)
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="Enter your full legal name"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-2">
                  <label htmlFor="mobile" className="block text-sm font-bold text-[var(--gray-800)]">
                    Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative w-32">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-2 py-3 text-sm text-[var(--gray-900)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition appearance-none"
                      >
                        <option value="+1">+1 (US)</option>
                        <option value="+44">+44 (UK)</option>
                        <option value="+91">+91 (IN)</option>
                        <option value="+86">+86 (CN)</option>
                        <option value="+81">+81 (JP)</option>
                        <option value="+82">+82 (KR)</option>
                        <option value="+65">+65 (SG)</option>
                        <option value="+971">+971 (AE)</option>
                        <option value="+61">+61 (AU)</option>
                        <option value="+49">+49 (DE)</option>
                        <option value="+33">+33 (FR)</option>
                        <option value="+92">+92 (PK)</option>
                        <option value="+880">+880 (BD)</option>
                        <option value="+94">+94 (LK)</option>
                        <option value="+977">+977 (NP)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <input
                        id="mobile"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        type="tel"
                        autoComplete="tel"
                        required
                        placeholder="Enter your mobile number"
                        pattern="[0-9]{10,15}"
                        className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-bold text-[var(--gray-800)]">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-bold text-[var(--gray-800)]">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>
                  <p className="text-xs text-[var(--gray-500)]">
                    Use at least 8 characters (recommended: mix letters + numbers).
                  </p>
                </div>

                {/* Referral */}
                <div className="space-y-2">
                  <label htmlFor="referralCode" className="block text-sm font-bold text-[var(--gray-800)]">
                    Referral Code <span className="text-[var(--gray-500)]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Ticket className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gray-500)]" />
                    <input
                      id="referralCode"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      placeholder="Enter referral code"
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] !pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>

                  <div className="rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-3">
                    <p className="text-xs text-[var(--gray-700)] flex items-start gap-2">
                      <Gift className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
                      Join your referrer’s network to start earning together.
                    </p>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4 text-sm cursor-pointer">
                  <input
                    className="mt-1 h-4 w-4 accent-[var(--primary)]"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                  />
                  <span className="text-[var(--gray-700)]">
                    I accept the{" "}
                    <span className=" text-[var(--primary)]">Terms &amp; Conditions</span>
                  </span>
                </label>

                {/* Submit */}
                <button
                  disabled={loading}
                  type="submit"
                  className="mt-1 inline-flex w-full items-center justify-center gap-2 h-12 rounded-xl text-sm  text-white shadow-sm transition hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: brandGradient }}
                >
                  {loading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating your account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-[var(--gray-500)]">
                By creating an account, you agree to our terms and privacy policy.
              </p>
            </div>
          </div>

          {/* Bottom helper */}
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-[var(--gray-600)]">
            <Link prefetch={false} href="/contact" className="hover:text-[var(--gray-900)] transition">
              Need help?
            </Link>
            <span className="h-1 w-1 rounded-full bg-[var(--gray-300)]" />
            <Link prefetch={false} href="/about" className="hover:text-[var(--gray-900)] transition">
              Learn about us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
