import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";
import { createAcbfDomainSchema } from "@/lib/validations";

// GET /api/acbf-domains — Liste des domaines ACBF
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "acbf:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const rawPage = parseInt(searchParams.get("page") || "1");
    const rawLimit = parseInt(searchParams.get("limit") || "20");
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter
    if (status === "archived") {
      where.deletedAt = { not: null };
    } else if (status === "all") {
      // No filter on deletedAt
    } else {
      // Default: only active (non-archived)
      where.deletedAt = null;
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [domains, total] = await Promise.all([
      db.acbfDomain.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              deliverables: { where: { deletedAt: null } },
            },
          },
        },
      }),
      db.acbfDomain.count({ where }),
    ]);

    return NextResponse.json({
      data: domains,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/acbf-domains:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/acbf-domains — Créer un domaine ACBF
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "acbf:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createAcbfDomainSchema.parse(body);

    // Vérifier si le code existe déjà
    const existingDomain = await db.acbfDomain.findUnique({
      where: { code: validated.code },
    });
    if (existingDomain) {
      return NextResponse.json(
        { error: "Un domaine ACBF avec ce code existe déjà" },
        { status: 409 }
      );
    }

    const domain = await db.acbfDomain.create({
      data: {
        code: validated.code,
        name: validated.name,
        order: validated.order,
      },
    });

    // Journal d'audit
    const { ipAddress, userAgent } = getIpAndUserAgent(request);
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "AcbfDomain",
        entityId: domain.id,
        newValue: JSON.stringify({
          code: domain.code,
          name: domain.name,
          order: domain.order,
        }),
        details: `Création du domaine ACBF ${domain.name} (${domain.code})`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: domain.id,
          code: domain.code,
          name: domain.name,
          order: domain.order,
          isActive: domain.isActive,
          createdAt: domain.createdAt,
          updatedAt: domain.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/acbf-domains:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
