import { Router } from "express";
import { connectToDatabase } from "../lib/db";
import { NotificationSetting } from "../models/NotificationSetting";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await connectToDatabase();
    const setting = await NotificationSetting.findOne({ key: "global" })
      .select("message isActive updatedAt")
      .lean();

    return res.json({
      notification: {
        message: setting?.message ?? "",
        isActive: !!setting?.isActive,
        updatedAt: setting?.updatedAt ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to load notification";
    return res.status(500).json({ error: msg });
  }
});

export default router;
