import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/app/providers";
import SiteHeader from "@/app/_components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReferGrow - Grow Your Income Through Referrals",
  description: "BV-based referral income platform with binary tree structure",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SiteHeader />
          <main className="min-h-[calc(100vh-16rem)]">{children}</main>
        </Providers>
        <footer className="mt-20 border-t border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm">
                    <span className="text-2xl font-bold text-blue-600">▼</span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-900">ReferGrow</h3>
                </div>
                <p className="text-sm text-gray-700">
                  Building financial freedom through smart referral networks.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-3">Platform</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link prefetch={false} href="/services" className="text-gray-700 hover:text-blue-600 transition-colors">Services</Link></li>
                  <li><Link prefetch={false} href="/business-opportunity" className="text-gray-700 hover:text-blue-600 transition-colors">Opportunity</Link></li>
                  <li><Link prefetch={false} href="/referrals" className="text-gray-700 hover:text-blue-600 transition-colors">Referrals</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-3">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/about" className="text-gray-700 hover:text-blue-600 transition-colors">About</Link></li>
                  <li><Link prefetch={false} href="/about/vision" className="text-gray-700 hover:text-blue-600 transition-colors">Vision</Link></li>
                  <li><Link prefetch={false} href="/contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contact</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-3">Account</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link prefetch={false} href="/login" className="text-gray-700 hover:text-blue-600 transition-colors">Sign In</Link></li>
                  <li><Link prefetch={false} href="/register" className="text-gray-700 hover:text-blue-600 transition-colors">Sign Up</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6 text-center">
              <p className="text-sm text-gray-700">
                © 2026 ReferGrow. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
