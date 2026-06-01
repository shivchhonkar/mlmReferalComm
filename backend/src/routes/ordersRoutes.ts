import express from "express";
import mongoose from "mongoose";

import { OrderModel } from "../models/Order";
import { PurchaseModel } from "../models/Purchase";
import { IncomeModel } from "../models/Income";
import { IncomeLogModel } from "../models/IncomeLog";
import { UserModel } from "../models/User";
import { ServiceModel } from "../models/Service";

import { requireAuth } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/db";
import { distributeBusinessVolumeWithSession } from "@/lib/bvDistribution";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";
import { syncDownlineActivityStatusForUser } from "@/lib/referralDownlineActivity";
import {
  enrichAndRepairOrdersForResponse,
  loadServiceMapForIds,
  orderItemsUseDynamicLink,
  orderIsDynamicPaymentOrder,
} from "@/lib/orderDynamicPayment";
import {
  canMarkDynamicPaid,
  canMarkDynamicPaymentReceived,
  dynamicOrderHasPaymentProof,
  dynamicPaymentProofVerified,
  isDynamicLinkService,
} from "@/lib/servicePayment";
import { markOrderPaidAndFulfilled } from "@/lib/orderFulfillment";
import { buildUpiPayUrl } from "@/lib/upiPayment";
import {
  applyDynamicBvToOrderItems,
  computeOrderTotals,
  orderHasAdminPricingSet,
} from "@/lib/orderDynamicBv";

const router = express.Router();

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function isAdminRole(role?: unknown) {
  return typeof role === "string" && ADMIN_ROLES.has(role);
}

const QUALIFYING_ORDER_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

async function hasQualifyingOrder(userId: mongoose.Types.ObjectId, session?: mongoose.ClientSession | null) {
  const query = OrderModel.exists({
    user: userId,
    status: { $in: QUALIFYING_ORDER_STATUSES },
  });
  if (session) query.session(session);
  const exists = await query;
  return !!exists;
}

async function syncUserStatusAndAncestorActivity(userId: mongoose.Types.ObjectId, session?: mongoose.ClientSession | null) {
  const userQuery = UserModel.findById(userId).select("_id parent role");
  if (session) userQuery.session(session);
  const userDoc = await userQuery.lean();
  if (!userDoc?._id) return;

  // Rule for normal users only: status is active only after own qualifying order.
  // Staff/admin users are excluded from this automatic status/activity flow.
  const userRole = String((userDoc as any).role ?? "user");
  if (!isReferralStaffRole(userRole)) {
    const ownActive = await hasQualifyingOrder(userDoc._id as mongoose.Types.ObjectId, session);
    await UserModel.updateOne(
      { _id: userDoc._id },
      {
        $set: {
          status: ownActive ? "active" : "inactive",
        } as any,
      },
      session ? { session } : undefined
    );
  }

  // Downline Activities: recompute from qualifying orders in the team (not login / not own order).
  await syncDownlineActivityStatusForUser(userDoc._id as mongoose.Types.ObjectId, session);

  let cursor = userDoc.parent ? new mongoose.Types.ObjectId(userDoc.parent) : null;
  const visited = new Set<string>();
  while (cursor) {
    const key = cursor.toString();
    if (visited.has(key)) break;
    visited.add(key);

    const currentUserQuery = UserModel.findById(cursor).select("parent role");
    if (session) currentUserQuery.session(session);
    const currentUser = await currentUserQuery.lean();
    if (!currentUser?._id) break;

    await syncDownlineActivityStatusForUser(cursor, session);

    cursor = currentUser?.parent ? new mongoose.Types.ObjectId(currentUser.parent) : null;
  }
}

/**
 * GET /api/orders/checkout-upi
 * Platform UPI ID for dynamic order payments (from admin payment settings or env).
 */
