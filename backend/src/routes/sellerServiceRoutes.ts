import type { Request, Response } from "express";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { requireSeller } from "@/middleware/auth";
import { ServiceModel } from "@/models/Service";

/**
 * Seller service routes
 * - GET /api/seller/services - List own services
 * - POST /api/seller/services - Create service (draft or pending only)
 * - PUT /api/seller/services/:id - Update service (all; approved/active cannot change status)
 */
export function registerSellerServiceRoutes(app: import("express").Express) {
  // List own services
  app.get("/api/seller/services", async (req: Request, res: Response) => {
    try {
      const ctx = await requireSeller(req);
      await connectToDatabase();

      const services = await ServiceModel.find({ sellerId: ctx.userId })
        .sort({ createdAt: -1 })
        .populate("categoryId", "name code")
        .lean();

      return res.json({ services });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Forbidden";
      const status = msg === "Forbidden" || msg === "Seller access required" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Create service (draft or pending only - sellers cannot publish directly)
  app.post("/api/seller/services", async (req: Request, res: Response) => {
    const schema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1).optional(),
      image: z.string().optional(),
      gallery: z.array(z.string()).optional(),
      price: z.number().min(0),
      originalPrice: z.number().min(0).optional(),
      currency: z.enum(["INR", "USD"]).default("INR"),
      discountPercent: z.number().min(0).max(100).optional(),
      businessVolume: z.number().min(0),
      shortDescription: z.string().max(200).optional(),
      description: z.string().optional(),
      status: z.enum(["draft", "pending"]).default("draft"),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });

    try {
      const ctx = await requireSeller(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const slug =
        body.slug ||
        body.name
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replaceAll(/(^-|-$)/g, "");
      const image = body.image || "/images/default-service.jpg";

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
        status: body.status,
        categoryId: body.categoryId,
        tags: body.tags,
      });

      return res.status(201).json({ service });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Seller access required" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });

  // Update service: draft/rejected can change status; approved/active can only update content (no status change)
  app.put("/api/seller/services/:id", async (req: Request, res: Response) => {
    const schema = z
      .object({
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        image: z.string().optional(),
        gallery: z.array(z.string()).optional(),
        price: z.number().min(0).optional(),
        originalPrice: z.number().min(0).optional(),
        currency: z.enum(["INR", "USD"]).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
        businessVolume: z.number().min(0).optional(),
        shortDescription: z.string().max(200).optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "pending"]).optional(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, "No fields to update");

    try {
      const ctx = await requireSeller(req);
      const body = schema.parse(req.body);
      await connectToDatabase();

      const service = await ServiceModel.findById(req.params.id);
      if (!service) return res.status(404).json({ error: "Service not found" });
      if (service.sellerId?.toString() !== ctx.userId) {
        return res.status(403).json({ error: "Not your service" });
      }

      const isApprovedOrActive = ["approved", "active"].includes(service.status);
      const updatePayload = { ...body };
      if (isApprovedOrActive) {
        delete (updatePayload as Record<string, unknown>).status;
      }

      const updated = await ServiceModel.findByIdAndUpdate(
        req.params.id,
        { $set: updatePayload },
        { new: true, runValidators: true }
      )
        .populate("categoryId", "name code")
        .lean();

      return res.json({ service: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const status = msg === "Seller access required" ? 403 : 400;
      return res.status(status).json({ error: msg });
    }
  });
}
