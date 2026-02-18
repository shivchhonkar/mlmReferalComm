// import mongoose from "mongoose";
// import { IncomeModel } from "@/models/Income";
// import { UserModel } from "@/models/User";
// import { PurchaseModel } from "@/models/Purchase";

// const levelPercents = [10, 5, 2]; // L1, L2, L3

// function calcBV(purchaseTotal: number) {
//   // Example: 50% of purchase total is BV
//   return Math.round(purchaseTotal * 0.5);
// }

// export async function distributeIncomeForPurchase(purchaseId: string) {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const purchase = await PurchaseModel.findById(purchaseId).session(session);
//     if (!purchase) throw new Error("Purchase not found");

//     // ✅ idempotency check: already generated?
//     const already = await IncomeModel.findOne({ purchase: purchase._id }).session(session);
//     if (already) {
//       await session.commitTransaction();
//       return { skipped: true };
//     }

//     const buyer = await UserModel.findById(purchase.user).session(session);
//     if (!buyer) throw new Error("Buyer not found");

//     const bv = calcBV(purchase.totalAmount); // adjust field name

//     let currentReferrerId = buyer.referrer; // adjust field name
//     for (let i = 0; i < levelPercents.length; i++) {
//       if (!currentReferrerId) break;

//       const pct = levelPercents[i];
//       const amount = Math.round((bv * pct) / 100);

//       await IncomeModel.create(
//         [
//           {
//             fromUser: buyer._id,
//             toUser: currentReferrerId,
//             purchase: purchase._id,
//             level: i + 1,
//             bv,
//             amount,
//           },
//         ],
//         { session }
//       );

//       // move up
//       const refUser = await UserModel.findById(currentReferrerId).session(session);
//       currentReferrerId = refUser?.referrer ?? null;
//     }

//     await session.commitTransaction();
//     return { skipped: false };
//   } catch (e) {
//     await session.abortTransaction();
//     throw e;
//   } finally {
//     session.endSession();
//   }
// }
