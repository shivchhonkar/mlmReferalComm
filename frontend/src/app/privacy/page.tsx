import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Privacy Policy
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
                <h2 className="text-lg font-semibold text-slate-900">1. Introduction</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Sambhariya Marketing (“we”, “our”, or “us”) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, services, referral platform, and related offerings. By using our services, you consent to the practices described in this policy.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">2. Information We Collect</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We may collect:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                  <li><strong>Account data:</strong> name, email, phone, address, and profile details you provide when registering or updating your account.</li>
                  <li><strong>Transaction data:</strong> orders, referrals, Business Volume (BV), and payment-related information necessary to operate the platform and distribute commissions.</li>
                  <li><strong>Usage data:</strong> IP address, device type, browser, pages visited, and general usage patterns to improve our services and security.</li>
                  <li><strong>Communications:</strong> messages you send via contact forms, support, or email, and our responses.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">3. How We Use Your Information</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We use collected information to: provide and maintain our services; process orders and referrals; calculate and distribute BV and commissions; communicate with you; improve our platform and user experience; detect and prevent fraud or abuse; comply with legal obligations; and send relevant updates (you can opt out of marketing communications).
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">4. Cookies and Similar Technologies</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We use cookies and similar technologies for session management, preferences, analytics, and security. You can control cookies through your browser settings. Disabling certain cookies may affect site functionality.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">5. Sharing and Disclosure</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We may share your information with: service providers (hosting, payment, email) who assist our operations under strict confidentiality; referral and upline/downline members only to the extent necessary for the referral and BV system; and authorities when required by law or to protect our rights and users’ safety. We do not sell your personal information to third parties for marketing.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">6. Data Security</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We implement appropriate technical and organizational measures to protect your data against unauthorized access, alteration, disclosure, or destruction. Sensitive data (e.g. passwords) is stored using industry-standard encryption. No method of transmission over the internet is 100% secure; we encourage you to use strong passwords and keep your account details confidential.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">7. Your Rights</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Depending on your jurisdiction, you may have the right to: access, correct, or delete your personal data; restrict or object to certain processing; data portability; and withdraw consent. To exercise these rights or ask questions, contact us using the details below. You may also have the right to lodge a complaint with a supervisory authority.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">8. Data Retention</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We retain your information for as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements. After account closure or when no longer needed, we will delete or anonymize your data in accordance with our retention policies.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">9. Children’s Privacy</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected such data, please contact us so we can delete it.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">10. Changes to This Policy</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We may update this Privacy Policy from time to time. We will post the revised policy on this page and update the “Last updated” date. Continued use of our services after changes constitutes acceptance of the updated policy. For material changes, we may provide additional notice (e.g. email or in-app notification).
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">11. Contact Us</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  For privacy-related questions, requests, or complaints, contact us at:{" "}
                  <a href="/contact" className="font-medium text-emerald-600 hover:underline">
                    Contact page
                  </a>{" "}
                  or via the email/address provided there. We will respond within a reasonable time.
                </p>
              </section>
            </div>
          </div>

          {/* <div className="flex flex-wrap gap-3">
            <Link
              href="/terms"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Terms of Service
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
