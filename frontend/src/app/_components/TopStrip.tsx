"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Phone, Facebook, Instagram, Linkedin, Youtube, MessageCircle } from "lucide-react";

type Props = {
  phone?: string; // e.g. "+91 7772047484"
  whatsappNumber?: string; // digits only e.g. "917772047484"
  showWhatsApp?: boolean;

  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;

  timeZone?: string; // e.g. "Asia/Kolkata"
};

export default function TopStrip({
  phone = "+91 80457 86127",
  whatsappNumber,
  showWhatsApp = true,
  facebookUrl = 'https://www.facebook.com/',
  instagramUrl = 'https://www.instagram.com/',
  linkedinUrl = 'https://www.linkedin.com/',
  youtubeUrl = 'https://www.youtube.com/',
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatted = useMemo(() => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone,
    }).format(now);
  }, [now, timeZone]);

  const socialItemClass =
    "inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors " +
    "hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

  return (
    <div className="w-full text-white">
      {/* Brand strip */}
      <div className="bg-gradient-to-r from-emerald-600 to-sky-600">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex h-10 items-center justify-between gap-4">
            {/* Left: Phone + WhatsApp */}
            <div className="flex items-center gap-3 text-sm">
             <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 text-sm font-semibold hover:underline underline-offset-4"
                aria-label="Call phone number"
              >
                <Phone className="h-3 w-3" />
                <span className="text-xs sm:text-sm">{phone}</span>
              </a>


              {showWhatsApp && whatsappNumber ? (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25 transition-colors"
                  aria-label="Chat on WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </div>

            {/* Right: Social + Date Time */}
            <div className="flex items-center gap-3">
              {/* Social icons */}
              <div className="hidden md:flex items-center gap-1">
                {facebookUrl !== "#" && (
                  <Link href={facebookUrl} target="_blank" rel="noreferrer" className={socialItemClass} aria-label="Facebook">
                    <Facebook className="h-4 w-4" />
                  </Link>
                )}
                {instagramUrl !== "#" && (
                  <Link href={instagramUrl} target="_blank" rel="noreferrer" className={socialItemClass} aria-label="Instagram">
                    <Instagram className="h-4 w-4" />
                  </Link>
                )}
                {linkedinUrl !== "#" && (
                  <Link href={linkedinUrl} target="_blank" rel="noreferrer" className={socialItemClass} aria-label="LinkedIn">
                    <Linkedin className="h-4 w-4" />
                  </Link>
                )}
                {youtubeUrl !== "#" && (
                  <Link href={youtubeUrl} target="_blank" rel="noreferrer" className={socialItemClass} aria-label="YouTube">
                    <Youtube className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {/* Date time */}
              <div className="text-xs sm:text-sm whitespace-nowrap font-semibold opacity-95">
                {formatted}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* subtle separator */}
      <div className="h-px bg-black/10" />
    </div>
  );
}
