import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { createStrategicAxisSchema } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";

// GET /api/strategic-axes — Liste des axes stratégiques
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "strategic:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
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

    const [axes, total] = await Promise.all([
      db.strategicAxis.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              activitiesPrimary: true,
              activitiesSecondary: true,
            },
          },
        },
      }),
      db.strategicAxis.count({ where }),
    ]);

    return NextResponse.json({
      data: axes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/strategic-axes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/strategic-axes — Créer un axe stratégique
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "strategic:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    const body = await request.json();
    const validated = createStrategicAxisSchema.parse(body);

    // Vérifier si le code existe déjà
    const existingAxis = await db.strategicAxis.findUnique({
      where: { code: validated.code },
    });
    if (existingAxis) {
      return NextResponse.json(
        { error: "Un axe stratégique avec ce code existe déjà" },
        { status: 409 }
      );
    }

    const axis = await db.strategicAxis.create({
      data: {
        code: validated.code,
        name: validated.name,
        objective: validated.objective,
        expectedResults: validated.expectedResults,
        indicators: validated.indicators,
        concernedUnits: validated.concernedUnits,
        order: validated.order,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "StrategicAxis",
        entityId: axis.id,
        newValue: JSON.stringify({
          code: axis.code,
          name: axis.name,
          objective: axis.objective,
          expectedResults: axis.expectedResults,
          indicators: axis.indicators,
          concernedUnits: axis.concernedUnits,
          order: axis.order,
        }),
        details: `Création de l'axe stratégique ${axis.name} (${axis.code})`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: axis.id,
          code: axis.code,
          name: axis.name,
          objective: axis.objective,
          expectedResults: axis.expectedResults,
          indicators: axis.indicators,
          concernedUnits: axis.concernedUnits,
          order: axis.order,
          isActive: axis.isActive,
          createdAt: axis.createdAt,
          updatedAt: axis.updatedAt,
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
    console.error("Erreur POST /api/strategic-axes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
