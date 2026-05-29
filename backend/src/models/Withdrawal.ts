import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const withdrawalSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      required: true,
      default: "pending",
      index: true,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, trim: true, default: "" },
    /** How admin paid the user (set when marking completed or manual payout). */
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", null],
      default: null,
    },
    /** UPI screenshot path (required when paymentMethod is upi). */
    paymentProofUrl: { type: String, trim: true, default: "" },
    payoutNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export type Withdrawal = InferSchemaType<typeof withdrawalSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WithdrawalModel: Model<Withdrawal> =
  (mongoose.models.Withdrawal as Model<Withdrawal>) ||
  mongoose.model<Withdrawal>("Withdrawal", withdrawalSchema);
