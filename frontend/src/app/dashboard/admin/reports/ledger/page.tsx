"use client";

import { useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { Download, RefreshCw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type UserOption = {
  _id: string;
  fullName?: string;
  name?: string;
  email?: string;
  mobile?: string;
  referralCode?: string;
};

type LedgerEntry = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
  fromUser?: {
    fullName?: string;
    name?: string;
    email?: string;
    mobile?: string;
    referralCode?: string;
  };
  purchase?: {
    service?:
      | string
      | {
          _id?: string;
          name?: string;
        };
  };
};

type LedgerPayload = {
  user: {
    _id: string;
    name?: string;
    email?: string;
    mobile?: string;
    referralCode?: string;
    bank?: {
      accountName?: string;
      accountNumber?: string;
      bankName?: string;
      bankAddress?: string;
      ifsc?: string;
      upiLink?: string;
    };
  };
  summary: {
    totalIncome: number;
    totalBusiness: number;
    entries: number;
  };
  ledger: LedgerEntry[];
};

function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function AdminLedgerReportPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerPayload | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u._id === selectedUserId),
    [users, selectedUserId]
  );

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/users?limit=500&role=user");
      const body = await readApiBody(res);
      const data = body.json as { users?: UserOption[]; error?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to load users");
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const generateLedger = async () => {
    if (!selectedUserId) {
      setError("Please select a user first.");
      return;
    }
    setLoadingLedger(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/reports/user-ledger?userId=${encodeURIComponent(selectedUserId)}`);
      const body = await readApiBody(res);
      const data = body.json as LedgerPayload & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to generate ledger report");
      setLedgerData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate ledger report");
      setLedgerData(null);
    } finally {
      setLoadingLedger(false);
    }
  };

  const downloadCsv = () => {
    if (!ledgerData) return;
    const lines: string[] = [];
    lines.push("Payment Ledger Report");
    lines.push(`User Name,${ledgerData.user.name || ""}`);
    lines.push(`Email,${ledgerData.user.email || ""}`);
    lines.push(`Mobile,${ledgerData.user.mobile || ""}`);
    lines.push(`Referral Code,${ledgerData.user.referralCode || ""}`);
    lines.push(`Bank Account Name,${ledgerData.user.bank?.accountName || ""}`);
    lines.push(`Bank Account Number,${ledgerData.user.bank?.accountNumber || ""}`);
    lines.push(`Bank Name,${ledgerData.user.bank?.bankName || ""}`);
    lines.push(`Bank IFSC,${ledgerData.user.bank?.ifsc || ""}`);
    lines.push(`UPI Link,${ledgerData.user.bank?.upiLink || ""}`);
    lines.push(`Total Income,${ledgerData.summary.totalIncome.toFixed(2)}`);
    lines.push(`Total Business,${ledgerData.summary.totalBusiness}`);
    lines.push("");
    lines.push("Date,Service,Level,From User,From Mobile,BV,Amount");

    ledgerData.ledger.forEach((row) => {
      const svc = typeof row.purchase?.service === "string"
        ? row.purchase.service
        : row.purchase?.service?.name || row.purchase?.service?._id || "-";
      const fromName = row.fromUser?.fullName || row.fromUser?.name || row.fromUser?.email || "-";
      lines.push(
        `"${new Date(row.createdAt).toLocaleString("en-IN")}","${String(svc).replace(/,/g, " ")}","L${row.level}","${fromName.replace(/,/g, " ")}","${row.fromUser?.mobile || "-"}",${row.bv ?? 0},${(row.amount ?? 0).toFixed(2)}`
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-ledger-${selectedUserId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    if (!ledgerData) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Payment Ledger Report", 40, 36);
    doc.setFontSize(10);
    doc.text(`User: ${ledgerData.user.name || "-"}`, 40, 54);
    doc.text(`Email: ${ledgerData.user.email || "-"} | Mobile: ${ledgerData.user.mobile || "-"}`, 40, 68);
    doc.text(`Bank: ${ledgerData.user.bank?.bankName || "-"} | A/C: ${ledgerData.user.bank?.accountNumber || "-"}`, 40, 82);
    doc.text(`IFSC: ${ledgerData.user.bank?.ifsc || "-"} | UPI: ${ledgerData.user.bank?.upiLink || "-"}`, 40, 96);
    doc.text(
      `Total Income: ${formatINRPrecise(ledgerData.summary.totalIncome)} | Total Business: ${ledgerData.summary.totalBusiness}`,
      40,
      110
    );

    const body = ledgerData.ledger.map((row) => {
      const svc =
        typeof row.purchase?.service === "string"
          ? row.purchase.service
          : row.purchase?.service?.name || row.purchase?.service?._id || "-";
      const fromName = row.fromUser?.fullName || row.fromUser?.name || row.fromUser?.email || "-";
      return [
        new Date(row.createdAt).toLocaleString("en-IN"),
        svc,
        `L${row.level}`,
        fromName,
        row.fromUser?.mobile || "-",
        row.bv ?? 0,
        formatINRPrecise(row.amount ?? 0),
      ];
    });

    autoTable(doc, {
      startY: 124,
      head: [["Date", "Service", "Level", "From User", "From Mobile", "BV", "Amount"]],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`user-ledger-${selectedUserId}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">User Ledger Report</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Payment Ledger with bank account details for each user
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:cursor-pointer"
          disabled={loadingUsers}
        >
          <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
          Load Users
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="min-w-[260px] rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {(u.fullName || u.name || u.email || u.mobile || u._id) as string}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generateLedger}
            disabled={loadingLedger || !selectedUserId}
            className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 hover:cursor-pointer disabled:opacity-50"
          >
            {loadingLedger ? "Generating..." : "Generate Ledger"}
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={!ledgerData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!ledgerData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>

        {selectedUser && (
          <p className="mt-2 text-xs text-zinc-500">
            Selected: {(selectedUser.fullName || selectedUser.name || selectedUser.email || selectedUser.mobile || selectedUser._id) as string}
          </p>
        )}
      </div>

      {ledgerData && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">User Details</h3>
              <div className="space-y-1 text-sm text-zinc-700">
                <p><span className="font-medium">Name:</span> {ledgerData.user.name || "-"}</p>
                <p><span className="font-medium">Email:</span> {ledgerData.user.email || "-"}</p>
                <p><span className="font-medium">Mobile:</span> {ledgerData.user.mobile || "-"}</p>
                <p><span className="font-medium">Referral Code:</span> {ledgerData.user.referralCode || "-"}</p>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">Bank Account Details</h3>
              <div className="space-y-1 text-sm text-zinc-700">
                <p><span className="font-medium">Account Name:</span> {ledgerData.user.bank?.accountName || "-"}</p>
                <p><span className="font-medium">Account Number:</span> {ledgerData.user.bank?.accountNumber || "-"}</p>
                <p><span className="font-medium">Bank Name:</span> {ledgerData.user.bank?.bankName || "-"}</p>
                <p><span className="font-medium">IFSC:</span> {ledgerData.user.bank?.ifsc || "-"}</p>
                <p><span className="font-medium">UPI:</span> {ledgerData.user.bank?.upiLink || "-"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <span className="mr-4 font-medium">Total Income: {formatINRPrecise(ledgerData.summary.totalIncome)}</span>
              <span className="mr-4">Total Business: {ledgerData.summary.totalBusiness}</span>
              <span>Entries: {ledgerData.summary.entries}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">From User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">From Mobile</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">BV</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ledgerData.ledger.map((row) => {
                    const serviceName =
                      typeof row.purchase?.service === "string"
                        ? row.purchase.service
                        : row.purchase?.service?.name || row.purchase?.service?._id || "-";
                    const fromName =
                      row.fromUser?.fullName || row.fromUser?.name || row.fromUser?.email || "-";
                    return (
                      <tr key={row._id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 text-zinc-700">
                          {new Date(row.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{serviceName}</td>
                        <td className="px-4 py-3 text-zinc-700">L{row.level}</td>
                        <td className="px-4 py-3 text-zinc-700">{fromName}</td>
                        <td className="px-4 py-3 text-zinc-700">{row.fromUser?.mobile || "-"}</td>
                        <td className="px-4 py-3 text-right text-zinc-700">{row.bv ?? 0}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">
                          {formatINRPrecise(row.amount ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