router.get("/checkout-upi", async (req, res) => {
  try {
    await requireAuth(req);
    await connectToDatabase();

    const adminUser = await UserModel.findOne({ role: { $in: ["admin", "super_admin"] } })
      .select("paymentLinkEnabled upiLink")
      .lean();

    const envUpi = String(process.env.PLATFORM_UPI_ID ?? process.env.UPI_ID ?? "").trim();
    const upiLink = String((adminUser as { upiLink?: string })?.upiLink ?? "").trim() || envUpi;

    return res.json({
      upiLink,
      paymentLinkEnabled: Boolean((adminUser as { paymentLinkEnabled?: boolean })?.paymentLinkEnabled),
      configured: upiLink.length > 0,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    const status = msg.toLowerCase().includes("unauthorized") ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
});

/**
 * ✅ GET /api/orders
 * - Normal users: get only their own orders
 * - Admin/Super Admin: get all orders
 * Optional query params:
 *   - limit (default 50, max 200)
 *   - page  (default 1)
 *   - status (e.g. PENDING)
 */
router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const user = await UserModel.findById(ctx.userId).select("_id role email").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const limitRaw = Number(req.query.limit ?? 50);
    const pageRaw = Number(req.query.page ?? 1);

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
    const skip = (page - 1) * limit;

    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const baseFilter: any = {};

    if (status) baseFilter.status = status;

    // ✅ users can only see their orders; admins can see all
    if (!isAdminRole((user as any).role)) {
      baseFilter.user = user._id;
    }

    const [ordersRaw, total] = await Promise.all([
      OrderModel.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // include user info only for admin views (handy for admin UI)
        .populate(isAdminRole((user as any).role) ? { path: "user", select: "email role name fullName mobile" } : undefined as any)
        .lean(),
      OrderModel.countDocuments(baseFilter),
    ]);

    const orders = await enrichAndRepairOrdersForResponse(ordersRaw);

    return res.json({
      ok: true,
      page,
      limit,
      total,
      orders,
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders GET error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    // ✅ auth (your existing style)
    const ctx = await requireAuth(req);

    await connectToDatabase();

    const user = await UserModel.findById(ctx.userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body ?? {};
    const { customer, items, payment } = body;
    const paymentModeRaw = payment?.mode ?? body.paymentMode;
    const paymentStatusRaw = payment?.status ?? body.paymentStatus;
    const paymentProofUrl = payment?.proofUrl ?? body.paymentProofUrl;

    // ---- Basic validation
    if (!customer?.fullName || String(customer.fullName).trim().length < 2) {
      return res.status(400).json({ message: "Customer fullName is required" });
    }

    const mobile = String(customer?.mobile ?? "").replace(/\D/g, "");
    if (mobile.length !== 10) {
      return res.status(400).json({ message: "Customer mobile must be 10 digits" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    // ✅ Validate each item:
    // - serviceId can be MongoDB ObjectId or legacy string (e.g. "svc001financial" from sample data)
    // - ObjectIds: validate against DB; legacy strings: use payload data as-is
    const serviceIds = items
      .map((it: any) => String(it?.id ?? "").trim())
      .filter(Boolean);

    if (serviceIds.length === 0) {
      return res.status(400).json({ message: "Invalid service id" });
    }

    const serviceMap = await loadServiceMapForIds(serviceIds);

    const orderUsesDynamicPaymentLink =
      paymentModeRaw === "DYNAMIC_LINK" || orderItemsUseDynamicLink(
        items.map((it: any) => ({ service: String(it?.id ?? "").trim() })),
        serviceMap,
      );

    for (const it of items) {
      const serviceId = String(it?.id ?? "").trim();
      const qty = Number(it?.quantity ?? 0);

      if (!serviceId) {
        return res.status(400).json({ message: "Invalid service id: missing" });
      }
      const inCatalog = serviceMap.has(serviceId);
      const looksLikeObjectId =
        mongoose.Types.ObjectId.isValid(serviceId) &&
        String(new mongoose.Types.ObjectId(serviceId)) === serviceId;
      if (looksLikeObjectId && !inCatalog) {
        return res.status(400).json({ message: `Invalid service id: ${serviceId}` });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: "Invalid item quantity" });
      }
    }

    // ---- Normalize items
    // ✅ IMPORTANT: service is stored as STRING because your Service _id is string (svc004invoice)
    const normalizedItems = items.map((it: any) => {
      const serviceId = String(it.id).trim();
      const svc: any = serviceMap.get(serviceId);

      const qty = Number(it.quantity);
      const isDynamicItem = svc && isDynamicLinkService(svc.paymentType);

      if (isDynamicItem) {
        return {
          service: serviceId,
          name: String(it.name ?? svc?.name ?? "Service"),
          price: 0,
          quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
          bv: 0,
        };
      }

      const price = Number(it.price);
      const bv = Number(it.businessVolume ?? it.bv ?? 0);

      return {
        service: serviceId,
        name: String(it.name ?? svc?.name ?? "Service"),
        price: Number.isFinite(price) ? price : Number(svc?.price ?? 0),
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        bv: Number.isFinite(bv) && bv >= 0 ? bv : Number(svc?.businessVolume ?? 0),
      };
    });

    const computedTotalQuantity = normalizedItems.reduce((s: number, i: any) => s + i.quantity, 0);
    const computedTotalAmount = normalizedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

    let paymentMode =
      paymentModeRaw === "RAZORPAY"
        ? "RAZORPAY"
        : paymentModeRaw === "UPI"
          ? "UPI"
          : paymentModeRaw === "CASH"
            ? "CASH"
            : paymentModeRaw === "DYNAMIC_LINK"
              ? "DYNAMIC_LINK"
              : "COD";

    if (orderUsesDynamicPaymentLink) {
      paymentMode = "DYNAMIC_LINK";
    }

    // Fixed UPI: require payment proof; order stays PENDING until admin reviews
    if (paymentMode === "UPI" && !orderUsesDynamicPaymentLink) {
      if (!paymentProofUrl || typeof paymentProofUrl !== "string" || !paymentProofUrl.trim()) {
        return res.status(400).json({ message: "UPI payment requires a screenshot as proof. Please upload your payment screenshot." });
      }
    }

    const paymentStatus =
      paymentMode === "CASH" || paymentStatusRaw === "PAID" ? "PAID" : "PENDING";
    const orderStatus =
      orderUsesDynamicPaymentLink
        ? "PENDING"
        : paymentStatus === "PAID"
          ? "CONFIRMED"
          : "PENDING";

    const orderDoc: any = {
      user: user._id,
      customer: {
        fullName: String(customer.fullName).trim(),
        mobile,
        email: customer.email ? String(customer.email).trim() : undefined,
        address: customer.address ? String(customer.address).trim() : undefined,
        notes: customer.notes ? String(customer.notes).trim() : undefined,
      },
      items: normalizedItems,
      totals: {
        totalQuantity: computedTotalQuantity,
        totalAmount: computedTotalAmount,
      },
      status: orderStatus,
      ...(orderUsesDynamicPaymentLink && {
        servicePaymentStatus: "awaiting_payment_link",
        paymentRequestedAt: new Date(),
      }),
      payment: {
        mode: paymentMode,
        status: paymentStatus,
        ...(paymentMode === "UPI" && {
          paymentProofUrl: paymentProofUrl.trim(),
          paymentReviewStatus: "PENDING_REVIEW",
        }),
      },
    };

    const runWithSession = async (session: mongoose.ClientSession | null) => {
      const createOpts = session ? { session } : {};
      const [order] = await OrderModel.create([orderDoc], createOpts);

      // UPI + dynamic_link: defer purchase creation and BV until payment is confirmed
      if (paymentMode === "UPI" || paymentMode === "DYNAMIC_LINK") {
        await syncUserStatusAndAncestorActivity(user._id, session);
        return { order, purchasesCreated: 0 };
      }

      const purchasesToInsert: { user: mongoose.Types.ObjectId; service: string; bv: number; order: mongoose.Types.ObjectId }[] = [];
      for (const it of normalizedItems) {
        for (let k = 0; k < it.quantity; k++) {
          purchasesToInsert.push({
            user: user._id,
            service: it.service,
            bv: it.bv,
            order: order._id,
          });
        }
      }

      const createdPurchases = await PurchaseModel.insertMany(purchasesToInsert, createOpts);

      for (const purchase of createdPurchases) {
        await distributeBusinessVolumeWithSession({
          userId: String(user._id),
          serviceId: purchase.service,
          purchaseId: String(purchase._id),
          session,
        });
      }

      await syncUserStatusAndAncestorActivity(user._id, session);

      return { order, purchasesCreated: createdPurchases.length };
    };

    try {
      const session = await mongoose.startSession();
      try {
        const result = await session.withTransaction(async () => runWithSession(session));
        const order = result!.order;
        return res.status(201).json({
          message: "Order created",
          order: {
            id: String(order._id),
            status: order.status,
            payment: order.payment,
            servicePaymentStatus: order.servicePaymentStatus,
            paymentLink: order.paymentLink,
            paymentRequestedAt: order.paymentRequestedAt,
            orderUsesDynamicPaymentLink,
            totalAmount: order?.totals?.totalAmount,
            totalQuantity: order?.totals?.totalQuantity,
            createdAt: order.createdAt,
            purchasesCreated: result!.purchasesCreated,
          },
        });
      } finally {
        session.endSession();
      }
    } catch (txErr: any) {
      const msg = String(txErr?.message ?? "");
      if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
        const result = await runWithSession(null);
        const order = result.order;
        return res.status(201).json({
          message: "Order created",
          order: {
            id: String(order._id),
            status: order.status,
            payment: order.payment,
            servicePaymentStatus: order.servicePaymentStatus,
            paymentLink: order.paymentLink,
            paymentRequestedAt: order.paymentRequestedAt,
            orderUsesDynamicPaymentLink,
            totalAmount: order?.totals?.totalAmount,
            totalQuantity: order?.totals?.totalQuantity,
            createdAt: order.createdAt,
            purchasesCreated: result.purchasesCreated,
          },
        });
      }
      throw txErr;
    }
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.error("orders POST error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/orders/:id/pricing
 * Admin: set customer-specific price on dynamic_link order lines (BV recalculated on mark paid).
 * Body: { items: [{ serviceId: string, price: number }] }
 */
router.patch("/:id/pricing", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const user = await UserModel.findById(ctx.userId).select("role").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!isAdminRole((user as any).role)) {
      return res.status(403).json({ message: "Only admin or super_admin can set order pricing." });
    }

    const { items: priceItems } = req.body ?? {};
    if (!Array.isArray(priceItems) || priceItems.length === 0) {
      return res.status(400).json({ message: "items array with serviceId and price is required." });
    }

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isDynamic = await orderIsDynamicPaymentOrder({
      items: order.items as Array<{ service?: string }>,
      payment: order.payment as { mode?: string },
      servicePaymentStatus: order.servicePaymentStatus as string | undefined,
    });
    if (!isDynamic) {
      return res.status(400).json({ message: "Order pricing can only be set for dynamic payment link orders." });
    }
    if (String(order.status) === "CANCELLED") {
      return res.status(400).json({ message: "Cannot price a cancelled order." });
    }
    if (order.servicePaymentStatus === "paid") {
      return res.status(400).json({ message: "Order is already paid." });
    }

    const priceByService = new Map<string, number>();
    for (const row of priceItems) {
      const serviceId = String(row?.serviceId ?? row?.service ?? "").trim();
      const price = Number(row?.price);
      if (!serviceId) {
        return res.status(400).json({ message: "Each item must include serviceId." });
      }
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ message: `Invalid price for service ${serviceId}.` });
      }
      priceByService.set(serviceId, price);
    }

    const orderLines = (order.items ?? []).map((it: any) => {
      const serviceId = String(it.service);
      const nextPrice = priceByService.get(serviceId);
      return {
        service: serviceId,
        name: String(it.name),
        price: nextPrice !== undefined ? nextPrice : Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        bv: Number(it.bv) || 0,
      };
    });

    for (const line of orderLines) {
      if (priceByService.has(line.service) && !Number.isFinite(line.price)) {
        return res.status(400).json({ message: `Missing price for line ${line.service}.` });
      }
    }

    const withBv = await applyDynamicBvToOrderItems(orderLines);
    const totals = computeOrderTotals(withBv);

    await OrderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          items: withBv,
          totals,
        },
      },
    );

    const updated = await OrderModel.findById(orderId).lean();
    return res.json({ message: "Order pricing updated.", order: updated });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders PATCH pricing error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/orders/:id/payment-proof
 * Customer: attach payment screenshot for dynamic_link orders after payment link is shared.
 * Body: { paymentProofUrl: string }
 */
router.patch("/:id/payment-proof", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const { paymentProofUrl } = req.body ?? {};
    if (!paymentProofUrl || typeof paymentProofUrl !== "string" || !paymentProofUrl.trim()) {
      return res.status(400).json({ message: "paymentProofUrl is required." });
    }

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (String(order.user) !== String(ctx.userId)) {
      return res.status(403).json({ message: "You can only upload proof for your own orders." });
    }

    const isDynamic = await orderIsDynamicPaymentOrder({
      items: order.items as Array<{ service?: string }>,
      payment: order.payment as { mode?: string },
      servicePaymentStatus: order.servicePaymentStatus as string | undefined,
    });
    if (!isDynamic) {
      return res.status(400).json({ message: "Payment proof upload applies only to dynamic payment orders." });
    }

    const payStatus = order.servicePaymentStatus as string | undefined;
    if (!canMarkDynamicPaymentReceived(payStatus) && payStatus !== "payment_received") {
      return res.status(400).json({
        message: "Payment proof can be uploaded after the admin shares a payment link.",
      });
    }
    if (payStatus === "paid") {
      return res.status(400).json({ message: "Order is already paid." });
    }

    await OrderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          "payment.paymentProofUrl": paymentProofUrl.trim(),
          "payment.paymentReviewStatus": "PENDING_REVIEW",
          "payment.paymentRejectionReason": undefined,
        },
      },
    );

    const updated = await OrderModel.findById(orderId).lean();
    return res.json({ message: "Payment proof submitted for review.", order: updated });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders PATCH payment-proof error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/orders/:id/service-payment
 * Admin: add/update payment link and service payment status for dynamic_link orders.
 * Body: { paymentLink?: string, action?: "payment_received", markPaid?: boolean }
 */
