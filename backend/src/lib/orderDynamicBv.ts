import { lineBvForService } from "@/lib/dynamicBv";
import { loadServiceMapForIds } from "@/lib/orderDynamicPayment";
import { isDynamicLinkService } from "@/lib/servicePayment";

export type OrderLineForBv = {
  service: string;
  name?: string;
  price: number;
  quantity: number;
  bv: number;
};

/** Recompute line BV from catalog bvPercentage for dynamic_link items (price must already be set). */
export async function applyDynamicBvToOrderItems(
  items: OrderLineForBv[],
): Promise<OrderLineForBv[]> {
  const serviceIds = items.map((it) => String(it.service)).filter(Boolean);
  const serviceMap = await loadServiceMapForIds(serviceIds);

  return items.map((it) => {
    const svc = serviceMap.get(String(it.service));
    const catalogName = String((svc as { name?: string })?.name ?? "").trim();
    const lineName = String(it.name ?? "").trim();
    const name = lineName || catalogName || "Service";

    if (!svc || !isDynamicLinkService(svc.paymentType)) {
      return { ...it, name: lineName || catalogName || it.name };
    }

    const price = Number(it.price) || 0;
    return {
      ...it,
      name,
      bv: lineBvForService(
        {
          paymentType: svc.paymentType,
          businessVolume: Number((svc as { businessVolume?: number }).businessVolume) || 0,
          bvPercentage: (svc as { bvPercentage?: number }).bvPercentage,
        },
        price,
      ),
    };
  });
}

export function orderHasAdminPricingSet(order: {
  items?: Array<{ price?: number }>;
  totals?: { totalAmount?: number };
}): boolean {
  const items = order.items ?? [];
  if (items.length === 0) return false;
  return items.every((it) => Number(it.price) > 0);
}

export function computeOrderTotals(items: Array<{ price: number; quantity: number }>) {
  const totalQuantity = items.reduce((s, i) => s + Math.max(1, Number(i.quantity) || 1), 0);
  const totalAmount = items.reduce(
    (s, i) => s + (Number(i.price) || 0) * Math.max(1, Number(i.quantity) || 1),
    0,
  );
  return { totalQuantity, totalAmount };
}
