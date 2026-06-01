/** Build UPI intent URL for Scan & Pay apps. */

export function buildUpiPayUrl(options: {
  vpa: string;
  amount: number;
  payeeName?: string;
  note?: string;
}): string {
  const vpa = String(options.vpa ?? "").trim();
  if (!vpa) return "";
  const amount = Number(options.amount);
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const params = new URLSearchParams({
    pa: vpa,
    pn: options.payeeName?.trim() || "Sambhariya Marketing",
    am: safeAmount.toFixed(2),
    cu: "INR",
    tn: options.note?.trim() || "Order payment",
  });
  return `upi://pay?${params.toString()}`;
}
