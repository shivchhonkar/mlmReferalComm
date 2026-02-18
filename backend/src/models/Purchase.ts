import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const purchaseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: String, ref: "Service", required: true },
    bv: { type: Number, required: true, min: 0 },
    /** When set, this purchase was created from an order; used to reverse income on order cancel */
    order: { type: Schema.Types.ObjectId, ref: "Order", default: null, index: true },
  },
  { timestamps: true }
);

export type Purchase = InferSchemaType<typeof purchaseSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PurchaseModel: Model<Purchase> =
  (mongoose.models.Purchase as Model<Purchase>) ||
  mongoose.model<Purchase>("Purchase", purchaseSchema);
