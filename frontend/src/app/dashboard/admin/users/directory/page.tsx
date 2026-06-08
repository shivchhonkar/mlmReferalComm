"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  ChevronsUpDown,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import ReportExportButtons from "../../reports/income-reports/_components/ReportExportButtons";

export type PeriodKey = "all" | "weekly" | "monthly" | "quarterly" | "annually";

export type DirectorySortKey =
  | "name"
  | "email"
  | "mobile"
  | "referralCode"
  | "bankAccount"
  | "bankIfsc"
  | "upi"
  | "createdAt";

type SortDir = "asc" | "desc";

type DirectoryUser = {
  _id: string;
  name?: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  referralCode?: string;
  role?: string;
  createdAt?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
  bankAddress?: string;
  upiLink?: string;
};

type UsersResponse = {
  users: DirectoryUser[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "annually", label: "Annually" },
];

const PAGE_SIZE = 500;
const MAX_PAGES = 80;

/** Maps UI column to GET /api/admin/users sortBy */
const SORT_QUERY: Record<DirectorySortKey, string> = {
  name: "name",
  email: "email",
  mobile: "mobile",
  referralCode: "referralCode",
  bankAccount: "bankAccountName",
  bankIfsc: "bankIfsc",
  upi: "upiLink",
  createdAt: "createdAt",
};

/** Inline grid — dynamic Tailwind `grid-cols-[…]` is not generated at build time. */
function directoryGridStyle(showHiddenColumns: boolean): CSSProperties {
  const base =
    "minmax(120px,1.1fr) minmax(150px,1.35fr) minmax(96px,0.75fr)";
  const bank = "minmax(150px,1.1fr) minmax(130px,0.95fr) minmax(110px,0.95fr)";
  const cols = showHiddenColumns
    ? `${base} minmax(88px,0.65fr) ${bank} minmax(100px,0.75fr)`
    : `${base} ${bank}`;
  return {
    display: "grid",
    gridTemplateColumns: cols,
    columnGap: "0.5rem",
    rowGap: "0.25rem",
    alignItems: "start",
  };
}

const TABLE_MIN_WIDTH: Record<"compact" | "full", number> = {
  compact: 920,
  full: 1120,
};

function upiDisplayHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^(https?:\/\/|upi:\/\/)/i.test(t)) return t;
  return null;
}

function displayName(u: DirectoryUser): string {
  const n = (u.fullName || u.name || "").trim();
  return n || "—";
}

async function fetchUsersPage(
  base: URLSearchParams,
  page: number
): Promise<UsersResponse & { error?: string }> {
  const params = new URLSearchParams(base);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  const res = await apiFetch(`/api/admin/users?${params.toString()}`);
  const body = await readApiBody(res);
  const json = (body.json ?? {}) as UsersResponse & { error?: string };
  if (!res.ok) throw new Error(json.error || "Failed to load users");
  return json;
}

function SortHead({
  label,
  column,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  column: DirectorySortKey;
  sortKey: DirectorySortKey;
  sortDir: SortDir;
  onToggle: (c: DirectorySortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="flex w-full min-w-0 items-center justify-start gap-1 text-left font-semibold text-zinc-600 hover:text-zinc-900"
    >
      <span className="truncate">{label}</span>
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
      )}
    </button>
  );
}

