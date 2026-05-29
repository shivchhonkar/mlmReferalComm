export const ADMIN_PAYOUT_PAYMENT_METHODS = ["cash", "upi"] as const;
export type AdminPayoutPaymentMethod = (typeof ADMIN_PAYOUT_PAYMENT_METHODS)[number];

export function assertValidAdminPayoutPayment(
  paymentMethod: string,
  paymentProofUrl?: string | null,
): void {
  if (!ADMIN_PAYOUT_PAYMENT_METHODS.includes(paymentMethod as AdminPayoutPaymentMethod)) {
    throw new Error("Payment method must be cash or UPI.");
  }
  if (paymentMethod === "upi") {
    const url = String(paymentProofUrl ?? "").trim();
    if (!url) {
      throw new Error("UPI payment requires a screenshot attachment.");
    }
  }
}
