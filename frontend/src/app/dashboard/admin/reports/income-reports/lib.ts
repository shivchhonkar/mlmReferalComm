export function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export type IncomeSummaryRow = {
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    referralCode: string;
    role: string;
  };
  totalEarnedAmount: number;
  totalPaidAmount: number;
  withdrawalAmount: number;
  pendingPayouts: number;
};

export type WithdrawalSummary = {
  totalEarnedAmount: number;
  totalPaidAmount: number;
  withdrawalAmount: number;
  pendingPayouts: number;
  maxCumulativeWithdrawalAllowed?: number;
  nonWithdrawableEarnings?: number;
};

export function formatActionLabel(action: string): string {
  return String(action ?? "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

export function csvEscape(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function personLabel(
  p?: { fullName?: string; name?: string; email?: string; mobile?: string } | null,
): string {
  if (!p) return "—";
  return p.fullName || p.name || p.email || p.mobile || "—";
}

export function customerLabel(
  c?: { name?: string; email?: string; mobile?: string } | null,
): string {
  if (!c) return "—";
  return c.name || c.email || c.mobile || "—";
}
