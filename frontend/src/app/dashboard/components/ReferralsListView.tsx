"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiFetch } from "@/lib/apiClient";
import { formatINRPrecise } from "@/lib/format";
import { Network, Share2 } from "lucide-react";

type ReferredBy = {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  referralCode?: string;
} | null;

type ListItem = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  referralCode: string;
  status: string;
  activityStatus: string;
  position: "left" | "right" | null;
  joinedAt: string;
  level: number;
  parentId: string | null;
  referredBy?: ReferredBy;
  earnings?: {
    totalEarnedAmount: number;
    withdrawalAmount: number;
  };
};

const FETCH_PAGE = 200;
const MAX_FETCH = 120_000;

async function fetchEarningsForUsers(
  userIds: string[],
): Promise<Record<string, { totalEarnedAmount: number; withdrawalAmount: number }>> {
  if (!userIds.length) return {};
  const qs = new URLSearchParams({ ids: userIds.join(",") });
  const r = await apiFetch(`/api/referrals/earnings?${qs.toString()}`);
  const json = (await r.json().catch(() => null)) as {
    earnings?: Record<string, { totalEarnedAmount: number; withdrawalAmount: number }>;
  } | null;
  if (!r.ok || !json?.earnings) return {};
  return json.earnings;
}

function mergeEarningsIntoItems(
  rows: ListItem[],
  earnings: Record<string, { totalEarnedAmount: number; withdrawalAmount: number }>,
): ListItem[] {
  if (!Object.keys(earnings).length) return rows;
  return rows.map((item) => ({
    ...item,
    earnings: earnings[item.id] ?? item.earnings,
  }));
}

const ROW_GRID_BASE =
  "grid gap-x-2 gap-y-1 items-start grid-cols-[minmax(52px,0.55fr)_minmax(160px,1.35fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,0.95fr)_minmax(80px,0.55fr)]";

const ROW_GRID_ADMIN =
  "grid gap-x-2 gap-y-1 items-start grid-cols-[minmax(52px,0.55fr)_minmax(160px,1.35fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,0.95fr)_minmax(72px,0.5fr)_minmax(160px,1.15fr)]";

