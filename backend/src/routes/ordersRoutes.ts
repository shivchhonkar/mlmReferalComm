import express from "express";

import { OrderModel } from "../models/Order";
import { PurchaseModel } from "../models/Purchase";
import { UserModel } from "../models/User";
import { ServiceModel } from "../models/Service"; // ✅ make sure this exists

import { requireAuth } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/db";

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

    const { customer, items, payment } = req.body ?? {};

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
    // - serviceId can be STRING like "svc004invoice"
    // - ensure quantity is valid
    // - ensure service exists in DB
    const serviceIds = items
      .map((it: any) => String(it?.id ?? "").trim())
      .filter(Boolean);

    if (serviceIds.length === 0) {
      return res.status(400).json({ message: "Invalid service id" });
    }

    // fetch all services in one query
    const services = await ServiceModel.find({ _id: { $in: serviceIds } })
      .select("_id name price businessVolume status")
      .lean();

    const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));

    for (const it of items) {
      const serviceId = String(it?.id ?? "").trim();
      const qty = Number(it?.quantity ?? 0);

      if (!serviceId || !serviceMap.has(serviceId)) {
        return res.status(400).json({ message: `Invalid service id: ${serviceId || "missing"}` });
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

    // ---- Create Order
    const order = await OrderModel.create({
      user: user._id, // ✅ user is ObjectId in users collection
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
      status: "PENDING",
      payment: {
        mode: payment?.mode === "RAZORPAY" ? "RAZORPAY" : "COD",
        status: "PENDING",
      },
    });

    // ---- Create Purchases
    // ✅ Your services use string _id, so Purchase.service should be String in schema.
    // If your Purchase schema is still ObjectId, change it to String to match services.
    const purchasesToInsert: any[] = [];

    for (const it of normalizedItems) {
      for (let k = 0; k < it.quantity; k++) {
        purchasesToInsert.push({
          user: user._id,
          service: it.service, // ✅ string id like "svc004invoice"
          bv: it.bv,
        });
      }
    }

    if (purchasesToInsert.length > 0) {
      await PurchaseModel.insertMany(purchasesToInsert);
    }

    return res.status(201).json({
      message: "Order created",
      order: {
        id: String(order._id),
        status: order.status,
        payment: order.payment,
        totalAmount: order?.totals?.totalAmount,
        totalQuantity: order?.totals?.totalQuantity,
        createdAt: order.createdAt,
        purchasesCreated: purchasesToInsert.length,
      },
    });
  } catch (err: any) {
    if (err?.status === 401 || err?.message?.toLowerCase?.().includes("unauthorized")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.error("orders POST error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
