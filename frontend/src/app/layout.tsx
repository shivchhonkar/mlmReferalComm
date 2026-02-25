import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import AppShell from "./_components/AppShell";
import SiteFooter from "./_components/SiteFooter";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sambhariya Marketing - Referral Growth Marketplace",
  description: "Referral-based platform to list services and earn commission on successful referrals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <AppShell
            phone={process.env.PHONE || "+91 90457 86127"}
            whatsappNumber={process.env.WHATSAPP_NUMBER || "919045786127"}
            showWhatsApp={process.env.SHOW_WHATSAPP === "true"}
            timeZone="Asia/Kolkata"
          />

          <main className="min-h-[calc(100vh-16rem)]">{children}</main>

          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
