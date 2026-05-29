import mongoose from "mongoose";
import { OrderModel } from "@/models/Order";
import { UserModel } from "@/models/User";
import { isReferralStaffRole } from "@/lib/referralStaffRoles";

const QUALIFYING_ORDER_STATUSES = ["CONFIRMED", "COMPLETED"] as const;

/** True when any descendant (not self) has a confirmed/completed order. */
export async function hasDownlineQualifyingOrder(
  userId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null,
): Promise<boolean> {
  const pipeline: mongoose.PipelineStage[] = [
    { $match: { _id: userId } },
    {
      $graphLookup: {
        from: "users",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parent",
        as: "downline",
        maxDepth: 25,
      },
    },
    { $project: { downlineIds: "$downline._id" } },
    {
      $lookup: {
        from: "orders",
        let: { ids: "$downlineIds" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$user", "$$ids"] },
                  { $in: ["$status", QUALIFYING_ORDER_STATUSES] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "qualifyingDownlineOrders",
      },
    },
    {
      $project: {
        hasAny: { $gt: [{ $size: "$qualifyingDownlineOrders" }, 0] },
      },
    },
  ];
  const agg = UserModel.aggregate(pipeline);
  if (session) agg.session(session);
  const rows = await agg;
  return !!rows?.[0]?.hasAny;
}

/**
 * Downline Activities for normal users:
 * active only when at least one downline has a qualifying order; otherwise inactive.
 * Staff/admin users are not auto-updated here.
 */
export async function syncDownlineActivityStatusForUser(
  userId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession | null,
): Promise<"active" | "inactive" | null> {
  const userQuery = UserModel.findById(userId).select("role activityStatus");
  if (session) userQuery.session(session);
  const user = await userQuery.lean();
  if (!user?._id) return null;

  const role = String((user as any).role ?? "user");
  if (isReferralStaffRole(role)) return null;

  const next: "active" | "inactive" = (await hasDownlineQualifyingOrder(userId, session))
    ? "active"
    : "inactive";
  const current = String((user as any).activityStatus ?? "inactive");
  if (current !== next) {
    await UserModel.updateOne(
      { _id: userId },
      { $set: { activityStatus: next } },
      session ? { session } : undefined,
    );
  }
  return next;
}
