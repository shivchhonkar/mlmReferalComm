/**
 * Resolve display "service cost" for an income row's purchase.
 * Prefer the order line unit price (actual charge for dynamic_link);
 * fall back to catalog Service.price (fixed_upi / legacy).
 */
export type PurchaseForServiceCost = {
  service?: { _id?: string; price?: number } | string | null;
  order?: {
    items?: Array<{ service?: string; price?: number }> | null;
  } | string | null;
};

export function resolveIncomeServiceCost(
  purchase: PurchaseForServiceCost | null | undefined
): number | null {
  if (!purchase || typeof purchase !== "object") return null;

  const serviceId =
    typeof purchase.service === "object" && purchase.service != null
      ? String((purchase.service as { _id?: string })._id ?? "")
      : typeof purchase.service === "string"
        ? purchase.service
        : "";

  const order = purchase.order;
  if (order && typeof order === "object" && Array.isArray(order.items) && serviceId) {
    const line = order.items.find((it) => String(it?.service ?? "") === serviceId);
    if (line) {
      const orderPrice = Number(line.price);
      if (Number.isFinite(orderPrice)) return orderPrice;
    }
  }

  const svc = purchase.service;
  if (svc && typeof svc === "object") {
    const catalogPrice = Number(svc.price);
    if (Number.isFinite(catalogPrice)) return catalogPrice;
  }

  return null;
}
