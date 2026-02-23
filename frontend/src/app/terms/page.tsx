import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Terms of Service
              </h1>
              <p className="mt-1 text-slate-600">
                Last updated: February 2026
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
            <div className="space-y-8 p-6 sm:p-10">
              <section>
                <h2 className="text-lg font-semibold text-slate-900">1. Acceptance of Terms</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  By accessing or using the Sambhariya Marketing website, services, referral platform, and related features (collectively, the “Platform”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, do not use the Platform. We may update these Terms from time to time; continued use after changes constitutes acceptance. Please review this page periodically.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">2. Use of the Platform</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  You may use the Platform only for lawful purposes and in accordance with these Terms. You agree not to: violate any applicable laws or regulations; infringe others’ intellectual property or privacy; transmit malware or harmful code; attempt to gain unauthorized access to our systems or other users’ accounts; manipulate referrals, Business Volume (BV), or commissions; use automated scripts or scrapers without permission; or use the Platform for any fraudulent or abusive purpose. We reserve the right to suspend or terminate accounts that violate these terms.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">3. Accounts and Registration</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  To access certain features (e.g. referrals, BV tracking, seller or admin roles), you must register and maintain an account. You agree to provide accurate, current information and to update it as needed. You are responsible for keeping your password confidential and for all activity under your account. Notify us immediately of any unauthorized use.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">4. Referrals and Business Volume (BV)</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Our Platform operates a referral and BV-based commission system. BV rules, commission rates, and distribution logic are defined by the platform and may be updated by administrators. You agree to comply with the then-current BV and referral policies. Eligibility for commissions may depend on account status, order completion, and policy compliance. We do not guarantee any specific level of income; results depend on your efforts and network activity.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">5. Orders, Payments, and Refunds</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Orders placed through the Platform are subject to product/service availability and our (or the seller’s) acceptance. Prices and payment terms are as displayed at the time of order. Refund and cancellation policies are as stated on the relevant product or service pages or in separate policies. We are not responsible for disputes between users and third-party sellers beyond what is stated in our policies.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">6. Conduct and Prohibited Activities</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  You must not harass, defame, or harm other users or our staff. Spam, false claims about earnings, or misleading recruitment practices are prohibited. You must not circumvent platform controls or attempt to manipulate rankings, BV, or commission calculations. We may remove content and suspend or terminate accounts for conduct that we determine violates these Terms or is harmful to the community.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">7. Intellectual Property</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  The Platform and its content, design, logos, and software are owned by Sambhariya Marketing or our licensors and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our prior written consent. You retain rights to content you submit; by submitting, you grant us a non-exclusive, royalty-free license to use, display, and process such content in connection with the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">8. Disclaimers</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  The Platform is provided “as is” and “as available.” We disclaim all warranties, express or implied, including merchantability and fitness for a particular purpose. We do not warrant that the Platform will be uninterrupted, error-free, or free of harmful components. Use of the Platform and any reliance on content or referrals is at your own risk.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">9. Limitation of Liability</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  To the maximum extent permitted by law, Sambhariya Marketing and its affiliates, officers, and employees shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or goodwill, arising from your use or inability to use the Platform, referrals, BV, or commissions. Our total liability for any claims related to the Platform shall not exceed the amount you paid us in the twelve (12) months preceding the claim (or one hundred Indian Rupees if no payment was made). Some jurisdictions do not allow certain limitations; in such cases, our liability is limited to the fullest extent permitted by law.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">10. Termination</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We may suspend or terminate your access to the Platform at any time, with or without cause or notice, including for violation of these Terms. You may close your account by contacting us or through account settings where available. Upon termination, your right to use the Platform ceases. Provisions that by their nature should survive (e.g. disclaimers, limitation of liability, dispute resolution) will survive termination.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">11. Governing Law and Disputes</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  These Terms are governed by the laws of India. Any dispute arising out of or relating to these Terms or the Platform shall be subject to the exclusive jurisdiction of the courts in India. You agree to attempt to resolve disputes in good faith before resorting to legal action.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">12. Contact</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  For questions about these Terms, please contact us via our{" "}
                  <a href="/contact" className="font-medium text-emerald-600 hover:underline">
                    Contact page
                  </a>{" "}
                  or the email/address provided there.
                </p>
              </section>
            </div>
          </div>

          {/* <div className="flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Privacy Policy
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Back to home
            </Link>
          </div> */}
        </div>
      </div>
    </div>
  );
}