function DirectoryRow({
  u,
  includeStaff,
  showHiddenColumns,
}: {
  u: DirectoryUser;
  includeStaff: boolean;
  showHiddenColumns: boolean;
}) {
  return (
    <>
      <div className="min-w-0 pt-0.5">
        <div className="font-medium text-zinc-900">{displayName(u)}</div>
        {includeStaff && u.role && u.role !== "user" && (
          <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
            {u.role}
          </span>
        )}
      </div>
      <div className="min-w-0 break-all text-zinc-700">{u.email || "—"}</div>
      <div className="whitespace-nowrap text-zinc-700">{u.mobile || "—"}</div>
      {showHiddenColumns ? (
        <div className="font-mono text-xs text-zinc-800">{u.referralCode || "—"}</div>
      ) : null}
      <div className="min-w-0 text-zinc-700">
        <div className="font-medium text-zinc-900">{u.bankAccountName || "—"}</div>
        <div className="font-mono text-xs text-zinc-600">{u.bankAccountNumber || "—"}</div>
      </div>
      <div className="min-w-0 text-zinc-700">
        <div className="font-mono text-xs">{u.bankIfsc || "—"}</div>
        <div className="text-xs text-zinc-600">{u.bankName || "—"}</div>
        {u.bankAddress ? (
          <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500" title={u.bankAddress}>
            {u.bankAddress}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 text-zinc-700">
        {(() => {
          const upi = (u.upiLink || "").trim();
          if (!upi) return <span className="text-zinc-400">—</span>;
          const href = upiDisplayHref(upi);
          if (href) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-xs font-medium text-emerald-700 hover:underline"
                title={upi}
              >
                {upi}
              </a>
            );
          }
          return (
            <span className="break-all font-mono text-xs text-zinc-800" title={upi}>
              {upi}
            </span>
          );
        })()}
      </div>
      {showHiddenColumns ? (
        <div className="whitespace-nowrap text-xs text-zinc-600">
          {u.createdAt
            ? new Date(u.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "—"}
        </div>
      ) : null}
    </>
  );
}

export default function AdminUserDirectoryPage() {
  const { user: currentUser, loading: authLoading } = useAuth({ requireAdmin: true });
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [includeStaff, setIncludeStaff] = useState(false);
  const [nameSearch, setNameSearch] = useState("");
  const [debouncedNameSearch, setDebouncedNameSearch] = useState("");
  const [sortKey, setSortKey] = useState<DirectorySortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [rows, setRows] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHiddenColumns, setShowHiddenColumns] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const gridStyle = useMemo(
    () => directoryGridStyle(showHiddenColumns),
    [showHiddenColumns],
  );
  const tableMinWidth = showHiddenColumns ? TABLE_MIN_WIDTH.full : TABLE_MIN_WIDTH.compact;

  const periodLabel = useMemo(() => PERIODS.find((p) => p.key === period)?.label ?? period, [period]);

  const exportMeta = useMemo(
    () => [
      { label: "Registration period", value: periodLabel },
      { label: "Accounts", value: includeStaff ? "Users + admin / moderator" : "Users only" },
      { label: "Name search", value: debouncedNameSearch || "—" },
      { label: "Sort", value: `${sortKey} (${sortDir})` },
      { label: "Total matching", value: String(total) },
      { label: "Rows in export", value: String(rows.length) },
      ...(truncated
        ? [{ label: "Note", value: `Export capped at ${MAX_PAGES * PAGE_SIZE} loaded rows; narrow filters for full list` }]
        : []),
    ],
    [periodLabel, includeStaff, debouncedNameSearch, sortKey, sortDir, total, rows.length, truncated],
  );

  const exportHeaders = useMemo(() => {
    const headers = ["Name", "Email", "Mobile", "Referral code"];
    if (includeStaff) headers.push("Role");
    headers.push(
      "Bank account name",
      "Bank account number",
      "Bank name",
      "IFSC",
      "Bank address",
      "UPI",
      "Registered",
    );
    return headers;
  }, [includeStaff]);

  const exportRows = useMemo(
    () =>
      rows.map((u) => {
        const cols = [
          displayName(u),
          u.email || "—",
          u.mobile || "—",
          u.referralCode || "—",
        ];
        if (includeStaff) cols.push(u.role || "user");
        cols.push(
          u.bankAccountName || "—",
          u.bankAccountNumber || "—",
          u.bankName || "—",
          u.bankIfsc || "—",
          u.bankAddress || "—",
          (u.upiLink || "").trim() || "—",
          u.createdAt
            ? new Date(u.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—",
        );
        return cols;
      }),
    [rows, includeStaff],
  );

  const exportFileBase = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    const searchSlug = debouncedNameSearch
      ? `-${debouncedNameSearch.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 24)}`
      : "";
    return `users-directory-${period}${searchSlug}-${date}`;
  }, [period, debouncedNameSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedNameSearch(nameSearch.trim()), 400);
    return () => window.clearTimeout(t);
  }, [nameSearch]);

  const buildBaseParams = useCallback(() => {
    const params = new URLSearchParams();
    if (period !== "all") params.set("period", period);
    if (!includeStaff) params.set("role", "user");
    if (debouncedNameSearch) params.set("searchName", debouncedNameSearch);
    params.set("sortBy", SORT_QUERY[sortKey]);
    params.set("sortOrder", sortDir);
    return params;
  }, [period, includeStaff, debouncedNameSearch, sortKey, sortDir]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = buildBaseParams();
      const first = await fetchUsersPage(base, 1);
      const pages = first.pagination?.pages ?? 1;
      const combined = [...(first.users ?? [])];
      const maxFetchPages = Math.min(pages, MAX_PAGES);

      for (let p = 2; p <= maxFetchPages; p++) {
        const next = await fetchUsersPage(base, p);
        combined.push(...(next.users ?? []));
      }

      const reportedTotal = first.pagination?.total ?? combined.length;
      setRows(combined);
      setTotal(reportedTotal);
      setTruncated(pages > MAX_PAGES || combined.length < reportedTotal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setRows([]);
      setTotal(0);
      setTruncated(false);
    } finally {
      setLoading(false);
    }
  }, [buildBaseParams]);

  useEffect(() => {
    if (!authLoading && currentUser) void loadAll();
  }, [authLoading, currentUser, loadAll]);

  const toggleSort = useCallback((column: DirectorySortKey) => {
    setSortKey((prev) => {
      if (prev === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(column === "createdAt" ? "desc" : "asc");
      return column;
    });
  }, []);

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [debouncedNameSearch, period, includeStaff, sortKey, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 112,
    overscan: 12,
  });

  if (authLoading || !currentUser) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-sm text-zinc-600">
        Checking access…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/admin/users/users"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to user management
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
            <Users className="h-6 w-6 text-emerald-600" />
            Users
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Directory with sortable columns, name search, and virtualized scrolling for large lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <ReportExportButtons
            reportTitle="Users directory — bank details"
            fileNameBase={exportFileBase}
            meta={exportMeta}
            headers={exportHeaders}
            rows={exportRows}
            disabled={loading || rows.length === 0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <Calendar className="h-3.5 w-3.5" />
            Registration period
          </p>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  period === key
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md flex-1">
            <label htmlFor="dir-name-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Search by name
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="dir-name-search"
                type="search"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder="First or full name…"
                className="w-full rounded-lg border border-zinc-200 py-2 !pl-[40px] pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                autoComplete="off"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={includeStaff}
              onChange={(e) => setIncludeStaff(e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            Include admin / moderator accounts
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
          <p className="text-sm text-zinc-600">
            {period === "all" ? (
              <span>Registrations{!includeStaff ? " (role: user)" : ""}.</span>
            ) : (
              <span>
                <strong>{periodLabel}</strong> (by account created date).
              </span>
            )}{" "}
            <strong>{total}</strong> matching — showing <strong>{rows.length}</strong> loaded
            {truncated ? (
              <span className="text-amber-700">
                {" "}
                (list capped: fetch at most {MAX_PAGES * PAGE_SIZE} rows; narrow period or search)
              </span>
            ) : null}
            {loading ? <span className="text-zinc-500"> — loading…</span> : null}
          </p>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={showHiddenColumns}
              onChange={(e) => setShowHiddenColumns(e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            View hidden columns
          </label>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: tableMinWidth }}>
            <div className="border-b border-zinc-200 bg-zinc-50/95 px-3 py-2">
              <div
                className="text-xs font-semibold uppercase tracking-wide text-zinc-600"
                style={gridStyle}
              >
                <SortHead label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHead label="Email" column="email" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHead label="Mobile" column="mobile" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {showHiddenColumns ? (
                  <SortHead
                    label="Referral"
                    column="referralCode"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                ) : null}
                <SortHead
                  label="Bank (name / no.)"
                  column="bankAccount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onToggle={toggleSort}
                />
                <SortHead label="IFSC / Bank" column="bankIfsc" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortHead label="UPI" column="upi" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {showHiddenColumns ? (
                  <SortHead
                    label="Registered"
                    column="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onToggle={toggleSort}
                  />
                ) : null}
              </div>
            </div>

            <div
              ref={parentRef}
              className="h-[min(70vh,720px)] w-full overflow-y-auto overflow-x-hidden"
              style={{ contain: "strict" }}
            >
              {loading && rows.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-zinc-500">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="flex items-center justify-center py-20 text-zinc-500">
                  No users in this period.
                </div>
              ) : (
                <div
                  className="relative w-full"
                  style={{ height: rowVirtualizer.getTotalSize() }}
                >
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const u = rows[vi.index];
                    return (
                      <div
                        key={u._id}
                        className="absolute left-0 top-0 w-full border-b border-zinc-100 px-3 py-2 text-sm hover:bg-zinc-50/90"
                        style={{
                          ...gridStyle,
                          height: vi.size,
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        <DirectoryRow
                          u={u}
                          includeStaff={includeStaff}
                          showHiddenColumns={showHiddenColumns}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        Weekly = Monday–Sunday (server local). Sorting applies server-side. Rows use virtual scrolling for performance.
      </p>
    </div>
  );
}
