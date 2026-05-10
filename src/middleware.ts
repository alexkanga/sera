import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes publiques (pas besoin d'authentification)
const publicRoutes = ["/login", "/api/auth", "/api/test-env"];

// Routes qui nécessitent des permissions spécifiques
const routePermissions: Record<string, string> = {
  "/api/users": "users:read",
  "/api/roles": "roles:read",
  "/api/permissions": "permissions:read",
  "/api/audit-logs": "audit:read",
  "/api/directions": "org:read",
  "/api/units": "org:read",
  "/api/strategic-axes": "strategic:read",
  "/api/acbf-domains": "acbf:read",
  "/api/acbf-deliverables": "acbf:read",
  "/api/activities": "pta:read",
  "/api/pta-consolide": "pta:read",
  "/api/evidence": "evidence:read",
  "/api/raci": "raci:read",
  "/api/gantt": "pta:read",
  "/api/kpi": "kpi:read",
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
    for (const [routePrefix, requiredPermission] of Object.entries(routePermissions)) {
      if (pathname.startsWith(routePrefix)) {
        // Check exact permission, module wildcard (e.g. "users:*"), and admin wildcard ("admin:*")
        const hasPermission = userPermissions.some((p) => {
          if (p === "admin:*") return true;
          if (p === requiredPermission) return true;
          const permModule = requiredPermission.split(":")[0];
          if (p === `${permModule}:*`) return true;
          return false;
        });
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
