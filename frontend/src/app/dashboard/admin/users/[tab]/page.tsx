"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import AdminUsersPage from "../AdminUsersPage";

const TAB_MAP: Record<string, "admins" | "users" | "sellers" | "seller_requests"> = {
  admins: "admins",
  users: "users",
  sellers: "sellers",
  "seller-requests": "seller_requests",
};

function TabContent() {
  const params = useParams();
  const tabSlug = (params?.tab as string) || "admins";
  const activeTab = TAB_MAP[tabSlug] ?? "admins";

  return <AdminUsersPage activeTab={activeTab} />;
}

export default function UsersTabPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm font-semibold text-zinc-600">Loading...</div>}>
      <TabContent />
    </Suspense>
  );
}
