import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DistributionRuleModel } from "@/models/DistributionRule";
import { IncomeLogModel } from "@/models/IncomeLog";
import { IncomeModel } from "@/models/Income";
import { OrderModel } from "@/models/Order";
import { ServiceModel } from "@/models/Service";
import { UserModel } from "@/models/User";

export type DistributeBVResult = {
  bv: number;
  logsCreated: number;
  levelsPaid: number;
};

function asObjectId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(id);
}

type ActiveDistributionRule = {
  basePercentage: number;
  decayEnabled: boolean;
};

const CAPPING_EXEMPT_ROLES = new Set(["super_admin", "admin", "moderator"]);

function sessionOpt(session: mongoose.ClientSession | null | undefined): { session?: mongoose.ClientSession } {
  return session != null ? { session } : {};
}

async function getActiveDistributionRule(session?: mongoose.ClientSession | null): Promise<ActiveDistributionRule> {
  const query = DistributionRuleModel.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .select("basePercentage decayEnabled");
  if (session) query.session(session);
  const rule = await query;

  // Default behavior when no rule is configured:
  // Commission structure: Level 1 = 10% of BV, Level 2 = 5%, Level 3 = 2.5%, Level 4 = 1.25%, Level 5+ = 50% of previous.
  if (!rule) return { basePercentage: 0.1, decayEnabled: true };

  const basePercentage = Number(rule.basePercentage);
  if (!Number.isFinite(basePercentage) || basePercentage < 0 || basePercentage > 1) {
    throw new Error("Invalid distribution rule: basePercentage");
  }

  return { basePercentage, decayEnabled: Boolean(rule.decayEnabled) };
}

