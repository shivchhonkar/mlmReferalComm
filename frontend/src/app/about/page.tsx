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
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full" />
          <div className="p-6 sm:p-8">
            {/* <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              About Us
            </span> */}
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              About{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Sambhariya
              </span>
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Discover our mission, vision, and the success stories that define our community.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { k: "Transparent BV", v: "Clear income distribution" },
              { k: "Community Growth", v: "Referral-first platform" },
              { k: "Scalable System", v: "Built for long-term use" },
            ].map((i) => (
              <div
                key={i.k}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-sm font-semibold text-slate-900">{i.k}</div>
                <div className="mt-1 text-xs text-slate-600">{i.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-3 text-sm font-semibold text-slate-900">Message from Leadership</div>
            <p className="text-sm leading-relaxed text-slate-800 sm:text-[15px]">
              Sambhariya Group ने एक ऐसे सिस्टम की शुरुआत की है जहाँ हर इंसान की मेहनत को सम्मान मिलता है और उसकी पहचान सिर्फ़ एक ग्राहक बनकर नहीं रह जाती। यहाँ हर व्यक्ति को एक वैल्यू पार्टनर माना जाता है। आज Sambhariya Group को देशभर के लोग तेजी से अपनाने लगे हैं। वजह साफ़ है— यह प्लेटफ़ॉर्म पारदर्शी है, सुरक्षित है और सबसे महत्वपूर्ण—कमाई को स्थायी बनाता है। हम उन सभी लोगों का दिल से आभार व्यक्त करते हैं जिन्होंने Sambhariya Group पर भरोसा किया, प्लेटफ़ॉर्म को अपनाया और इसे घर-घर तक पहुँचाने में मदद की। आपका भरोसा ही हमारी सबसे बड़ी ताकत है। अब हमारी आप सभी से एक ही अपील है— जितने ज़्यादा लोगों को Sambhariya Group से जोड़ेंगे, उतनी ही आपकी फ़्यूचर इनकम मजबूत होती जाएगी। यह सिर्फ़ एक रेफ़रल सिस्टम नहीं, बल्कि आपके परिवार के लिए एक दीर्घकालिक फाइनेंशियल सिक्योरिटी प्लान है। आज ही अपना नेटवर्क बढ़ाइए, ज्यादा से ज्यादा लोगों को रेफर कीजिए और भविष्य के लिए अपनी फिक्स्ड कमाई सुनिश्चित कीजिए। Sambhariya Group के साथ कदम बढ़ाइए— क्योंकि यहां ग्राहक नहीं, परिवार बनता हैं।
            </p>
            <p className="mt-5 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-900">
              भवदीय
              <br />
              PK Sambhariya
              <br />
              Managing Director Sambhariya Group
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
          <div className="p-6 sm:p-10">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900">Explore More</h2>
              <p className="mt-1 text-sm text-slate-600">
                Learn more about our story, vision, and community achievements.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {cards.map(({ href, title, desc, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
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
