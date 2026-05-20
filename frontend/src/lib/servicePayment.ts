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

export type DynamicPaymentStep = 1 | 2 | 3 | 4;

export function dynamicPaymentStep(
  orderStatus: string,
  servicePaymentStatus?: string | null,
): DynamicPaymentStep {
  if (servicePaymentStatus === "paid") return 4;
  if (canMarkDynamicPaid(servicePaymentStatus)) return 4;
  if (canMarkDynamicPaymentReceived(servicePaymentStatus)) return 3;
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
  "Payment link shared",
  "Payment received",
  "Mark paid",
] as const;
