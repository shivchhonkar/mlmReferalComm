import type { Request } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const uploadsDir = path.join(process.cwd(), "uploads", "payout-proofs");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const adminId = String((req as Request & { adminId?: string }).adminId ?? "admin");
    const ext = (path.extname(file.originalname) || ".png").toLowerCase();
    const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".png";
    const name = `payout-${adminId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

export const payoutProofUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed (JPG, PNG, GIF, WebP)"));
    }
    cb(null, true);
  },
});

export function payoutProofPublicUrl(filename: string): string {
  return `/uploads/payout-proofs/${filename}`;
}
