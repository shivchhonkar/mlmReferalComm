import mongoose from "mongoose";
import { OrderModel } from "@/models/Order";
import { IncomeModel } from "@/models/Income";
import { WithdrawalModel } from "@/models/Withdrawal";
import { UserModel } from "@/models/User";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";

/**
 * Lifetime referral withdrawal cap for end users: first non-cancelled own order total.
 * Admins / moderators: no cap (null).
 */
export async function getFirstOrderWithdrawalCap(
  userObjectId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null
): Promise<number | null> {
  const userQuery = UserModel.findById(userObjectId).select("role");
  if (session) userQuery.session(session);
  const user = await userQuery.lean();
  const role = String((user as any)?.role ?? "user");
  if (isReferralStaffRole(role)) return null;

  const q = OrderModel.findOne({
    user: userObjectId,
    status: { $ne: "CANCELLED" },
  })
    .sort({ createdAt: 1 })
    .select("totals.totalAmount");
  if (session) q.session(session);
  const first = await q.lean();
  const raw = Number((first as any)?.totals?.totalAmount ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

export type ReferralWithdrawalSummary = {
  /** Sum of referral `Income.amount` (full credited earnings; never reduced by the plan cap). */
  totalEarnedAmount: number;
  /**
   * Balance available to withdraw right now: `min(earned, lifetime cap) − completed − pending`.
   * End users are capped by their first own order total; staff roles have no cap (`lifetimeWithdrawalCap` is null).
   */
  withdrawalAmount: number;
  /** First-order cap for end users; null means unlimited (admin roles). */
  lifetimeWithdrawalCap: number | null;
  /** Maximum total referral income that can ever be withdrawn (min(earned, cap) for users). */
  maxCumulativeWithdrawalAllowed: number;
  /** Sum of completed withdrawal payouts. */
  totalWithdrawn: number;
  /** Sum of pending withdrawal requests (counts against availability). */
  totalPendingWithdrawals: number;
  /** Earnings that cannot be withdrawn under the cap (max(0, earned - cap)); 0 for admins. */
  nonWithdrawableEarnings: number;
};

function buildReferralWithdrawalSummary(
  totalEarnedAmount: number,
  lifetimeWithdrawalCap: number | null,
  totalWithdrawn: number,
  totalPendingWithdrawals: number,
): ReferralWithdrawalSummary {
  const maxCumulativeWithdrawalAllowed =
    lifetimeWithdrawalCap === null
      ? totalEarnedAmount
      : Math.min(totalEarnedAmount, Math.max(0, lifetimeWithdrawalCap));

  const reserved = totalWithdrawn + totalPendingWithdrawals;
  const withdrawalAmount = Math.max(0, maxCumulativeWithdrawalAllowed - reserved);

  const nonWithdrawableEarnings =
    lifetimeWithdrawalCap === null ? 0 : Math.max(0, totalEarnedAmount - maxCumulativeWithdrawalAllowed);

  return {
    totalEarnedAmount,
    withdrawalAmount,
    lifetimeWithdrawalCap,
    maxCumulativeWithdrawalAllowed,
    totalWithdrawn,
    totalPendingWithdrawals,
    nonWithdrawableEarnings,
  };
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

  const uniqueIds = [
    ...new Map(userIds.map((id) => [id.toString(), id])).values(),
  ];

  const users = await UserModel.find({ _id: { $in: uniqueIds } })
    .select("_id role")
    .lean();
  const roleById = new Map(
    users.map((u) => [String(u._id), String((u as { role?: string }).role ?? "user")]),
  );

  const [earnedAgg, completedAgg, pendingAgg, firstOrders] = await Promise.all([
    IncomeModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
      { $match: { toUser: { $in: uniqueIds } } },
      { $group: { _id: "$toUser", total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
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
          totalAmount: { $first: "$totals.totalAmount" },
        },
      },
    ]),
  ]);

  const earnedById = new Map(earnedAgg.map((r) => [String(r._id), Number(r.total) || 0]));
  const withdrawnById = new Map(completedAgg.map((r) => [String(r._id), Number(r.total) || 0]));
  const pendingById = new Map(pendingAgg.map((r) => [String(r._id), Number(r.total) || 0]));
  const firstOrderById = new Map(
    firstOrders.map((r) => {
      const raw = Number(r.totalAmount ?? 0);
      const cap = Number.isFinite(raw) && raw > 0 ? raw : 0;
      return [String(r._id), cap] as const;
    }),
  );

  for (const id of uniqueIds) {
    const key = id.toString();
    const role = roleById.get(key) ?? "user";
    const totalEarnedAmount = earnedById.get(key) ?? 0;
    const lifetimeWithdrawalCap = isReferralStaffRole(role)
      ? null
      : (firstOrderById.get(key) ?? 0);

    const summary = buildReferralWithdrawalSummary(
      totalEarnedAmount,
      lifetimeWithdrawalCap,
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
  session?: mongoose.ClientSession | null
): Promise<ReferralWithdrawalSummary> {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const earnedPipe = [
    { $match: { toUser: userObjectId } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
  ];
  const earnedAggQ = IncomeModel.aggregate<{ _id: null; total: number }>(earnedPipe);
  if (session) earnedAggQ.session(session);
  const earnedAgg = await earnedAggQ;
  const totalEarnedAmount = Number(earnedAgg[0]?.total ?? 0) || 0;

  const lifetimeWithdrawalCap = await getFirstOrderWithdrawalCap(userObjectId, session);

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

  return buildReferralWithdrawalSummary(
    totalEarnedAmount,
    lifetimeWithdrawalCap,
    totalWithdrawn,
    totalPendingWithdrawals,
  );
}
