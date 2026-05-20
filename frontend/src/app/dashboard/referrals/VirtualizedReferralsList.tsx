"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Share2 } from "lucide-react";

export type ReferralListItem = {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  referralCode: string;
  status: string;
  activityStatus: string;
  joinedAt: string;
  level: number;
  businessVolume: number;
  referredBy?: {
    id: string;
    name: string;
    mobile?: string;
    email?: string;
    referralCode?: string;
  } | null;
};

const ROW_COLLAPSED = 88;
const ROW_EXPANDED = 200;
const ROW_GAP = 0;

const ROW_GRID =
  "grid grid-cols-[minmax(52px,0.55fr)_minmax(160px,1.35fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.75fr)_minmax(120px,0.95fr)_minmax(80px,0.55fr)] gap-x-2 items-start";

type Props = {
  items: ReferralListItem[];
  listBusy: boolean;
  canViewPrivateContacts: boolean;
  openReferredBy: Record<string, boolean>;
  onToggleReferredBy: (id: string) => void;
};

export default function VirtualizedReferralsList({
  items,
  listBusy,
  canViewPrivateContacts,
  openReferredBy,
  onToggleReferredBy,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const u = items[index];
      const base = u && openReferredBy[u.id] ? ROW_EXPANDED : ROW_COLLAPSED;
      return base + ROW_GAP;
    },
    overscan: 8,
    getItemKey: (index) => items[index]?.id ?? index,
  });

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure on expand
  }, [openReferredBy, items.length]);

  return (
    <div className="overflow-auto rounded-xl border border-zinc-200">
      <div className="min-w-[980px]">
        <div
          className={`${ROW_GRID} border-b border-zinc-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 text-left text-xs font-medium text-zinc-700`}
        >
          <div>Level</div>
          <div>User</div>
          <div>Referred By</div>
          <div>Status / Activity</div>
          <div>Business Volume</div>
          <div>Joined</div>
          <div>Action</div>
        </div>

        <div
          ref={scrollRef}
          className="h-[min(70vh,640px)] overflow-auto"
          style={{ contain: "strict" }}
        >
          {listBusy && items.length === 0 ? (
            <div className="py-8 text-center text-zinc-600">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-zinc-600">No results found.</div>
          ) : (
            <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((vi) => {
                const u = items[vi.index];
                if (!u) return null;
                const isOpen = !!openReferredBy[u.id];
                const rb = u.referredBy ?? null;

                return (
                  <div
                    key={u.id}
                    data-index={vi.index}
                    ref={rowVirtualizer.measureElement}
                    className={`${ROW_GRID} absolute left-0 top-0 w-full border-b border-zinc-200 px-4 py-3 text-sm hover:bg-emerald-50/40`}
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    <div className="pt-0.5">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        L{u.level}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900">{u.name}</div>
                      {canViewPrivateContacts ? (
                        <div className="text-xs text-zinc-600">
                          Mobile: {u.mobile || "—"}, {u.email || "—"}
                        </div>
                      ) : null}
                      <div className="text-xs text-zinc-600">Code: {u.referralCode}</div>
                    </div>

                    <div className="min-w-0 font-mono text-xs text-sky-800">
                      {rb ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => onToggleReferredBy(u.id)}
                            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-100 hover:cursor-pointer"
                          >
                            <span className="truncate">{rb.name}</span>
                            <span className="text-sky-700">{isOpen ? "▲" : "▼"}</span>
                          </button>
                          {isOpen ? (
                            <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-sm">
                              <div className="text-zinc-900">{rb.name}</div>
                              {canViewPrivateContacts ? (
                                <div className="mt-0.5 text-zinc-600">
                                  Mobile: {rb.mobile || "—"}, {rb.email || "—"}
                                </div>
                              ) : null}
                              {rb.referralCode ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-zinc-600">Code:</span>
                                  <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-800">
                                    {rb.referralCode}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(rb.referralCode || "")}
                                    className="rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-50 hover:cursor-pointer"
                                  >
                                    Copy
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600">
                          Referred by: —
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-xs",
                          u.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700",
                        ].join(" ")}
                      >
                        {u.status}
                      </span>
                      <span
                        className={[
                          "ml-2 rounded-full border px-2 py-1 text-xs",
                          u.activityStatus === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700",
                        ].join(" ")}
                      >
                        {u.activityStatus}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-700">
                      {(u.businessVolume ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </div>

                    <div className="whitespace-nowrap text-xs text-zinc-700">
                      {new Date(u.joinedAt).toLocaleString()}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(u.referralCode)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-50 hover:cursor-pointer"
                        title="Copy code"
                      >
                        <Share2 className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
