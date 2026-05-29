import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import { WithdrawalModel } from "@/models/Withdrawal";
import { getReferralWithdrawalSummary } from "@/lib/referralWithdrawalSummary";
import { resolveReportPeriodRange } from "@/lib/reportPeriodRange";

const router = Router();

const bodySchema = z.object({
  amount: z.coerce.number().positive(),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const userObjectId = new mongoose.Types.ObjectId(ctx.userId);
    const statusParam = String(req.query.status ?? "all").toLowerCase();
    const allowedStatuses = new Set(["all", "pending", "completed", "rejected"]);
    const statusFilter = allowedStatuses.has(statusParam) ? statusParam : "all";
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 500) : 200;

    const withdrawalQuery: {
      user: mongoose.Types.ObjectId;
      status?: string;
      createdAt?: { $gte: Date; $lte: Date };
    } = {
      user: userObjectId,
    };
    if (statusFilter !== "all") {
      withdrawalQuery.status = statusFilter;
    }

    let period: {
      key: string;
      label: string;
      start: string;
      end: string;
    } | null = null;

    const periodParam = String(req.query.period ?? "monthly").trim();
    if (periodParam) {
      try {
        const range = resolveReportPeriodRange(
          periodParam,
          String(req.query.from ?? ""),
          String(req.query.to ?? ""),
        );
        withdrawalQuery.createdAt = { $gte: range.start, $lte: range.end };
        period = {
          key: range.key,
          label: range.label,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        };
      } catch (rangeErr: unknown) {
        const msg =
          rangeErr instanceof Error ? rangeErr.message : "Invalid report period";
        return res.status(400).json({ error: msg });
      }
    }

    const aggMatch: Record<string, unknown> = { user: userObjectId };
    if (withdrawalQuery.createdAt) {
      aggMatch.createdAt = withdrawalQuery.createdAt;
    }

    const [summary, withdrawals, statusAgg] = await Promise.all([
      getReferralWithdrawalSummary(ctx.userId),
      WithdrawalModel.find(withdrawalQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("reviewedBy", "fullName name email")
        .lean(),
      WithdrawalModel.aggregate<{
        _id: string;
        count: number;
        totalAmount: number;
      }>([
        { $match: aggMatch },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
          },
        },
      ]),
    ]);

    const statusCounts = {
      all: 0,
      pending: 0,
      completed: 0,
      rejected: 0,
    };
    const statusAmounts = {
      all: 0,
      pending: 0,
      completed: 0,
      rejected: 0,
    };
    for (const row of statusAgg) {
      const key = String(row._id ?? "") as keyof typeof statusCounts;
      if (!(key in statusCounts)) continue;
      statusCounts[key] = row.count;
      statusAmounts[key] = Number(row.totalAmount) || 0;
      statusCounts.all += row.count;
      statusAmounts.all += Number(row.totalAmount) || 0;
    }

    const periodSummary = {
      requestCount: statusCounts.all,
      requestAmount: statusAmounts.all,
      paidAmount: statusAmounts.completed,
      pendingAmount: statusAmounts.pending,
      rejectedAmount: statusAmounts.rejected,
    };

    return res.json({
      summary,
      withdrawals,
      statusCounts,
      statusAmounts,
      period,
      periodSummary,
    });
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
