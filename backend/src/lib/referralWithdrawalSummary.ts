import mongoose from "mongoose";
import { OrderModel } from "@/models/Order";
import { IncomeModel } from "@/models/Income";
import { WithdrawalModel } from "@/models/Withdrawal";
import { UserModel } from "@/models/User";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";
import {
  aggregateLegEarningsForEarner,
  computeMaxCumulativeWithdrawalFromLegTotals,
  loadParentChainMap,
  type IncomeLegLine,
} from "@/lib/referralLegRoot";

/**
 * Per-leg withdrawal cap for end users: first non-cancelled own order total (applied to each direct-referral leg).
 * Admins / moderators: no cap (null).
 */
export async function getFirstOrderWithdrawalCap(
  userObjectId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null,
): Promise<number | null> {
  const userQuery = UserModel.findById(userObjectId).select("role");
  if (session) userQuery.session(session);
  const user = await userQuery.lean();
  const role = String((user as { role?: string })?.role ?? "user");
  if (isReferralStaffRole(role)) return null;

  const q = OrderModel.findOne({
    user: userObjectId,
    status: { $ne: "CANCELLED" },
  })
    .sort({ createdAt: 1 })
    .select("totals.totalAmount");
  if (session) q.session(session);
  const first = await q.lean();
  const raw = Number((first as { totals?: { totalAmount?: number } })?.totals?.totalAmount ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

export type LegWithdrawalBreakdown = {
  legRootUserId: string;
  legEarnings: number;
  legWithdrawableCap: number;
};

export type ReferralWithdrawalSummary = {
  /** Sum of referral `Income.amount` (full credited earnings; never reduced by the plan cap). */
  totalEarnedAmount: number;
  /**
   * Balance available to withdraw now: `Σ min(leg earnings, per-leg cap) − completed − pending`.
   * Staff: no per-leg cap (`lifetimeWithdrawalCap` is null).
   */
  withdrawalAmount: number;
  /** Per-leg cap amount (first order total) for end users; null means unlimited (staff). */
  lifetimeWithdrawalCap: number | null;
  /** Maximum total referral income that can ever be withdrawn under per-leg caps. */
  maxCumulativeWithdrawalAllowed: number;
  /** Sum of completed withdrawal payouts. */
  totalWithdrawn: number;
  /** Sum of pending withdrawal requests (counts against availability). */
  totalPendingWithdrawals: number;
  /** Earnings that cannot be withdrawn under per-leg caps. */
  nonWithdrawableEarnings: number;
  /** Per direct-referral leg breakdown (optional detail for UI). */
  legBreakdown?: LegWithdrawalBreakdown[];
};

function buildReferralWithdrawalSummary(
  totalEarnedAmount: number,
  lifetimeWithdrawalCap: number | null,
  maxCumulativeWithdrawalAllowed: number,
  totalWithdrawn: number,
  totalPendingWithdrawals: number,
  legBreakdown?: LegWithdrawalBreakdown[],
): ReferralWithdrawalSummary {
  const reserved = totalWithdrawn + totalPendingWithdrawals;
  const withdrawalAmount = Math.max(0, maxCumulativeWithdrawalAllowed - reserved);

  const nonWithdrawableEarnings =
    lifetimeWithdrawalCap === null
      ? 0
      : Math.max(0, totalEarnedAmount - maxCumulativeWithdrawalAllowed);

  return {
    totalEarnedAmount,
    withdrawalAmount,
    lifetimeWithdrawalCap,
    maxCumulativeWithdrawalAllowed,
    totalWithdrawn,
    totalPendingWithdrawals,
    nonWithdrawableEarnings,
    legBreakdown: legBreakdown ?? [],
  };
}

function legBreakdownFromMap(
  legEarnings: Map<string, number>,
  perLegCap: number | null,
): LegWithdrawalBreakdown[] {
  return [...legEarnings.entries()]
    .map(([legRootUserId, legEarningsTotal]) => ({
      legRootUserId,
      legEarnings: legEarningsTotal,
      legWithdrawableCap:
        perLegCap === null
          ? legEarningsTotal
          : Math.min(legEarningsTotal, Math.max(0, perLegCap)),
    }))
    .sort((a, b) => b.legEarnings - a.legEarnings);
}

async function loadLegEarningsForEarner(
  earnerObjectId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null,
): Promise<{ totalEarnedAmount: number; legEarnings: Map<string, number> }> {
  const incomeQuery = IncomeModel.find({ toUser: earnerObjectId })
    .select("amount fromUser legRootUserId")
    .lean();
  if (session) incomeQuery.session(session);
  const incomes = await incomeQuery;

  const totalEarnedAmount = incomes.reduce(
    (sum, row) => sum + (Number((row as { amount?: number }).amount) || 0),
    0,
  );

  const buyerIds = [
    ...new Set(
      incomes
        .map((row) => String((row as { fromUser?: unknown }).fromUser ?? ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const parentByUserId = await loadParentChainMap(buyerIds, session);
  const earnerId = earnerObjectId.toString();
  const lines: IncomeLegLine[] = incomes.map((row) => ({
    amount: Number((row as { amount?: number }).amount) || 0,
    fromUser: (row as { fromUser: mongoose.Types.ObjectId }).fromUser,
    legRootUserId: (row as { legRootUserId?: mongoose.Types.ObjectId | null }).legRootUserId,
  }));

  const legEarnings = aggregateLegEarningsForEarner(earnerId, lines, parentByUserId);
  return { totalEarnedAmount, legEarnings };
}

export type ReferralEarningsListFields = Pick<
  ReferralWithdrawalSummary,
  | "totalEarnedAmount"
  | "withdrawalAmount"
  | "totalWithdrawn"
  | "totalPendingWithdrawals"
>;

/** Batch-load referral earnings for many users (used by admin referrals list). */
export async function getReferralWithdrawalSummariesBatch(
  userIds: mongoose.Types.ObjectId[],
): Promise<Map<string, ReferralEarningsListFields>> {
  const out = new Map<string, ReferralEarningsListFields>();
  if (!userIds.length) return out;

  const uniqueIds = [...new Map(userIds.map((id) => [id.toString(), id])).values()];

  const users = await UserModel.find({ _id: { $in: uniqueIds } })
    .select("_id role")
    .lean();
  const roleById = new Map(
    users.map((u) => [String(u._id), String((u as { role?: string }).role ?? "user")]),
  );

  const [incomes, completedAgg, pendingAgg, firstOrders] = await Promise.all([
    IncomeModel.find({ toUser: { $in: uniqueIds } })
      .select("toUser amount fromUser legRootUserId")
      .lean(),
    WithdrawalModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      { $match: { user: { $in: uniqueIds }, status: "completed" } },
      { $group: { _id: "$user", total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    WithdrawalModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      { $match: { user: { $in: uniqueIds }, status: "pending" } },
      { $group: { _id: "$user", total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    OrderModel.aggregate<{ _id: mongoose.Types.ObjectId; totalAmount: number }>([
      { $match: { user: { $in: uniqueIds }, status: { $ne: "CANCELLED" } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$user",
          totalAmount: { $first: { $ifNull: ["$totals.totalAmount", 0] } },
        },
      },
    ]),
  ]);

  const withdrawnById = new Map(completedAgg.map((r) => [String(r._id), Number(r.total) || 0]));
  const pendingById = new Map(pendingAgg.map((r) => [String(r._id), Number(r.total) || 0]));
  const firstOrderById = new Map(
    firstOrders.map((r) => {
      const raw = Number(r.totalAmount ?? 0);
      const cap = Number.isFinite(raw) && raw > 0 ? raw : 0;
      return [String(r._id), cap] as const;
    }),
  );

  const incomesByEarner = new Map<string, IncomeLegLine[]>();
  const allBuyerIds = new Set<string>();

  for (const row of incomes) {
    const earnerKey = String((row as { toUser?: unknown }).toUser ?? "");
    if (!earnerKey) continue;
    const line: IncomeLegLine = {
      amount: Number((row as { amount?: number }).amount) || 0,
      fromUser: (row as { fromUser: mongoose.Types.ObjectId }).fromUser,
      legRootUserId: (row as { legRootUserId?: mongoose.Types.ObjectId | null }).legRootUserId,
    };
    const list = incomesByEarner.get(earnerKey) ?? [];
    list.push(line);
    incomesByEarner.set(earnerKey, list);

    const buyerKey = String(line.fromUser ?? "");
    if (mongoose.Types.ObjectId.isValid(buyerKey)) allBuyerIds.add(buyerKey);
  }

  const parentByUserId = await loadParentChainMap(
    [...allBuyerIds].map((id) => new mongoose.Types.ObjectId(id)),
  );

  for (const id of uniqueIds) {
    const key = id.toString();
    const role = roleById.get(key) ?? "user";
    const lines = incomesByEarner.get(key) ?? [];
    const totalEarnedAmount = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const lifetimeWithdrawalCap = isReferralStaffRole(role) ? null : (firstOrderById.get(key) ?? 0);

    const legEarnings = aggregateLegEarningsForEarner(key, lines, parentByUserId);
    const maxCumulativeWithdrawalAllowed = computeMaxCumulativeWithdrawalFromLegTotals(
      legEarnings,
      lifetimeWithdrawalCap,
      totalEarnedAmount,
    );

    const summary = buildReferralWithdrawalSummary(
      totalEarnedAmount,
      lifetimeWithdrawalCap,
      maxCumulativeWithdrawalAllowed,
      withdrawnById.get(key) ?? 0,
      pendingById.get(key) ?? 0,
    );
    out.set(key, {
      totalEarnedAmount: summary.totalEarnedAmount,
      withdrawalAmount: summary.withdrawalAmount,
      totalWithdrawn: summary.totalWithdrawn,
      totalPendingWithdrawals: summary.totalPendingWithdrawals,
    });
  }

  return out;
}

export async function getReferralWithdrawalSummary(
  userId: string,
  session?: mongoose.ClientSession | null,
): Promise<ReferralWithdrawalSummary> {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const lifetimeWithdrawalCap = await getFirstOrderWithdrawalCap(userObjectId, session);

  const { totalEarnedAmount, legEarnings } = await loadLegEarningsForEarner(
    userObjectId,
    session,
  );

  const maxCumulativeWithdrawalAllowed = computeMaxCumulativeWithdrawalFromLegTotals(
    legEarnings,
    lifetimeWithdrawalCap,
    totalEarnedAmount,
  );

  const completedPipe = [
    { $match: { user: userObjectId, status: "completed" } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ];
  const completedAggQ = WithdrawalModel.aggregate<{ _id: null; total: number }>(completedPipe);
  if (session) completedAggQ.session(session);
  const completedAgg = await completedAggQ;
  const totalWithdrawn = Number(completedAgg[0]?.total ?? 0) || 0;

  const pendingPipe = [
    { $match: { user: userObjectId, status: "pending" } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ];
  const pendingAggQ = WithdrawalModel.aggregate<{ _id: null; total: number }>(pendingPipe);
  if (session) pendingAggQ.session(session);
  const pendingAgg = await pendingAggQ;
  const totalPendingWithdrawals = Number(pendingAgg[0]?.total ?? 0) || 0;

  const legBreakdown = legBreakdownFromMap(legEarnings, lifetimeWithdrawalCap);

  return buildReferralWithdrawalSummary(
    totalEarnedAmount,
    lifetimeWithdrawalCap,
    maxCumulativeWithdrawalAllowed,
    totalWithdrawn,
    totalPendingWithdrawals,
    legBreakdown,
  );
}
