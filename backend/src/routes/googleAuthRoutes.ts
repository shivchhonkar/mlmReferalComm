import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { verifyGoogleIdToken } from "@/lib/googleAuth";
import { signGooglePendingToken, verifyGooglePendingToken } from "@/lib/googlePending";
import { signAuthToken } from "@/lib/jwt";
import { hashPassword } from "@/lib/password";
import { generateUniqueReferralCode } from "@/lib/referral";
import { getBusinessOpportunityEmailContent } from "@/lib/businessOpportunity";
import { sendEmail } from "@/lib/email";
import {
  sendValidationError,
  sendSuccessResponse,
  VALIDATION_MESSAGES,
  formatZodError,
} from "@/lib/validation";
import { UserModel } from "@/models/User";
import { setAuthCookie, authLimiter } from "@/middleware/auth";
import { logLoginActivity } from "@/lib/activityLogger";

const router = Router();
router.use(authLimiter);

function normalizeMobile(mobile: string): string {
  return mobile.replace(/\D/g, "");
}

function authUserPayload(user: {
  _id: mongoose.Types.ObjectId;
  mobile?: string | null;
  name?: string | null;
  email?: string | null;
  role: string;
  isVerified?: boolean;
  referralCode: string;
}) {
  return {
    _id: user._id,
    mobile: user.mobile,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    referralCode: user.referralCode,
  };
}

async function issueLoginSession(
  user: {
    _id: mongoose.Types.ObjectId;
    role: string;
    email?: string | null;
    mobile?: string | null;
    name?: string | null;
    isVerified?: boolean;
    referralCode: string;
  },
  res: import("express").Response,
  req: import("express").Request,
) {
  const token = await signAuthToken({
    sub: user._id.toString(),
    role: user.role as import("@/models/User").UserRole,
    email: user.email || undefined,
  });
  setAuthCookie(res, token);

  await UserModel.findByIdAndUpdate(user._id, {
    lastLoginAt: new Date(),
  });

  logLoginActivity(req, { userId: user._id, success: true }).catch(() => {});

  return sendSuccessResponse(res, { user: authUserPayload(user) }, "Login successful");
}

/**
 * POST /api/auth/google
 * Sign in or start sign-up with Google ID token.
 */
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      return sendValidationError(res, "Google credential is required", 400);
    }

    const profile = await verifyGoogleIdToken(credential);
    await connectToDatabase();

    const byGoogle = await UserModel.findOne({ googleId: profile.googleId });
    if (byGoogle) {
      if (byGoogle.status === "deleted") {
        return sendValidationError(res, VALIDATION_MESSAGES.ACCOUNT_DELETED, 403);
      }
      if (byGoogle.status === "suspended") {
        return sendValidationError(res, VALIDATION_MESSAGES.ACCOUNT_SUSPENDED, 403);
      }
      return issueLoginSession(byGoogle, res, req);
    }

    const byEmail = await UserModel.findOne({ email: profile.email });
    if (byEmail) {
      if (byEmail.status === "deleted") {
        return sendValidationError(res, VALIDATION_MESSAGES.ACCOUNT_DELETED, 403);
      }
      if (byEmail.status === "suspended") {
        return sendValidationError(res, VALIDATION_MESSAGES.ACCOUNT_SUSPENDED, 403);
      }
      if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
        return sendValidationError(
          res,
          "This email is linked to a different Google account. Sign in with email/password or contact support.",
          409,
        );
      }

      byEmail.googleId = profile.googleId;
      if (profile.emailVerified) byEmail.isVerified = true;
      await byEmail.save();

      return issueLoginSession(byEmail, res, req);
    }

    const pendingToken = await signGooglePendingToken({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    return res.json({
      success: true,
      requiresProfile: true,
      pendingToken,
      profile: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
      message: "Complete your profile to finish signing up with Google.",
    });
  } catch (err: unknown) {
    console.error("Google auth error:", err);
    const msg = err instanceof Error ? err.message : "Google sign-in failed";
    const status = msg.includes("configured") ? 500 : 401;
    return sendValidationError(res, msg.includes("configured") ? msg : "Google sign-in failed. Please try again.", status);
  }
});

