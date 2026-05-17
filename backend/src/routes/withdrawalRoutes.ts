import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import { WithdrawalModel } from "@/models/Withdrawal";
import { getReferralWithdrawalSummary } from "@/lib/referralWithdrawalSummary";

const router = Router();

const bodySchema = z.object({
  amount: z.coerce.number().positive(),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const [summary, withdrawals] = await Promise.all([
      getReferralWithdrawalSummary(ctx.userId),
      WithdrawalModel.find({ user: ctx.userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return res.json({ summary, withdrawals });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to load withdrawals";
    const status =
      msg.includes("log in") || msg.includes("Authentication") || msg.includes("Please log in") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    const body = bodySchema.parse(req.body ?? {});
    const amt = Number(body.amount);
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(ctx.userId);

    const runCreate = async (session: mongoose.ClientSession | null) => {
      const summary = await getReferralWithdrawalSummary(ctx.userId, session ?? undefined);
      if (!Number.isFinite(amt) || amt <= 0) {
        const e = new Error("Invalid amount");
        (e as any).statusCode = 400;
        throw e;
      }
      if (amt > summary.withdrawalAmount + 1e-9) {
        const e = new Error("Amount exceeds allowed withdrawal balance");
        (e as any).statusCode = 400;
        throw e;
      }
      const opts = session ? { session } : {};
      const [doc] = await WithdrawalModel.create(
        [{ user: userObjectId, amount: amt, status: "pending" }],
        opts
      );
      return doc;
    };

    let doc: mongoose.Document | null = null;

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          doc = await runCreate(session);
        });
      } finally {
        session.endSession();
      }
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
        doc = await runCreate(null);
      } else {
        throw txErr;
      }
    }

    if (!doc) throw new Error("Withdrawal failed");

    const summary = await getReferralWithdrawalSummary(ctx.userId);
    return res.status(201).json({
      ok: true,
      withdrawal: { id: String((doc as any)._id), amount: (doc as any).amount, status: (doc as any).status },
      summary,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.flatten() });
    }
    const msg = err instanceof Error ? err.message : "Withdrawal request failed";
    const code = (err as any)?.statusCode;
    const status =
      code === 400 ? 400 : msg.includes("log in") || msg.includes("Authentication") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
