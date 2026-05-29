import { Router } from "express";
import mongoose from "mongoose";
import { UserModel } from "@/models/User";
import { requireAuth } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/db";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";
import { getReferralWithdrawalSummariesBatch } from "@/lib/referralWithdrawalSummary";

const router = Router();

/**
 * GET /api/referrals/earnings?ids=id1,id2,id3
 * Staff only: per-user total earned + withdrawable amount (same as Overview card).
 */
router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const viewerDoc = await UserModel.findById(ctx.userId).select("role").lean();
    const viewerRole = String((viewerDoc as { role?: string } | null)?.role ?? ctx.role);
    if (!isReferralStaffRole(viewerRole)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const idsParam = String(req.query.ids ?? "").trim();
    const userIds = [
      ...new Set(
        idsParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => mongoose.Types.ObjectId.isValid(s)),
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    if (!userIds.length) {
      return res.json({ earnings: {} as Record<string, { totalEarnedAmount: number; withdrawalAmount: number }> });
    }

    const batch = await getReferralWithdrawalSummariesBatch(userIds);
    const earnings: Record<string, { totalEarnedAmount: number; withdrawalAmount: number }> = {};
    batch.forEach((value, key) => {
      earnings[key] = value;
    });

    return res.json({ earnings });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return res.status(401).json({ error: msg });
  }
});

export default router;
