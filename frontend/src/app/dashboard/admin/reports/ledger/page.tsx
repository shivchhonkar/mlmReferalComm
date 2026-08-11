"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { Check, ChevronDown, Download, RefreshCw, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatServiceCostDisplay, resolveIncomeServiceCost } from "@/lib/incomeServiceCost";

type UserOption = {
  _id: string;
  fullName?: string;
  name?: string;
  email?: string;
  mobile?: string;
  referralCode?: string;
  role?: string;
};

const USERS_PAGE_SIZE = 500;
const USERS_MAX_PAGES = 80;

const STAFF_ROLES = new Set(["super_admin", "admin", "moderator"]);

function isEndUserRole(role?: string): boolean {
  const r = (role ?? "user").toLowerCase();
  return !STAFF_ROLES.has(r);
}

const LEDGER_ROW_HEIGHT = 52;
const LEDGER_GRID_COLS =
  "grid grid-cols-[minmax(148px,1.25fr)_minmax(120px,1fr)_52px_minmax(110px,1fr)_minmax(100px,0.85fr)_72px_minmax(100px,0.9fr)_100px] gap-x-2 items-center";

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
          price?: number;
        };
    order?: {
      items?: Array<{ service?: string; price?: number }>;
    } | null;
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

function userPrimaryLabel(u: UserOption): string {
  return String(u.fullName || u.name || u.email || u.mobile || u._id);
}

function userMatchesQuery(u: UserOption, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [u.fullName, u.name, u.email, u.mobile, u.referralCode, u.role]
    .filter(Boolean)
    .join(" \u0000 ")
    .toLowerCase();
  return hay.includes(needle);
}

function ledgerServiceName(row: LedgerEntry): string {
  return typeof row.purchase?.service === "string"
    ? row.purchase.service
    : row.purchase?.service?.name || row.purchase?.service?._id || "-";
}

function ledgerFromName(row: LedgerEntry): string {
  return row.fromUser?.fullName || row.fromUser?.name || row.fromUser?.email || "-";
}

function ledgerServiceCost(row: LedgerEntry): number | null {
  return resolveIncomeServiceCost(row.purchase);
}

function ledgerServiceCostDisplay(row: LedgerEntry): string {
  return formatServiceCostDisplay(row.purchase);
}

