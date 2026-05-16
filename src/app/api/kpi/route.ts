import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";
import { createKpiFormSchema, kpiFilterSchema } from "@/lib/validations";
import { kpiInclude } from "@/lib/kpi-utils";

// Use centralized schema with route-local alias
const createKpiSchema = createKpiFormSchema;

// ============================================================
// GET /api/kpi — Liste des définitions KPI avec filtres
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasKpiRead = userHasPermission(currentUser, "kpi:read");
    const hasPtaRead = userHasPermission(currentUser, "pta:read");
    if (!hasKpiRead && !hasPtaRead) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // M8: If user only has pta:read (not kpi:read), only show public KPIs
    const restrictToPublic = !hasKpiRead && hasPtaRead;

    const { searchParams } = new URL(request.url);

    const parseResult = kpiFilterSchema.safeParse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      strategicAxisId: searchParams.get("strategicAxisId") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      isActive: searchParams.get("isActive") || undefined,
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    const where: Record<string, unknown> = {};

    // Soft delete: by default exclude archived
    if (params.isActive === "true") {
      where.deletedAt = null;
      where.isActive = true;
    } else if (params.isActive === "false") {
      where.deletedAt = { not: null };
    }
    // "all" => no filter

    // M8: Restrict to public KPIs when user only has pta:read
    if (restrictToPublic) {
      where.isPublic = true;
    }

    // Search filter
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (params.category) {
      where.category = params.category;
    }

    // Strategic axis filter
    if (params.strategicAxisId) {
      where.strategicAxisId = params.strategicAxisId;
    }

    // Direction filter
    if (params.directionId) {
      where.directionId = params.directionId;
    }

    const skip = (params.page - 1) * params.limit;

    const [kpis, total] = await Promise.all([
      db.kpiDefinition.findMany({
        where,
        include: kpiInclude,
        orderBy: [{ category: "asc" }, { code: "asc" }],
        skip,
        take: params.limit,
      }),
      db.kpiDefinition.count({ where }),
    ]);

    return NextResponse.json({
      data: kpis,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/kpi:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// POST /api/kpi — Créer une définition KPI
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "kpi:write") ||
      userHasPermission(currentUser, "pta:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createKpiSchema.parse(body);

    // Check unique code
    const existingKpi = await db.kpiDefinition.findUnique({
      where: { code: validated.code },
    });
    if (existingKpi) {
      return NextResponse.json(
        { error: "Un KPI avec ce code existe déjà" },
        { status: 409 }
      );
    }

    // Verify strategicAxisId exists if provided
    if (validated.strategicAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.strategicAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify directionId exists if provided
    if (validated.directionId) {
      const direction = await db.direction.findUnique({
        where: { id: validated.directionId },
      });
      if (!direction) {
        return NextResponse.json(
          { error: "La direction spécifiée n'existe pas" },
          { status: 400 }
        );
      }
    }

    const kpi = await db.kpiDefinition.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description ?? null,
        category: validated.category,
        targetValue: validated.targetValue,
        currentValue: validated.currentValue,
        unit: validated.unit ?? null,
        direction: validated.direction,
        frequency: validated.frequency,
        strategicAxisId: validated.strategicAxisId ?? null,
        directionId: validated.directionId ?? null,
        isPublic: validated.isPublic,
      },
      include: kpiInclude,
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "KpiDefinition",
        entityId: kpi.id,
        newValue: JSON.stringify({
          code: kpi.code,
          name: kpi.name,
          category: kpi.category,
          targetValue: kpi.targetValue,
          currentValue: kpi.currentValue,
        }),
        details: `Création du KPI ${kpi.name} (${kpi.code})`,
      },
    });

    return NextResponse.json({ data: kpi }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/kpi:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
