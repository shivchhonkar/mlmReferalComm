"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";
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
};

type ListResponse = {
  total: number;
  offset: number;
  limit: number;
  depth: number;
  items: ListItem[];
};

export default function ReferralsListView({ showLinkToFull = true }: { showLinkToFull?: boolean }) {
  const [list, setList] = useState<ListResponse | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [offset, setOffset] = useState(0);
  const [openReferredBy, setOpenReferredBy] = useState<Record<string, boolean>>({});
  const limit = 50;

  const toggleReferredBy = (id: string) =>
    setOpenReferredBy((p) => ({ ...p, [id]: !p[id] }));

  const loadList = useCallback(async () => {
    setListBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        depth: "20",
        limit: String(limit),
        offset: String(offset),
      });
      if (q.trim()) qs.set("q", q.trim());
      if (status) qs.set("status", status);

      const r = await apiFetch(`/api/referrals/list?${qs.toString()}`);
      const json = await r.json().catch(() => null);

      if (!r.ok) throw new Error(json?.error ?? `List API failed (${r.status})`);
      setList(json);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setListBusy(false);
    }
  }, [q, status, offset]);

  useEffect(() => {
    const t = window.setTimeout(loadList, 300);
    return () => window.clearTimeout(t);
  }, [loadList]);

  const canPrev = offset > 0;
  const canNext = list ? offset + limit < list.total : false;

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

      {/* Search + filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email / code / name…"
          className="w-full sm:w-80 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
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
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      ) : null}

      {/* List header */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-900">
          Downline List {list ? <span className="text-zinc-500">({list.total})</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(o - limit, 0))}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={!canPrev || listBusy}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset((o) => o + limit)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={!canNext || listBusy}
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-r from-emerald-50 to-sky-50 text-left text-zinc-700">
            <tr>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(list?.items ?? []).map((u) => {
              const isOpen = !!openReferredBy[u.id];
              const rb = u.referredBy ?? null;

              return (
                <tr
                  key={u.id}
                  className="border-t border-zinc-200 transition hover:bg-emerald-50/40"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      L{u.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-zinc-900">{u.name}</div>
                    <div className="text-xs text-zinc-600">
                      Mobile: {u.mobile ?? "—"}, {u.email ?? "—"}
                    </div>
                    <div className="text-xs text-zinc-600">Code: {u.referralCode}</div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-sky-800">
                    {rb ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => toggleReferredBy(u.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-100"
                        >
                          <span className="text-sky-700">Ref by:</span>
                          <span className="max-w-[180px] truncate">{rb.name}</span>
                          <span className="ml-1 text-sky-700">{isOpen ? "▲" : "▼"}</span>
                        </button>
                        {isOpen ? (
                          <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-sm">
                            <div className="text-zinc-900">{rb.name}</div>
                            <div className="mt-0.5 text-zinc-600">
                              {rb.mobile ?? "—"}, {rb.email ?? "—"}
                            </div>
                            {rb.referralCode ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-zinc-600">Code:</span>
                                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-800">
                                  {rb.referralCode}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigator.clipboard.writeText(rb.referralCode ?? "")
                                  }
                                  className="rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-50"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600">
                        Referred by: —
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={
                        u.status === "active"
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                          : "rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700"
                      }
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700 align-top">
                    {new Date(u.joinedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(u.referralCode)}
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50"
                      title="Copy code"
                    >
                      <Share2 className="h-3 w-3" />
                      Copy
                    </button>
                  </td>
                </tr>
              );
            })}
            {listBusy ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-600">
                  Loading…
                </td>
              </tr>
            ) : null}
            {!listBusy && (list?.items?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-600">
                  No referrals yet. Share your referral code to grow your network.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {list ? (
        <div className="mt-3 text-xs text-zinc-600">
          Showing <b>{list.total === 0 ? 0 : offset + 1}</b> –{" "}
          <b>{Math.min(offset + limit, list.total)}</b> of <b>{list.total}</b>
        </div>
      ) : null}
    </section>
  );
}