function VirtualizedLedgerTable({ ledger }: { ledger: LedgerEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: ledger.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LEDGER_ROW_HEIGHT,
    overscan: 15,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [ledger]);

  if (ledger.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-zinc-500">No ledger entries for this user.</div>
    );
  }

  return (
    <>
      <div className="min-w-[1100px] border-b border-zinc-200 bg-zinc-50">
        <div
          className={`${LEDGER_GRID_COLS} px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500`}
        >
          <div>Date</div>
          <div>Service</div>
          <div>Level</div>
          <div>From User</div>
          <div>From Mobile</div>
          <div className="text-right">BV</div>
          <div className="text-right">Service cost</div>
          <div className="text-right">Amount</div>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-[min(70vh,640px)] overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          className="relative min-w-[1100px]"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const row = ledger[vi.index];
            const serviceCost = ledgerServiceCost(row);
            return (
              <div
                key={row._id}
                className={`${LEDGER_GRID_COLS} absolute left-0 top-0 w-full border-b border-zinc-100 px-4 text-sm hover:bg-zinc-50/50`}
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <div className="truncate text-zinc-700">
                  {new Date(row.createdAt).toLocaleString("en-IN")}
                </div>
                <div className="truncate text-zinc-700">{ledgerServiceName(row)}</div>
                <div className="text-zinc-700">L{row.level}</div>
                <div className="truncate text-zinc-700">{ledgerFromName(row)}</div>
                <div className="truncate text-zinc-700">{row.fromUser?.mobile || "-"}</div>
                <div className="text-right text-zinc-700">{row.bv ?? 0}</div>
                <div className="text-right text-zinc-700">
                  {serviceCost == null ? "—" : formatINRPrecise(serviceCost)}
                </div>
                <div className="text-right font-medium text-emerald-700">
                  {formatINRPrecise(row.amount ?? 0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function AdminLedgerReportPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerPayload | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [comboQuery, setComboQuery] = useState("");
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const comboWrapRef = useRef<HTMLDivElement>(null);
  const comboInputRef = useRef<HTMLInputElement>(null);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedUser = useMemo(
    () => users.find((u) => u._id === selectedUserId),
    [users, selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => userMatchesQuery(u, comboQuery));
  }, [users, comboQuery]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const combined: UserOption[] = [];
      let pages = 1;
      for (let page = 1; page <= pages && page <= USERS_MAX_PAGES; page++) {
        const res = await apiFetch(
          `/api/admin/users?page=${page}&limit=${USERS_PAGE_SIZE}&sortBy=createdAt&sortOrder=desc&role=user`
        );
        const body = await readApiBody(res);
        const data = body.json as {
          users?: UserOption[];
          pagination?: { pages: number };
          error?: string;
        };
        if (!res.ok) throw new Error(data?.error || "Failed to load users");
        const batch = (Array.isArray(data?.users) ? data.users : []).filter((u) =>
          isEndUserRole(u.role)
        );
        combined.push(...batch);
        pages = data.pagination?.pages ?? 1;
      }
      setUsers(combined);
      setSelectedUserId((prev) => (prev && combined.some((u) => u._id === prev) ? prev : ""));
      setLedgerData(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setHighlightedIdx((i) => {
      if (filteredUsers.length === 0) return 0;
      return Math.min(i, filteredUsers.length - 1);
    });
  }, [filteredUsers.length, comboQuery]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!comboWrapRef.current?.contains(e.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const cancelBlurClose = () => {
    if (blurCloseTimer.current != null) {
      window.clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  };

  const openCombo = () => {
    cancelBlurClose();
    setListOpen(true);
    setComboQuery("");
    setHighlightedIdx(0);
    requestAnimationFrame(() => comboInputRef.current?.focus());
  };

  const selectUser = (u: UserOption) => {
    cancelBlurClose();
    setSelectedUserId(u._id);
    setListOpen(false);
    setComboQuery("");
    setLedgerData(null);
  };

  const inputDisplayValue = listOpen
    ? comboQuery
    : selectedUser
      ? userPrimaryLabel(selectedUser)
      : "";

  const onComboKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      openCombo();
      return;
    }
    if (!listOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setListOpen(false);
      setComboQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, Math.max(0, filteredUsers.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = filteredUsers[highlightedIdx];
      if (pick) selectUser(pick);
      return;
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
    lines.push("Date,Service,Level,From User,From Mobile,BV,Service cost,Amount");

    ledgerData.ledger.forEach((row) => {
      const svc = ledgerServiceName(row);
      const fromName = ledgerFromName(row);
      lines.push(
        `"${new Date(row.createdAt).toLocaleString("en-IN")}","${String(svc).replace(/,/g, " ")}","L${row.level}","${fromName.replace(/,/g, " ")}","${row.fromUser?.mobile || "-"}",${row.bv ?? 0},${ledgerServiceCostDisplay(row)},${(row.amount ?? 0).toFixed(2)}`
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
      const svc = ledgerServiceName(row);
      const fromName = ledgerFromName(row);
      return [
        new Date(row.createdAt).toLocaleString("en-IN"),
        svc,
        `L${row.level}`,
        fromName,
        row.fromUser?.mobile || "-",
        row.bv ?? 0,
        ledgerServiceCostDisplay(row),
        formatINRPrecise(row.amount ?? 0),
      ];
    });

    autoTable(doc, {
      startY: 124,
      head: [["Date", "Service", "Level", "From User", "From Mobile", "BV", "Service cost", "Amount"]],
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
          Refresh list
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Select User
        </label>
        <div ref={comboWrapRef} className="relative mb-4 max-w-xl">
          <div className="relative flex items-stretch">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              ref={comboInputRef}
              type="text"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="ledger-user-listbox"
              aria-autocomplete="list"
              autoComplete="off"
              placeholder={loadingUsers ? "Loading users…" : "Search by name, mobile, email, or code…"}
              value={inputDisplayValue}
              disabled={loadingUsers && users.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (!listOpen) {
                  setListOpen(true);
                  setComboQuery(v);
                } else {
                  setComboQuery(v);
                }
                setHighlightedIdx(0);
              }}
              onFocus={() => {
                if (!listOpen) openCombo();
              }}
              readOnly={!listOpen && !!selectedUser}
              onBlur={() => {
                blurCloseTimer.current = setTimeout(() => {
                  setListOpen(false);
                  setComboQuery("");
                }, 180);
              }}
              onKeyDown={onComboKeyDown}
              className="min-h-[42px] w-full rounded-lg border border-zinc-200 bg-white py-2 !pl-[40px] pr-11 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-zinc-50"
            />
            <button
              type="button"
              tabIndex={-1}
              aria-label={listOpen ? "Close list" : "Open list"}
              onMouseDown={(e) => {
                e.preventDefault();
                cancelBlurClose();
                if (listOpen) {
                  setListOpen(false);
                  setComboQuery("");
                } else {
                  openCombo();
                }
              }}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${listOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>

          {listOpen && (
            <div
              id="ledger-user-listbox"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[min(320px,50vh)] overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
              onMouseDown={cancelBlurClose}
            >
              {filteredUsers.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-zinc-500">
                  {users.length === 0
                    ? loadingUsers
                      ? "Loading…"
                      : "No users loaded."
                    : "No matches. Try another name or mobile number."}
                </div>
              ) : (
                filteredUsers.map((u, idx) => {
                  const primary = userPrimaryLabel(u);
                  const sub = [u.mobile, u.email].filter(Boolean).join(" · ");
                  const selected = u._id === selectedUserId;
                  const hi = idx === highlightedIdx;
                  return (
                    <button
                      key={u._id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      id={`ledger-user-opt-${u._id}`}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                        hi ? "bg-emerald-50" : "hover:bg-zinc-50"
                      } ${selected ? "border-l-2 border-l-emerald-600" : "border-l-2 border-l-transparent"}`}
                      onMouseEnter={() => setHighlightedIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectUser(u);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">{primary}</span>
                        {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                      </div>
                      {sub ? <div className="truncate text-xs text-zinc-500">{sub}</div> : null}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
              <VirtualizedLedgerTable ledger={ledgerData.ledger} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

