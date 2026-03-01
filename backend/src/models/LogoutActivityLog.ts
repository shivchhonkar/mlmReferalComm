import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Logout activity log - tracks when users log out.
 */
const logoutActivityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 512 },
    reason: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

logoutActivityLogSchema.index({ userId: 1, createdAt: -1 });

export type LogoutActivityLog = InferSchemaType<typeof logoutActivityLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LogoutActivityLogModel: Model<LogoutActivityLog> =
  (mongoose.models.LogoutActivityLog as Model<LogoutActivityLog>) ||
  mongoose.model<LogoutActivityLog>("LogoutActivityLog", logoutActivityLogSchema);
