import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createDeliverableSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z.string().min(1, "Le nom est requis"),
  domainId: z.string().min(1, "Le domaine ACBF est requis"),
  description: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

// GET /api/acbf-deliverables — Liste des livrables ACBF
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
    const domainId = searchParams.get("domainId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    if (domainId) {
      where.domainId = domainId;
    }

    const [deliverables, total] = await Promise.all([
      db.acbfDeliverable.findMany({
        where,
        orderBy: [{ code: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          domain: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      db.acbfDeliverable.count({ where }),
    ]);

    const formattedDeliverables = deliverables.map((deliverable) => ({
      id: deliverable.id,
      code: deliverable.code,
      name: deliverable.name,
      description: deliverable.description,
      priority: deliverable.priority,
      status: deliverable.status,
      domainId: deliverable.domainId,
      domain: deliverable.domain,
      isActive: deliverable.isActive,
      deletedAt: deliverable.deletedAt,
      createdAt: deliverable.createdAt,
      updatedAt: deliverable.updatedAt,
    }));

    return NextResponse.json({
      data: formattedDeliverables,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/acbf-deliverables:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/acbf-deliverables — Créer un livrable ACBF
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
    const validated = createDeliverableSchema.parse(body);

    // Vérifier si le code existe déjà
    const existingDeliverable = await db.acbfDeliverable.findUnique({
      where: { code: validated.code },
    });
    if (existingDeliverable) {
      return NextResponse.json(
        { error: "Un livrable ACBF avec ce code existe déjà" },
        { status: 409 }
      );
    }

    // Vérifier que le domaine existe
    const existingDomain = await db.acbfDomain.findUnique({
      where: { id: validated.domainId },
    });
    if (!existingDomain) {
      return NextResponse.json(
        { error: "Le domaine ACBF spécifié n'existe pas" },
        { status: 400 }
      );
    }

    const deliverable = await db.acbfDeliverable.create({
      data: {
        code: validated.code,
        name: validated.name,
        domainId: validated.domainId,
        description: validated.description,
        priority: validated.priority,
        status: validated.status,
      },
      include: {
        domain: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "AcbfDeliverable",
        entityId: deliverable.id,
        newValue: JSON.stringify({
          code: deliverable.code,
          name: deliverable.name,
          domainId: deliverable.domainId,
          priority: deliverable.priority,
        }),
        details: `Création du livrable ACBF ${deliverable.name} (${deliverable.code})`,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: deliverable.id,
          code: deliverable.code,
          name: deliverable.name,
          description: deliverable.description,
          priority: deliverable.priority,
          status: deliverable.status,
          domainId: deliverable.domainId,
          domain: deliverable.domain,
          isActive: deliverable.isActive,
          createdAt: deliverable.createdAt,
          updatedAt: deliverable.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/acbf-deliverables:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
