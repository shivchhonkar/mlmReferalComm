import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const communicationShareLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service", required: true }],
    channel: { type: String, enum: ["whatsapp", "sms", "email"], required: true, index: true },
    status: { type: String, enum: ["prepared", "opened", "sent"], default: "prepared", index: true },
    message: { type: String, trim: true, maxlength: 4000 },
    shareUrl: { type: String, trim: true, maxlength: 3000 },
  },
  { timestamps: true }
);

communicationShareLogSchema.index({ adminId: 1, createdAt: -1 });
communicationShareLogSchema.index({ userId: 1, createdAt: -1 });

export type CommunicationShareLog = InferSchemaType<typeof communicationShareLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CommunicationShareLogModel: Model<CommunicationShareLog> =
  (mongoose.models.CommunicationShareLog as Model<CommunicationShareLog>) ||
  mongoose.model<CommunicationShareLog>("CommunicationShareLog", communicationShareLogSchema);