const completeProfileSchema = z.object({
  pendingToken: z.string().min(1, "Sign-in session expired. Please try Google again."),
  name: z.string().min(2, VALIDATION_MESSAGES.NAME_TOO_SHORT).max(50),
  fullName: z.string().min(2, VALIDATION_MESSAGES.FULL_NAME_REQUIRED).max(100),
  mobile: z
    .string()
    .min(10, VALIDATION_MESSAGES.MOBILE_INVALID)
    .max(15, VALIDATION_MESSAGES.MOBILE_INVALID),
  countryCode: z.string().default("+91"),
  referralCode: z
    .string()
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : v))
    .transform((v) => v || undefined),
  acceptedTerms: z.literal(true, { message: VALIDATION_MESSAGES.TERMS_REQUIRED }),
});

async function handleGoogleCompleteProfile(req: import("express").Request, res: import("express").Response) {
  try {
    const body = completeProfileSchema.parse(req.body);
    const pending = await verifyGooglePendingToken(body.pendingToken);
    const mobile = normalizeMobile(body.mobile);

    await connectToDatabase();

    const existingMobile = await UserModel.findOne({ mobile }).select("_id email googleId");
    if (existingMobile) {
      if (existingMobile.email?.toLowerCase() !== pending.email) {
        return sendValidationError(
          res,
          "This mobile number is already registered with a different email. Use another number or sign in with that account.",
          409,
        );
      }
      if (existingMobile.googleId && existingMobile.googleId !== pending.googleId) {
        return sendValidationError(res, "This account is linked to a different Google account.", 409);
      }

      existingMobile.googleId = pending.googleId;
      existingMobile.name = body.name;
      existingMobile.fullName = body.fullName;
      existingMobile.isVerified = true;
      await existingMobile.save();

      return issueLoginSession(existingMobile, res, req);
    }

    const duplicateGoogle = await UserModel.findOne({ googleId: pending.googleId });
    if (duplicateGoogle) {
      return issueLoginSession(duplicateGoogle, res, req);
    }

    const existingEmail = await UserModel.findOne({ email: pending.email }).select("_id");
    if (existingEmail) {
      return sendValidationError(res, VALIDATION_MESSAGES.EMAIL_EXISTS, 409);
    }

    let parentId: mongoose.Types.ObjectId | null = null;
    if (body.referralCode) {
      const sponsor = await UserModel.findOne({ referralCode: body.referralCode }).select("_id");
      if (!sponsor) return sendValidationError(res, "Invalid referral code", 400);
      parentId = sponsor._id;
    }

    const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
    const referralCode = await generateUniqueReferralCode();

    const user = await UserModel.create({
      mobile,
      countryCode: body.countryCode,
      name: body.name,
      fullName: body.fullName,
      email: pending.email,
      passwordHash,
      googleId: pending.googleId,
      role: "user",
      status: "inactive",
      activityStatus: "inactive",
      isVerified: true,
      referralCode,
      parent: parentId,
      position: null,
    });

    setTimeout(async () => {
      try {
        const content = getBusinessOpportunityEmailContent();
        if (user.email) {
          await sendEmail({ to: user.email, subject: content.subject, text: content.text });
        }
      } catch (emailErr) {
        console.error("Failed to send welcome email:", emailErr);
      }
    }, 0);

    return issueLoginSession(user, res, req);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return sendValidationError(res, formatZodError(err));
    }
    console.error("Google complete-profile error:", err);
    const msg = err instanceof Error ? err.message : VALIDATION_MESSAGES.SERVER_ERROR;
    const status = msg.includes("session") || msg.includes("expired") ? 401 : 500;
    return sendValidationError(res, msg, status);
  }
}

router.post("/google/complete-profile", handleGoogleCompleteProfile);
router.post("/google/link-phone", handleGoogleCompleteProfile);

export default router;