async function distributeBusinessVolumeInSession(options: {
  userObjectId: mongoose.Types.ObjectId;
  /** Service _id (string CUID in your schema) */
  serviceId: string;
  purchaseObjectId?: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession | null;
}): Promise<DistributeBVResult> {
  const { userObjectId, serviceId, purchaseObjectId, session } = options;
  const opts = sessionOpt(session);

  const rule = await getActiveDistributionRule(session);

  const serviceQuery = ServiceModel.findById(serviceId).select("businessVolume status bv isActive");
  if (session) serviceQuery.session(session);
  const service = await serviceQuery;

  if (!service) throw new Error("Service not found");

  const legacyService = service as unknown as { isActive?: boolean; bv?: number };
  const status = service.status ?? (legacyService.isActive ? "active" : "inactive");
  if (status !== "active") throw new Error("Service is inactive");

  const bv = (service.businessVolume ?? legacyService.bv) as number;
  if (!Number.isFinite(bv) || bv < 0) throw new Error("Service has invalid BV");

  const buyerQuery = UserModel.findById(userObjectId).select("parent");
  if (session) buyerQuery.session(session);
  const buyer = await buyerQuery;
  if (!buyer) throw new Error("User not found");

  let parentId = buyer.parent ? new mongoose.Types.ObjectId(buyer.parent) : null;
  let level = 1;
  let incomeAmount = bv * rule.basePercentage;

  const visited = new Set<string>([userObjectId.toString()]);
  const recipientCapCache = new Map<string, { capAmount: number; earnedSoFar: number }>();
  const logs: Array<{
    fromUserId: mongoose.Types.ObjectId;
    toUserId: mongoose.Types.ObjectId;
    level: number;
    bv: number;
    incomeAmount: number;
  }> = [];

  const incomes: Array<{
    fromUser: mongoose.Types.ObjectId;
    toUser: mongoose.Types.ObjectId;
    purchase: mongoose.Types.ObjectId;
    level: number;
    bv: number;
    amount: number;
  }> = [];

  // Guardrail for corrupt graphs (should be impossible with correct parent assignment).
  const MAX_LEVELS = 50_000;

  async function getRecipientCapState(
    recipientId: mongoose.Types.ObjectId
  ): Promise<{ capAmount: number; earnedSoFar: number }> {
    const key = recipientId.toString();
    const cached = recipientCapCache.get(key);
    if (cached) return cached;

    // Cap basis: user's first non-cancelled order totalAmount.
    const firstOrderQuery = OrderModel.findOne({
      user: recipientId,
      status: { $ne: "CANCELLED" },
    })
      .sort({ createdAt: 1 })
      .select("totals.totalAmount");
    if (session) firstOrderQuery.session(session);
    const firstOrder = await firstOrderQuery.lean();

    const capAmountRaw = Number((firstOrder as any)?.totals?.totalAmount ?? 0);
    const capAmount = Number.isFinite(capAmountRaw) && capAmountRaw > 0 ? capAmountRaw : 0;

    const incomeAgg = await IncomeLogModel.aggregate<{ _id: null; total: number }>([
      { $match: { toUserId: recipientId } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$incomeAmount", 0] } } } },
    ], session ? { session } : undefined);

    const earnedRaw = Number(incomeAgg[0]?.total ?? 0);
    const earnedSoFar = Number.isFinite(earnedRaw) && earnedRaw > 0 ? earnedRaw : 0;

    const result = { capAmount, earnedSoFar };
    recipientCapCache.set(key, result);
    return result;
  }

  while (parentId) {
    const parentKey = parentId.toString();
    if (visited.has(parentKey)) {
      throw new Error("Circular reference detected in referral chain");
    }
    visited.add(parentKey);

    const recipientQuery = UserModel.findById(parentId).select("parent status role");
    if (session) recipientQuery.session(session);
    const recipient = await recipientQuery.lean();

    const recipientRole = String((recipient as any)?.role ?? "user");
    const isCapExempt = CAPPING_EXEMPT_ROLES.has(recipientRole);
    // Active-status eligibility applies to normal users only.
    // Admin roles can receive referral income regardless of status.
    const recipientStatus = String((recipient as any)?.status ?? "inactive");
    const isIncomeEligible = isCapExempt || recipientStatus === "active";
    if (isIncomeEligible) {
      let payableAmount = 0;
      let capState: { capAmount: number; earnedSoFar: number } | null = null;

      if (isCapExempt) {
        payableAmount = incomeAmount;
      } else {
        capState = await getRecipientCapState(parentId);
        const remainingCap = Math.max(capState.capAmount - capState.earnedSoFar, 0);
        payableAmount = Math.min(incomeAmount, remainingCap);
      }

      if (payableAmount > 0) {
        logs.push({
          fromUserId: userObjectId,
          toUserId: parentId,
          level,
          bv,
          incomeAmount: payableAmount,
        });

        if (purchaseObjectId) {
          incomes.push({
            fromUser: userObjectId,
            toUser: parentId,
            purchase: purchaseObjectId,
            level,
            bv,
            amount: payableAmount,
          });
        }

        // Track in-memory progression so cap remains accurate within this same distribution run.
        if (capState) {
          capState.earnedSoFar += payableAmount;
        }
      }
    }

    if (level >= MAX_LEVELS) {
      throw new Error("Referral chain too deep or corrupt");
    }

    parentId = (recipient as any)?.parent ? new mongoose.Types.ObjectId((recipient as any).parent) : null;

    level += 1;
    if (!rule.decayEnabled) {
      break;
    }

    incomeAmount /= 2;
  }

  if (logs.length > 0) {
    await IncomeLogModel.insertMany(logs, opts);
  }

  if (purchaseObjectId && incomes.length > 0) {
    await IncomeModel.insertMany(incomes, opts);
  }

  return {
    bv,
    logsCreated: logs.length,
    levelsPaid: logs.length,
  };
}

/**
 * Distribute Business Volume (BV) income up the referral chain.
 *
 * Commission structure (default when no rule configured):
 * - Level 1: 10% of BV
 * - Level 2: 5% of BV
 * - Level 3: 2.5% of BV
 * - Level 4: 1.25% of BV
 * - Level 5+: 50% of previous level
 *
 * Rules:
 * - Input: userId, serviceId
 * - Fetch service BV, traverse referral parents upward
 * - Store income logs in MongoDB
 * - Use MongoDB transaction to ensure consistency
 */
export async function distributeBusinessVolume(options: {
  userId: string;
  serviceId: string;
}): Promise<DistributeBVResult> {
  await connectToDatabase();

  const userObjectId = asObjectId(options.userId, "userId");

  try {
    const session = await mongoose.startSession();
    try {
      let result: DistributeBVResult | null = null;
      await session.withTransaction(async () => {
        result = await distributeBusinessVolumeInSession({
          userObjectId,
          serviceId: options.serviceId,
          session,
        });
      });
      if (!result) throw new Error("Transaction failed");
      return result;
    } finally {
      session.endSession();
    }
  } catch (err: any) {
    const msg = err?.message ?? "";
    if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
      return distributeBusinessVolumeInSession({
        userObjectId,
        serviceId: options.serviceId,
        session: null,
      });
    }
    throw err;
  }
}

/**
 * Same distribution logic, but meant to be called inside another transaction.
 * Useful for "purchase + income logs" in a single atomic operation.
 */
export async function distributeBusinessVolumeWithSession(options: {
  userId: string;
  serviceId: string;
  purchaseId?: string;
  session?: mongoose.ClientSession | null;
}): Promise<DistributeBVResult> {
  const userObjectId = asObjectId(options.userId, "userId");
  const purchaseObjectId = options.purchaseId
    ? asObjectId(options.purchaseId, "purchaseId")
    : undefined;

  return distributeBusinessVolumeInSession({
    userObjectId,
    serviceId: options.serviceId,
    purchaseObjectId,
    session: options.session ?? undefined,
  });
}
