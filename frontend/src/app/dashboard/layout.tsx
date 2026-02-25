"use client";

import DashboardSidebar from "./components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="min-h-screen flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
