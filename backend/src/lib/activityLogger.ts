import type { Request } from "express";
import { getRequestMetadata } from "./requestMetadata";
import { LoginActivityLogModel } from "@/models/LoginActivityLog";
import { LogoutActivityLogModel } from "@/models/LogoutActivityLog";
import { AccountChangeLogModel } from "@/models/AccountChangeLog";
import { ServiceActionLogModel } from "@/models/ServiceActionLog";
import mongoose from "mongoose";

type AccountChangeType = "profile" | "business" | "email" | "role" | "status" | "permission" | "kyc" | "other";
type ServiceActionType = "created" | "activated" | "approved" | "rejected" | "modified" | "deactivated" | "expired";

/** Log login attempt (success or failure). Never stores password. */
export async function logLoginActivity(
  req: Request,
  options: {
    userId?: mongoose.Types.ObjectId | null;
    success: boolean;
    failureReason?: string;
  }
): Promise<void> {
  try {
    const { ip, userAgent } = getRequestMetadata(req);
    await LoginActivityLogModel.create({
      userId: options.userId ?? null,
      success: options.success,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      failureReason: options.failureReason,
    });
  } catch (err) {
    console.error("[ActivityLogger] Failed to log login:", err);
  }
}

/** Log logout. */
export async function logLogoutActivity(
  req: Request,
  options: {
    userId: mongoose.Types.ObjectId | string;
    reason?: string;
  }
): Promise<void> {
  try {
    const { ip, userAgent } = getRequestMetadata(req);
    await LogoutActivityLogModel.create({
      userId: options.userId,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      reason: options.reason,
    });
  } catch (err) {
    console.error("[ActivityLogger] Failed to log logout:", err);
  }
}

/** Log account change (profile, email, role, etc.). Does not store sensitive values. */
export async function logAccountChange(
  req: Request,
  options: {
    userId: mongoose.Types.ObjectId;
    changedBy?: mongoose.Types.ObjectId | null;
    changedFields: string[];
    changeType?: AccountChangeType;
  }
): Promise<void> {
  try {
    const { ip, userAgent } = getRequestMetadata(req);
    await AccountChangeLogModel.create({
      userId: options.userId,
      changedBy: options.changedBy ?? null,
      changedFields: options.changedFields,
      changeType: options.changeType ?? "other",
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    });
  } catch (err) {
    console.error("[ActivityLogger] Failed to log account change:", err);
  }
}

/** Log service action (approved, rejected, etc.). */
export async function logServiceAction(options: {
  serviceId: string;
  sellerId: mongoose.Types.ObjectId;
  action: ServiceActionType;
  performedBy?: mongoose.Types.ObjectId | null;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ServiceActionLogModel.create({
      serviceId: options.serviceId,
      sellerId: options.sellerId,
      action: options.action,
      performedBy: options.performedBy ?? null,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus,
      metadata: options.metadata,
    });
  } catch (err) {
    console.error("[ActivityLogger] Failed to log service action:", err);
  }
}
