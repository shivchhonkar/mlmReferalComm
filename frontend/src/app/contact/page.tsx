"use client";

import { useMemo, useState } from "react";
import { Mail, Phone, Clock, MapPin, Send } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const contact = useMemo(
    () => ({
      email: process.env.NEXT_PUBLIC_EMAIL,
      phone: process.env.NEXT_PUBLIC_PHONE,
      hours: process.env.NEXT_PUBLIC_BUSINESS_HOURS,
      addressLine: process.env.NEXT_PUBLIC_LOCATION,
    }),
    []
  );

  const resetForm = () =>
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showSuccessToast("Thanks! Your message has been sent successfully.");
        resetForm();
      } else {
        const errorData = await response.json().catch(() => ({}));
        showErrorToast(errorData?.error || "Failed to send message. Please try again.");
      }
    } catch (error) {
      console.error("Contact form submission error:", error);
      showErrorToast("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Contact Us
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Have questions about services, referrals, or marketplace setup? Send a message and we’ll respond soon.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Mail className="h-4 w-4 text-emerald-600" />
              Email us
            </a>
            <a
              href={`tel:${contact?.phone?.replaceAll(/\s/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              <Phone className="h-4 w-4" />
              Call now
            </a>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
              <div className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-slate-900">Send us a message</h2>
                <p className="mt-2 text-sm text-slate-700">
                  Share your query and our team will get back to you.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="block text-sm font-semibold text-slate-800">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="John Doe"
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-800">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="john@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="subject" className="block text-sm font-semibold text-slate-800">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="How can we help you?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="block text-sm font-semibold text-slate-800">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Tell us more about how we can assist you..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>

                <p className="text-center text-xs text-slate-600">
                  By submitting, you agree to be contacted back regarding your query.
                </p>
              </form>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
              <div className="pt-6 sm:pt-8">
                <h2 className="text-xl font-semibold text-slate-900">Get in Touch</h2>
                <p className="mt-2 text-sm text-slate-700">
                  Reach out via email/phone or during business hours.
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Email</div>
                      <a className="text-sm text-emerald-600 hover:underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Phone</div>
                      <a
                        className="text-sm text-slate-700 transition hover:text-emerald-600"
                        href={`tel:${contact?.phone?.replaceAll(/\s/g, "")}`}
                      >
                        {contact.phone}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Business Hours</div>
                      <div className="text-sm text-slate-700">{contact.hours}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Location</div>
                      <div className="text-sm text-slate-700">{contact.addressLine}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 p-6 text-white shadow-sm sm:p-8">
              <h3 className="text-lg font-semibold">Need faster support?</h3>
              <p className="mt-2 text-sm text-white/90">
                For urgent queries, call us during business hours.
              </p>
              <a
                href={`tel:${contact?.phone?.replaceAll(/\s/g, "")}`}
                className="mt-5 inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/20"
              >
                {contact?.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
