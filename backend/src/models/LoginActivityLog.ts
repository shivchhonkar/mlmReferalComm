import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Login activity log - tracks login attempts (success/failure).
 * Does NOT store passwords or sensitive credentials.
 */
const loginActivityLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    success: { type: Boolean, required: true, index: true },
    ip: { type: String, trim: true, maxlength: 45 },
    userAgent: { type: String, trim: true, maxlength: 512 },
    failureReason: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

loginActivityLogSchema.index({ userId: 1, createdAt: -1 });
loginActivityLogSchema.index({ createdAt: -1 });

export type LoginActivityLog = InferSchemaType<typeof loginActivityLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LoginActivityLogModel: Model<LoginActivityLog> =
  (mongoose.models.LoginActivityLog as Model<LoginActivityLog>) ||
  mongoose.model<LoginActivityLog>("LoginActivityLog", loginActivityLogSchema);
