import type { Express, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { signAuthToken, verifyAuthToken } from "@/lib/jwt";
import { hashPassword, verifyPassword } from "@/lib/password";
import { generateUniqueReferralCode } from "@/lib/referral";
import { findBinaryPlacement } from "@/lib/binaryPlacement";
import { distributeBusinessVolumeWithSession } from "@/lib/bvDistribution";
import { buildReferralTree } from "@/lib/referralTree";
import { getBusinessOpportunityEmailContent } from "@/lib/businessOpportunity";
import { sendEmail } from "@/lib/email";
import { upload, getFileUrl, importUpload } from "@/lib/upload";
import { processBulkServiceUpload, generateServiceImportTemplate } from "@/lib/bulkServiceImport";
import { processBulkCategoryUpload, generateCategoryImportTemplate } from "@/lib/bulkCategoryImport";
import path from "path";
import express from "express";

import { UserModel, type UserRole } from "@/models/User";
import { ServiceModel } from "@/models/Service";
import { CategoryModel } from "@/models/Category";
import { PurchaseModel } from "@/models/Purchase";
import { IncomeModel } from "@/models/Income";
import { DistributionRuleModel } from "@/models/DistributionRule";
import { IncomeLogModel } from "@/models/IncomeLog";
import { ContactModel } from "@/models/Contact";
import { Slider } from "@/models/Slider";
import { SubcategoryModel } from "@/models/Subcategory";
import { AnalyticsModel } from "@/models/Analytics";

type AuthContext = { userId: string; role: UserRole; email: string };

function getTokenFromReq(req: Request) {
  const cookieToken = (req.cookies?.token as string | undefined) ?? undefined;
  const header = req.header("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7) : undefined;
  return cookieToken ?? bearer;
}

async function requireAuth(req: Request): Promise<AuthContext> {
  const token = getTokenFromReq(req);
  if (!token) throw new Error("Unauthorized");

  const payload = await verifyAuthToken(token);
  const role = payload.role as UserRole;
  const email = payload.email as string;

  if (!payload.sub || !role || !email) throw new Error("Unauthorized");
  
  // Verify user still exists and is active
  await connectToDatabase();
  const user = await UserModel.findById(payload.sub).select("status sessionExpiresAt activityStatus").lean();
  
  if (!user) throw new Error("Unauthorized");
  if (user.status === "deleted") throw new Error("Account has been deleted");
  if (user.status === "suspended") throw new Error("Account has been suspended by administrator");
  if (user.sessionExpiresAt && new Date(user.sessionExpiresAt) < new Date()) {
    // Update activity status to inactive on session expiration
    await UserModel.findByIdAndUpdate(payload.sub, { 
      activityStatus: "inactive",
      lastLogoutAt: new Date()
    });
    throw new Error("Session has expired");
  }
  
  return { userId: payload.sub, role, email };
}

async function requireRole(req: Request, role: UserRole): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (ctx.role !== role) throw new Error("Forbidden");
  return ctx;
}

async function requireAdminRole(req: Request): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (!["super_admin", "admin", "moderator"].includes(ctx.role)) throw new Error("Forbidden");
  return ctx;
}

async function requireSuperAdminOrAdmin(req: Request): Promise<AuthContext> {
  const ctx = await requireAuth(req);
  if (!["super_admin", "admin"].includes(ctx.role)) throw new Error("Forbidden");
  return ctx;
}

function setAuthCookie(res: Response, token: string) {
  const isProduction = env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax", // 'none' required for cross-domain cookies
    secure: isProduction, // Must be true when sameSite is 'none'
    path: "/",
    maxAge: 60 * 60 * 24 * 7 * 1000,
    // No domain specified - allows cookie to work on any domain
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie("token", { path: "/" });
}

const DUMMY_PASSWORD_HASH = "$2b$12$npwxPAElS4BfdU.iS5LIFuqi0v31VhieuIsoP1t9cMORH152MK/3i";

