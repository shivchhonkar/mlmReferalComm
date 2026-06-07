export const SERVICE_PAYMENT_TYPES = ["fixed_upi", "dynamic_link"] as const;
export type ServicePaymentType = (typeof SERVICE_PAYMENT_TYPES)[number];

export const SERVICE_PAYMENT_STATUSES = [
  "pending",
  "awaiting_payment_link",
  "payment_link_added",
  "payment_link_shared",
  "payment_received",
  "paid",
] as const;
export type ServicePaymentStatus = (typeof SERVICE_PAYMENT_STATUSES)[number];

export function isPaymentLinkSharedStatus(status?: string | null): boolean {
  return status === "payment_link_shared" || status === "payment_link_added";
}

export function canMarkDynamicPaymentReceived(status?: string | null): boolean {
  return isPaymentLinkSharedStatus(status);
}

export function canMarkDynamicPaid(status?: string | null): boolean {
  return status === "payment_received";
}

export type DynamicPaymentStep = 1 | 2 | 3 | 4 | 5 | 6;

export function orderHasAdminPricingSet(totalAmount: number): boolean {
  return Number.isFinite(totalAmount) && totalAmount > 0;
}

export function dynamicPaymentProofVerified(payment?: {
  paymentReviewStatus?: string;
} | null): boolean {
  return payment?.paymentReviewStatus === "APPROVED";
}

export function dynamicOrderHasPaymentProof(payment?: {
  paymentProofUrl?: string;
} | null): boolean {
  const url = payment?.paymentProofUrl;
  return typeof url === "string" && url.trim().length > 0;
}

export function dynamicPaymentStep(
  orderStatus: string,
  servicePaymentStatus?: string | null,
  totalAmount = 0,
): DynamicPaymentStep {
  if (servicePaymentStatus === "paid") return 6 as DynamicPaymentStep;
  if (canMarkDynamicPaid(servicePaymentStatus)) return 5;
  if (canMarkDynamicPaymentReceived(servicePaymentStatus)) return 4;
  if (isPaymentLinkSharedStatus(servicePaymentStatus)) return 4;
  if (
    (orderStatus === "CONFIRMED" || orderStatus === "COMPLETED") &&
    orderHasAdminPricingSet(totalAmount)
  ) {
    return 3;
  }
  if (orderStatus === "CONFIRMED" || orderStatus === "COMPLETED") return 2;
  return 1;
}

export function normalizeServicePaymentType(value: unknown): ServicePaymentType {
  return value === "dynamic_link" ? "dynamic_link" : "fixed_upi";
}

export function isDynamicLinkPayment(value: unknown): boolean {
  return normalizeServicePaymentType(value) === "dynamic_link";
}

/** Catalog list/checkout price is required only for fixed UPI services */
export function isCatalogPriceRequired(paymentType: unknown): boolean {
  return !isDynamicLinkPayment(paymentType);
}

/** Stored catalog price for dynamic-link services (govt fee / quoted per order) */
export const DYNAMIC_LINK_CATALOG_PRICE = 0;

export type ServiceBvDisplay = {
  paymentType?: unknown;
  businessVolume?: number;
  bvPercentage?: number;
};

/** Catalog BV badge: fixed services show points; dynamic_link shows configured percentage. */
export function formatServiceBvLabel(service: ServiceBvDisplay): string {
  if (isDynamicLinkPayment(service.paymentType)) {
    const pct =
      service.bvPercentage ??
      (typeof service.businessVolume === "number" &&
      service.businessVolume > 0 &&
      service.businessVolume <= 100
        ? service.businessVolume
        : undefined);
    if (typeof pct === "number" && Number.isFinite(pct)) {
      return `${pct}% BV`;
    }
    return "BV on order price";
  }
  return `${Number(service.businessVolume) || 0} BV`;
}

export function servicePaymentStatusLabel(status?: string | null): string {
  switch (status) {
    case "awaiting_payment_link":
      return "Awaiting payment link";
    case "payment_link_added":
    case "payment_link_shared":
      return "Payment link shared";
    case "payment_received":
      return "Payment received";
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    default:
      return "";
  }
}

export const DYNAMIC_PAYMENT_STEP_LABELS = [
  "Confirm order",
  "Set order price",
  "Payment link shared",
  "Payment received",
  "Mark paid",
] as const;
