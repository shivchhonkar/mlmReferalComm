import { Router, type Request, type Response } from "express";
import { connectToDatabase } from "@/lib/db";
import { IncomeModel } from "@/models/Income";
import { requireAuth } from "@/middleware/auth";
import { getReferralWithdrawalSummary } from "@/lib/referralWithdrawalSummary";

const router = Router();

const incomeListPopulate = [
  { path: "fromUser", select: "email mobile referralCode fullName fullname name" },
  {
    path: "purchase",
    populate: {
      path: "service",
      select: "_id name price businessVolume",
    },
  },
] as const;

function parseDateRangeQuery(from?: string, to?: string): { createdAt?: { $gte?: Date; $lte?: Date } } {
  const createdAt: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(start.getTime())) createdAt.$gte = start;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) createdAt.$lte = end;
  }
  return Object.keys(createdAt).length > 0 ? { createdAt } : {};
}

function isTruthyQuery(value: unknown): boolean {
  return value === "1" || value === "true" || value === "yes";
}

async function handleIncomeList(req: Request, res: Response, options: { forReports: boolean }) {
  const ctx = await requireAuth(req);
  await connectToDatabase();

  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const incomeFilter = {
    toUser: ctx.userId,
    ...(options.forReports ? parseDateRangeQuery(from, to) : {}),
  };

  let incomeQuery = IncomeModel.find(incomeFilter)
    .populate(incomeListPopulate[0])
    .populate(incomeListPopulate[1])
    .sort({ createdAt: -1 });

  if (!options.forReports) {
    incomeQuery = incomeQuery.limit(100);
  }

  const [incomes, summary, totalRecords] = await Promise.all([
    incomeQuery.lean(),
    getReferralWithdrawalSummary(ctx.userId),
    IncomeModel.countDocuments({ toUser: ctx.userId }),
  ]);

  return res.json({ incomes, summary, totalRecords });
}

// Full income list for reports (no row cap) — also available as GET /?forReports=1
router.get("/reports", async (req, res) => {
  try {
    return await handleIncomeList(req, res, { forReports: true });
  } catch (err: unknown) {
    console.error("Error fetching income reports:", err);
    const msg = err instanceof Error ? err.message : "Unable to load income reports";
    const status =
      msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

// Get user income (latest 100) or full list when ?forReports=1
router.get("/", async (req, res) => {
  try {
    const forReports = isTruthyQuery(req.query.forReports);
    return await handleIncomeList(req, res, { forReports });
  } catch (err: unknown) {
    console.error("Error fetching income:", err);
    const msg = err instanceof Error ? err.message : "Unable to load income information";
    const status = msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
