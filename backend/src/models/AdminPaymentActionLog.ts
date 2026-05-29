import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const adminPaymentActionLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    withdrawalId: { type: Schema.Types.ObjectId, ref: "Withdrawal", default: null, index: true },
    action: {
      type: String,
      enum: ["withdrawal_completed", "withdrawal_rejected", "manual_payout", "status_note"],
      required: true,
      index: true,
    },
    amount: { type: Number, min: 0, default: null },
    previousStatus: { type: String, trim: true, default: "" },
    newStatus: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 512 },
  },
  { timestamps: true },
);

adminPaymentActionLogSchema.index({ createdAt: -1 });

export type AdminPaymentActionLog = InferSchemaType<typeof adminPaymentActionLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AdminPaymentActionLogModel: Model<AdminPaymentActionLog> =
  (mongoose.models.AdminPaymentActionLog as Model<AdminPaymentActionLog>) ||
  mongoose.model<AdminPaymentActionLog>("AdminPaymentActionLog", adminPaymentActionLogSchema);
