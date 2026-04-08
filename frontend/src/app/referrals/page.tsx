import Link from "next/link";
import { Network, Users, HandCoins, ShieldCheck, ArrowRight } from "lucide-react";

const steps = [
  {
    title: "Join the platform",
    description: "Create your account and complete your profile to start building your network.",
    icon: Users,
  },
  {
    title: "Invite referrals",
    description: "Share your referral code with friends and partners who want to join and purchase.",
    icon: Network,
  },
  {
    title: "Earn level income",
    description:
      "When your network purchases, commission is distributed level-wise based on Business Volume (BV).",
    icon: HandCoins,
  },
];

const structure = [
  { level: "Level 1", value: "10% of BV" },
  { level: "Level 2", value: "5% of BV" },
  { level: "Level 3", value: "2.5% of BV" },
  { level: "Level 4", value: "1.25% of BV" },
  { level: "Level 5+", value: "50% of previous level" },
];

export default function ReferralsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full" />
          <div className="p-6 sm:p-8">
            {/* <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Referral Program
            </span> */}
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Grow your network and earn with{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Sambhariya
              </span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Build a long-term referral business with transparent tracking, level-wise BV commission,
              and clear performance visibility from your dashboard.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                Start Now
              </Link>
              <Link
                href="/dashboard/referrals"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Open Referral Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Commission structure</h3>
              <p className="mt-1 text-sm text-slate-600">
                Level income follows a fixed halving model from first level onward.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {structure.map((row) => (
              <div
                key={row.level}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-900">{row.level}</span>
                <span className="text-sm font-semibold text-emerald-700">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
