import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Account change log - tracks profile, email, permission, and other account updates.
 * Stores only field names and actor - no sensitive values like passwords.
 */
const accountChangeLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    changedFields: [{ type: String, trim: true, maxlength: 64 }],
    changeType: {
      type: String,
      enum: ["profile", "business", "email", "role", "status", "permission", "kyc", "other"],
      default: "other",
      index: true,
    },
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 512 },
  },
  { timestamps: true }
);

accountChangeLogSchema.index({ userId: 1, createdAt: -1 });

export type AccountChangeLog = InferSchemaType<typeof accountChangeLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AccountChangeLogModel: Model<AccountChangeLog> =
  (mongoose.models.AccountChangeLog as Model<AccountChangeLog>) ||
  mongoose.model<AccountChangeLog>("AccountChangeLog", accountChangeLogSchema);
