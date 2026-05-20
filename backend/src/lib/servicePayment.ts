/** Service catalog payment types and order service-payment lifecycle. */

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

/** Legacy status stored on older dynamic orders */
export function isPaymentLinkSharedStatus(status: unknown): boolean {
  return status === "payment_link_shared" || status === "payment_link_added";
}

export function canMarkDynamicPaymentReceived(status: unknown): boolean {
  return isPaymentLinkSharedStatus(status);
}

export function canMarkDynamicPaid(status: unknown): boolean {
  return status === "payment_received";
}

export function normalizeServicePaymentType(value: unknown): ServicePaymentType {
  return value === "dynamic_link" ? "dynamic_link" : "fixed_upi";
}

export function isDynamicLinkService(value: unknown): boolean {
  return normalizeServicePaymentType(value) === "dynamic_link";
}

export function defaultServicePaymentFields(): {
  paymentType: ServicePaymentType;
  requiresAdminPricing: boolean;
} {
  return { paymentType: "fixed_upi", requiresAdminPricing: false };
}

export const DYNAMIC_LINK_CATALOG_PRICE = 0;

/** Resolve catalog price on create/update from payment type */
export function resolveCatalogPrice(
  paymentType: unknown,
  price: number | undefined,
): number {
  if (isDynamicLinkService(paymentType)) return DYNAMIC_LINK_CATALOG_PRICE;
  return typeof price === "number" && Number.isFinite(price) ? Math.max(0, price) : 0;
}

export function catalogPriceRequired(paymentType: unknown): boolean {
  return !isDynamicLinkService(paymentType);
}
