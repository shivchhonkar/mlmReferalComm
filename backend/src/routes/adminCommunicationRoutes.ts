import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";

import { connectToDatabase } from "../lib/db";
import { requireAdminRole } from "../middleware/auth";
import { CommunicationShareLogModel } from "../models/CommunicationShareLog";

const router = Router();

router.post("/track-share", async (req, res) => {
  try {
    const ctx = await requireAdminRole(req);
    await connectToDatabase();

    const body = z
      .object({
        channel: z.enum(["email", "sms", "whatsapp"]),
        serviceIds: z.array(z.string()).min(1),
        status: z.enum(["prepared", "opened", "sent"]).default("prepared"),
        message: z.string().optional(),
        shareItems: z
          .array(
            z.object({
              userId: z.string(),
              shareUrl: z.string().optional(),
            })
          )
          .min(1),
      })
      .parse(req.body);

    const validServiceIds = body.serviceIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const docs = body.shareItems
      .filter((item) => mongoose.Types.ObjectId.isValid(item.userId))
      .map((item) => ({
        adminId: ctx.userId,
        userId: new mongoose.Types.ObjectId(item.userId),
        serviceIds: validServiceIds.map((id) => new mongoose.Types.ObjectId(id)),
        channel: body.channel,
        status: body.status,
        message: body.message,
        shareUrl: item.shareUrl,
      }));

    if (docs.length === 0) {
      return res.status(400).json({ error: "No valid share items to track" });
    }

    await CommunicationShareLogModel.insertMany(docs);
    return res.json({ success: true, tracked: docs.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status = msg === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

router.get("/logs", async (req, res) => {
  try {
    await requireAdminRole(req);
    await connectToDatabase();

    const limitRaw = Number(req.query.limit ?? 5000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(10000, limitRaw)) : 5000;

    const logs = await CommunicationShareLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("adminId", "fullName name email")
      .populate("userId", "fullName name email mobile")
      .populate("serviceIds", "name")
      .lean();

    return res.json({
      success: true,
      total: logs.length,
      logs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status = msg === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
