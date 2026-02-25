import type { Express, Request, Response } from "express";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { generateUniqueReferralCode } from "@/lib/referral";
import { importUpload } from "@/lib/upload";
import { processBulkServiceUpload, generateServiceImportTemplate } from "@/lib/bulkServiceImport";
import { processBulkCategoryUpload, generateCategoryImportTemplate } from "@/lib/bulkCategoryImport";
import { requireAuth, requireRole, requireAdminRole, requireSuperAdminOrAdmin } from "@/middleware/auth";

import { UserModel } from "@/models/User";
import { ServiceModel } from "@/models/Service";
import { CategoryModel } from "@/models/Category";
import { SubcategoryModel } from "@/models/Subcategory";
import { PurchaseModel } from "@/models/Purchase";
import { IncomeLogModel } from "@/models/IncomeLog";
import { DistributionRuleModel } from "@/models/DistributionRule";
import { ContactModel } from "@/models/Contact";
import { Slider } from "@/models/Slider";
import mongoose from "mongoose";

/**
 * Register all admin routes
 * These routes are protected and require admin, super_admin, or moderator roles
 */
export function registerAdminRoutes(app: Express) {
  // ============================================================================
  // ADMIN DASHBOARD
  // ============================================================================
  
  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const [totalUsers, activeServices] = await Promise.all([
        UserModel.estimatedDocumentCount(),
        ServiceModel.countDocuments({ $or: [{ status: "active" }, { status: { $exists: false }, isActive: true }] }),
      ]);

      const bvAgg = await PurchaseModel.aggregate<{ _id: null; totalBVGenerated: number }>([
        { $group: { _id: null, totalBVGenerated: { $sum: { $ifNull: ["$bv", 0] } } } },
      ]);
      const totalBVGenerated = bvAgg[0]?.totalBVGenerated ?? 0;

      const incomeAgg = await IncomeLogModel.aggregate<{ _id: null; totalIncomeDistributed: number }>([
        { $group: { _id: null, totalIncomeDistributed: { $sum: { $ifNull: ["$incomeAmount", 0] } } } },
      ]);
      const totalIncomeDistributed = incomeAgg[0]?.totalIncomeDistributed ?? 0;

      return res.json({ totalUsers, totalBVGenerated, totalIncomeDistributed, activeServices });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // ADMIN ANALYTICS
  // ============================================================================
  
  app.get("/api/admin/analytics", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // User Analytics
      const totalUsers = await UserModel.countDocuments({ status: { $ne: "deleted" } });
      const activeUsers = await UserModel.countDocuments({ status: { $ne: "deleted" }, activityStatus: "active" });
      
      // Provider Analytics (role: "user" = service providers in this system)
      const totalProviders = await UserModel.countDocuments({ status: { $ne: "deleted" }, role: "user" });
      const activeProviders = await UserModel.countDocuments({ status: { $ne: "deleted" }, activityStatus: "active", role: "user" });
      const newProviders = await UserModel.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: { $ne: "deleted" },
        role: "user"
      });
      
      // Buyer Analytics (roles: "admin", "moderator" = buyers in this system)
      const totalBuyers = await UserModel.countDocuments({ 
        status: { $ne: "deleted" }, 
        role: { $in: ["admin", "moderator"] }
      });
      const activeBuyers = await UserModel.countDocuments({ 
        status: { $ne: "deleted" }, 
        activityStatus: "active",
        role: { $in: ["admin", "moderator"] }
      });
      const newBuyers = await UserModel.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: { $ne: "deleted" },
        role: { $in: ["admin", "moderator"] }
      });
      
      const newRegistrations = await UserModel.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: { $ne: "deleted" }
      });

      // Service Analytics
      const totalServices = await ServiceModel.countDocuments();
      const pendingServices = await ServiceModel.countDocuments({ status: "pending_approval" });
      const approvedServices = await ServiceModel.countDocuments({ status: "approved" });
      const rejectedServices = await ServiceModel.countDocuments({ status: "rejected" });
      const activeServices = await ServiceModel.countDocuments({ status: "active" });

      // Inquiry Analytics (using Contact model as inquiries)
      const totalInquiries = await ContactModel.countDocuments();
      const pendingInquiries = await ContactModel.countDocuments({ status: "pending" });

      return res.json({
        users: {
          total: totalUsers,
          active: activeUsers,
          providers: {
            total: totalProviders,
            active: activeProviders,
            new: newProviders
          },
          buyers: {
            total: totalBuyers,
            active: activeBuyers,
            new: newBuyers
          },
          newRegistrations
        },
        services: {
          total: totalServices,
          pending: pendingServices,
          approved: approvedServices,
          rejected: rejectedServices,
          active: activeServices
        },
        inquiries: {
          total: totalInquiries,
          pending: pendingInquiries
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================
  
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || "";
      const role = req.query.role as string;
      const status = req.query.status as string;
      const type = req.query.type as string; // "sellers" = approved sellers with service count

      const today = new Date();
      // Include users without status field (legacy docs) or with status != "deleted"
      const query: any = {
        $or: [
          { status: { $exists: false } },
          { status: null },
          { status: { $nin: ["deleted"] } },
        ],
      };

      let requestedRoles: string[] = [];
      if (type === "sellers") {
        query.isSeller = true;
        query.sellerStatus = "approved";
        delete query.$or; // sellers: use simple non-deleted filter
        query.status = { $ne: "deleted" };
      } else if (role) {
        requestedRoles = role.split(",").map((r: string) => r.trim()).filter(Boolean);
        if (requestedRoles.length === 1) query.role = requestedRoles[0];
        else if (requestedRoles.length > 1) query.role = { $in: requestedRoles };
      }
      
      // Handle special "new" filter for users created this month
      if (status === "new") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
      } else if (status === "active" || status === "inactive") {
        query.activityStatus = status;
      } else if (status) {
        query.status = status;
      }
      
      if (search) {
        const searchOr = [
          { name: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } }
        ];
        query.$and = query.$and || [];
        query.$and.push({ $or: searchOr });
      }

      const roleOrder: Record<string, number> = { super_admin: 0, admin: 1, moderator: 2, user: 3 };
      const sort: any = type === "sellers"
        ? { fullName: 1 }
        : { createdAt: -1 };

      let users: any[];
      let total: number;

      if (type === "sellers") {
        const aggregated = await UserModel.aggregate([
          { $match: query },
          { $lookup: { from: "services", localField: "_id", foreignField: "sellerId", as: "services" } },
          { $addFields: { serviceCount: { $size: "$services" } } },
          { $lookup: { from: "users", localField: "parent", foreignField: "_id", as: "parentDoc", pipeline: [{ $project: { name: 1, email: 1, mobile: 1 } }] } },
          { $set: { parent: { $arrayElemAt: ["$parentDoc", 0] } } },
          { $project: { parentDoc: 0, passwordHash: 0, services: 0 } },
          { $sort: { fullName: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]);
        total = await UserModel.countDocuments(query);
        users = aggregated;
      } else {
        users = await UserModel.find(query)
          .select("-passwordHash")
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("parent", "name email mobile")
          .lean();
        total = await UserModel.countDocuments(query);
        if (query.role && query.role.$in) {
          users.sort((a: any, b: any) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99));
        }
        // If we requested admin roles and got no users, include current user if they have an admin role in DB
        if (requestedRoles.length > 0 && users.length === 0 && total === 0 && page === 1) {
          const currentUserDoc = await UserModel.findById(ctx.userId)
            .select("-passwordHash")
            .populate("parent", "name email mobile")
            .lean();
          if (currentUserDoc && requestedRoles.includes(currentUserDoc.role as string)) {
            users = [currentUserDoc as any];
            total = 1;
          }
        }
      }

      return res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const user = await UserModel.findById(req.params.id)
        .select("-passwordHash")
        .populate("parent", "name email mobile");

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAuth(req);
      
      const body = z.object({
        name: z.string().min(1),
        email: z.string().email({ message: "Invalid email format" }).optional(),
        mobile: z.string().min(10),
        countryCode: z.string().default("+91"),
        password: z.string().min(8),
        role: z.enum(["super_admin", "admin", "moderator", "user"]),
        referralCode: z.string().optional()
      }).parse(req.body);

      // Only super_admin can create super_admin or admin accounts
      if ((body.role === "super_admin" || body.role === "admin") && ctx.role !== "super_admin") {
        return res.status(403).json({ error: "Only Super Admin can create Admin or Super Admin accounts" });
      }

      // Regular admins can only create moderator or user accounts
      if (!["super_admin", "admin"].includes(ctx.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      await connectToDatabase();

      // Check if user already exists
      const existingUser = await UserModel.findOne({
        $or: [
          { mobile: body.mobile },
          { email: body.email }
        ]
      });

      if (existingUser) {
        return res.status(400).json({ error: "User with this mobile or email already exists" });
      }

      const passwordHash = await hashPassword(body.password);
      const referralCode = body.referralCode || await generateUniqueReferralCode();

      const user = new UserModel({
        ...body,
        passwordHash,
        referralCode,
        fullName: body.name,
        isVerified: true
      });

      await user.save();

      return res.status(201).json({
        message: "User created successfully",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/users/:id/status", async (req: Request, res: Response) => {
    try {
      // ✅ allow admin + super_admin (and you can decide if moderator should be allowed)
      const ctx = await requireAuth(req);

      if (!["admin", "super_admin"].includes(ctx.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const body = z
        .object({
          status: z.enum(["active", "suspended", "deleted"]),
        })
        .parse(req.body);

      await connectToDatabase();

      const targetUser = await UserModel.findById(id).select("role status");
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      // ✅ admin restrictions
      if (ctx.role === "admin") {
        // admin cannot change admin/super_admin accounts
        if (["admin", "super_admin"].includes(targetUser.role)) {
          return res.status(403).json({
            error: "Admin cannot change status of Admin/Super Admin users",
          });
        }
      }

      // Optional safety: prevent changing self to deleted/suspended
      // if (String(ctx.userId) === String(id) && body.status !== "active") {
      //   return res.status(400).json({ error: "You cannot change your own status" });
      // }

      const updated = await UserModel.findByIdAndUpdate(
        id,
        { $set: { status: body.status } },
        { new: true, runValidators: true }
      )
        .select("-passwordHash")
        .populate("parent", "name email mobile");

      return res.json({ message: "User status updated successfully", user: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });


  // Update user referral parent (only super_admin can assign parent to users without one)
  app.put("/api/admin/users/:id/referral", async (req: Request, res: Response) => {
    try {
      await requireRole(req, "super_admin");
      const body = z.object({
        referralCode: z.string().min(1, "Referral code is required"),
      }).parse(req.body);

      await connectToDatabase();

      // Find the user to update
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if user already has a parent
      if (user.parent) {
        return res.status(400).json({ error: "User already has a referral parent. Cannot change referral hierarchy." });
      }

      // Find the parent by referral code
      const parentUser = await UserModel.findOne({ referralCode: body.referralCode });
      if (!parentUser) {
        return res.status(404).json({ error: "Invalid referral code. Parent user not found." });
      }

      // Prevent self-referral
      if (parentUser._id.toString() === user._id.toString()) {
        return res.status(400).json({ error: "Cannot refer yourself" });
      }

      // Unilevel: assign parent directly (unlimited direct children per referral code).
      user.parent = parentUser._id;
      user.position = null;
      await user.save();

      return res.json({ 
        message: "Referral parent assigned successfully", 
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          parent: {
            _id: parentUser._id,
            name: parentUser.name,
            email: parentUser.email,
            mobile: parentUser.mobile,
            referralCode: parentUser.referralCode
          },
          position: user.position
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Generate and assign a unique referral code for a user (admin/super_admin)
  app.post("/api/admin/users/:id/generate-referral-code", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }
      await connectToDatabase();
      const user = await UserModel.findById(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      const referralCode = await generateUniqueReferralCode();
      user.referralCode = referralCode;
      await user.save();
      return res.json({
        message: "Referral code generated and assigned",
        referralCode,
        user: await UserModel.findById(req.params.id).select("-passwordHash").lean()
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      await requireRole(req, "super_admin");
      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "deleted" } },
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "User deleted successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // SERVICE MANAGEMENT
  // ============================================================================
  
  app.get("/api/admin/services", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();
      const statusFilter = req.query.status as string | undefined;
      const sellerId = req.query.sellerId as string | undefined;
      const query: any = statusFilter && statusFilter !== "all"
        ? { status: statusFilter }
        : {};
      if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
        query.sellerId = new mongoose.Types.ObjectId(sellerId);
      }
      const services = await ServiceModel.find(query)
        .sort({ createdAt: -1 })
        .populate("sellerId", "name email fullName mobile")
        .populate("categoryId", "name code")
        .lean();
      return res.json({ services });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/admin/services", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1).optional(),
      image: z.string().url({ message: "Invalid URL format" }).optional(),
      gallery: z.array(z.string().url({ message: "Invalid URL format" })).optional(),
      price: z.number().min(0),
      originalPrice: z.number().min(0).optional(),
      currency: z.enum(["INR", "USD"]).default("INR"),
      discountPercent: z.number().min(0).max(100).optional(),
      businessVolume: z.number().min(0),
      shortDescription: z.string().max(200).optional(),
      description: z.string().optional(),
      status: z.enum(["draft", "pending", "pending_approval", "approved", "rejected", "active", "inactive", "out_of_stock"]).optional(),
      isFeatured: z.boolean().default(false),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    try {
      const ctx = await requireAdminRole(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      // Auto-generate slug if not provided
      const slug = body.slug || body.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/(^-|-$)/g, '');
      
      // Use default image if not provided
      const image = body.image || '/images/default-service.jpg';

      // Check for duplicate slug
      const existingService = await ServiceModel.findOne({ slug });
      if (existingService) {
        return res.status(400).json({ error: `Service with slug "${slug}" already exists` });
      }

      const service = await ServiceModel.create({
        sellerId: ctx.userId,
        name: body.name,
        slug,
        image,
        gallery: body.gallery,
        price: body.price,
        originalPrice: body.originalPrice,
        currency: body.currency,
        discountPercent: body.discountPercent,
        businessVolume: body.businessVolume,
        shortDescription: body.shortDescription,
        description: body.description,
        status: body.status || "pending_approval", // Default to pending_approval if not specified
        isFeatured: body.isFeatured,
        categoryId: body.categoryId,
        tags: body.tags,
      });

      return res.status(201).json({ service });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/services/:id", async (req, res) => {
    const schema = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        image: z.string().optional(),//z.string().url({ message: "Invalid URL format" }).optional(),
        gallery: z.string().optional(), //z.array(z.string().url({ message: "Invalid URL format" })).optional(),
        price: z.number().min(0).optional(),
        originalPrice: z.number().min(0).optional(),
        currency: z.enum(["INR", "USD"]).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
        businessVolume: z.number().min(0).optional(),
        shortDescription: z.string().max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "pending", "approved", "rejected", "active", "inactive", "out_of_stock"]).optional(),
        isFeatured: z.boolean().optional(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      await requireAdminRole(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const service = await ServiceModel.findByIdAndUpdate(req.params.id, body, { new: true });
      if (!service) return res.status(404).json({ error: "Not found" });
      return res.json({ service });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  /**
 * =========================================================
 * ✅ UPDATE USER
 * PUT /api/admin/users/:id
 * =========================================================
 */

  app.put("/api/admin/users/:id", async (req: Request, res: Response) => {
  try {
    // Must be admin/super_admin/moderator? (your rule says admin routes)
    // If you want only admin & super_admin, change to requireSuperAdminOrAdmin(req)
    await requireAdminRole(req);

    const ctx = await requireAuth(req);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const body = z.object({
      name: z.string().min(1).optional(),
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      mobile: z.string().min(10).optional(),
      countryCode: z.string().optional(),

      role: z.enum(["super_admin", "admin", "moderator", "user"]).optional(),

      status: z.enum(["active", "suspended", "deleted"]).optional(),
      activityStatus: z.enum(["active", "inactive"]).optional(),
      kycStatus: z.enum(["pending", "submitted", "verified", "rejected"]).optional(),

      // Admin can set referral code for user (must be unique)
      referralCode: z.string().min(1).max(32).optional(),
    }).refine(v => Object.keys(v).length > 0, "No fields to update")
      .parse(req.body);

    await connectToDatabase();

    const adminUser = await UserModel.findById(ctx.userId).select("role");
    if (!adminUser) return res.status(401).json({ error: "Unauthorized" });

    const targetUser = await UserModel.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    //  Prevent non-super-admin from editing super_admin
    if (targetUser.role === "super_admin" && adminUser.role !== "super_admin") {
      return res.status(403).json({ error: "Only Super Admin can modify Super Admin" });
    }

    //  Only super_admin can change role
    if (body.role && adminUser.role !== "super_admin") {
      delete (body as any).role;
    }

    // Optional: keep fullName in sync if name updated
    if (body.name && !body.fullName) {
      (body as any).fullName = body.name;
    }

    // referralCode must be unique (cannot duplicate another user's code)
    if (body.referralCode) {
      const existing = await UserModel.findOne({ referralCode: body.referralCode });
      if (existing && existing._id.toString() !== req.params.id) {
        return res.status(400).json({ error: "This referral code is already in use" });
      }
    }

    const updated = await UserModel.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    )
      .select("-passwordHash")
      .populate("parent", "name email mobile");

    return res.json({ message: "User updated successfully", user: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status =
      msg === "Forbidden" ? 403 :
      msg.includes("Unauthorized") ? 401 :
      msg.includes("Invalid user id") ? 400 :
      400;

    return res.status(status).json({ error: msg });
  }
});


  app.delete("/api/admin/services/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      await connectToDatabase();

      const service = await ServiceModel.findByIdAndDelete(req.params.id);
      if (!service) return res.status(404).json({ error: "Service not found" });

      return res.json({ message: "Service deleted successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Bulk Service Import/Export
  app.post("/api/admin/services/bulk-upload", importUpload.single("file"), async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      const fs = await import("node:fs").then(m => m.promises);
      const fileBuffer = await fs.readFile(req.file.path);

      const result = await processBulkServiceUpload(fileBuffer, req.file.originalname, ServiceModel);

      await fs.unlink(req.file.path).catch(() => {});

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Import failed with ${result.errors.length} error(s)`,
          totalRows: result.totalRows,
          successfulInserts: result.successfulInserts,
          errors: result.errors.slice(0, 10),
          warnings: result.warnings,
          summary: result.summary,
        });
      }

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${result.successfulInserts} services`,
        totalRows: result.totalRows,
        successfulInserts: result.successfulInserts,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/services/template/download", async (req, res) => {
    try {
      await requireAdminRole(req);

      const template = generateServiceImportTemplate();

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="service-import-template.xlsx"');
      res.send(template);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/admin/services/bulk", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const { services, format } = req.body;

      if (!services || !Array.isArray(services)) {
        return res.status(400).json({ error: "Services array is required" });
      }

      if (!format || !['json', 'excel', 'csv'].includes(format)) {
        return res.status(400).json({ error: "Format must be json, excel, or csv" });
      }

      const processedServices = services.map(service => ({
        ...service,
        slug: service.slug || service.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
        status: service.status || "active",
        currency: service.currency || "INR",
        isActive: service.isActive === undefined ? true : service.isActive,
        categoryId: service.categoryId || null,
      }));

      const result = await ServiceModel.insertMany(processedServices);

      const categoryGroups = processedServices.reduce((acc, service) => {
        const categoryId = service.categoryId || 'uncategorized';
        if (!acc[categoryId]) acc[categoryId] = [];
        acc[categoryId].push(service);
        return acc;
      }, {} as Record<string, any[]>);

      for (const [categoryId, categoryServices] of Object.entries(categoryGroups)) {
        if (categoryId !== 'uncategorized') {
          await CategoryModel.findByIdAndUpdate(categoryId, {
            $inc: { serviceCount: (categoryServices as any[]).length }
          });
        }
      }

      return res.status(201).json({ 
        message: `Successfully imported ${result.length} services`,
        services: result,
        categoryGroups
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/services/by-category", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const { categoryId, sortBy = 'sortOrder', sortOrder = 'asc' } = req.query;

      let query: any = {};
      if (categoryId && categoryId !== 'all') {
        query.categoryId = categoryId;
      }

      let sortQuery: any = {};
      if (sortBy === 'name') {
        sortQuery.name = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'price') {
        sortQuery.price = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'businessVolume') {
        sortQuery.businessVolume = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'sortOrder') {
        sortQuery.sortOrder = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortQuery.sortOrder = 1;
      }

      const services = await ServiceModel.find(query)
        .sort(sortQuery)
        .populate('categoryId', 'name code slug')
        .lean();

      return res.json({ services });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/services/export", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const { format = 'json', categoryId, sortBy = 'sortOrder', sortOrder = 'asc' } = req.query;

      let query: any = {};
      if (categoryId && categoryId !== 'all') {
        query.categoryId = categoryId;
      }

      let sortQuery: any = {};
      if (sortBy === 'name') {
        sortQuery.name = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'price') {
        sortQuery.price = sortOrder === 'desc' ? -1 : 1;
      } else if (sortBy === 'businessVolume') {
        sortQuery.businessVolume = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortQuery.sortOrder = 1;
      }

      const services = await ServiceModel.find(query)
        .sort(sortQuery)
        .populate('categoryId', 'name code slug')
        .lean();

      if (format === 'csv') {
        const csv = [
          'Name,Slug,Category,Price,Business Volume,Status,Featured,Description',
          ...services.map(service => [
            service.name,
            service.slug,
            (service.categoryId as any)?.name || 'Uncategorized',
            service.price,
            service.businessVolume,
            service.status,
            service.isFeatured || false,
            `"${(service.description || '').replaceAll('"', '""')}"`
          ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="services.csv"`);
        return res.send(csv);
      } else if (format === 'excel') {
        const excelCsv = [
          'Name\tSlug\tCategory\tPrice\tBV\tStatus\tFeatured\tDescription',
          ...services.map(service => [
            service.name,
            service.slug,
            (service.categoryId as any)?.name || 'Uncategorized',
            service.price,
            service.businessVolume,
            service.status,
            service.isFeatured || false,
            service.description || ''
          ].join('\t'))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="services.xls"`);
        return res.send(excelCsv);
      } else {
        return res.json({ services });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // SERVICE APPROVAL
  // ============================================================================
  
  app.get("/api/admin/services/pending", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string)?.trim();

      const matchQuery: Record<string, unknown> = { status: { $in: ["draft", "pending", "pending_approval"] } };

      if (search) {
        const User = mongoose.model("User");
        const Category = mongoose.model("Category");
        const sellerIds = await User.find({
          $or: [
            { name: new RegExp(search, "i") },
            { fullName: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
            { mobile: new RegExp(search, "i") },
          ],
        }).distinct("_id");
        const categoryIds = await Category.find({
          $or: [{ name: new RegExp(search, "i") }, { code: new RegExp(search, "i") }],
        }).distinct("_id");
        const orConditions: Record<string, unknown>[] = [
          { name: new RegExp(search, "i") },
          { slug: new RegExp(search, "i") },
          { description: new RegExp(search, "i") },
          { shortDescription: new RegExp(search, "i") },
        ];
        if (sellerIds.length) orConditions.push({ sellerId: { $in: sellerIds } });
        if (categoryIds.length) orConditions.push({ categoryId: { $in: categoryIds } });
        matchQuery.$or = orConditions;
      }

      const services = await ServiceModel.find(matchQuery)
        .populate("sellerId", "name email fullName mobile")
        .populate("categoryId", "name code")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await ServiceModel.countDocuments(matchQuery);

      return res.json({
        services,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/services/:id/approve", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const ctx = await requireAuth(req);

      const service = await ServiceModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: "active", // Approved services become active so they show on public page
            approvedAt: new Date(),
            approvedBy: ctx.userId
          }
        },
        { new: true, runValidators: true }
      ).populate("categoryId", "name code");

      if (!service) return res.status(404).json({ error: "Service not found" });

      return res.json({ message: "Service approved successfully", service });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/services/:id/reject", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      const body = z.object({
        reason: z.string().min(1, "Rejection reason is required")
      }).parse(req.body);

      await connectToDatabase();

      const ctx = await requireAuth(req);

      const service = await ServiceModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            rejectedBy: ctx.userId,
            rejectionReason: body.reason
          }
        },
        { new: true, runValidators: true }
      ).populate("categoryId", "name code");

      if (!service) return res.status(404).json({ error: "Service not found" });

      return res.json({ message: "Service rejected successfully", service });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // CONTACT MANAGEMENT
  // ============================================================================
  
  app.get("/api/admin/contacts", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const contacts = await ContactModel.find({})
        .sort({ createdAt: -1 })
        .limit(50);

      return res.json({ contacts });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/contacts/:id", async (req, res) => {
    const schema = z.object({
      status: z.enum(["pending", "read", "replied"]),
    });

    try {
      await requireAdminRole(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const contact = await ContactModel.findByIdAndUpdate(
        req.params.id, 
        { status: body.status }, 
        { new: true }
      );
      
      if (!contact) return res.status(404).json({ error: "Not found" });
      return res.json({ contact });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // SLIDER MANAGEMENT
  // ============================================================================
  
  app.get("/api/admin/sliders", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();
      const sliders = await Slider.find()
        .sort({ order: 1 })
        .lean();
      return res.json({ sliders });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  const sliderCreateSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1),
    order: z.number().int().min(0),
    isActive: z.boolean().default(true)
  });

  app.post("/api/admin/sliders", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      const body = sliderCreateSchema.parse(req.body);
      await connectToDatabase();

      const slider = new Slider(body);
      await slider.save();
      return res.json({ slider });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  const sliderUpdateSchema = z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1).optional(),
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  });

  app.put("/api/admin/sliders/reorder", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      const reorderSchema = z.object({
        sliders: z.array(z.object({
          id: z.string().min(1),
          order: z.number().int().min(0)
        }))
      });
      const body = reorderSchema.parse(req.body);
      await connectToDatabase();

      const bulkOps = body.sliders.map(({ id, order }) => ({
        updateOne: {
          filter: { _id: id },
          update: { order }
        }
      }));

      await Slider.bulkWrite(bulkOps);
      return res.json({ message: "Sliders reordered successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/sliders/:id", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      const body = sliderUpdateSchema.parse(req.body);
      await connectToDatabase();

      const slider = await Slider.findByIdAndUpdate(
        req.params.id,
        { $set: body },
        { new: true, runValidators: true }
      );

      if (!slider) return res.status(404).json({ error: "Slider not found" });
      return res.json({ slider });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.delete("/api/admin/sliders/:id", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const slider = await Slider.findByIdAndDelete(req.params.id);
      if (!slider) return res.status(404).json({ error: "Slider not found" });
      
      return res.json({ message: "Slider deleted successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // CATEGORY MANAGEMENT
  // ============================================================================

  app.get("/api/admin/categories", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();
      const showInactive = req.query.showInactive !== "false";
      const filter = showInactive ? {} : { isActive: true };
      const categories = await CategoryModel.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
      return res.json(categories);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/admin/categories", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100),
        code: z.string().min(1).max(10),
        icon: z.string().optional(),
        image: z.string().optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().min(0).default(0)
      }).parse(req.body);

      await connectToDatabase();

      const category = new CategoryModel(body);
      await category.save();

      return res.status(201).json({ message: "Category created successfully", category });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/categories/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(100).optional(),
        code: z.string().min(1).max(10).optional(),
        icon: z.string().optional(),
        image: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().min(0).optional()
      }).parse(req.body);

      await connectToDatabase();

      const category = await CategoryModel.findByIdAndUpdate(
        req.params.id,
        { $set: body },
        { new: true, runValidators: true }
      );

      if (!category) return res.status(404).json({ error: "Category not found" });

      return res.json({ message: "Category updated successfully", category });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.delete("/api/admin/categories/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      await connectToDatabase();

      const category = await CategoryModel.findByIdAndDelete(req.params.id);
      if (!category) return res.status(404).json({ error: "Category not found" });

      return res.json({ message: "Category deleted successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Bulk Category Import
  app.post("/api/admin/categories/bulk-upload", importUpload.single("file"), async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      const fs = await import("node:fs").then(m => m.promises);
      const fileBuffer = await fs.readFile(req.file.path);

      const result = await processBulkCategoryUpload(fileBuffer, req.file.originalname, CategoryModel);

      await fs.unlink(req.file.path).catch(() => {});

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Import failed with ${result.errors.length} error(s)`,
          totalRows: result.totalRows,
          successfulInserts: result.successfulInserts,
          errors: result.errors.slice(0, 10),
          warnings: result.warnings,
          summary: result.summary,
        });
      }

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${result.successfulInserts} categories`,
        totalRows: result.totalRows,
        successfulInserts: result.successfulInserts,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/categories/template/download", async (req, res) => {
    try {
      await requireAdminRole(req);

      const template = generateCategoryImportTemplate();

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="category-import-template.xlsx"');
      res.send(template);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // SUBCATEGORY MANAGEMENT
  // ============================================================================
  
  app.post("/api/admin/subcategories", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100),
        code: z.string().min(1).max(10),
        categoryId: z.string(),
        icon: z.string().optional(),
        image: z.string().optional(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().min(0).default(0)
      }).parse(req.body);

      await connectToDatabase();

      const subcategory = new SubcategoryModel(body);
      await subcategory.save();

      return res.status(201).json({ message: "Subcategory created successfully", subcategory });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.get("/api/admin/subcategories", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const categoryId = req.query.categoryId as string;
      const query: any = {};
      if (categoryId) query.categoryId = categoryId;

      const subcategories = await SubcategoryModel.find(query)
        .populate("categoryId", "name code")
        .sort({ sortOrder: 1, name: 1 });

      return res.json({ subcategories });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/subcategories/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(100).optional(),
        code: z.string().min(1).max(10).optional(),
        categoryId: z.string().optional(),
        icon: z.string().optional(),
        image: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().min(0).optional()
      }).parse(req.body);

      await connectToDatabase();

      const subcategory = await SubcategoryModel.findByIdAndUpdate(
        req.params.id,
        { $set: body },
        { new: true, runValidators: true }
      ).populate("categoryId", "name code");

      if (!subcategory) return res.status(404).json({ error: "Subcategory not found" });

      return res.json({ message: "Subcategory updated successfully", subcategory });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.delete("/api/admin/subcategories/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      await connectToDatabase();

      const subcategory = await SubcategoryModel.findByIdAndDelete(req.params.id);
      if (!subcategory) return res.status(404).json({ error: "Subcategory not found" });

      return res.json({ message: "Subcategory deleted successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // DISTRIBUTION RULES
  // ============================================================================
  
  app.get("/api/admin/rules", async (req, res) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const activeRule = await DistributionRuleModel.findOne({ isActive: true }).sort({ createdAt: -1 });
      const recentRules = await DistributionRuleModel.find({}).sort({ createdAt: -1 }).limit(10);

      return res.json({ activeRule, recentRules });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/admin/rules", async (req, res) => {
    const schema = z.object({
      basePercentage: z
        .number()
        .min(0)
        .transform((v) => (v > 1 ? v / 100 : v))
        .refine((v) => v >= 0 && v <= 1, "basePercentage must be between 0 and 1"),
      decayEnabled: z.boolean(),
      isActive: z.boolean().optional(),
    });

    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const body = schema.parse(req.body);
      const isActive = body.isActive ?? true;
      if (isActive) await DistributionRuleModel.updateMany({ isActive: true }, { $set: { isActive: false } });

      const rule = await DistributionRuleModel.create({
        basePercentage: body.basePercentage,
        decayEnabled: body.decayEnabled,
        isActive,
      });

      return res.status(201).json({ rule });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/rules/:id", async (req, res) => {
    const schema = z
      .object({
        basePercentage: z
          .number()
          .min(0)
          .optional()
          .transform((v) => {
            if (v == null) return v;
            return v > 1 ? v / 100 : v;
          })
          .refine((v) => v == null || (v >= 0 && v <= 1), "basePercentage must be between 0 and 1"),
        decayEnabled: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const body = schema.parse(req.body);
      if (body.isActive === true) await DistributionRuleModel.updateMany({ isActive: true }, { $set: { isActive: false } });

      const rule = await DistributionRuleModel.findByIdAndUpdate(req.params.id, body, { new: true });
      if (!rule) return res.status(404).json({ error: "Not found" });

      return res.json({ rule });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // PAYMENT SETTINGS
  // ============================================================================
  
  app.get("/api/admin/payment-settings", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      await connectToDatabase();

      const adminUser = await UserModel.findOne({ role: { $in: ["admin", "super_admin"] } })
        .select("paymentLinkEnabled upiLink");

      const settings = {
        paymentLinkEnabled: adminUser?.paymentLinkEnabled || false,
        upiLink: adminUser?.upiLink || ""
      };

      return res.json(settings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/payment-settings", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        paymentLinkEnabled: z.boolean(),
        upiLink: z.string().optional()
      }).parse(req.body);

      await connectToDatabase();

      const updated = await UserModel.updateMany(
        { role: { $in: ["admin", "super_admin"] } },
        { $set: body }
      );

      return res.json({ message: "Payment settings updated successfully", updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // ============================================================================
  // KYC MANAGEMENT
  // ============================================================================
  
  app.get("/api/admin/kyc/pending", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const page = Number.parseInt(req.query.page as string) || 1;
      const limit = Number.parseInt(req.query.limit as string) || 10;

      const users = await UserModel.find({ kycStatus: "submitted" })
        .select("-passwordHash")
        .sort({ kycSubmittedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await UserModel.countDocuments({ kycStatus: "submitted" });

      return res.json({
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/kyc/:id/approve", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            kycStatus: "verified",
            kycVerifiedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).select("-passwordHash");

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "KYC approved successfully", user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/kyc/:id/reject", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      const body = z.object({
        reason: z.string().min(1, "Rejection reason is required")
      }).parse(req.body);

      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            kycStatus: "rejected",
            kycRejectedAt: new Date(),
            kycRejectionReason: body.reason
          }
        },
        { new: true, runValidators: true }
      ).select("-passwordHash");

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "KYC rejected successfully", user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });
}

