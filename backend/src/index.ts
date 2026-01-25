import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";

const backendEnvPath = path.resolve(__dirname, "../.env");
const repoRootEnvPath = path.resolve(__dirname, "../../.env");

dotenv.config({ path: fs.existsSync(backendEnvPath) ? backendEnvPath : repoRootEnvPath });


const app = express();

const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

// Support multiple CORS origins (comma-separated)
const allowedOrigins = corsOrigin.split(",").map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Don't throw an error (Express may serialize it as HTML);
        // just deny the CORS request.
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Serve static files from the uploads directory
const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function main() {
  // Connect to MongoDB on startup
  const { connectToDatabase } = await import("./lib/db");
  await connectToDatabase();

  const { registerRoutes } = await import("./routes");
  registerRoutes(app);

  // Always return JSON for errors so the frontend can safely parse them.
  // This also handles body-parser JSON errors and other thrown exceptions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    // eslint-disable-next-line no-console
    console.error("[Server] Unhandled error:", message);
    res.status(400).json({ error: message });
  });

  app.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`[Server] ReferGrow API listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
