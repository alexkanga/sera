import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes publiques (pas besoin d'authentification)
const publicRoutes = ["/login", "/api/auth", "/api/test-env"];

// Routes qui nécessitent des permissions spécifiques
const routePermissions: Record<string, string[]> = {
  "/api/users": ["users:read", "users:*"],
  "/api/roles": ["roles:read", "roles:*"],
  "/api/permissions": ["permissions:read", "permissions:*"],
  "/api/audit-logs": ["audit:read", "audit:*", "admin:*"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Autoriser les assets statiques
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // fichiers statiques
  ) {
    return NextResponse.next();
  }

  // Vérifier si la route est publique
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Vérifier l'authentification
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // Rediriger vers login si pas authentifié
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Vérifier les permissions pour les routes API sensibles
  if (pathname.startsWith("/api/")) {
    const userPermissions = (token.roles as Array<{ permissions: string[] }>)?.flatMap(
      (r) => r.permissions
    ) || [];

    // Vérifier les permissions de la route
    for (const [routePrefix, requiredPermissions] of Object.entries(routePermissions)) {
      if (pathname.startsWith(routePrefix)) {
        const hasPermission = requiredPermissions.some((p) => userPermissions.includes(p));
        if (!hasPermission) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
