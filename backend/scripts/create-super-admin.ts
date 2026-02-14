import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import { UserModel } from "../src/models/User";

function genReferralCode(len = 10) {
  return crypto.randomBytes(16).toString("hex").slice(0, len).toUpperCase();
}

async function main() {
  // ✅ support multiple common env keys
  const MONGO_URI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL;

  console.log("[create-super-admin] Mongo URI:", MONGO_URI ? "✅ found" : "❌ missing");

  if (!MONGO_URI) {
    throw new Error("Missing MONGODB_URI / MONGO_URI / DATABASE_URL in .env");
  }

  
  await mongoose.connect(MONGO_URI);
  console.log("[create-super-admin] Connected ✅");

  const email = process.env.ADMIN_EMAIL || '';
  const mobile = process.env.ADMIN_MOBILE;
  const fullName = process.env.ADMIN_NAME;
  const password = process.env.ADMIN_PASS || '';

  const existing = await UserModel.findOne({
    role: { $in: ["super_admin", "admin"] },
  }).lean();

  if (existing) {
    console.log("❌ Admin already exists:", {
      id: String(existing._id),
      email: existing.email,
      mobile: existing.mobile,
      role: existing.role,
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  for (let i = 0; i < 5; i++) {
    try {
      user = await UserModel.create({
        mobile,
        email: email.toLowerCase(),
        fullName,
        name: fullName,
        passwordHash,
        role: "super_admin",
        isVerified: true,
        isBlocked: false,
        status: "active",
        activityStatus: "inactive",
        referralCode: genReferralCode(10),
        parent: null,
        position: null,
      });
      break;
    } catch (e: any) {
      // retry if referralCode collision
      if (e?.code === 11000 && (e?.keyPattern?.referralCode || e?.keyValue?.referralCode)) continue;
      throw e;
    }
  }

  if (!user) throw new Error("Failed to generate unique referralCode");

  console.log("✅ Super admin created:", {
    id: String(user._id),
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    referralCode: user.referralCode,
  });
}

main()
  .then(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ Failed:", e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
