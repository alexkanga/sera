import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createRaciSchema = z.object({
  acbfDeliverableId: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  accountable: z.string().optional().nullable(),
  accountableUserId: z.string().optional().nullable(),
  contributors: z.string().optional().nullable(),
  informed: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  indicativeDeadline: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  verificationSource: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
});

// GET /api/raci — Liste des entrées RACI
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "raci:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const acbfDeliverableId = searchParams.get("acbfDeliverableId") || "";
    const activityId = searchParams.get("activityId") || "";
    const strategicAxisId = searchParams.get("strategicAxisId") || "";
    const priority = searchParams.get("priority") || "";
    const responsibleUserId = searchParams.get("responsibleUserId") || "";
    const accountableUserId = searchParams.get("accountableUserId") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter (soft delete)
    if (status === "archived") {
      where.deletedAt = { not: null };
    } else if (status === "all") {
      // No filter on deletedAt
    } else {
      // Default: only active
      where.deletedAt = null;
      where.isActive = true;
    }

    // Search filter (by responsible, accountable, contributors, informed text)
    if (search) {
      where.OR = [
        { responsible: { contains: search, mode: "insensitive" } },
        { accountable: { contains: search, mode: "insensitive" } },
        { contributors: { contains: search, mode: "insensitive" } },
        { informed: { contains: search, mode: "insensitive" } },
      ];
    }

    // AcbfDeliverableId filter
    if (acbfDeliverableId) {
      where.acbfDeliverableId = acbfDeliverableId;
    }

    // ActivityId filter
    if (activityId) {
      where.activityId = activityId;
    }

    // StrategicAxisId filter
    if (strategicAxisId) {
      where.strategicAxisId = strategicAxisId;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // ResponsibleUserId filter
    if (responsibleUserId) {
      where.responsibleUserId = responsibleUserId;
    }

    // AccountableUserId filter
    if (accountableUserId) {
      where.accountableUserId = accountableUserId;
    }

    const include = {
      acbfDeliverable: {
        select: {
          id: true,
          code: true,
          name: true,
          domain: { select: { code: true, name: true } },
        },
      },
      activity: {
        select: { id: true, activityCode: true, title: true },
      },
      strategicAxis: {
        select: { id: true, code: true, name: true },
      },
      responsibleUser: {
        select: { id: true, name: true, email: true },
      },
      accountableUser: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    };

    const [raciEntries, total] = await Promise.all([
      db.raciMatrix.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.raciMatrix.count({ where }),
    ]);

    return NextResponse.json({
      data: raciEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/raci:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/raci — Créer une entrée RACI
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "raci:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createRaciSchema.parse(body);

    // Verify acbfDeliverableId exists if provided
    if (validated.acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: validated.acbfDeliverableId },
      });
      if (!deliverable) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify activityId exists if provided
    if (validated.activityId) {
      const activity = await db.activity.findUnique({
        where: { id: validated.activityId },
      });
      if (!activity) {
        return NextResponse.json(
          { error: "L'activité spécifiée n'existe pas" },
          { status: 400 }
        );
      }
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

    // Verify responsibleUserId exists if provided
    if (validated.responsibleUserId) {
      const user = await db.user.findUnique({
        where: { id: validated.responsibleUserId },
      });
      if (!user) {
        return NextResponse.json(
          { error: "L'utilisateur responsable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify accountableUserId exists if provided
    if (validated.accountableUserId) {
      const user = await db.user.findUnique({
        where: { id: validated.accountableUserId },
      });
      if (!user) {
        return NextResponse.json(
          { error: "L'utilisateur redevable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    const raciEntry = await db.raciMatrix.create({
      data: {
        acbfDeliverableId: validated.acbfDeliverableId ?? null,
        activityId: validated.activityId ?? null,
        strategicAxisId: validated.strategicAxisId ?? null,
        responsible: validated.responsible ?? null,
        responsibleUserId: validated.responsibleUserId ?? null,
        accountable: validated.accountable ?? null,
        accountableUserId: validated.accountableUserId ?? null,
        contributors: validated.contributors ?? null,
        informed: validated.informed ?? null,
        priority: validated.priority ?? null,
        indicativeDeadline: validated.indicativeDeadline ?? null,
        verificationSource: validated.verificationSource ?? null,
        comments: validated.comments ?? null,
        createdById: currentUser.id,
      },
      include: {
        acbfDeliverable: {
          select: {
            id: true,
            code: true,
            name: true,
            domain: { select: { code: true, name: true } },
          },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        strategicAxis: {
          select: { id: true, code: true, name: true },
        },
        responsibleUser: {
          select: { id: true, name: true, email: true },
        },
        accountableUser: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "RaciMatrix",
        entityId: raciEntry.id,
        newValue: JSON.stringify({
          acbfDeliverableId: raciEntry.acbfDeliverableId,
          activityId: raciEntry.activityId,
          strategicAxisId: raciEntry.strategicAxisId,
          responsible: raciEntry.responsible,
          accountable: raciEntry.accountable,
          contributors: raciEntry.contributors,
          informed: raciEntry.informed,
          priority: raciEntry.priority,
        }),
        details: `Création de l'entrée RACI ${raciEntry.id}`,
      },
    });

    return NextResponse.json({ data: raciEntry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/raci:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
