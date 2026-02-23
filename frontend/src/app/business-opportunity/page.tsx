import BusinessOpportunityForm from "./BusinessOpportunityForm";
import { TrendingUp, IndianRupee, Lock, Briefcase, Infinity, Zap } from "lucide-react";

export default function BusinessOpportunityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Business Opportunity
            </h1>
            <p className="mt-2 text-slate-600 max-w-3xl">
              Build a sustainable income stream through our transparent{" "}
              <span className="font-semibold text-slate-900">Business Volume (BV)</span>{" "}
              system—simple, trackable, and scalable.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Start earning</div>
                  <div className="text-xs text-slate-600">Track referrals & BV in dashboard</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
              <div className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <TrendingUp className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Income is calculated from <span className="font-semibold">Business Volume (BV)</span>. Every service has a BV
                      value—repurchases generate BV again, compounding your earnings over time.
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      Our system tracks each transaction and distributes income fairly across your network.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-4">
                  <IndianRupee className="h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="text-xl font-semibold text-slate-900">Commission structure</h4>
                    <p className="mt-1 text-sm text-slate-700">
                      Level-wise commission distributed as a decreasing percentage of BV.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { level: "Level 1", value: "5% of BV" },
                    { level: "Level 2", value: "2.5% of BV" },
                    { level: "Level 3", value: "1.25% of BV" },
                    { level: "Level 4", value: "0.625% of BV" },
                    { level: "Level 5+", value: "50% of previous" },
                  ].map((row) => (
                    <div
                      key={row.level}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-slate-900">{row.level}</span>
                      <span className="text-sm font-semibold text-emerald-700">{row.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-600">
                  Note: percentages are illustrative; actual rules are set in Admin → Distribution Rules.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-slate-900">Request details</h2>
              <p className="mt-1 text-sm text-slate-700">
                Enter your email and we’ll send the complete plan, BV rules, and commission breakdown.
              </p>
            </div>
            {/* <div className="p-6 sm:p-8">
              <BusinessOpportunityForm />
            </div> */}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Infinity, title: "Unlimited Depth", desc: "No limits on network growth potential." },
              { icon: Lock, title: "100% Transparent", desc: "Every BV transaction is visible and verifiable." },
              { icon: Zap, title: "Instant Distribution", desc: "Automated income calculation and distribution." },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-700">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
