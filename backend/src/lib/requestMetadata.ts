import type { Request } from "express";

/**
 * Extract IP and User-Agent from request for activity logging.
 * Handles proxies (X-Forwarded-For, X-Real-IP).
 */
export function getRequestMetadata(req: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket?.remoteAddress ||
    null;
  const userAgent = (req.headers["user-agent"] as string) || null;
  return { ip: ip || null, userAgent };
}
