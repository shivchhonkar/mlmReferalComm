import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DistributionRuleModel } from "@/models/DistributionRule";
import { IncomeLogModel } from "@/models/IncomeLog";
import { IncomeModel } from "@/models/Income";
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
  // Commission structure: Level 1 = 5% of BV, Level 2 = 2.5%, Level 3 = 1.25%, Level 4 = 0.625%, Level 5+ = 50% of previous.
  if (!rule) return { basePercentage: 0.05, decayEnabled: true };

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

  while (parentId) {
    const parentKey = parentId.toString();
    if (visited.has(parentKey)) {
      throw new Error("Circular reference detected in referral chain");
    }
    visited.add(parentKey);

    logs.push({
      fromUserId: userObjectId,
      toUserId: parentId,
      level,
      bv,
      incomeAmount,
    });

    if (purchaseObjectId) {
      incomes.push({
        fromUser: userObjectId,
        toUser: parentId,
        purchase: purchaseObjectId,
        level,
        bv,
        amount: incomeAmount,
      });
    }

    if (level >= MAX_LEVELS) {
      throw new Error("Referral chain too deep or corrupt");
    }

    const parentQuery = UserModel.findById(parentId).select("parent");
    if (session) parentQuery.session(session);
    const parent = await parentQuery;
    parentId = parent?.parent ? new mongoose.Types.ObjectId(parent.parent) : null;

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
 * - Level 1: 5% of BV
 * - Level 2: 2.5% of BV
 * - Level 3: 1.25% of BV
 * - Level 4: 0.625% of BV
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
