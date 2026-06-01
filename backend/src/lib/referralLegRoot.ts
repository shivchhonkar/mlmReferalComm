import mongoose from "mongoose";
import { UserModel } from "@/models/User";

export type ParentByUserId = Map<string, string | null>;

/**
 * Resolve the direct-referral leg root for commission paid to `earnerId` from buyer `buyerId`.
 * Leg root = the downline user on the path buyer → … → earner whose parent is `earnerId`.
 */
export function resolveLegRootUserIdFromParents(
  earnerId: string,
  buyerId: string,
  parentByUserId: ParentByUserId,
): string | null {
  const earnerKey = String(earnerId);
  const buyerKey = String(buyerId);
  if (!earnerKey || !buyerKey || earnerKey === buyerKey) return null;

  let cursor: string | null = buyerKey;
  const visited = new Set<string>();
  const MAX_STEPS = 50_000;

  for (let step = 0; cursor && step < MAX_STEPS; step++) {
    if (visited.has(cursor)) return null;
    visited.add(cursor);

    const parent: string | null = parentByUserId.get(cursor) ?? null;
    if (!parent) return null;
    if (parent === earnerKey) return cursor;
    cursor = parent;
  }

  return null;
}

/** Sum of min(leg earnings, perLegCap) across all legs. Staff: pass perLegCap = null for unlimited. */
export function computeMaxCumulativeWithdrawalFromLegTotals(
  legEarnings: Map<string, number>,
  perLegCap: number | null,
  totalEarnedAmount: number,
): number {
  if (perLegCap === null) return totalEarnedAmount;

  const cap = Math.max(0, perLegCap);
  let sum = 0;
  for (const legTotal of legEarnings.values()) {
    sum += Math.min(Math.max(0, legTotal), cap);
  }
  return sum;
}

export function mergeLegEarning(
  legEarnings: Map<string, number>,
  legRootId: string,
  amount: number,
): void {
  const amt = Number(amount) || 0;
  if (!legRootId || amt <= 0) return;
  legEarnings.set(legRootId, (legEarnings.get(legRootId) ?? 0) + amt);
}

/**
 * Load parent pointers for `userIds` and all ancestors up the chain (for leg resolution).
 */
export async function loadParentChainMap(
  userIds: mongoose.Types.ObjectId[],
  session?: mongoose.ClientSession | null,
): Promise<ParentByUserId> {
  const parentByUserId: ParentByUserId = new Map();
  if (!userIds.length) return parentByUserId;

  const queue = new Set<string>(
    userIds.map((id) => id.toString()).filter((id) => mongoose.Types.ObjectId.isValid(id)),
  );
  const visited = new Set<string>();
  const MAX_USERS = 100_000;

  while (queue.size > 0 && visited.size < MAX_USERS) {
    const batch = [...queue].filter((id) => !visited.has(id)).slice(0, 500);
    batch.forEach((id) => {
      queue.delete(id);
      visited.add(id);
    });
    if (!batch.length) break;

    const objectIds = batch.map((id) => new mongoose.Types.ObjectId(id));
    const q = UserModel.find({ _id: { $in: objectIds } }).select("_id parent").lean();
    if (session) q.session(session);
    const rows = await q;

    for (const row of rows) {
      const id = String(row._id);
      const parentRaw = row.parent;
      const parent =
        parentRaw && mongoose.Types.ObjectId.isValid(String(parentRaw))
          ? String(parentRaw)
          : null;
      parentByUserId.set(id, parent);
      if (parent && !visited.has(parent)) queue.add(parent);
    }
  }

  return parentByUserId;
}

export async function resolveLegRootUserId(
  earnerId: string,
  buyerId: string,
  session?: mongoose.ClientSession | null,
): Promise<string | null> {
  if (!mongoose.Types.ObjectId.isValid(earnerId) || !mongoose.Types.ObjectId.isValid(buyerId)) {
    return null;
  }
  const parentByUserId = await loadParentChainMap(
    [new mongoose.Types.ObjectId(buyerId)],
    session,
  );
  return resolveLegRootUserIdFromParents(earnerId, buyerId, parentByUserId);
}

export type IncomeLegLine = {
  amount: number;
  fromUser: mongoose.Types.ObjectId | string;
  legRootUserId?: mongoose.Types.ObjectId | string | null;
};

/**
 * Build leg → total earnings map for one earner from income lines.
 */
export function aggregateLegEarningsForEarner(
  earnerId: string,
  lines: IncomeLegLine[],
  parentByUserId: ParentByUserId,
): Map<string, number> {
  const legEarnings = new Map<string, number>();

  for (const line of lines) {
    const amt = Number(line.amount) || 0;
    if (amt <= 0) continue;

    let legRoot: string | null = null;
    const stored = line.legRootUserId;
    if (stored && mongoose.Types.ObjectId.isValid(String(stored))) {
      legRoot = String(stored);
    } else {
      legRoot = resolveLegRootUserIdFromParents(
        earnerId,
        String(line.fromUser),
        parentByUserId,
      );
    }

    if (legRoot) mergeLegEarning(legEarnings, legRoot, amt);
  }

  return legEarnings;
}
