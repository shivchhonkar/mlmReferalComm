import mongoose from "mongoose";
import { OrderModel } from "@/models/Order";
import { PurchaseModel } from "@/models/Purchase";
import { distributeBusinessVolumeWithSession } from "@/lib/bvDistribution";
import { applyDynamicBvToOrderItems } from "@/lib/orderDynamicBv";
import { orderIsDynamicPaymentOrder } from "@/lib/orderDynamicPayment";

type OrderDoc = {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  items?: Array<{ service: string; quantity: number; bv: number; price?: number }>;
};

/** Create purchases and distribute BV for a confirmed order (shared by UPI approve + dynamic link paid). */
export async function fulfillOrderPurchasesAndBv(
  order: OrderDoc,
  session: mongoose.ClientSession | null,
): Promise<number> {
  const opts = session ? { session } : {};
  const items = order.items || [];
  const purchasesToInsert: {
    user: mongoose.Types.ObjectId;
    service: string;
    bv: number;
    order: mongoose.Types.ObjectId;
  }[] = [];

  for (const it of items) {
    const qty = Math.max(1, Number(it.quantity) || 1);
    for (let k = 0; k < qty; k++) {
      purchasesToInsert.push({
        user: order.user,
        service: String(it.service),
        bv: Number(it.bv) || 0,
        order: order._id,
      });
    }
  }

  if (purchasesToInsert.length === 0) return 0;

  const existing = await PurchaseModel.countDocuments({ order: order._id }, opts);
  if (existing > 0) return 0;

  const createdPurchases = await PurchaseModel.insertMany(purchasesToInsert, opts);

  for (const purchase of createdPurchases) {
    await distributeBusinessVolumeWithSession({
      userId: String(order.user),
      serviceId: purchase.service,
      purchaseId: String(purchase._id),
      session,
    });
  }

  return createdPurchases.length;
}

export async function markOrderPaidAndFulfilled(
  orderId: string,
  session: mongoose.ClientSession | null,
): Promise<{ purchasesCreated: number }> {
  const opts = session ? { session } : {};
  const query = OrderModel.findById(orderId);
  const orderDoc = session ? await query.session(session).exec() : await query.exec();
  if (!orderDoc) throw new Error("Order not found");

  const isDynamic = await orderIsDynamicPaymentOrder({
    items: orderDoc.items as Array<{ service?: string }>,
    payment: orderDoc.payment as { mode?: string },
    servicePaymentStatus: orderDoc.servicePaymentStatus as string | undefined,
  });

  let itemsForFulfillment = (orderDoc.items ?? []) as OrderDoc["items"];
  if (isDynamic && itemsForFulfillment?.length) {
    const withBv = await applyDynamicBvToOrderItems(
      itemsForFulfillment.map((it) => ({
        service: String(it.service),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        bv: Number(it.bv) || 0,
      })),
    );
    await OrderModel.updateOne(
      { _id: orderId },
      { $set: { items: withBv } },
      session ? { session } : {},
    );
    itemsForFulfillment = withBv;
  }

  const purchasesCreated = await fulfillOrderPurchasesAndBv(
    {
      _id: orderDoc._id,
      user: orderDoc.user as mongoose.Types.ObjectId,
      items: itemsForFulfillment,
    },
    session,
  );

  await OrderModel.updateOne(
    { _id: orderId },
    {
      $set: {
        status: "CONFIRMED",
        "payment.status": "PAID",
        servicePaymentStatus: "paid",
      },
    },
    opts,
  );

  return { purchasesCreated };
}
