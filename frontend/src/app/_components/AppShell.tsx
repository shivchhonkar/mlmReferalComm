"use client";

import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";
import TopStrip from "./TopStrip";
import DashboardHeader from "./DashboardHeader";

type AppShellProps = {
  phone?: string;
  whatsappNumber?: string;
  showWhatsApp?: boolean;
  timeZone?: string;
};

export default function AppShell({
  phone = "+91 90457 86127",
  whatsappNumber = "919045786127",
  showWhatsApp = true,
  timeZone = "Asia/Kolkata",
}: AppShellProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  if (isDashboard) {
    return <DashboardHeader />;
  }

  return (
    <>
      <TopStrip
        phone={phone}
        whatsappNumber={whatsappNumber}
        showWhatsApp={showWhatsApp}
        timeZone={timeZone}
      />
      <SiteHeader />
    </>
  );
}
