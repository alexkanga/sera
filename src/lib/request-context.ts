import { NextRequest } from "next/server";

/**
 * Extract IP address and User-Agent from a NextRequest.
 * Used in audit logs for traceability and security compliance.
 */
export function getIpAndUserAgent(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return { ip, userAgent };
}
