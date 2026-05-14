import type { NextRequest } from "next/server";

/**
 * Extract IP address and User-Agent from a NextRequest object.
 * Shared utility for audit logging across all API routes.
 */
export function getIpAndUserAgent(request: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}
