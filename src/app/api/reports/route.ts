import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/request-context";
import {
  reportFilterSchema,
  createReportTemplateSchema,
} from "@/lib/validations";
import { z } from "zod";

// ============================================================
// GET /api/reports — Liste des modèles de rapports ET rapports générés
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "reports:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    const parseResult = reportFilterSchema.safeParse({
      tab: searchParams.get("tab") || undefined,
      search: searchParams.get("search") || undefined,
      type: searchParams.get("type") || undefined,
      category: searchParams.get("category") || undefined,
      status: searchParams.get("status") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      strategicAxisId: searchParams.get("strategicAxisId") || undefined,
      acbfDomainId: searchParams.get("acbfDomainId") || undefined,
      period: searchParams.get("period") || undefined,
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
    const skip = (params.page - 1) * params.limit;

    if (params.tab === "templates") {
      // ============================================================
      // Templates list
      // ============================================================
      const where: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };

      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { code: { contains: params.search, mode: "insensitive" } },
        ];
      }

      if (params.type) {
        where.type = params.type;
      }

      if (params.category) {
        where.category = params.category;
      }

      const [templates, total] = await Promise.all([
        db.reportTemplate.findMany({
          where,
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
            _count: {
              select: { reports: { where: { deletedAt: null } } },
            },
          },
          orderBy: [{ code: "asc" as const }],
          skip,
          take: params.limit,
        }),
        db.reportTemplate.count({ where }),
      ]);

      // Enrich with generated reports count (only active reports) — E6 fix
      const templatesWithCount = templates.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        type: t.type,
        category: t.category,
        periodFormat: t.periodFormat,
        sections: t.sections,
        filters: t.filters,
        isSystem: t.isSystem,
        isActive: t.isActive,
        createdById: t.createdById,
        createdBy: t.createdBy,
        reportsCount: t._count.reports,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));

      return NextResponse.json({
        data: templatesWithCount,
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / params.limit)),
        },
      });
    } else {
      // ============================================================
      // Generated reports list
      // ============================================================
      const where: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };

      if (params.search) {
        where.OR = [
          { title: { contains: params.search, mode: "insensitive" } },
          { period: { contains: params.search, mode: "insensitive" } },
        ];
      }

      if (params.type) {
        where.type = params.type;
      }

      if (params.status) {
        where.status = params.status;
      }

      if (params.directionId) {
        where.directionId = params.directionId;
      }

      if (params.strategicAxisId) {
        where.strategicAxisId = params.strategicAxisId;
      }

      // M3 fix: Apply acbfDomainId filter to reports query
      if (params.acbfDomainId) {
        where.acbfDomainId = params.acbfDomainId;
      }

      if (params.period) {
        where.period = params.period;
      }

      const [reports, total] = await Promise.all([
        db.report.findMany({
          where,
          include: {
            template: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                category: true,
              },
            },
            generatedBy: {
              select: { id: true, name: true, email: true },
            },
            validatedBy: {
              select: { id: true, name: true, email: true },
            },
            direction: {
              select: { id: true, code: true, name: true },
            },
            strategicAxis: {
              select: { id: true, code: true, name: true },
            },
            acbfDomain: {
              select: { id: true, code: true, name: true },
            },
          },
          orderBy: [{ generatedAt: "desc" as const }],
          skip,
          take: params.limit,
        }),
        db.report.count({ where }),
      ]);

      return NextResponse.json({
        data: reports,
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / params.limit)),
        },
      });
    }
  } catch (error) {
    console.error("Erreur GET /api/reports:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// POST /api/reports — Créer un modèle de rapport
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "reports:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();

    // C2 fix: Use safeParse instead of .parse()
    const parseResult = createReportTemplateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }
    const validated = parseResult.data;

    // Check unique code
    const existingTemplate = await db.reportTemplate.findUnique({
      where: { code: validated.code },
    });
    if (existingTemplate) {
      return NextResponse.json(
        { error: "Un modèle de rapport avec ce code existe déjà" },
        { status: 409 }
      );
    }

    const template = await db.reportTemplate.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description ?? null,
        type: validated.type,
        category: validated.category,
        periodFormat: validated.periodFormat,
        sections: validated.sections ?? null,
        filters: validated.filters ?? null,
        createdById: currentUser.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // C1 fix: Include IP and User-Agent in audit logs
    const { ip, userAgent } = getIpAndUserAgent(request);
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "ReportTemplate",
        entityId: template.id,
        newValue: JSON.stringify({
          code: template.code,
          name: template.name,
          type: template.type,
          category: template.category,
          periodFormat: template.periodFormat,
        }),
        details: `Création du modèle de rapport ${template.name} (${template.code})`,
        ipAddress: ip,
        userAgent: userAgent,
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/reports:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
