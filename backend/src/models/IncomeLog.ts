import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const incomeLogSchema = new Schema(
  {
    fromUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Present when logged from a purchase; used to reverse logs on order cancel. */
    purchase: { type: Schema.Types.ObjectId, ref: "Purchase", default: null, index: true },

    level: { type: Number, required: true, min: 1 },
    bv: { type: Number, required: true, min: 0 },

    // Income amount derived from BV.
    incomeAmount: { type: Number, required: true, min: 0 },
  },
  {
    // Keep only createdAt to match the requested schema.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export type IncomeLog = InferSchemaType<typeof incomeLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const IncomeLogModel: Model<IncomeLog> =
  (mongoose.models.IncomeLog as Model<IncomeLog>) ||
  mongoose.model<IncomeLog>("IncomeLog", incomeLogSchema);
