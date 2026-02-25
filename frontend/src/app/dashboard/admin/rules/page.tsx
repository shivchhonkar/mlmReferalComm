"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  AlertCircle,
  BarChart3,
  Plus,
  ClipboardList,
  LayoutDashboard,
  Cog,
  RefreshCw,
  Check,
} from "lucide-react";
import { formatNumber } from "@/lib/format";

type Rule = {
  _id: string;
  basePercentage: number;
  decayEnabled: boolean;
  isActive: boolean;
  createdAt: string;
};

const formInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60";
const formLabelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export default function AdminRulesPage() {
  useAuth({ requireAdmin: true });
  const [rules, setRules] = useState<Rule[]>([]);
  const [basePercentage, setBasePercentage] = useState<number | "">("");
  const [decayEnabled, setDecayEnabled] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    const res = await apiFetch("/api/admin/rules");
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Failed to load rules");
    const recent = (json.recentRules ?? []) as Rule[];
    setRules(recent);
  }

  useEffect(() => {
    load().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePercentage, decayEnabled, isActive: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Create failed");
      await load();
      setBasePercentage("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setActive(rule: Rule) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/rules/${rule._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LayoutDashboard className="h-4 w-4" />
              <span>Admin</span>
              <span className="text-slate-400">·</span>
              <span>Rules</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Distribution Rules
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Configure BV income distribution: Level 1 percentage and decay for upper levels.
            </p>
            {rules.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {rules.length} rule{rules.length !== 1 ? "s" : ""}
                </span>
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    1 active
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Admin home
            </Link>
            <Link
              href="/dashboard/admin/services"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Services
            </Link> */}
            <button
              type="button"
              onClick={() => load().catch((e) => setError(String(e?.message ?? e)))}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="mt-0.5 text-sm text-red-700">{error}</p>
            </div>
          </div>
        ) : null}

        {/* Create rule */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
              <Plus className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create new rule</h2>
              <p className="text-sm text-slate-500">Set Level 1 percentage and decay. The new rule will be set as active.</p>
            </div>
          </div>
          <form onSubmit={createRule} className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={formLabelClass}>Level 1 percentage (of BV)</label>
              <input
                className={formInputClass}
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={basePercentage}
                onChange={(e) => setBasePercentage(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 5 for 5% at Level 1"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Example: 5 = 5% income at Level 1.</p>
            </div>
            <div>
              <label className={formLabelClass}>Decay</label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={decayEnabled}
                  onChange={(e) => setDecayEnabled(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-sm">
                  <span className="font-medium text-slate-900">Halve each level</span>
                  <p className="mt-0.5 text-xs text-slate-500">L2 = 50% of L1, L3 = 25%, etc.</p>
                </div>
              </label>
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {busy ? "Saving…" : "Create & set active"}
              </button>
            </div>
          </form>
        </div>

        {/* All rules */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <ClipboardList className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All rules</h2>
              <p className="text-sm text-slate-500">One rule is active at a time. Set active to apply a rule.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Level 1 %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Decay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r._id} className="border-b border-slate-100 transition hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900">
                        {formatNumber(r.basePercentage * 100, 2)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {r.decayEnabled ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                          Halving
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          Level 1 only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {r.isActive ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActive(r)}
                        disabled={busy || r.isActive}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {r.isActive ? "Active" : "Set active"}
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <Cog className="mx-auto h-12 w-12 text-slate-300" />
                      <p className="mt-3 font-medium text-slate-900">No rules yet</p>
                      <p className="mt-1 text-sm text-slate-500">Create your first rule above.</p>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {rules.length > 0 && (
            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-lg">💡</span>
                <div className="text-sm text-slate-600">
                  <strong className="text-slate-900">Formula:</strong> Income per level = BV × Level-1% × (1/2)^(level−1) when decay is enabled.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
