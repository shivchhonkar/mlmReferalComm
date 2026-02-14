import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import "module-alias/register";

const backendEnvPath = path.resolve(__dirname, "../.env");
const repoRootEnvPath = path.resolve(__dirname, "../../.env");

// Load env from backend/.env if exists else repo root .env
dotenv.config({ path: fs.existsSync(backendEnvPath) ? backendEnvPath : repoRootEnvPath });

const app = express();

// Trust proxy for rate limiting + secure cookies when behind nginx
app.set("trust proxy", 1);

// ✅ IMPORTANT: API default should be 4001 (your nginx proxies /api -> 4001)
const port = Number(process.env.PORT ?? 4001);

// ===== Security middleware =====
app.use(
  helmet({
    contentSecurityPolicy: false, // disable CSP for now; enable later if needed
    crossOriginEmbedderPolicy: false,
  })
);

// ===== Rate limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// ===== CORS (robust) =====
// Exact allowed origins (comma-separated)
const corsOrigin =
  process.env.CORS_ORIGIN ??
  "http://localhost:4000,http://localhost:3000,https://sambhariyamarketing.com,https://www.sambhariyamarketing.com";

// Optional hostname allowlist (helps avoid issues like :443, etc.)
const corsOriginHosts =
  process.env.CORS_ORIGIN_HOSTS ??
  "localhost,sambhariyamarketing.com,www.sambhariyamarketing.com";

const allowedOrigins = new Set(
  corsOrigin
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

const allowedHostnames = new Set(
  corsOriginHosts
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, some apps)
      if (!origin) return callback(null, true);

      // 1) Exact origin match
      if (allowedOrigins.has(origin)) return callback(null, true);

      // 2) Hostname match fallback (handles cases like https://domain:443)
      try {
        const { hostname } = new URL(origin);
        if (allowedHostnames.has(hostname)) return callback(null, true);
      } catch {
        // ignore parse errors
      }

      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Body + cookies
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Serve static files from uploads directory (with permissive CORS for assets)
const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", cors(), express.static(uploadsPath));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function main() {
  // Connect to MongoDB on startup
  const { connectToDatabase } = await import("./lib/db");
  await connectToDatabase();

  const { registerRoutes } = await import("./routes");
  registerRoutes(app);

  // ✅ Apply authLimiter only to auth routes (after routes registered OR before, both ok)
  // If your auth routes are under /api/auth, this will apply correctly.
  app.use("/api/auth", authLimiter);

  // Always return JSON for errors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error(`[Server] Error: ${message}`);
    res.status(400).json({ error: message });
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`[Server] API listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(`[Server] Startup error: ${err instanceof Error ? err.message : "Unknown error"}`);
  process.exit(1);
});
