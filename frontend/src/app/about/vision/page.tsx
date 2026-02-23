import Link from "next/link";
import { ArrowLeft, BarChart3, Lock, Infinity, Target } from "lucide-react";

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/about"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to About
        </Link>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
            <Target className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Our Vision
            </h1>
            <p className="mt-2 text-slate-600 max-w-3xl">
              Transparent, scalable referral growth — with BV-based income that stays consistent and predictable.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Unlimited Depth", value: "Network growth without arbitrary limits" },
            { label: "Real-time Updates", value: "Admin changes reflect instantly" },
            { label: "Secure & Fair", value: "Trustworthy, transparent distribution" },
          ].map((i) => (
            <div
              key={i.label}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="text-sm font-semibold text-slate-900">{i.label}</div>
              <div className="mt-1 text-xs text-slate-600">{i.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
          <div className="p-6 sm:p-10 space-y-10">
            <div className="space-y-6 text-slate-700 leading-relaxed">
              <p className="text-lg font-semibold text-emerald-700">
                Our vision is a transparent and scalable platform where income calculation is clear, BV-based,
                and consistent across unlimited depth.
              </p>
              <p>
                Admin controls service pricing and BV values, and all pages and calculations reflect those
                updates consistently. This ensures fairness and predictability for every network member.
              </p>
              <p>
                We envision a future where referral marketing is synonymous with trust, transparency, and mutual growth—
                where every participant can see exactly how their efforts contribute to their income and the success of their network.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { Icon: Infinity, title: "Unlimited Depth", desc: "No arbitrary limits on network growth" },
                { Icon: BarChart3, title: "Real-Time Updates", desc: "Instant reflection of all changes" },
                { Icon: Lock, title: "Secure & Fair", desc: "Built with security and fairness at core" },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white">
                    <Icon className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Want to see BV in action?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Browse services and understand how purchases generate BV and growth.
                </p>
              </div>
              <Link
                href="/services"
                prefetch={false}
                className="inline-flex items-center justify-center h-12 rounded-xl px-6 text-sm font-semibold text-white shadow-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 transition"
              >
                Explore Services
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
