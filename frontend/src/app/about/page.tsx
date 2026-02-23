import Link from "next/link";
import { ArrowRight, BookOpen, Target, Star } from "lucide-react";

const cards = [
  {
    href: "/about/story",
    title: "Our Story",
    desc: "Learn how Sambhariya Marketing was built to empower communities through transparent reward systems.",
    Icon: BookOpen,
  },
  {
    href: "/about/vision",
    title: "Vision",
    desc: "Explore our vision for a transparent, scalable platform that rewards network growth.",
    Icon: Target,
  },
  {
    href: "/about/success-stories",
    title: "Success Stories",
    desc: "Read inspiring stories from our thriving community members.",
    Icon: Star,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            About <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Sambhariya</span>
          </h1>
          <p className="mt-2 text-slate-600 max-w-3xl">
            Discover our mission, vision, and the success stories that define our community.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { k: "Transparent BV", v: "Clear income distribution" },
              { k: "Community Growth", v: "Referral-first platform" },
              { k: "Scalable System", v: "Built for long-term use" },
            ].map((i) => (
              <div
                key={i.k}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-900">{i.k}</div>
                <div className="mt-1 text-xs text-slate-600">{i.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
          <div className="p-6 sm:p-10">
            <div className="grid gap-6 md:grid-cols-3">
              {cards.map(({ href, title, desc, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition group-hover:text-slate-900">
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-700 leading-relaxed">{desc}</p>
                  </div>
                  <div className="mt-6 text-xs font-semibold text-emerald-600">
                    Explore {title} →
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:p-8 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Ready to get started?</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Join the platform and explore services that generate BV and growth.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  prefetch={false}
                  className="inline-flex items-center justify-center h-12 rounded-xl px-6 text-sm font-semibold text-white shadow-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 transition"
                >
                  Create Account
                </Link>
                <Link
                  href="/services"
                  prefetch={false}
                  className="inline-flex items-center justify-center h-12 rounded-xl px-6 text-sm font-medium border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
                >
                  Browse Services
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
