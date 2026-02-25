import { Router } from "express";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { UserModel } from "@/models/User";
import { requireAuth } from "@/middleware/auth";

const router = Router();

// GET /api/kyc - Get current user's KYC data (for pre-filling form and status)
router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req);
    await connectToDatabase();

    const user = await UserModel.findById(ctx.userId)
      .select("kycStatus kycSubmittedAt kycVerifiedAt kycRejectedAt kycRejectionReason fullName fatherName address dob occupation incomeSlab profileImage panNumber panDocument aadhaarNumber aadhaarDocument bankAccountName bankAccountNumber bankName bankAddress bankIfsc bankDocument nominees")
      .lean();

    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const formatDate = (d: Date | string | null | undefined): string =>
      d ? (typeof d === "string" ? d.slice(0, 10) : new Date(d as Date).toISOString().slice(0, 10)) : "";

    const u = user as any;
    const nominees = (u.nominees || []).map((n: any) => ({
      relation: n.relation || "",
      name: n.name || "",
      dob: formatDate(n.dob),
      mobile: n.mobile || "",
    }));

    return res.json({
      kyc: {
        kycStatus: u.kycStatus || "pending",
        kycSubmittedAt: u.kycSubmittedAt,
        kycVerifiedAt: u.kycVerifiedAt,
        kycRejectedAt: u.kycRejectedAt,
        kycRejectionReason: u.kycRejectionReason,
        fullName: u.fullName || "",
        fatherName: u.fatherName || "",
        address: u.address || "",
        dob: formatDate(u.dob),
        occupation: u.occupation || "",
        incomeSlab: u.incomeSlab || "",
        profileImage: u.profileImage,
        panNumber: u.panNumber || "",
        panDocument: u.panDocument,
        aadhaarNumber: u.aadhaarNumber || "",
        aadhaarDocument: u.aadhaarDocument,
        bankAccountName: u.bankAccountName || "",
        bankAccountNumber: u.bankAccountNumber || "",
        bankName: u.bankName || "",
        bankAddress: u.bankAddress || "",
        bankIfsc: u.bankIfsc || "",
        bankDocument: u.bankDocument,
        nominees,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unable to retrieve KYC information";
    const status = msg.includes("log in") || msg.includes("Authentication") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

// PUT /api/kyc - Submit or update KYC
router.put("/", async (req, res) => {
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
    console.error('Error submitting KYC:', err);
    const msg = err instanceof Error ? err.message : "Unable to submit KYC information";
    const status = msg.includes("permission") || msg.includes("log in") || msg.includes("Authentication") ? 401 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
