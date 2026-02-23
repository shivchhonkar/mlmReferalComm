import express from "express";
import mongoose from "mongoose";

import { OrderModel } from "../models/Order";
import { PurchaseModel } from "../models/Purchase";
import { IncomeModel } from "../models/Income";
import { UserModel } from "../models/User";
import { ServiceModel } from "../models/Service";

import { requireAuth } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/db";
import { distributeBusinessVolumeWithSession } from "@/lib/bvDistribution";

const router = express.Router();

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

function isAdminRole(role?: unknown) {
  return typeof role === "string" && ADMIN_ROLES.has(role);
}

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

    const [orders, total] = await Promise.all([
      OrderModel.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // include user info only for admin views (handy for admin UI)
        .populate(isAdminRole((user as any).role) ? { path: "user", select: "email role name fullName mobile" } : undefined as any)
        .lean(),
      OrderModel.countDocuments(baseFilter),
    ]);

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
    // Support both nested payment and top-level fallbacks (for proxy/parsing edge cases)
    const paymentModeRaw = payment?.mode ?? body.paymentMode;
    const paymentStatusRaw = payment?.status ?? body.paymentStatus;

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

    const validObjectIds = serviceIds.filter((id: string) =>
      mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id
    );

    let serviceMap = new Map<string, any>();
    if (validObjectIds.length > 0) {
      const services = await ServiceModel.find({ _id: { $in: validObjectIds } })
        .select("_id name price businessVolume status")
        .lean();
      serviceMap = new Map(services.map((s: any) => [String(s._id), s]));
    }

    for (const it of items) {
      const serviceId = String(it?.id ?? "").trim();
      const qty = Number(it?.quantity ?? 0);

      if (!serviceId) {
        return res.status(400).json({ message: "Invalid service id: missing" });
      }
      const isLegacyId = !validObjectIds.includes(serviceId);
      if (!isLegacyId && !serviceMap.has(serviceId)) {
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
      const price = Number(it.price);
      const bv = Number(it.businessVolume ?? it.bv ?? 0);

      // if you want server-truth values, uncomment these and use them instead
      // const finalPrice = Number(svc?.price ?? 0);
      // const finalBv = Number(svc?.businessVolume ?? 0);

      return {
        service: serviceId, // ✅ string id
        name: String(it.name ?? svc?.name ?? "Service"),
        price: Number.isFinite(price) ? price : Number(svc?.price ?? 0),
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        bv: Number.isFinite(bv) && bv >= 0 ? bv : Number(svc?.businessVolume ?? 0),
      };
    });

    const computedTotalQuantity = normalizedItems.reduce((s: number, i: any) => s + i.quantity, 0);
    const computedTotalAmount = normalizedItems.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

    const paymentMode =
      paymentModeRaw === "RAZORPAY" ? "RAZORPAY"
      : paymentModeRaw === "CASH" ? "CASH"
      : "COD";
    const paymentStatus =
      paymentMode === "CASH" || paymentStatusRaw === "PAID" ? "PAID" : "PENDING";

    // When customer paid (e.g. cash), order is confirmed; otherwise pending until payment/confirmation
    const orderStatus = paymentStatus === "PAID" ? "CONFIRMED" : "PENDING";

    const orderDoc = {
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
      payment: {
        mode: paymentMode,
        status: paymentStatus,
      },
    };

    const runWithSession = async (session: mongoose.ClientSession | null) => {
      const createOpts = session ? { session } : {};
      const [order] = await OrderModel.create([orderDoc], createOpts);

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
 * PATCH /api/orders/:id/status
 * Body: { status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" }
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

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const isAdmin = isAdminRole((user as any).role);
    if (!isAdmin && String(order.user) !== String(ctx.userId)) {
      return res.status(403).json({ message: "You can only update your own orders" });
    }

    if (status === "CANCELLED") {
      const runCancel = async (session: mongoose.ClientSession | null) => {
        const opts = session ? { session } : {};
        const findQuery = PurchaseModel.find({ order: orderId }).select("_id");
        if (session) findQuery.session(session);
        const purchases = await findQuery.lean();
        const purchaseIds = purchases.map((p: any) => p._id);
        if (purchaseIds.length > 0) {
          await IncomeModel.deleteMany({ purchase: { $in: purchaseIds } }, opts);
        }
        await OrderModel.updateOne({ _id: orderId }, { $set: { status: "CANCELLED" } }, opts);
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
