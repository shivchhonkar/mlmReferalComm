import mongoose from "mongoose";
import { OrderModel } from "@/models/Order";
import { ServiceModel } from "@/models/Service";
import { isDynamicLinkService } from "@/lib/servicePayment";

export async function loadServiceMapForIds(serviceIds: string[]) {
  const unique = [...new Set(serviceIds.map((id) => String(id).trim()).filter(Boolean))];
  if (unique.length === 0) return new Map<string, { _id: string; paymentType?: string }>();

  const services = await ServiceModel.find({ _id: { $in: unique } })
    .select("_id name price businessVolume status paymentType fixedUpiId requiresAdminPricing")
    .lean();

  return new Map(services.map((s: any) => [String(s._id), s]));
}

export function orderItemsUseDynamicLink(
  items: Array<{ service?: string }> | undefined,
  serviceMap: Map<string, { paymentType?: string }>,
): boolean {
  if (!items?.length) return false;
  return items.some((it) => {
    const svc = serviceMap.get(String(it.service ?? ""));
    return svc && isDynamicLinkService(svc.paymentType);
  });
}

/** Fix orders that were saved as COD because service _id is a string (CUID), not ObjectId. */
export async function enrichAndRepairOrdersForResponse(orders: any[]): Promise<any[]> {
  if (!orders.length) return orders;

  const serviceIds = [
    ...new Set(
      orders.flatMap((o) =>
        (o.items ?? []).map((it: { service?: string }) => String(it.service ?? "").trim()),
      ),
    ),
  ].filter(Boolean);

  const serviceMap = await loadServiceMapForIds(serviceIds);
  const repairs: Array<{ id: mongoose.Types.ObjectId; $set: Record<string, unknown> }> = [];

  const enriched = orders.map((o) => {
    const hasDynamic = orderItemsUseDynamicLink(o.items, serviceMap);
    if (!hasDynamic) return o;

    const out = { ...o, orderUsesDynamicPaymentLink: true };
    const mode = o.payment?.mode;
    const needsModeFix = mode !== "DYNAMIC_LINK";
    const needsStatusFix = !o.servicePaymentStatus;

    if (needsModeFix || needsStatusFix) {
      const $set: Record<string, unknown> = {};
      if (needsModeFix) $set["payment.mode"] = "DYNAMIC_LINK";
      if (needsStatusFix) {
        $set.servicePaymentStatus = "awaiting_payment_link";
        if (!o.paymentRequestedAt) $set.paymentRequestedAt = new Date();
      }
      repairs.push({ id: o._id as mongoose.Types.ObjectId, $set });

      out.payment = { ...(o.payment ?? {}), mode: "DYNAMIC_LINK" };
      if (needsStatusFix) {
        out.servicePaymentStatus = "awaiting_payment_link";
      }
    }

    return out;
  });

  if (repairs.length > 0) {
    for (const r of repairs) {
      await OrderModel.collection.updateOne(
        { _id: r.id },
        { $set: r.$set },
      );
    }
  }

  return enriched;
}

export async function orderIsDynamicPaymentOrder(order: {
  items?: Array<{ service?: string }>;
  payment?: { mode?: string };
  servicePaymentStatus?: string;
}): Promise<boolean> {
  if (order.payment?.mode === "DYNAMIC_LINK") return true;
  if (order.servicePaymentStatus) return true;

  const serviceIds = (order.items ?? []).map((it) => String(it.service ?? "").trim()).filter(Boolean);
  const serviceMap = await loadServiceMapForIds(serviceIds);
  return orderItemsUseDynamicLink(order.items, serviceMap);
}
