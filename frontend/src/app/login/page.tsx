"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAppDispatch } from "@/store/hooks";
import { setUserProfile } from "@/store/slices/userSlice";
import { ArrowLeft, LockKeyhole, Mail } from "lucide-react";

const brandGradient = "linear-gradient(90deg, #22C55E 0%, #0EA5E9 100%)";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await readApiBody(res);
      const data = body.json as any;
      if (!res.ok) throw new Error(data?.error ?? body.text ?? "Login failed");

      // Give browser a beat to persist the cookie
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Fetch /api/me to store profile + decide redirect
      let userRole = "user";
      try {
        const meRes = await apiFetch("/api/me");
        const meBody = await readApiBody(meRes);
        const meJson = meBody.json as any;
        if (meRes.ok) {
          dispatch(setUserProfile(meJson.user ?? null));
          userRole = meJson.user?.role ?? "user";
        }
      } catch {
        // ignore
      }

      router.push(userRole === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      {/* Top subtle header strip */}
      <div className="border-b border-[var(--gray-200)] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
          <Link
            prefetch={false}
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--gray-700)] hover:text-[var(--gray-900)] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
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
                  <LockKeyhole className="h-7 w-7" />
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-1 text-xs font-extrabold text-[var(--gray-700)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  Secure Login
                </div>

                <h1 className="text-2xl font-extrabold text-[var(--gray-900)]">
                  Welcome Back
                </h1>
                <p className="text-sm text-[var(--gray-700)]">
                  Sign in to access your dashboard.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm font-bold text-red-800">Login failed</div>
                  <p className="mt-1 text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Form */}
              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
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
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-[var(--gray-200)] bg-[var(--gray-50)] pl-12 pr-4 py-3 text-sm text-[var(--gray-900)] placeholder:text-[var(--gray-500)] focus:outline-none focus:bg-white focus:border-[#0EA5E9] focus:ring-2 focus:ring-[#0EA5E9]/20 transition"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 h-12 rounded-xl text-sm font-extrabold text-white shadow-sm transition hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: brandGradient }}
                >
                  {loading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 rounded-2xl border border-[var(--gray-200)] bg-[var(--gray-50)] p-4 text-center">
                <p className="text-sm text-[var(--gray-700)]">
                  Don&apos;t have an account?{" "}
                  <Link
                    prefetch={false}
                    href="/register"
                    className="font-extrabold text-[var(--primary)] hover:underline"
                  >
                    Create one now
                  </Link>
                </p>
              </div>

              {/* small note */}
              <p className="mt-4 text-center text-xs text-[var(--gray-500)]">
                By signing in, you agree to our terms and privacy policy.
              </p>
            </div>
          </div>

          {/* Optional helper links row */}
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