router.patch("/:id/service-payment", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const user = await UserModel.findById(ctx.userId).select("role").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!isAdminRole((user as any).role)) {
      return res.status(403).json({ message: "Only admin or super_admin can update service payment." });
    }

    const { paymentLink, action, markPaid, usePlatformUpi } = req.body ?? {};
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isDynamic = await orderIsDynamicPaymentOrder({
      items: order.items as Array<{ service?: string }>,
      payment: order.payment as { mode?: string },
      servicePaymentStatus: order.servicePaymentStatus as string | undefined,
    });

    if (!isDynamic) {
      return res.status(400).json({
        message: "Service payment updates apply only to dynamic payment link orders.",
      });
    }

    if ((order.payment as any)?.mode !== "DYNAMIC_LINK") {
      await OrderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            "payment.mode": "DYNAMIC_LINK",
            ...(order.servicePaymentStatus
              ? {}
              : { servicePaymentStatus: "awaiting_payment_link", paymentRequestedAt: new Date() }),
          },
        },
      );
    }

    const orderStatus = String(order.status);
    const payStatus = order.servicePaymentStatus as string | undefined;
    const update: Record<string, unknown> = {};

    let resolvedPaymentLink =
      typeof paymentLink === "string" ? paymentLink.trim() : "";

    if (usePlatformUpi === true) {
      if (orderStatus !== "CONFIRMED" && orderStatus !== "COMPLETED") {
        return res.status(400).json({ message: "Confirm the order before sending a payment request." });
      }
      if (!orderHasAdminPricingSet({ items: order.items, totals: order.totals ?? undefined })) {
        return res.status(400).json({
          message: "Set the customer-specific order price before sending a payment request.",
        });
      }
      const totalAmount = Number((order.totals as { totalAmount?: number })?.totalAmount) || 0;
      const adminUser = await UserModel.findOne({ role: { $in: ["admin", "super_admin"] } })
        .select("upiLink")
        .lean();
      const envUpi = String(process.env.PLATFORM_UPI_ID ?? process.env.UPI_ID ?? "").trim();
      const vpa =
        String((adminUser as { upiLink?: string })?.upiLink ?? "").trim() || envUpi;
      if (!vpa) {
        return res.status(400).json({
          message:
            "Platform UPI is not configured. Set UPI in Admin → Payment Settings or PLATFORM_UPI_ID env.",
        });
      }
      resolvedPaymentLink = buildUpiPayUrl({
        vpa,
        amount: totalAmount,
        note: `Order ${orderId}`,
      });
    }

    if (resolvedPaymentLink) {
      if (orderStatus !== "CONFIRMED" && orderStatus !== "COMPLETED") {
        return res.status(400).json({
          message: "Confirm the order before sharing a payment link.",
        });
      }
      if (payStatus === "paid") {
        return res.status(400).json({ message: "Order is already marked paid." });
      }
      if (!orderHasAdminPricingSet({ items: order.items, totals: order.totals ?? undefined })) {
        return res.status(400).json({
          message: "Set the customer-specific order price before sending a payment request.",
        });
      }
      update.paymentLink = resolvedPaymentLink;
      update.servicePaymentStatus = "payment_link_shared";
      update.paymentRequestedAt = new Date();
    }

    if (action === "payment_received") {
      if (!canMarkDynamicPaymentReceived(payStatus)) {
        return res.status(400).json({
          message: "Share the payment link with the customer before marking payment received.",
        });
      }
      if (orderStatus !== "CONFIRMED" && orderStatus !== "COMPLETED") {
        return res.status(400).json({ message: "Confirm the order first." });
      }
      if (!dynamicOrderHasPaymentProof(order.payment as { paymentProofUrl?: string })) {
        return res.status(400).json({
          message: "Customer must upload payment proof before payment can be marked received.",
        });
      }
      update.servicePaymentStatus = "payment_received";
      update["payment.paymentReviewStatus"] = "APPROVED";
      update["payment.paymentReviewedAt"] = new Date();
      update["payment.paymentReviewedBy"] = ctx.userId;
    }

    if (markPaid === true) {
      const effectivePayStatus =
        (update.servicePaymentStatus as string | undefined) ?? payStatus;
      if (!canMarkDynamicPaid(effectivePayStatus)) {
        return res.status(400).json({
          message: "Verify payment proof and mark payment as received before marking the order paid.",
        });
      }
      const effectivePayment = {
        ...(order.payment as object),
        ...(update["payment.paymentReviewStatus"]
          ? { paymentReviewStatus: update["payment.paymentReviewStatus"] }
          : {}),
      } as { paymentReviewStatus?: string; paymentProofUrl?: string };
      if (!dynamicPaymentProofVerified(effectivePayment)) {
        return res.status(400).json({
          message: "Payment proof must be verified before marking the order paid.",
        });
      }
      if (!orderHasAdminPricingSet({ items: order.items, totals: order.totals ?? undefined })) {
        return res.status(400).json({
          message: "Order price must be set before marking paid.",
        });
      }
      if (orderStatus !== "CONFIRMED" && orderStatus !== "COMPLETED") {
        return res.status(400).json({ message: "Confirm the order first." });
      }

      const runPaid = async (session: mongoose.ClientSession | null) => {
        if (Object.keys(update).length > 0) {
          await OrderModel.updateOne({ _id: orderId }, { $set: update }, session ? { session } : {});
        }
        await markOrderPaidAndFulfilled(orderId, session);
        await syncUserStatusAndAncestorActivity(order.user as mongoose.Types.ObjectId, session);
      };

      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => runPaid(session));
        } finally {
          session.endSession();
        }
      } catch (txErr: any) {
        const msg = String(txErr?.message ?? "");
        if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
          await runPaid(null);
        } else {
          throw txErr;
        }
      }

      const updated = await OrderModel.findById(orderId).lean();
      return res.json({ message: "Payment marked paid. BV distributed.", order: updated });
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        message: "Provide paymentLink, usePlatformUpi, action: payment_received, or markPaid.",
      });
    }

    await OrderModel.updateOne({ _id: orderId }, { $set: update });
    const updated = await OrderModel.findById(orderId).lean();
    const msg =
      update.servicePaymentStatus === "payment_link_shared"
        ? "Payment link saved and marked as shared."
        : update.servicePaymentStatus === "payment_received"
          ? "Payment marked as received."
          : "Service payment updated.";
    return res.json({ message: msg, order: updated });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders PATCH service-payment error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/orders/:id/payment-review
 * Body: { action: "approve" | "reject", reason?: string }
 * - For UPI orders: only admin or super_admin can approve/reject payment proof.
 * - On approve: create purchases, distribute BV, set order CONFIRMED and payment PAID.
 * - On reject: set paymentReviewStatus REJECTED, optional reason.
 */
