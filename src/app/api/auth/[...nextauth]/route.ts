import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions, runWithContext } from "@/lib/auth";

/**
 * Wrap NextAuth in AsyncLocalStorage so authorize() can access IP/User-Agent.
 * We must pass both the request and the route context (params) to NextAuth's handler.
 */
async function handler(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  return runWithContext({ ipAddress, userAgent }, async () => {
    const nextAuthHandler = NextAuth(authOptions);
    // Call NextAuth's handler with both request and context — same as Next.js would
    const result = await (nextAuthHandler as unknown as (
      req: NextRequest,
      ctx: { params: Promise<{ nextauth: string[] }> }
    ) => Promise<Response>)(req, context);

    if (result instanceof Response) {
      return result;
    }
    // Fallback
    return new NextResponse((result as Response).body, {
      status: (result as Response).status,
      statusText: (result as Response).statusText,
      headers: (result as Response).headers,
    });
  });
}

export { handler as GET, handler as POST };
