/**
 * Backfill Income.legRootUserId for existing commission rows.
 *
 * Usage: npx tsx scripts/backfill-income-leg-root.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db";
import { IncomeModel } from "../src/models/Income";
import {
  loadParentChainMap,
  resolveLegRootUserIdFromParents,
} from "../src/lib/referralLegRoot";

const BATCH = 500;

async function main() {
  await connectToDatabase();

  const filter = {
    $or: [{ legRootUserId: null }, { legRootUserId: { $exists: false } }],
  };

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (;;) {
    const batch = await IncomeModel.find(filter)
      .select("_id toUser fromUser amount")
      .sort({ createdAt: 1 })
      .limit(BATCH)
      .lean();

    if (!batch.length) break;

    const buyerIds = [
      ...new Set(
        batch
          .map((r) => String(r.fromUser ?? ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const parentByUserId = await loadParentChainMap(buyerIds);

    for (const row of batch) {
      processed++;
      const earnerId = String(row.toUser ?? "");
      const buyerId = String(row.fromUser ?? "");
      if (!mongoose.Types.ObjectId.isValid(earnerId) || !mongoose.Types.ObjectId.isValid(buyerId)) {
        skipped++;
        continue;
      }

      const legRoot = resolveLegRootUserIdFromParents(earnerId, buyerId, parentByUserId);
      if (!legRoot) {
        skipped++;
        continue;
      }

      await IncomeModel.updateOne(
        { _id: row._id },
        { $set: { legRootUserId: new mongoose.Types.ObjectId(legRoot) } },
      );
      updated++;
    }

    console.log(`Processed ${processed} (updated ${updated}, skipped ${skipped})…`);
  }

  console.log(`Done. processed=${processed} updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
