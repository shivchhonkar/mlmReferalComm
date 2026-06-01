import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DistributionRuleModel } from "@/models/DistributionRule";
import { IncomeLogModel } from "@/models/IncomeLog";
import { IncomeModel } from "@/models/Income";
import { PurchaseModel } from "@/models/Purchase";
import { ServiceModel } from "@/models/Service";
import { isDynamicLinkService } from "@/lib/servicePayment";
import { UserModel } from "@/models/User";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";

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

  const serviceQuery = ServiceModel.findById(serviceId).select(
    "businessVolume bvPercentage paymentType status bv isActive",
  );
  if (session) serviceQuery.session(session);
  const service = await serviceQuery;

  if (!service) throw new Error("Service not found");

  const legacyService = service as unknown as { isActive?: boolean; bv?: number };
  const status = service.status ?? (legacyService.isActive ? "active" : "inactive");
  if (status !== "active") throw new Error("Service is inactive");

  let bv: number;
  if (purchaseObjectId) {
    const purchaseQuery = PurchaseModel.findById(purchaseObjectId).select("bv");
    if (session) purchaseQuery.session(session);
    const purchase = await purchaseQuery.lean();
    const purchaseBv = Number((purchase as { bv?: number } | null)?.bv);
    if (purchase && Number.isFinite(purchaseBv) && purchaseBv >= 0) {
      bv = purchaseBv;
    } else if (isDynamicLinkService((service as { paymentType?: string }).paymentType)) {
      throw new Error("Purchase has invalid BV for dynamic service");
    } else {
      bv = (service.businessVolume ?? legacyService.bv) as number;
    }
  } else {
    bv = (service.businessVolume ?? legacyService.bv) as number;
  }
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
    purchase?: mongoose.Types.ObjectId | null;
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
    withdrawableAmount: number;
    legRootUserId: mongoose.Types.ObjectId;
  }> = [];

  // Guardrail for corrupt graphs (should be impossible with correct parent assignment).
  const MAX_LEVELS = 50_000;
  /** Node on buyer → upline path; parent of this node is current recipient (leg root for this level). */
  let pathNodeFromBuyer: mongoose.Types.ObjectId = userObjectId;

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
    const isAdminRecipient = isReferralStaffRole(recipientRole);
    // Active-status eligibility applies to normal users only.
    // Admin roles can receive referral income regardless of status.
    const recipientStatus = String((recipient as any)?.status ?? "inactive");
    const isIncomeEligible = isAdminRecipient || recipientStatus === "active";
    if (isIncomeEligible && incomeAmount > 0) {
      logs.push({
        fromUserId: userObjectId,
        toUserId: parentId,
        purchase: purchaseObjectId ?? null,
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
          withdrawableAmount: incomeAmount,
          legRootUserId: pathNodeFromBuyer,
        });
      }
    }

    if (level >= MAX_LEVELS) {
      throw new Error("Referral chain too deep or corrupt");
    }

    pathNodeFromBuyer = parentId;
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
 * Earnings are not capped at distribution time. Withdrawal caps apply only when processing payouts.
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
