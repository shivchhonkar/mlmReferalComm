import { Router, type Request, type Response } from "express";
import { connectToDatabase } from "@/lib/db";
import { IncomeModel } from "@/models/Income";
import { requireAuth } from "@/middleware/auth";
import { getReferralWithdrawalSummary } from "@/lib/referralWithdrawalSummary";
import { resolveReportPeriodRange } from "@/lib/reportPeriodRange";

const router = Router();

const incomeListPopulate = [
  { path: "fromUser", select: "email mobile referralCode fullName fullname name" },
  {
    path: "purchase",
    populate: [
      {
        path: "service",
        select: "_id name price businessVolume",
      },
      {
        path: "order",
        select: "items.service items.price",
      },
    ],
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
  const periodParam = typeof req.query.period === "string" ? req.query.period.trim() : "";

  let createdAtFilter: { createdAt?: { $gte?: Date; $lte?: Date } } = {};
  let period: {
    key: string;
    label: string;
    start: string;
    end: string;
  } | null = null;

  if (periodParam) {
    const range = resolveReportPeriodRange(periodParam, from ?? "", to ?? "");
    createdAtFilter = { createdAt: { $gte: range.start, $lte: range.end } };
    period = {
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    };
  } else if (options.forReports) {
    createdAtFilter = parseDateRangeQuery(from, to);
  }

  const incomeFilter = {
    toUser: ctx.userId,
    ...createdAtFilter,
  };

  let incomeQuery = IncomeModel.find(incomeFilter)
    .populate(incomeListPopulate[0])
    .populate(incomeListPopulate[1])
    .sort({ createdAt: -1 });

  const hasDateFilter = Object.keys(createdAtFilter).length > 0;
  if (!hasDateFilter && !options.forReports) {
    incomeQuery = incomeQuery.limit(100);
  } else {
    incomeQuery = incomeQuery.limit(500);
  }

  const [incomes, summary, totalRecords, periodEarnedAgg] = await Promise.all([
    incomeQuery.lean(),
    getReferralWithdrawalSummary(ctx.userId),
    IncomeModel.countDocuments(incomeFilter),
    periodParam
      ? IncomeModel.aggregate<{ _id: null; total: number }>([
          { $match: incomeFilter },
          { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
        ])
      : Promise.resolve([]),
  ]);

  const periodSummary = periodParam
    ? {
        totalEarnedInPeriod: Number(periodEarnedAgg[0]?.total ?? 0) || 0,
        recordCount: totalRecords,
      }
    : undefined;

  return res.json({ incomes, summary, totalRecords, period, periodSummary });
}

// Full income list for reports (no row cap) — also available as GET /?forReports=1
function incomeErrorStatus(msg: string): number {
  return msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication")
    ? 401
    : 400;
}

router.get("/reports", async (req, res) => {
  try {
    return await handleIncomeList(req, res, { forReports: true });
  } catch (err: unknown) {
    console.error("Error fetching income reports:", err);
    const msg = err instanceof Error ? err.message : "Unable to load income reports";
    return res.status(incomeErrorStatus(msg)).json({ error: msg });
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
    return res.status(incomeErrorStatus(msg)).json({ error: msg });
  }
});

export default router;
