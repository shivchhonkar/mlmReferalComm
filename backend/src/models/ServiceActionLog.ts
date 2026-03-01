import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Service action log - tracks service status changes (activated, approved, rejected, modified, etc.).
 */
const serviceActionLogSchema = new Schema(
  {
    serviceId: { type: String, required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: ["created", "activated", "approved", "rejected", "modified", "deactivated", "expired"],
      required: true,
      index: true,
    },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    previousStatus: { type: String, trim: true, maxlength: 32 },
    newStatus: { type: String, trim: true, maxlength: 32 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

serviceActionLogSchema.index({ sellerId: 1, createdAt: -1 });

export type ServiceActionLog = InferSchemaType<typeof serviceActionLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ServiceActionLogModel: Model<ServiceActionLog> =
  (mongoose.models.ServiceActionLog as Model<ServiceActionLog>) ||
  mongoose.model<ServiceActionLog>("ServiceActionLog", serviceActionLogSchema);