export default function ReferralsListView({
  showLinkToFull = true,
  viewerIsStaff = false,
}: {
  showLinkToFull?: boolean;
  /** From /api/me — shows earnings column for admin while list loads */
  viewerIsStaff?: boolean;
}) {
  const [includesEarnings, setIncludesEarnings] = useState(false);
  const showEarnings = includesEarnings || viewerIsStaff;
  const rowGrid = showEarnings ? ROW_GRID_ADMIN : ROW_GRID_BASE;

  const [items, setItems] = useState<ListItem[]>([]);
  const [totalDownline, setTotalDownline] = useState(0);
  const [listBusy, setListBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [openReferredBy, setOpenReferredBy] = useState<Record<string, boolean>>({});
  const [fetchCapped, setFetchCapped] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleReferredBy = (id: string) =>
    setOpenReferredBy((p) => ({ ...p, [id]: !p[id] }));

  const loadAll = useCallback(async () => {
    setListBusy(true);
    setError(null);
    setFetchCapped(false);
    setIncludesEarnings(false);
    try {
      const accumulated: ListItem[] = [];
      let offset = 0;
      let reportedTotal = 0;
      let listIncludesEarnings = false;

      for (;;) {
        const qs = new URLSearchParams({
          depth: "20",
          limit: String(FETCH_PAGE),
          offset: String(offset),
        });
        if (q.trim()) qs.set("q", q.trim());
        if (status) qs.set("status", status);

        const r = await apiFetch(`/api/referrals/list?${qs.toString()}`);
        const json = (await r.json().catch(() => null)) as {
          total?: number;
          items?: ListItem[];
          includesEarnings?: boolean;
          error?: string;
        } | null;

        if (!r.ok) throw new Error(json?.error ?? `List API failed (${r.status})`);
        if (json?.includesEarnings === true) {
          listIncludesEarnings = true;
          setIncludesEarnings(true);
        }
        reportedTotal = Number(json?.total ?? 0);
        const batch = Array.isArray(json?.items) ? json.items : [];
        accumulated.push(...batch);

        if (accumulated.length >= MAX_FETCH) {
          setFetchCapped(true);
          break;
        }
        if (batch.length < FETCH_PAGE || accumulated.length >= reportedTotal) break;
        offset += FETCH_PAGE;
      }

      let finalItems = accumulated;
      if (viewerIsStaff || listIncludesEarnings) {
        const earningsMap = await fetchEarningsForUsers(accumulated.map((row) => row.id));
        if (Object.keys(earningsMap).length > 0) {
          setIncludesEarnings(true);
          finalItems = mergeEarningsIntoItems(accumulated, earningsMap);
        }
      }

      setItems(finalItems);
      setTotalDownline(reportedTotal);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setItems([]);
      setTotalDownline(0);
      setIncludesEarnings(false);
    } finally {
      setListBusy(false);
    }
  }, [q, status, viewerIsStaff]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 300);
    return () => window.clearTimeout(t);
  }, [loadAll]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104,
    overscan: 10,
  });

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-sm">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Referrals</h2>
            <p className="text-xs text-zinc-600">Your downline list</p>
          </div>
        </div>
        {showLinkToFull && (
          <Link
            prefetch={false}
            href="/dashboard/referrals"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
          >
            View full referrals
            <Share2 className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email / code / name…"
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-80"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | "active" | "suspended")}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">⚠️ {error}</div>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-700">
        <span>
          Downline <span className="text-zinc-500">({totalDownline} total)</span>
          {listBusy ? <span className="ml-2 text-zinc-500">Loading…</span> : null}
        </span>
        {fetchCapped || (totalDownline > 0 && items.length < totalDownline) ? (
          <span className="text-xs text-amber-700">
            Showing {items.length} of {totalDownline}
            {fetchCapped ? " (load cap — refine search)." : "."}
          </span>
        ) : (
          <span className="text-xs text-zinc-500">{items.length} in scroll area</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <div className={showEarnings ? "min-w-[1100px]" : "min-w-[880px]"}>
          <div
            className={`${rowGrid} border-b border-zinc-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-3 py-3 text-left text-xs font-medium text-zinc-700`}
          >
            <div>Level</div>
            <div>User</div>
            <div>Referred By</div>
            <div>User Status / Downline Activities</div>
            <div>Joined</div>
            <div>Action</div>
            {showEarnings ? <div>Referral earnings</div> : null}
          </div>

          <div
            ref={parentRef}
            className="h-[min(480px,58vh)] overflow-auto overscroll-contain"
            style={{ contain: "strict" }}
          >
            {listBusy && items.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-zinc-500">Loading referrals…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-zinc-600">
                No referrals yet. Share your referral code to grow your network.
              </div>
            ) : (
              <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const u = items[vi.index];
                  const isOpen = !!openReferredBy[u.id];
                  const rb = u.referredBy ?? null;
                  return (
                    <div
                      key={u.id}
                      data-index={vi.index}
                      ref={rowVirtualizer.measureElement}
                      className={`${rowGrid} absolute left-0 top-0 w-full border-b border-zinc-100 px-3 py-3 text-sm hover:bg-emerald-50/40`}
                      style={{
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      <div className="pt-0.5">
                        <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                          L{u.level}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900">{u.name}</div>
                        <div className="truncate text-xs text-zinc-600">
                          Mobile: {u.mobile ?? "—"}, {u.email ?? "—"}
                        </div>
                        <div className="truncate text-xs text-zinc-600">Code: {u.referralCode}</div>
                      </div>
                      <div className="min-w-0 font-mono text-xs text-sky-800">
                        {rb ? (
                          <div className="max-h-24 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => toggleReferredBy(u.id)}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-800 hover:bg-sky-100"
                            >
                              <span className="truncate">{rb.name}</span>
                              <span className="shrink-0 text-sky-700">{isOpen ? "▲" : "▼"}</span>
                            </button>
                            {isOpen ? (
                              <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700 shadow-sm">
                                <div className="text-zinc-900">{rb.name}</div>
                                <div className="mt-0.5 text-zinc-600">
                                  {rb.mobile ?? "—"}, {rb.email ?? "—"}
                                </div>
                                {rb.referralCode ? (
                                  <div className="mt-1 font-mono text-emerald-800">{rb.referralCode}</div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">
                            —
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span
                          className={
                            u.status === "active"
                              ? "inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                              : "inline-block rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
                          }
                        >
                          {u.status}
                        </span>
                        <span
                          className={`ml-1 inline-block rounded-full border px-2 py-1 text-xs ${
                            u.activityStatus === "active"
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          {u.activityStatus}
                        </span>
                      </div>
                      <div className="whitespace-nowrap text-xs text-zinc-700">
                        {new Date(u.joinedAt).toLocaleString()}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(u.referralCode)}
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-2 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50"
                          title="Copy code"
                        >
                          <Share2 className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                      {showEarnings ? (
                        <div className="space-y-1 text-xs">
                          <div>
                            <span className="text-zinc-500">Total earned</span>
                            <div className="font-semibold text-emerald-800">
                              {formatINRPrecise(u.earnings?.totalEarnedAmount ?? 0)}
                            </div>
                          </div>
                          <div>
                            <span className="text-zinc-500">Withdrawal amount</span>
                            <div className="font-semibold text-sky-800">
                              {formatINRPrecise(u.earnings?.withdrawalAmount ?? 0)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