export function registerRoutes(app: Express) {
  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Auth
  app.post("/api/auth/register", async (req, res) => {
    const schema = z.object({
      mobile: z.string().min(10).max(15),
      countryCode: z.string().default("+91"),
      name: z.string().min(1),
      email: z.string().email().optional(),
      password: z.string().min(8),
      acceptedTerms: z.literal(true),
      referralCode: z
        .string()
        .optional()
        .transform((v) => (typeof v === "string" ? v.trim() : v))
        .transform((v) => (v ? v : undefined)),
      fullName: z.string().min(1),
    });

    try {
      const body = schema.parse(req.body);
      await connectToDatabase();

      // Check if mobile already exists
      const existingMobile = await UserModel.findOne({ mobile: body.mobile }).select("_id");
      if (existingMobile) return res.status(409).json({ error: "Mobile number already in use" });

      // Check if email already exists (if provided)
      if (body.email) {
        const existingEmail = await UserModel.findOne({ email: body.email.toLowerCase() }).select("_id");
        if (existingEmail) return res.status(409).json({ error: "Email already in use" });
      }

      let parentId: mongoose.Types.ObjectId | null = null;
      let position: "left" | "right" | null = null;

      if (body.referralCode) {
        const sponsor = await UserModel.findOne({ referralCode: body.referralCode }).select("_id");
        if (!sponsor) return res.status(400).json({ error: "Invalid referral code" });

        const placement = await findBinaryPlacement({ sponsorId: sponsor._id });
        parentId = placement.parentId;
        position = placement.position;
      }

      const passwordHash = await hashPassword(body.password);
      const referralCode = await generateUniqueReferralCode();

      const user = await UserModel.create({
        mobile: body.mobile,
        countryCode: body.countryCode,
        name: body.name,
        fullName: body.fullName,
        email: body.email?.toLowerCase(),
        passwordHash,
        role: "user",
        referralCode,
        parent: parentId,
        position,
      });

      // Non-blocking email - don't wait for it to complete
      if (body.email) {
        setTimeout(async () => {
          try {
            const content = getBusinessOpportunityEmailContent();
            if (user.email) {
              await sendEmail({ to: user.email, subject: content.subject, text: content.text });
            }
          } catch (err) {
            console.error("Failed to send welcome email:", err);
          }
        }, 0);
      }

      return res.status(201).json({ 
        message: "Registration successful",
        user: {
          _id: user._id,
          mobile: user.mobile,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          referralCode: user.referralCode,
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(400).json({ error: msg });
    }
  });

  // Login

  app.post("/api/auth/login", async (req, res) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

    try {
      const body = schema.parse(req.body);
      await connectToDatabase();

      const user = await UserModel.findOne({ email: body.email.toLowerCase() });
      if (!user) {
        await verifyPassword(body.password, DUMMY_PASSWORD_HASH);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check account status before verifying password
      if (user.status === "deleted") {
        return res.status(403).json({ error: "Account has been deleted" });
      }
      if (user.status === "suspended") {
        return res.status(403).json({ error: "Account has been suspended by administrator" });
      }
      if (user.sessionExpiresAt && new Date(user.sessionExpiresAt) < new Date()) {
        return res.status(403).json({ error: "Account session has expired" });
      }

      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      // Update user activity status to active on successful login
      await UserModel.findByIdAndUpdate(user._id, { 
        activityStatus: "active",
        lastLoginAt: new Date()
      });

      const token = await signAuthToken({ sub: user._id.toString(), role: user.role, ...(user.email && { email: user.email }) });
      setAuthCookie(res, token);

      return res.json({
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          parentUserId: user.parent?.toString() ?? null,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(400).json({ error: msg });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      await connectToDatabase();

      // Update user activity status to inactive on logout
      await UserModel.findByIdAndUpdate(ctx.userId, { 
        activityStatus: "inactive",
        lastLogoutAt: new Date()
      });

      clearAuthCookie(res);
      res.json({ ok: true });
    } catch (err: unknown) {
      // Even if auth fails, clear the cookie
      clearAuthCookie(res);
      const msg = err instanceof Error ? err.message : "Logout failed";
      return res.status(400).json({ error: msg });
    }
  });

  // Me
  app.get("/api/me", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      await connectToDatabase();

      const user = await UserModel.findById(ctx.userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      return res.json({
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          profileImage: user.profileImage,
          parentUserId: user.parent?.toString() ?? null,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Profile Management - Get full profile
  app.get("/api/profile", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      await connectToDatabase();

      const user = await UserModel.findById(ctx.userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      return res.json({
        user: {
          id: user._id.toString(),
          mobile: user.mobile,
          countryCode: user.countryCode,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isBlocked: user.isBlocked,
          referralCode: user.referralCode,
          
          // Business Settings
          businessName: user.businessName,
          companyPhone: user.companyPhone,
          companyEmail: user.companyEmail,
          website: user.website,
          billingAddress: user.billingAddress,
          state: user.state,
          pincode: user.pincode,
          city: user.city,
          language: user.language,
          businessType: user.businessType,
          industryType: user.industryType,
          businessDescription: user.businessDescription,
          gstin: user.gstin,
          panNumber: user.panNumber,
          isGSTRegistered: user.isGSTRegistered,
          enableEInvoicing: user.enableEInvoicing,
          enableTDS: user.enableTDS,
          enableTCS: user.enableTCS,
          businessLogo: user.businessLogo,
          profileImage: user.profileImage,
          signature: user.signature,
          currencyCode: user.currencyCode,
          currencySymbol: user.currencySymbol,
          
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Profile Management - Update Basic Info (Signup fields)
  app.put("/api/profile/basic", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
    }).refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      const ctx = await requireAuth(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      // Check if email already exists (if updating email)
      if (body.email) {
        const existingEmail = await UserModel.findOne({ 
          email: body.email.toLowerCase(),
          _id: { $ne: ctx.userId }
        }).select("_id");
        if (existingEmail) return res.status(409).json({ error: "Email already in use" });
      }

      const updateData: any = {};
      if (body.name) updateData.name = body.name;
      if (body.email) updateData.email = body.email.toLowerCase();

      const user = await UserModel.findByIdAndUpdate(
        ctx.userId, 
        updateData, 
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ 
        message: "Basic profile updated successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Profile Management - Update Business Settings
  app.put("/api/profile/business", async (req, res) => {
    const schema = z.object({
      businessName: z.string().optional(),
      companyPhone: z.string().optional(),
      companyEmail: z.string().email().optional(),
      website: z.string().url().optional(),
      billingAddress: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      city: z.string().optional(),
      language: z.string().optional(),
      businessType: z.string().optional(),
      industryType: z.string().optional(),
      businessDescription: z.string().optional(),
      gstin: z.string().optional(),
      panNumber: z.string().optional(),
      isGSTRegistered: z.boolean().optional(),
      enableEInvoicing: z.boolean().optional(),
      enableTDS: z.boolean().optional(),
      enableTCS: z.boolean().optional(),
      businessLogo: z.string().url().optional(),
      signature: z.string().optional(),
      currencyCode: z.string().optional(),
      currencySymbol: z.string().optional(),
    }).refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      const ctx = await requireAuth(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        ctx.userId, 
        body, 
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ 
        message: "Business settings updated successfully",
        user: {
          id: user._id.toString(),
          businessName: user.businessName,
          companyPhone: user.companyPhone,
          companyEmail: user.companyEmail,
          website: user.website,
          billingAddress: user.billingAddress,
          state: user.state,
          pincode: user.pincode,
          city: user.city,
          language: user.language,
          businessType: user.businessType,
          industryType: user.industryType,
          businessDescription: user.businessDescription,
          gstin: user.gstin,
          panNumber: user.panNumber,
          isGSTRegistered: user.isGSTRegistered,
          enableEInvoicing: user.enableEInvoicing,
          enableTDS: user.enableTDS,
          enableTCS: user.enableTCS,
          businessLogo: user.businessLogo,
          signature: user.signature,
          currencyCode: user.currencyCode,
          currencySymbol: user.currencySymbol,
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Profile Image Upload
  app.post("/api/upload/profile-image", upload.single("image"), async (req, res) => {
    try {
      console.log('Profile image upload request received');
      console.log('Request headers:', req.headers);
      console.log('Request body:', req.body);
      
      const ctx = await requireAuth(req);
      await connectToDatabase();

      console.log('User authenticated:', ctx.userId);

      if (!req.file) {
        console.log('No file provided in request. Files:', req.files);
        return res.status(400).json({ error: "No image provided" });
      }

      console.log('File received:', {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });

      // Get the file URL
      const imageUrl = getFileUrl(req.file.filename);
      console.log('Generated image URL:', imageUrl);

      // Update user's profileImage field
      const user = await UserModel.findByIdAndUpdate(
        ctx.userId,
        { profileImage: imageUrl },
        { new: true }
      );

      if (!user) {
        console.log('User not found:', ctx.userId);
        return res.status(404).json({ error: "User not found" });
      }

      console.log('Profile image updated successfully for user:', ctx.userId, 'Image URL:', user.profileImage);

      return res.json({ 
        message: "Profile image uploaded successfully",
        imageUrl: user.profileImage,
        success: true
      });
    } catch (err: unknown) {
      console.error('Profile image upload error:', err);
      
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Unauthorized" ? 401 : 400;
      
      // Ensure we always return JSON
      return res.status(status).json({ error: msg, success: false });
    }
  });

  // Public services
  app.get("/api/services", async (_req, res) => {
    try {
      await connectToDatabase();
      const services = await ServiceModel.find({ status: "active" }).sort({ createdAt: -1 }).lean();
      
      // Ensure all services have required fields for frontend compatibility
      const processedServices = services.map(service => ({
        _id: service._id?.toString() || '',
        name: service.name || '',
        slug: service.slug || service.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '',
        image: service.image || '/images/default-service.jpg', // Provide default image if missing
        price: service.price || 0,
        businessVolume: service.businessVolume || 0,
        status: service.status || 'active',
        // Include other optional fields if they exist
        ...(service.originalPrice && { originalPrice: service.originalPrice }),
        ...(service.currency && { currency: service.currency }),
        ...(service.discountPercent && { discountPercent: service.discountPercent }),
        ...(service.shortDescription && { shortDescription: service.shortDescription }),
        ...(service.description && { description: service.description }),
        ...(service.isFeatured !== undefined && { isFeatured: service.isFeatured }),
        ...(service.categoryId && { categoryId: service.categoryId }),
        ...(service.tags && { tags: service.tags }),
        ...(service.rating && { rating: service.rating }),
        ...(service.reviewCount && { reviewCount: service.reviewCount }),
        ...(service.gallery && { gallery: service.gallery }),
      }));
      
      res.json({ services: processedServices });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ error: msg, services: [] });
    }
  });

  // Purchases
  app.get("/api/purchases", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      await connectToDatabase();

      const purchases = await PurchaseModel.find({ user: ctx.userId }).populate("service").sort({ createdAt: -1 }).limit(50);
      return res.json({ purchases });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.post("/api/purchases", async (req, res) => {
    const schema = z.object({ serviceId: z.string().min(1) });

    try {
      const ctx = await requireAuth(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const session = await mongoose.startSession();
      try {
        const result = await session.withTransaction(async () => {
          const [purchase] = await PurchaseModel.create(
            [
              {
                user: new mongoose.Types.ObjectId(ctx.userId),
                service: new mongoose.Types.ObjectId(body.serviceId),
                bv: 0,
              },
            ],
            { session }
          );

          const distribution = await distributeBusinessVolumeWithSession({
            userId: ctx.userId,
            serviceId: body.serviceId,
            purchaseId: purchase._id.toString(),
            session,
          });

          await PurchaseModel.updateOne({ _id: purchase._id }, { $set: { bv: distribution.bv } }, { session });

          return {
            purchaseId: purchase._id.toString(),
            bv: distribution.bv,
            logsCreated: distribution.logsCreated,
            levelsPaid: distribution.levelsPaid,
          };
        });

        return res.status(201).json({ ok: true, ...result });
      } finally {
        session.endSession();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Income
  app.get("/api/income", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      await connectToDatabase();

      const incomes = await IncomeModel.find({ toUser: ctx.userId })
        .populate("fromUser", "email referralCode")
        .populate("purchase")
        .sort({ createdAt: -1 })
        .limit(100);

      return res.json({ incomes });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Referrals
  app.get("/api/referrals", async (req, res) => {
    try {
      const ctx = await requireAuth(req);
      const depthParam = Number(req.query.depth ?? "3");
      const maxDepth = Math.min(Math.max(depthParam, 1), 10);

      const tree = await buildReferralTree({ rootUserId: ctx.userId, depth: maxDepth });
      return res.json({ tree, maxDepth });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const status = msg === "Unauthorized" ? 401 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Business opportunity request
  app.post("/api/business-opportunity/request", async (req, res) => {
    const schema = z.object({ email: z.string().email() });

    try {
      const body = schema.parse(req.body);
      const content = getBusinessOpportunityEmailContent();
      const result = await sendEmail({ 
        to: body.email, 
        subject: content.subject, 
        text: content.text,
        html: content.html 
      });
      
      if (!result.sent) {
        return res.status(500).json({ error: result.error || "Failed to send email" });
      }
      
      return res.json({ ok: true, emailed: result.sent });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(400).json({ error: msg });
    }
  });

  // Admin setup
  app.post("/api/admin/setup", async (req, res) => {
    const schema = z.object({
      secret: z.string().min(1),
      name: z.string().min(1).optional(),
      email: z.string().email(),
      password: z.string().min(8),
    });

    try {
      const body = schema.parse(req.body);

      if (!env.ADMIN_SETUP_SECRET) return res.status(500).json({ error: "ADMIN_SETUP_SECRET not configured" });
      if (body.secret !== env.ADMIN_SETUP_SECRET) return res.status(403).json({ error: "Forbidden" });

      await connectToDatabase();

      const existingAdmin = await UserModel.exists({ role: "admin" });
      if (existingAdmin) return res.status(409).json({ error: "Admin already exists" });

      const existingEmail = await UserModel.exists({ email: body.email.toLowerCase() });
      if (existingEmail) return res.status(409).json({ error: "Email already in use" });

      const passwordHash = await hashPassword(body.password);
      const referralCode = await generateUniqueReferralCode();

      const admin = await UserModel.create({
        name: body.name ?? "Admin",
        email: body.email,
        passwordHash,
        role: "admin",
        referralCode,
        parent: null,
        position: null,
      });

      return res.json({
        admin: {
          id: admin._id.toString(),
          email: admin.email,
          role: admin.role,
          referralCode: admin.referralCode,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(400).json({ error: msg });
    }
  });

  // Admin services
  app.get("/api/admin/services", async (req, res) => {
    try {
      await requireRole(req, "admin");
      await connectToDatabase();
      const services = await ServiceModel.find({}).sort({ createdAt: -1 });
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
      image: z.string().url().optional(),
      gallery: z.array(z.string().url()).optional(),
      price: z.number().finite().min(0),
      originalPrice: z.number().finite().min(0).optional(),
      currency: z.enum(["INR", "USD"]).default("INR"),
      discountPercent: z.number().min(0).max(100).optional(),
      businessVolume: z.number().finite().min(0),
      shortDescription: z.string().max(200).optional(),
      description: z.string().optional(),
      status: z.enum(["active", "inactive", "out_of_stock"]).default("active"),
      isFeatured: z.boolean().default(false),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    try {
      await requireRole(req, "admin");
      const body = schema.parse(req.body);
      await connectToDatabase();

      // Auto-generate slug if not provided
      const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      
      // Use default image if not provided
      const image = body.image || '/images/default-service.jpg';

      // Check for duplicate slug
      const existingService = await ServiceModel.findOne({ slug });
      if (existingService) {
        return res.status(400).json({ error: `Service with slug "${slug}" already exists` });
      }

      const service = await ServiceModel.create({
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
        status: body.status,
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
        image: z.string().url().optional(),
        gallery: z.array(z.string().url()).optional(),
        price: z.number().finite().min(0).optional(),
        originalPrice: z.number().finite().min(0).optional(),
        currency: z.enum(["INR", "USD"]).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
        businessVolume: z.number().finite().min(0).optional(),
        shortDescription: z.string().max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["active", "inactive", "out_of_stock"]).optional(),
        isFeatured: z.boolean().optional(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      await requireRole(req, "admin");
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

  // Public categories endpoint
  app.get("/api/categories", async (req, res) => {
    try {
      await connectToDatabase();

      const categories = await CategoryModel.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .select('_id name slug code icon image isActive sortOrder')
        .lean();

      const processedCategories = categories.map(cat => ({
        _id: cat._id?.toString() || '',
        name: cat.name || '',
        slug: cat.slug || '',
        code: cat.code || '',
        icon: cat.icon,
        image: cat.image,
        isActive: cat.isActive !== false,
        sortOrder: cat.sortOrder || 0,
      }));

      return res.json({ categories: processedCategories });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      return res.status(500).json({ error: msg, categories: [] });
    }
  });

  // Bulk Service Import from Excel/CSV
  app.post("/api/admin/services/bulk-upload", importUpload.single("file"), async (req, res) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Read file buffer
      const fs = await import("fs").then(m => m.promises);
      const fileBuffer = await fs.readFile(req.file.path);

      // Process bulk upload
      const result = await processBulkServiceUpload(fileBuffer, req.file.originalname, ServiceModel);

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {}); // Ignore errors if file doesn't exist

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Import failed with ${result.errors.length} error(s)`,
          totalRows: result.totalRows,
          successfulInserts: result.successfulInserts,
          errors: result.errors.slice(0, 10), // Return first 10 errors
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

  // Download Service Import Template
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

  // Old bulk endpoint (for backward compatibility - remove in future)
  app.post("/api/admin/services/bulk", async (req, res) => {
    try {
      await requireRole(req, "admin");
      await connectToDatabase();

      const { services, format } = req.body;

      if (!services || !Array.isArray(services)) {
        return res.status(400).json({ error: "Services array is required" });
      }

      if (!format || !['json', 'excel', 'csv'].includes(format)) {
        return res.status(400).json({ error: "Format must be json, excel, or csv" });
      }

      // Process services and ensure they have proper category references
      const processedServices = services.map(service => ({
        ...service,
        // Auto-generate slug if not provided
        slug: service.slug || service.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        // Set default values
        status: service.status || "active",
        currency: service.currency || "INR",
        isActive: service.isActive !== undefined ? service.isActive : true,
        // Validate category exists if provided
        categoryId: service.categoryId || null,
      }));

      // Bulk insert with category sorting
      const result = await ServiceModel.insertMany(processedServices);

      // Group by category for organized storage
      const categoryGroups = processedServices.reduce((acc, service) => {
        const categoryId = service.categoryId || 'uncategorized';
        if (!acc[categoryId]) acc[categoryId] = [];
        acc[categoryId].push(service);
        return acc;
      }, {} as Record<string, any[]>);

      // Update categories with service counts
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

  // Get services by category with sorting
  app.get("/api/admin/services/by-category", async (req, res) => {
    try {
      await requireRole(req, "admin");
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

  // Export services in different formats
  app.get("/api/admin/services/export", async (req, res) => {
    try {
      await requireRole(req, "admin");
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
        // CSV Export
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
            `"${(service.description || '').replace(/"/g, '""')}"`
          ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="services.csv"`);
        return res.send(csv);
      } else if (format === 'excel') {
        // Excel Export (simplified CSV format that Excel can open)
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
        // JSON Export
        return res.json({ services });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Admin rules (DistributionRule)
  app.get("/api/admin/rules", async (req, res) => {
    try {
      await requireRole(req, "admin");
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
        .finite()
        .min(0)
        .transform((v) => (v > 1 ? v / 100 : v))
        .refine((v) => v >= 0 && v <= 1, "basePercentage must be between 0 and 1"),
      decayEnabled: z.boolean(),
      isActive: z.boolean().optional(),
    });

    try {
      await requireRole(req, "admin");
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
          .finite()
          .min(0)
          .optional()
          .transform((v) => (v == null ? v : v > 1 ? v / 100 : v))
          .refine((v) => v == null || (v >= 0 && v <= 1), "basePercentage must be between 0 and 1"),
        decayEnabled: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      await requireRole(req, "admin");
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

  // Admin dashboard
  app.get("/api/admin/dashboard", async (req, res) => {
    try {
      await requireRole(req, "admin");
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

  // Contact form
  app.post("/api/contact", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      subject: z.string().min(1),
      message: z.string().min(10),
    });

    try {
      const body = schema.parse(req.body);
      await connectToDatabase();

      // Save to database
      const contact = await ContactModel.create({
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
      });

      // Send email notification to admin
      const adminEmailContent = {
        subject: `New Contact Form Submission: ${body.subject}`,
        text: `You have received a new contact form submission:

Name: ${body.name}
Email: ${body.email}
Subject: ${body.subject}
Message: ${body.message}

Submitted at: ${new Date().toLocaleString()}

This message has been saved to the database with ID: ${contact._id}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${body.name}</p>
          <p><strong>Email:</strong> ${body.email}</p>
          <p><strong>Subject:</strong> ${body.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${body.message.replace(/\n/g, '<br>')}</p>
          <p><strong>Submitted at:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Database ID:</strong> ${contact._id}</p>
        `
      };

      // Send email asynchronously - don't wait for it
      setTimeout(async () => {
        try {
          await sendEmail({
            to: "refergrow.official@gmail.com",
            subject: adminEmailContent.subject,
            text: adminEmailContent.text,
            html: adminEmailContent.html
          });
        } catch (emailError) {
          console.error("Failed to send contact notification email:", emailError);
        }
      }, 0);

      return res.status(200).json({ 
        message: "Thank you for your message! We'll get back to you soon.",
        received: {
          name: body.name,
          email: body.email,
          subject: body.subject,
          message: body.message,
          timestamp: new Date().toISOString(),
          id: contact._id
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      return res.status(400).json({ error: msg });
    }
  });

  // Admin contact submissions
  app.get("/api/admin/contacts", async (req, res) => {
    try {
      await requireRole(req, "admin");
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
      await requireRole(req, "admin");
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

  // === SLIDER MANAGEMENT ROUTES ===

  // Public route to get active slider images
  app.get("/api/sliders", async (req: Request, res: Response) => {
    try {
      await connectToDatabase();
      const sliders = await Slider.find({ isActive: true })
        .sort({ order: 1 })
        .select('title description imageUrl order')
        .lean();
      return res.json({ sliders });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Server error";
      return res.status(500).json({ error: msg });
    }
  });

  // Admin routes for slider management
  app.get("/api/admin/sliders", async (req: Request, res: Response) => {
    try {
      console.log("GET /api/admin/sliders - Starting request");
      await requireRole(req, "admin");
      console.log("GET /api/admin/sliders - Auth passed");
      await connectToDatabase();
      console.log("GET /api/admin/sliders - DB connected");
      const sliders = await Slider.find()
        .sort({ order: 1 })
        .lean();
      console.log("GET /api/admin/sliders - Found sliders:", sliders.length);
      return res.json({ sliders });
    } catch (err: unknown) {
      console.error("GET /api/admin/sliders - Error:", err);
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  });

  const sliderCreateSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    imageUrl: z.string().min(1), // Accept both URLs and base64 data URLs
    order: z.number().int().min(0),
    isActive: z.boolean().default(true)
  });

  app.post("/api/admin/sliders", async (req: Request, res: Response) => {
    try {
      await requireRole(req, "admin");
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
    imageUrl: z.string().min(1).optional(), // Accept both URLs and base64 data URLs
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  });

  // Batch update slider orders
  app.put("/api/admin/sliders/reorder", async (req: Request, res: Response) => {
    try {
      console.log('Reorder request received:', req.body);
      await requireRole(req, "admin");
      const reorderSchema = z.object({
        sliders: z.array(z.object({
          id: z.string(),
          order: z.number().int().min(0)
        }))
      });
      const body = reorderSchema.parse(req.body);
      console.log('Parsed body:', body);
      await connectToDatabase();

      const bulkOps = body.sliders.map(({ id, order }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { order } }
        }
      }));

      await Slider.bulkWrite(bulkOps);
      return res.json({ message: "Sliders reordered successfully" });
    } catch (err: unknown) {
      console.error('Reorder error:', err);
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.put("/api/admin/sliders/:id", async (req: Request, res: Response) => {
    try {
      await requireRole(req, "admin");
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
      await requireRole(req, "admin");
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

  // KYC Submission Route
  app.put("/api/user/kyc", async (req: Request, res: Response) => {
    try {
      const ctx = await requireAuth(req);
      const body = z.object({
        fullName: z.string().min(1),
        fatherName: z.string().optional(),
        address: z.string().min(1),
        dob: z.string().transform(val => new Date(val)),
        occupation: z.string().min(1),
        incomeSlab: z.string().min(1),
        profileImage: z.string().optional(),
        panNumber: z.string().min(10),
        panDocument: z.string().optional(),
        aadhaarNumber: z.string().min(12),
        aadhaarDocument: z.string().optional(),
        bankAccountName: z.string().min(1),
        bankAccountNumber: z.string().min(1),
        bankName: z.string().min(1),
        bankAddress: z.string().min(1),
        bankIfsc: z.string().min(11),
        bankDocument: z.string().optional(),
        nominees: z.array(z.object({
          relation: z.string().min(1),
          name: z.string().min(1),
          dob: z.string().transform(val => new Date(val)),
          mobile: z.string().min(10)
        })).optional()
      }).parse(req.body);

      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        ctx.userId,
        {
          $set: {
            ...body,
            kycStatus: "submitted",
            kycSubmittedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).select("-passwordHash");

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "KYC submitted successfully", user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Admin Analytics Dashboard
  app.get("/api/admin/analytics", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

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

  // User Management Routes
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || "";
      const role = req.query.role as string;
      const status = req.query.status as string;

      const today = new Date();
      const query: any = { status: { $ne: "deleted" } };
      
      // Handle special "new" filter for users created this month
      if (status === "new") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
      } else if (status === "active" || status === "inactive") {
        // Filter by activity status for active/inactive
        query.activityStatus = status;
      } else if (status) {
        // Filter by account status for other values (suspended, etc.)
        query.status = status;
      }
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } }
        ];
      }
      if (role) query.role = role;

      const users = await UserModel.find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("parent", "name email mobile");

      const total = await UserModel.countDocuments(query);

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

  app.post("/api/admin/users", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        name: z.string().min(1),
        email: z.string().email().optional(),
        mobile: z.string().min(10),
        countryCode: z.string().default("+91"),
        password: z.string().min(8),
        role: z.enum(["super_admin", "admin", "moderator", "user"]),
        referralCode: z.string().optional()
      }).parse(req.body);

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
      await requireSuperAdminOrAdmin(req);
      const body = z.object({
        status: z.enum(["active", "suspended", "deleted"])
      }).parse(req.body);

      await connectToDatabase();

      const user = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status: body.status } },
        { new: true, runValidators: true }
      ).select("-passwordHash");

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ message: "User status updated successfully", user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Forbidden" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  app.delete("/api/admin/users/:id", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
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

  // Service Approval Routes
  app.get("/api/admin/services/pending", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const services = await ServiceModel.find({ status: "pending_approval" })
        .populate("categoryId", "name code")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await ServiceModel.countDocuments({ status: "pending_approval" });

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
            status: "approved",
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

  // Bulk Category Import from Excel/CSV
  app.post("/api/admin/categories/bulk-upload", importUpload.single("file"), async (req, res) => {
    try {
      const ctx = await requireAdminRole(req);
      await connectToDatabase();

      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Read file buffer
      const fs = await import("fs").then(m => m.promises);
      const fileBuffer = await fs.readFile(req.file.path);

      // Process bulk upload
      const result = await processBulkCategoryUpload(fileBuffer, req.file.originalname, CategoryModel);

      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {}); // Ignore errors if file doesn't exist

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Import failed with ${result.errors.length} error(s)`,
          totalRows: result.totalRows,
          successfulInserts: result.successfulInserts,
          errors: result.errors.slice(0, 10), // Return first 10 errors
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

  // Download Category Import Template
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

  // Category Management Routes
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

  // Subcategory Management Routes
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

  // Payment Link Management
  app.get("/api/admin/payment-settings", async (req: Request, res: Response) => {
    try {
      await requireSuperAdminOrAdmin(req);
      await connectToDatabase();

      // Get payment settings from the first admin user (or create default settings)
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

  // KYC Management Routes
  app.get("/api/admin/kyc/pending", async (req: Request, res: Response) => {
    try {
      await requireAdminRole(req);
      await connectToDatabase();

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

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

  // Fallback error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: msg });
  });
}
