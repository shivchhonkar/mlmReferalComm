import { Router, Request, Response } from "express";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { requireAdminRole } from "@/middleware/auth";
import { UserModel } from "@/models/User";

const router = Router();

// List KYC users by status: submitted, verified, rejected, pending, or all
router.get("/list", async (req: Request, res: Response) => {
  try {
    await requireAdminRole(req);
    await connectToDatabase();

    const page = Number.parseInt(req.query.page as string) || 1;
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 50);
    const status = (req.query.status as string) || "submitted";

    const filter: { kycStatus?: string | { $in: string[] } } = {};
    if (status === "all") {
      filter.kycStatus = { $in: ["pending", "submitted", "verified", "rejected"] };
    } else {
      filter.kycStatus = status;
    }

    const sortField =
      status === "verified" ? "kycVerifiedAt" :
      status === "rejected" ? "kycRejectedAt" :
      status === "pending" ? "createdAt" :
      status === "all" ? "updatedAt" : "kycSubmittedAt";
    const users = await UserModel.find(filter)
      .select("-passwordHash")
      .sort({ [sortField]: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await UserModel.countDocuments(filter);

    return res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status = msg === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

// Get counts for each KYC status (for tabs)
router.get("/counts", async (req: Request, res: Response) => {
  try {
    await requireAdminRole(req);
    await connectToDatabase();

    const [submitted, verified, rejected, pending] = await Promise.all([
      UserModel.countDocuments({ kycStatus: "submitted" }),
      UserModel.countDocuments({ kycStatus: "verified" }),
      UserModel.countDocuments({ kycStatus: "rejected" }),
      UserModel.countDocuments({ kycStatus: "pending" })
    ]);

    return res.json({ submitted, verified, rejected, pending, total: submitted + verified + rejected + pending });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status = msg === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

// Legacy: pending list (submitted for review)
router.get("/pending", async (req: Request, res: Response) => {
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

// Approve KYC
router.put("/:id/approve", async (req: Request, res: Response) => {
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

// Reject KYC
router.put("/:id/reject", async (req: Request, res: Response) => {
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

// Request user to resubmit KYC
router.put("/:id/request-resubmission", async (req: Request, res: Response) => {
  try {
    await requireAdminRole(req);
    await connectToDatabase();

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      {
        $set: { kycStatus: "pending" },
        $unset: {
          kycVerifiedAt: "",
          kycRejectedAt: "",
          kycRejectionReason: ""
        }
      },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ message: "User has been requested to resubmit KYC. They will see an editable form to submit updated records.", user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bad request";
    const status = msg === "Forbidden" ? 403 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
