import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import { UserModel } from "../src/models/User";

function loadBackendEnv(): string | null {
  const backendRoot = path.resolve(__dirname, "..");
  const candidates = [
    path.join(backendRoot, ".env"),
    path.join(backendRoot, ".env.local"),
    path.join(backendRoot, ".env.production"),
    path.resolve(backendRoot, "..", ".env"),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const result = dotenv.config({ path: envPath, override: false });
    if (!result.error) {
      console.log(`[create-super-admin] Loaded env from ${envPath}`);
      return envPath;
    }
  }

  return null;
}

function env(key: string): string | undefined {
  const raw = process.env[key];
  if (raw == null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function genReferralCode(len = 10) {
  return crypto.randomBytes(16).toString("hex").slice(0, len).toUpperCase();
}

async function main() {
  const loadedFrom = loadBackendEnv();

  const MONGO_URI = env("MONGODB_URI") || env("MONGO_URI") || env("DATABASE_URL");

  console.log("[create-super-admin] Mongo URI:", MONGO_URI ? "✅ found" : "❌ missing");

  if (!MONGO_URI) {
    const backendRoot = path.resolve(__dirname, "..");
    throw new Error(
      [
        "Missing MONGODB_URI (or MONGO_URI / DATABASE_URL).",
        loadedFrom
          ? `Env file was loaded (${loadedFrom}) but MONGODB_URI is not set or is commented out.`
          : `No .env file found. Create ${path.join(backendRoot, ".env")} on the server.`,
        "Required in .env:",
        "  MONGODB_URI=mongodb://...",
        "  ADMIN_EMAIL=...",
        "  ADMIN_MOBILE=...",
        "  ADMIN_NAME=...",
        "  ADMIN_PASS=...",
        "Or run: MONGODB_URI='mongodb://...' npx tsx scripts/create-super-admin.ts",
      ].join("\n")
    );
  }

  const email = env("ADMIN_EMAIL");
  const mobile = env("ADMIN_MOBILE");
  const fullName = env("ADMIN_NAME");
  const password = env("ADMIN_PASS");
  const role = "super_admin";

  if (!email || !mobile || !fullName || !password) {
    throw new Error(
      "Missing admin credentials in .env: set ADMIN_EMAIL, ADMIN_MOBILE, ADMIN_NAME, and ADMIN_PASS (no spaces around =)."
    );
  }

  await mongoose.connect(MONGO_URI);
  console.log("[create-super-admin] Connected ✅");

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
        role,
        isVerified: true,
        isBlocked: false,
        status: "active",
        activityStatus: "inactive",
        referralCode: genReferralCode(10),
        parent: null,
        position: null,
      });
      break;
    } catch (e: unknown) {
      const err = e as { code?: number; keyPattern?: { referralCode?: unknown }; keyValue?: { referralCode?: unknown } };
      if (err?.code === 11000 && (err?.keyPattern?.referralCode || err?.keyValue?.referralCode)) continue;
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
    console.error("❌ Failed:", e instanceof Error ? e.message : e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
