"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { User } from "lucide-react";

const ROW_HEIGHT = 64;
const INCOME_GRID_COLS =
  "grid grid-cols-[minmax(108px,1fr)_56px_minmax(140px,1.35fr)_72px_100px] gap-x-2 items-center";

type FromUser = {
  _id?: string;
  email?: string;
  referralCode?: string;
  fullName?: string;
  fullname?: string;
  name?: string;
};

export type IncomeRow = {
  _id: string;
  fromUser?: FromUser | string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
};

function fromUserName(u: FromUser | string | undefined): string {
  if (!u || typeof u === "string") return "-";
  const n = u.fullName ?? u.fullname ?? u.name ?? u.email;
  return n || "-";
}

function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function VirtualizedIncomeTable({ incomes }: { incomes: IncomeRow[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: incomes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    getItemKey: (index) => incomes[index]?._id ?? index,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [incomes]);

  return (
    <>
      <div className="min-w-[600px] border-b border-zinc-200 bg-zinc-50/50">
        <div
          className={`${INCOME_GRID_COLS} px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500`}
        >
          <div>Date</div>
          <div>Level</div>
          <div>From</div>
          <div className="text-right">BV</div>
          <div className="text-right">Amount</div>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-[min(70vh,640px)] overflow-auto"
        style={{ contain: "strict" }}
      >
        <div className="relative min-w-[600px]" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const inc = incomes[vi.index];
            if (!inc) return null;
            return (
              <div
                key={inc._id}
                data-index={vi.index}
                className={`${INCOME_GRID_COLS} absolute left-0 top-0 w-full border-b border-zinc-100 px-4 py-3 text-sm hover:bg-zinc-50/50`}
                style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
              >
                <div className="whitespace-nowrap text-zinc-600">
                  {inc.createdAt
                    ? new Date(inc.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "-"}
                </div>
                <div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    L{inc.level}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="flex items-center gap-2 text-zinc-700">
                    <User className="h-4 w-4 shrink-0 text-zinc-400" />
                    <span className="truncate">{fromUserName(inc.fromUser)}</span>
                  </span>
                  {typeof inc.fromUser === "object" && inc.fromUser?.referralCode ? (
                    <p className="ml-6 mt-0.5 truncate text-xs text-zinc-500">{inc.fromUser.referralCode}</p>
                  ) : null}
                </div>
                <div className="text-right text-zinc-600">{inc.bv ?? 0}</div>
                <div className="text-right font-medium text-emerald-700">
                  {formatINRPrecise(inc.amount ?? 0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