router.patch("/:id/payment-review", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const { action, reason } = req.body ?? {};
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use approve or reject." });
    }

    const user = await UserModel.findById(ctx.userId).select("role").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (!isAdminRole((user as any).role)) {
      return res.status(403).json({ message: "Only admin or super_admin can review payments." });
    }

    const order = await OrderModel.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const payment = order.payment as any;
    const isDynamic = await orderIsDynamicPaymentOrder({
      items: order.items as Array<{ service?: string }>,
      payment: order.payment as { mode?: string },
      servicePaymentStatus: order.servicePaymentStatus as string | undefined,
    });

    if (payment?.mode !== "UPI" && !isDynamic) {
      return res.status(400).json({
        message: "Payment review applies only to UPI or dynamic payment link orders.",
      });
    }
    if (payment?.paymentReviewStatus === "APPROVED") {
      return res.status(400).json({ message: "Payment already approved." });
    }
    if (payment?.paymentReviewStatus === "REJECTED") {
      return res.status(400).json({ message: "Payment already rejected. User may need to place a new order." });
    }

    if (action === "reject") {
      await OrderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            "payment.paymentReviewStatus": "REJECTED",
            "payment.paymentRejectionReason": typeof reason === "string" ? reason.trim().slice(0, 500) : undefined,
            "payment.paymentReviewedAt": new Date(),
            "payment.paymentReviewedBy": ctx.userId,
          },
        }
      );
      const updated = await OrderModel.findById(orderId).lean();
      return res.json({ message: "Payment rejected.", order: updated });
    }

    // action === "approve"
    const runApprove = async (session: mongoose.ClientSession | null) => {
      const opts = session ? { session } : {};
      const query = OrderModel.findById(orderId);
      const orderDoc = session ? await query.session(session).exec() : await query.exec();
      if (!orderDoc) throw new Error("Order not found");

      const orderPayment = orderDoc.payment as { mode?: string; paymentProofUrl?: string };
      const dynamicOrder = await orderIsDynamicPaymentOrder({
        items: orderDoc.items as Array<{ service?: string }>,
        payment: orderPayment,
        servicePaymentStatus: orderDoc.servicePaymentStatus as string | undefined,
      });

      if (dynamicOrder) {
        if (!dynamicOrderHasPaymentProof(orderPayment)) {
          throw new Error("Customer must upload payment proof before approval.");
        }
        if (!canMarkDynamicPaymentReceived(orderDoc.servicePaymentStatus)) {
          throw new Error("Share the payment link before verifying payment proof.");
        }

        await OrderModel.updateOne(
          { _id: orderId },
          {
            $set: {
              "payment.paymentReviewStatus": "APPROVED",
              "payment.paymentReviewedAt": new Date(),
              "payment.paymentReviewedBy": ctx.userId,
              servicePaymentStatus: "payment_received",
            },
          },
          opts,
        );

        return { purchasesCreated: 0 };
      }

      const items = orderDoc.items || [];
      const normalizedItems = items.map((it: any) => ({
        service: String(it.service),
        quantity: Number(it.quantity) || 1,
        bv: Number(it.bv) || 0,
      }));

      const purchasesToInsert: { user: mongoose.Types.ObjectId; service: string; bv: number; order: mongoose.Types.ObjectId }[] = [];
      for (const it of normalizedItems) {
        for (let k = 0; k < it.quantity; k++) {
          purchasesToInsert.push({
            user: orderDoc.user,
            service: it.service,
            bv: it.bv,
            order: orderDoc._id,
          });
        }
      }

      const createdPurchases = await PurchaseModel.insertMany(purchasesToInsert, opts);

      for (const purchase of createdPurchases) {
        await distributeBusinessVolumeWithSession({
          userId: String(purchase.user),
          serviceId: purchase.service,
          purchaseId: String(purchase._id),
          session,
        });
      }

      await OrderModel.updateOne(
        { _id: orderId },
        {
          $set: {
            status: "CONFIRMED",
            "payment.status": "PAID",
            "payment.paymentReviewStatus": "APPROVED",
            "payment.paymentReviewedAt": new Date(),
            "payment.paymentReviewedBy": ctx.userId,
          },
        },
        opts,
      );

      await syncUserStatusAndAncestorActivity(orderDoc.user as mongoose.Types.ObjectId, session);

      return { purchasesCreated: createdPurchases.length };
    };

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => runApprove(session));
      } finally {
        session.endSession();
      }
    } catch (txErr: any) {
      const msg = String(txErr?.message ?? "");
      if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
        await runApprove(null);
      } else {
        throw txErr;
      }
    }

    const updated = await OrderModel.findById(orderId).lean();
    if (updated?.user) {
      // Safety re-sync after commit/fallback so buyer status and parent activity are always up-to-date.
      await syncUserStatusAndAncestorActivity(updated.user as mongoose.Types.ObjectId, null);
    }
    const isDynamicOrder = await orderIsDynamicPaymentOrder({
      items: updated?.items as Array<{ service?: string }>,
      payment: updated?.payment as { mode?: string },
      servicePaymentStatus: updated?.servicePaymentStatus as string | undefined,
    });
    return res.json({
      message: isDynamicOrder
        ? "Payment proof verified. You can now mark the order as paid."
        : "Payment approved. Order confirmed.",
      order: updated,
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders PATCH payment-review error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Body: { status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" }
 * - Only admin or super_admin can confirm, reject (cancel), or complete orders.
 * - When status is CANCELLED: reverse referral income (delete Income records for this order's purchases).
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const { status } = req.body ?? {};
    const allowed = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use one of: " + allowed.join(", ") });
    }

    const user = await UserModel.findById(ctx.userId).select("role").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Only admin or super_admin can confirm, cancel, or complete orders
    if (!isAdminRole((user as any).role)) {
      return res.status(403).json({ message: "Only admin or super_admin can confirm, reject, or complete orders." });
    }

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status === "CANCELLED") {
      const runCancel = async (session: mongoose.ClientSession | null) => {
        const opts = session ? { session } : {};
        const findQuery = PurchaseModel.find({ order: orderId }).select("_id");
        if (session) findQuery.session(session);
        const purchases = await findQuery.lean();
        const purchaseIds = purchases.map((p: any) => p._id);
        if (purchaseIds.length > 0) {
          await IncomeModel.deleteMany({ purchase: { $in: purchaseIds } }, opts);
          await IncomeLogModel.deleteMany({ purchase: { $in: purchaseIds } }, opts);
        }
        await OrderModel.updateOne({ _id: orderId }, { $set: { status: "CANCELLED" } }, opts);
        await syncUserStatusAndAncestorActivity(order.user as mongoose.Types.ObjectId, session);
      };
      try {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(() => runCancel(session));
        } finally {
          session.endSession();
        }
      } catch (txErr: any) {
        const msg = String(txErr?.message ?? "");
        if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
          await runCancel(null);
        } else {
          throw txErr;
        }
      }
    } else {
      await OrderModel.updateOne({ _id: orderId }, { $set: { status } });
      await syncUserStatusAndAncestorActivity(order.user as mongoose.Types.ObjectId, null);
    }

    const updated = await OrderModel.findById(orderId).lean();
    return res.json({ message: "Order status updated", order: updated });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.error("orders PATCH status error:", err);
    return res.status(500).json({ message: err?.message || "Internal server error" });
  }
});

export default router;
