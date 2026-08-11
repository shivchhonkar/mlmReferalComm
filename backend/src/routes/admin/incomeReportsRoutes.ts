import type { Express, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { requireAdminRole } from "@/middleware/auth";
import { logAdminPaymentAction } from "@/lib/activityLogger";
import {
  getReferralWithdrawalSummariesBatch,
  getReferralWithdrawalSummary,
  type ReferralEarningsListFields,
} from "@/lib/referralWithdrawalSummary";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";
import { UserModel } from "@/models/User";
import { IncomeModel } from "@/models/Income";
import { WithdrawalModel } from "@/models/Withdrawal";
import { AdminPaymentActionLogModel } from "@/models/AdminPaymentActionLog";
import { assertValidAdminPayoutPayment, ADMIN_PAYOUT_PAYMENT_METHODS } from "@/lib/adminPayoutPayment";
import { payoutProofPublicUrl, payoutProofUpload } from "@/lib/payoutProofUpload";
import { resolveReportPeriodRange } from "@/lib/reportPeriodRange";
import { resolveIncomeServiceCost } from "@/lib/incomeServiceCost";

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapUserBrief(u: {
  _id?: mongoose.Types.ObjectId;
  fullName?: string;
  name?: string;
  email?: string | null;
  mobile?: string;
  referralCode?: string;
  role?: string;
}) {
  return {
    id: String(u._id),
    name: String(u.fullName || u.name || "User"),
    email: u.email ?? "",
    mobile: u.mobile || "",
    referralCode: u.referralCode || "",
    role: u.role || "user",
  };
}

function mapUserBank(u: {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankIfsc?: string;
}) {
  return {
    accountName: String(u.bankAccountName ?? "").trim(),
    accountNumber: String(u.bankAccountNumber ?? "").trim(),
    bankName: String(u.bankName ?? "").trim(),
    ifsc: String(u.bankIfsc ?? "").trim(),
  };
}

export function registerAdminIncomeReportRoutes(app: Express) {
  /** Upload UPI payout screenshot (admin only). */
  app.post("/api/admin/upload/payout-proof", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      (req as Request & { adminId?: string }).adminId = ctx.userId;

      payoutProofUpload.single("image")(req, res, (err: unknown) => {
        if (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          return res.status(400).json({ error: msg });
        }
        if (!req.file) {
          return res.status(400).json({ error: "No image provided" });
        }
        return res.json({
          success: true,
          imageUrl: payoutProofPublicUrl(req.file.filename),
        });
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      return res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
    }
  });

  /**
   * Logged-in admin: referral income earned in period + customer payouts they processed.
   */
  app.get("/api/admin/reports/my-income", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      const periodRaw = String(req.query.period ?? "monthly");
      const fromRaw = String(req.query.from ?? "").trim();
      const toRaw = String(req.query.to ?? "").trim();

      const range = resolveReportPeriodRange(periodRaw, fromRaw, toRaw);
      const adminId = new mongoose.Types.ObjectId(ctx.userId);
      const dateFilter = { $gte: range.start, $lte: range.end };

      const customerRoleFilter = {
        role: { $nin: ["super_admin", "admin", "moderator"] },
        status: { $ne: "deleted" },
      };

      const [
        adminUser,
        incomes,
        payouts,
        lifetimeSummary,
        customerIncomePeriodAgg,
        pendingWithdrawals,
        customerUserIds,
      ] = await Promise.all([
        UserModel.findById(adminId)
          .select("fullName name email mobile referralCode role")
          .lean(),
        IncomeModel.find({ toUser: adminId, createdAt: dateFilter })
          .populate("fromUser", "fullName name email mobile referralCode")
          .populate({
            path: "purchase",
            populate: [
              { path: "service", select: "name price _id" },
              { path: "order", select: "items.service items.price" },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
        WithdrawalModel.find({
          status: "completed",
          reviewedBy: adminId,
          reviewedAt: dateFilter,
        })
          .populate("user", "fullName name email mobile referralCode")
          .sort({ reviewedAt: -1 })
          .limit(500)
          .lean(),
        getReferralWithdrawalSummary(ctx.userId),
        IncomeModel.aggregate<{ _id: null; total: number; entries: number }>([
          { $match: { createdAt: dateFilter } },
          {
            $lookup: {
              from: "users",
              localField: "toUser",
              foreignField: "_id",
              as: "recipient",
            },
          },
          { $unwind: "$recipient" },
          {
            $match: {
              "recipient.role": { $nin: ["super_admin", "admin", "moderator"] },
              "recipient.status": { $ne: "deleted" },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $ifNull: ["$amount", 0] } },
              entries: { $sum: 1 },
            },
          },
        ]),
        WithdrawalModel.find({ status: "pending" })
          .populate("user", "fullName name email mobile referralCode role upiLink")
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
        UserModel.find(customerRoleFilter).select("_id").lean(),
      ]);

      const totalCustomerIncomeInPeriod = Number(customerIncomePeriodAgg[0]?.total ?? 0) || 0;
      const customerIncomeEntriesInPeriod = Number(customerIncomePeriodAgg[0]?.entries ?? 0) || 0;

      const pendingUserIds = [
        ...new Set(
          pendingWithdrawals
            .map((w) => String((w.user as { _id?: mongoose.Types.ObjectId })?._id ?? w.user ?? ""))
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id)),
        ),
      ];

      const pendingSummaries = await getReferralWithdrawalSummariesBatch(pendingUserIds);

      const payableForPending = (userId: string, requested: number) => {
        const s = pendingSummaries.get(userId);
        if (!s) return Math.max(0, requested);
        return Math.min(requested, (s.withdrawalAmount ?? 0) + requested);
      };

      let totalCustomersWithdrawable = 0;
      const allCustomerIds = customerUserIds.map(
        (u) => u._id as mongoose.Types.ObjectId,
      );
      const BATCH = 200;
      for (let i = 0; i < allCustomerIds.length; i += BATCH) {
        const chunk = allCustomerIds.slice(i, i + BATCH);
        const batch = await getReferralWithdrawalSummariesBatch(chunk);
        for (const s of batch.values()) {
          totalCustomersWithdrawable += s.withdrawalAmount ?? 0;
        }
      }

      let totalPendingRequestAmount = 0;
      let totalPayablePending = 0;
      const pendingPayments = pendingWithdrawals
        .filter((w) => {
          const role = String((w.user as { role?: string })?.role ?? "user");
          return !isReferralStaffRole(role);
        })
        .map((w) => {
          const user = w.user as
            | {
                _id?: mongoose.Types.ObjectId;
                fullName?: string;
                name?: string;
                email?: string;
                mobile?: string;
                upiLink?: string;
              }
            | undefined;
          const userId = String(user?._id ?? w.user ?? "");
          const requested = Number(w.amount) || 0;
          const summary: ReferralEarningsListFields | undefined = pendingSummaries.get(userId);
          const withdrawableBalance = summary?.withdrawalAmount ?? 0;
          const payableAmount = payableForPending(userId, requested);
          totalPendingRequestAmount += requested;
          totalPayablePending += payableAmount;
          return {
            _id: String(w._id),
            requestedAmount: requested,
            withdrawableBalance,
            payableAmount,
            totalEarned: summary?.totalEarnedAmount ?? 0,
            createdAt: w.createdAt,
            customer: user
              ? {
                  id: userId,
                  name: user.fullName || user.name || "",
                  email: user.email || "",
                  mobile: user.mobile || "",
                  upiLink: String(user.upiLink ?? "").trim(),
                }
              : null,
          };
        });

      const totalEarnedInPeriod = incomes.reduce(
        (sum, row) => sum + (Number((row as { amount?: number }).amount) || 0),
        0,
      );
      const totalPaidToCustomers = payouts.reduce(
        (sum, row) => sum + (Number((row as { amount?: number }).amount) || 0),
        0,
      );

      const payoutsByMethod = { cash: 0, upi: 0, other: 0 };
      for (const p of payouts) {
        const method = String((p as { paymentMethod?: string }).paymentMethod ?? "").toLowerCase();
        if (method === "cash") payoutsByMethod.cash += 1;
        else if (method === "upi") payoutsByMethod.upi += 1;
        else payoutsByMethod.other += 1;
      }

      return res.json({
        period: {
          key: range.key,
          label: range.label,
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        },
        admin: adminUser
          ? mapUserBrief(adminUser as Parameters<typeof mapUserBrief>[0])
          : { id: ctx.userId, name: "Admin", email: "", mobile: "", referralCode: "", role: "" },
        summary: {
          totalEarnedInPeriod,
          totalPaidToCustomers,
          payoutCount: payouts.length,
          payoutsByMethod,
          lifetimeEarned: lifetimeSummary.totalEarnedAmount,
          lifetimeWithdrawn: lifetimeSummary.totalWithdrawn,
          lifetimeWithdrawable: lifetimeSummary.withdrawalAmount,
          totalCustomerIncomeInPeriod,
          customerIncomeEntriesInPeriod,
          totalPendingPayoutRequests: pendingPayments.length,
          totalPendingRequestAmount,
          totalPayablePending,
          totalCustomersWithdrawable,
        },
        pendingPayments,
        incomes: incomes.map((inc) => {
          const from = inc.fromUser as
            | { fullName?: string; name?: string; email?: string; mobile?: string; referralCode?: string }
            | undefined;
          const purchase = inc.purchase as
            | {
                service?: { _id?: string; name?: string; price?: number } | string;
                order?: { items?: Array<{ service?: string; price?: number }> } | null;
              }
            | undefined;
          const service = purchase?.service;
          return {
            _id: String(inc._id),
            level: inc.level,
            bv: inc.bv,
            amount: inc.amount,
            createdAt: inc.createdAt,
            fromUser: from
              ? {
                  name: from.fullName || from.name || "",
                  email: from.email || "",
                  mobile: from.mobile || "",
                  referralCode: from.referralCode || "",
                }
              : null,
            serviceName:
              typeof service === "string" ? service : (service as { name?: string })?.name || "",
            serviceCost: resolveIncomeServiceCost(purchase),
          };
        }),
        paymentsToCustomers: payouts.map((w) => {
          const user = w.user as
            | { _id?: mongoose.Types.ObjectId; fullName?: string; name?: string; email?: string; mobile?: string }
            | undefined;
          return {
            _id: String(w._id),
            amount: w.amount,
            paymentMethod: (w as { paymentMethod?: string }).paymentMethod || "",
            paymentProofUrl: (w as { paymentProofUrl?: string }).paymentProofUrl || "",
            payoutNote: (w as { payoutNote?: string }).payoutNote || "",
            reviewedAt: (w as { reviewedAt?: Date }).reviewedAt,
            createdAt: w.createdAt,
            customer: user
              ? {
                  id: String(user._id),
                  name: user.fullName || user.name || "",
                  email: user.email || "",
                  mobile: user.mobile || "",
                }
              : null,
          };
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status =
        msg === "Forbidden" ? 403 : msg.includes("Custom range") ? 400 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  /** All end-users with income / withdrawal summary (paginated). */
  app.get("/api/admin/reports/income-summaries", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const q = String(req.query.q ?? "").trim();
      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50) || 50));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {
        role: { $nin: ["super_admin", "admin", "moderator"] },
        status: { $ne: "deleted" },
      };
      if (q) {
        const rx = new RegExp(escapeRegexLiteral(q), "i");
        filter.$or = [{ email: rx }, { mobile: rx }, { fullName: rx }, { name: rx }, { referralCode: rx }];
      }

      const [users, total] = await Promise.all([
        UserModel.find(filter)
          .select(
            "_id fullName name email mobile referralCode role bankAccountName bankAccountNumber bankName bankIfsc",
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        UserModel.countDocuments(filter),
      ]);

      const ids = users.map((u) => u._id as mongoose.Types.ObjectId);
      const earningsMap = await getReferralWithdrawalSummariesBatch(ids);

      const items = users.map((u) => {
        const key = String(u._id);
        const w = earningsMap.get(key);
        return {
          user: {
            ...mapUserBrief(u),
            bank: mapUserBank(u as Parameters<typeof mapUserBank>[0]),
          },
          totalEarnedAmount: w?.totalEarnedAmount ?? 0,
          totalPaidAmount: w?.totalWithdrawn ?? 0,
          withdrawalAmount: w?.withdrawalAmount ?? 0,
          pendingPayouts: w?.totalPendingWithdrawals ?? 0,
        };
      });

      return res.json({
        items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
    }
  });

  /** Single user: income sources + withdrawals + summary. */
  app.get("/api/admin/reports/income-summaries/:userId", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const userId = String(req.params.userId ?? "").trim();
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const user = await UserModel.findById(userId)
        .select("_id fullName name email mobile referralCode role bankAccountName bankAccountNumber bankName bankIfsc upiLink")
        .lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      const [incomes, withdrawals, summary] = await Promise.all([
        IncomeModel.find({ toUser: userId })
          .populate("fromUser", "fullName name email mobile referralCode")
          .populate({
            path: "purchase",
            populate: [
              { path: "service", select: "_id name price" },
              { path: "order", select: "items.service items.price" },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(500)
          .lean(),
        WithdrawalModel.find({ user: userId }).sort({ createdAt: -1 }).limit(200).lean(),
        getReferralWithdrawalSummary(userId),
      ]);

      return res.json({
        user: {
          ...mapUserBrief(user),
          bank: {
            accountName: (user as { bankAccountName?: string }).bankAccountName || "",
            accountNumber: (user as { bankAccountNumber?: string }).bankAccountNumber || "",
            bankName: (user as { bankName?: string }).bankName || "",
            ifsc: (user as { bankIfsc?: string }).bankIfsc || "",
            upiLink: (user as { upiLink?: string }).upiLink || "",
          },
        },
        summary: {
          totalEarnedAmount: summary.totalEarnedAmount,
          totalPaidAmount: summary.totalWithdrawn,
          withdrawalAmount: summary.withdrawalAmount,
          pendingPayouts: summary.totalPendingWithdrawals,
          maxCumulativeWithdrawalAllowed: summary.maxCumulativeWithdrawalAllowed,
          nonWithdrawableEarnings: summary.nonWithdrawableEarnings,
        },
        incomes,
        withdrawals,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
    }
  });

  /** Payment / withdrawal history (all users). */
  app.get("/api/admin/reports/payment-history", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      const statusRaw = String(req.query.status ?? "all").trim().toLowerCase();
      const userId = String(req.query.userId ?? "").trim();
      const scope = String(req.query.scope ?? "all").trim().toLowerCase();
      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));

      const filter: Record<string, unknown> = {};
      if (statusRaw !== "all" && ["pending", "completed", "rejected"].includes(statusRaw)) {
        filter.status = statusRaw;
      }
      if (scope === "mine") {
        filter.reviewedBy = new mongoose.Types.ObjectId(ctx.userId);
      }
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.user = new mongoose.Types.ObjectId(userId);
      }

      const rows = await WithdrawalModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("user", "fullName name email mobile referralCode role")
        .populate("reviewedBy", "fullName name email")
        .lean();

      return res.json({ withdrawals: rows });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
    }
  });

  /** Admin payment audit log. */
  app.get("/api/admin/reports/payment-audit", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));
      const userId = String(req.query.userId ?? "").trim();
      const scope = String(req.query.scope ?? "all").trim().toLowerCase();

      const filter: Record<string, unknown> = {};
      if (scope === "mine") {
        filter.adminId = new mongoose.Types.ObjectId(ctx.userId);
      }
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        filter.targetUserId = new mongoose.Types.ObjectId(userId);
      }

      const rows = await AdminPaymentActionLogModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("adminId", "fullName name email role")
        .populate("targetUserId", "fullName name email mobile referralCode")
        .lean();

      return res.json({ logs: rows });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
    }
  });

  /** Record a manual completed payout (admin-initiated). */
  app.post("/api/admin/reports/manual-payout", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      const body = z
        .object({
          userId: z.string().min(1),
          amount: z.number().positive(),
          paymentMethod: z.enum(ADMIN_PAYOUT_PAYMENT_METHODS),
          paymentProofUrl: z.string().optional(),
          note: z.string().max(500).optional(),
        })
        .parse(req.body ?? {});

      assertValidAdminPayoutPayment(body.paymentMethod, body.paymentProofUrl);

      if (!mongoose.Types.ObjectId.isValid(body.userId)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const user = await UserModel.findById(body.userId).select("role").lean();
      if (!user) return res.status(404).json({ error: "User not found" });
      if (isReferralStaffRole((user as { role?: string }).role)) {
        return res.status(400).json({ error: "Cannot record manual payout for staff accounts" });
      }

      const summary = await getReferralWithdrawalSummary(body.userId);
      if (body.amount > summary.withdrawalAmount + 1e-6) {
        return res.status(400).json({
          error: `Amount exceeds available withdrawal balance (${summary.withdrawalAmount}).`,
        });
      }

      const reviewer = new mongoose.Types.ObjectId(ctx.userId);
      const withdrawal = await WithdrawalModel.create({
        user: body.userId,
        amount: body.amount,
        status: "completed",
        reviewedAt: new Date(),
        reviewedBy: reviewer,
        paymentMethod: body.paymentMethod,
        paymentProofUrl:
          body.paymentMethod === "upi" ? String(body.paymentProofUrl ?? "").trim() : "",
        payoutNote: body.note?.trim() ?? "",
      });

      await logAdminPaymentAction(req, {
        adminId: reviewer,
        targetUserId: body.userId,
        withdrawalId: withdrawal._id,
        action: "manual_payout",
        amount: body.amount,
        previousStatus: "none",
        newStatus: "completed",
        note: [body.paymentMethod, body.note].filter(Boolean).join(" — "),
      });

      const updatedSummary = await getReferralWithdrawalSummary(body.userId);
      return res.json({
        ok: true,
        withdrawal,
        summary: {
          totalEarnedAmount: updatedSummary.totalEarnedAmount,
          totalPaidAmount: updatedSummary.totalWithdrawn,
          withdrawalAmount: updatedSummary.withdrawalAmount,
          pendingPayouts: updatedSummary.totalPendingWithdrawals,
        },
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: err.flatten() });
      }
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
    }
  });
}
