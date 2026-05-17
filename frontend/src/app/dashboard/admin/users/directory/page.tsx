"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export type PeriodKey = "all" | "weekly" | "monthly" | "quarterly" | "annually";

export type DirectorySortKey =
  | "name"
  | "email"
  | "mobile"
  | "referralCode"
  | "bankAccount"
  | "bankIfsc"
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
  createdAt: "createdAt",
};

const GRID_COLS =
  "grid grid-cols-[minmax(120px,1.1fr)_minmax(150px,1.35fr)_minmax(96px,0.75fr)_minmax(88px,0.65fr)_minmax(150px,1.1fr)_minmax(130px,0.95fr)_minmax(100px,0.75fr)] gap-x-2 gap-y-1 items-start";

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

function DirectoryRow({ u, includeStaff }: { u: DirectoryUser; includeStaff: boolean }) {
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
      <div className="font-mono text-xs text-zinc-800">{u.referralCode || "—"}</div>
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
      <div className="whitespace-nowrap text-xs text-zinc-600">
        {u.createdAt
          ? new Date(u.createdAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—"}
      </div>
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

  const parentRef = useRef<HTMLDivElement>(null);

  const periodLabel = useMemo(() => PERIODS.find((p) => p.key === period)?.label ?? period, [period]);

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
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
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
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
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
        </div>

        <div className="min-w-0 border-b border-zinc-200 bg-zinc-50/95 px-3 py-2">
          <div className={`${GRID_COLS} text-xs font-semibold uppercase tracking-wide text-zinc-600`}>
            <SortHead label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="Email" column="email" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="Mobile" column="mobile" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="Referral" column="referralCode" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="Bank (name / no.)" column="bankAccount" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="IFSC / Bank" column="bankIfsc" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
            <SortHead label="Registered" column="createdAt" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
          </div>
        </div>

        <div
          ref={parentRef}
          className="h-[min(70vh,720px)] w-full overflow-auto"
          style={{ contain: "strict" }}
        >
          {loading && rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-zinc-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-zinc-500">No users in this period.</div>
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
                    className={`${GRID_COLS} absolute left-0 top-0 w-full border-b border-zinc-100 px-3 py-2 text-sm hover:bg-zinc-50/90`}
                    style={{
                      height: vi.size,
                      transform: `translateY(${vi.start}px)`,
                    }}
                  >
                    <DirectoryRow u={u} includeStaff={includeStaff} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-[11px] text-zinc-400">
        Weekly = Monday–Sunday (server local). Sorting applies server-side. Rows use virtual scrolling for performance.
      </p>
    </div>
  );
}
