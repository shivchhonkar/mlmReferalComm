import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { createId } from "@paralleldrive/cuid2";

const serviceSchema = new Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    _id: { type: String, default: createId },
    name: { type: String, required: true, trim: true },
    
    // SEO-friendly URL slug
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    
    // Service image
    image: { type: String, required: true },
    
    // Additional images gallery
    gallery: [{ type: String }],
    
    // Price for purchasing the service
    price: { type: Number, required: true, min: 0 },
    
    // Original price for discount display
    originalPrice: { type: Number, min: 0 },
    
    // Currency support
    currency: { type: String, enum: ["INR", "USD"], default: "INR" },
    
    // Discount percentage
    discountPercent: { type: Number, min: 0, max: 100 },

    // Business Volume (BV) for fixed_upi services (absolute amount)
    businessVolume: { type: Number, min: 0, default: 0 },

    /** dynamic_link only: BV % of admin-set order price (e.g. 30 = 30%) */
    bvPercentage: { type: Number, min: 0, max: 100 },

    /** fixed_upi = same UPI for every order; dynamic_link = admin adds link per order */
    paymentType: {
      type: String,
      enum: ["fixed_upi", "dynamic_link"],
      default: "fixed_upi",
      index: true,
    },
    /** UPI ID / VPA shown for fixed_upi services (falls back to env / admin settings) */
    fixedUpiId: { type: String, trim: true },
    /** When true, final price may be set by admin per order (dynamic_link) */
    requiresAdminPricing: { type: Boolean, default: false },

    // Short description for previews
    shortDescription: { type: String, trim: true, maxlength: 200 },
    
    // Full description
    description: { type: String, trim: true },

    // Service status
    // draft: seller working on it | pending: submitted for review | approved/active: public | rejected: admin rejected
    status: { 
      type: String, 
      enum: ["draft", "pending", "pending_approval", "approved", "rejected", "active", "inactive", "out_of_stock"], 
      default: "pending_approval", 
      index: true 
    },
    
    // Approval tracking
    approvedAt: { type: Date },
    approvedBy: { type: String, ref: "User" },
    rejectedAt: { type: Date },
    rejectedBy: { type: String, ref: "User" },
    rejectionReason: { type: String },
    
    // Featured flag for highlighting
    isFeatured: { type: Boolean, default: false },
    
    // Category and subcategory references
    categoryId: { type: String, ref: "Category" },
    subcategoryId: { type: String, ref: "Subcategory" },
    
    // Tags for filtering and search
    tags: [{ type: String, trim: true }],
    
    // Rating and reviews
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

// Indexes for better query performance
// Note: slug index is created automatically via unique: true constraint above
serviceSchema.index({ status: 1, isFeatured: 1 });
serviceSchema.index({ categoryId: 1 });
serviceSchema.index({ subcategoryId: 1 });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ rating: -1 });

export type Service = InferSchemaType<typeof serviceSchema> & {
  _id: string;
};

export const ServiceModel: Model<Service> =
  (mongoose.models.Service as Model<Service>) ||
  mongoose.model<Service>("Service", serviceSchema);
