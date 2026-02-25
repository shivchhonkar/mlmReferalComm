import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const orderItemSchema = new Schema(
  {
    // service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    service: { type: String, ref: "Service", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    bv: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    customer: {
      fullName: { type: String, required: true, trim: true },
      mobile: { type: String, required: true, trim: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      notes: { type: String, trim: true },
    },

    items: { type: [orderItemSchema], required: true },

    totals: {
      totalQuantity: { type: Number, required: true, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
    },

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },

    payment: {
      mode: { type: String, enum: ["COD", "CASH", "RAZORPAY", "UPI"], default: "COD" },
      status: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },

      // UPI payment proof (screenshot) - required when mode is UPI
      paymentProofUrl: { type: String },
      paymentReviewStatus: { type: String, enum: ["PENDING_REVIEW", "APPROVED", "REJECTED"] },
      paymentReviewedAt: { type: Date },
      paymentReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      paymentRejectionReason: { type: String },

      // Razorpay
      razorpayOrderId: { type: String },
      razorpayPaymentId: { type: String },
      razorpaySignature: { type: String },
    },
  },
  { timestamps: true }
);

export type Order = InferSchemaType<typeof orderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OrderModel: Model<Order> =
  (mongoose.models.Order as Model<Order>) || mongoose.model<Order>("Order", orderSchema);
