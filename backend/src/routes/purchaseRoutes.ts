import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { distributeBusinessVolumeWithSession } from "@/lib/bvDistribution";
import { PurchaseModel } from "@/models/Purchase";
import { requireAuth } from "@/middleware/auth";

const router = Router();

// Get user purchases
router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    // ctx.userId is a string; Purchase.user is ObjectId in schema, but mongoose
    // can match it if it is castable. Safer to cast explicitly:
    const userObjectId = new mongoose.Types.ObjectId(ctx.userId);

    const purchases = await PurchaseModel.find({ user: userObjectId })
      .populate("service") // ✅ service is String ref -> populate works if Service _id is string
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({ purchases });
  } catch (err: unknown) {
    console.error("Error fetching purchases:", err);
    const msg = err instanceof Error ? err.message : "Unable to load purchase history";
    const status =
      msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication")
        ? 401
        : 400;
    return res.status(status).json({ error: msg });
  }
});

// Create purchase
router.post("/", async (req, res) => {
  const schema = z.object({
    serviceId: z.string().min(1),
  });

  try {
    const ctx = await requireAuth(req);
    const body = schema.parse(req.body);
    await connectToDatabase();

    const session = await mongoose.startSession();

    try {
      const result = await session.withTransaction(async () => {
        // ✅ user is ObjectId in Purchase schema
        const userObjectId = new mongoose.Types.ObjectId(ctx.userId);

        // ✅ serviceId is STRING in your Service collection (_id like "svc004invoice")
        const serviceId = String(body.serviceId).trim();

        // ✅ insertMany is clean with session + returns created docs
        const created = await PurchaseModel.insertMany(
          [
            {
              user: userObjectId,
              service: serviceId, // ✅ string, NOT ObjectId
              bv: 0,
            },
          ],
          { session }
        );

        const purchase = created[0];

        const distribution = await distributeBusinessVolumeWithSession({
          userId: ctx.userId,
          serviceId: serviceId,
          purchaseId: purchase._id.toString(),
          session,
        });

        await PurchaseModel.updateOne(
          { _id: purchase._id },
          { $set: { bv: distribution.bv } },
          { session }
        );

        return {
          purchaseId: purchase._id.toString(),
          bv: distribution.bv,
          logsCreated: distribution.logsCreated,
          levelsPaid: distribution.levelsPaid,
        };
      });

      return res.status(201).json({ ok: true, ...result });
    } finally {
      session.endSession();
    }
  } catch (err: unknown) {
    console.error("Error creating purchase:", err);
    const msg = err instanceof Error ? err.message : "Unable to create purchase";
    const status =
      msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication")
        ? 401
        : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
