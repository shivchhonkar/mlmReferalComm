"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { CheckCircle2, AlertTriangle, Mail, Send } from "lucide-react";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

export default function BusinessOpportunityForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const res = await apiFetch("/api/business-opportunity/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Request failed");

      const successMsg = json.emailed
        ? "Sent! Please check your inbox."
        : "Saved! Email sending is not configured yet on this server.";
      
      showSuccessToast(successMsg);
      setEmail("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showErrorToast(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
          <Mail className="h-6 w-6" />
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900">Get more information</h3>
          <p className="mt-1 text-sm text-slate-700">
            We'll email you complete details about BV rules, earnings, and how to start.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-3 !pl-12 pr-4 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </div>

          <button
            className="inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={busy}
            type="submit"
          >
            <Send className="h-4 w-4" />
            {busy ? "Sending..." : "Send Details"}
          </button>
        </div>

        <p className="text-xs text-slate-600">
          We respect your privacy. You can unsubscribe anytime.
        </p>
      </form>
    </div>
  );
}
