import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createActivitySchema = z.object({
  activityCode: z.string().optional(),
  responsibleId: z.string().min(1, "Le responsable est requis"),
  directionId: z.string().optional().nullable(),
  primaryAxisId: z.string().optional().nullable(),
  secondaryAxisId: z.string().optional().nullable(),
  acbfDomainId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
  annualObjective: z.string().optional().nullable(),
  title: z.string().min(1, "Le titre est requis"),
  detailedTasks: z.string().optional().nullable(),
  expectedDeliverable: z.string().optional().nullable(),
  validatorId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).default("Moyenne"),
  performanceIndicator: z.string().optional().nullable(),
  verificationSource: z.string().optional().nullable(),
  status: z
    .enum(["Non démarré", "En cours", "Terminé", "Annulé"])
    .default("Non démarré"),
  progressRate: z.number().min(0).max(100).default(0),
  riskDescription: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  validationStatus: z
    .enum(["Brouillon", "Soumis", "Validé", "Rejeté"])
    .default("Brouillon"),
  nature: z.string().optional().nullable(),
  dependency: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
});

// GET /api/activities — Liste des activités
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "pta:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const directionId = searchParams.get("directionId") || "";
    const responsibleId = searchParams.get("responsibleId") || "";
    const primaryAxisId = searchParams.get("primaryAxisId") || "";
    const acbfDomainId = searchParams.get("acbfDomainId") || "";
    const priority = searchParams.get("priority") || "";
    const validationStatus = searchParams.get("validationStatus") || "";
    const activityStatus = searchParams.get("activityStatus") || "";
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
      // Default: only active (non-archived)
      where.deletedAt = null;
      where.isActive = true;
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { activityCode: { contains: search, mode: "insensitive" } },
      ];
    }

    // Direction filter
    if (directionId) {
      where.directionId = directionId;
    }

    // Responsible filter
    if (responsibleId) {
      where.responsibleId = responsibleId;
    }

    // Primary axis filter
    if (primaryAxisId) {
      where.primaryAxisId = primaryAxisId;
    }

    // ACBF domain filter
    if (acbfDomainId) {
      where.acbfDomainId = acbfDomainId;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Validation status filter
    if (validationStatus) {
      where.validationStatus = validationStatus;
    }

    // Activity status filter
    if (activityStatus) {
      where.status = activityStatus;
    }

    const include = {
      responsible: {
        select: { id: true, name: true, email: true, ptaCode: true },
      },
      direction: {
        select: { id: true, code: true, name: true },
      },
      primaryAxis: {
        select: { id: true, code: true, name: true },
      },
      acbfDomain: {
        select: { id: true, code: true, name: true },
      },
      validator: {
        select: { id: true, name: true, email: true },
      },
    };

    const [activities, total] = await Promise.all([
      db.activity.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.activity.count({ where }),
    ]);

    return NextResponse.json({
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/activities:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Helper: auto-generate activityCode (format: ACT-YYYY-XXX)
async function generateActivityCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ACT-${year}-`;

  // Find the last activity code with this prefix
  const lastActivity = await db.activity.findFirst({
    where: {
      activityCode: { startsWith: prefix },
    },
    orderBy: { activityCode: "desc" },
    select: { activityCode: true },
  });

  let nextNum = 1;
  if (lastActivity) {
    const parts = lastActivity.activityCode.split("-");
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

// POST /api/activities — Créer une activité
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "pta:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createActivitySchema.parse(body);

    // Auto-generate activityCode if not provided
    let activityCode = validated.activityCode;
    if (!activityCode) {
      activityCode = await generateActivityCode();
    } else {
      // Check unique activityCode
      const existingActivity = await db.activity.findUnique({
        where: { activityCode },
      });
      if (existingActivity) {
        return NextResponse.json(
          { error: "Une activité avec ce code existe déjà" },
          { status: 409 }
        );
      }
    }

    // Verify responsibleId exists
    const responsible = await db.user.findUnique({
      where: { id: validated.responsibleId },
    });
    if (!responsible) {
      return NextResponse.json(
        { error: "L'utilisateur responsable spécifié n'existe pas" },
        { status: 400 }
      );
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

    // Verify primaryAxisId exists if provided
    if (validated.primaryAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.primaryAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique principal spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify secondaryAxisId exists if provided
    if (validated.secondaryAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.secondaryAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique secondaire spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify acbfDomainId exists if provided
    if (validated.acbfDomainId) {
      const domain = await db.acbfDomain.findUnique({
        where: { id: validated.acbfDomainId },
      });
      if (!domain) {
        return NextResponse.json(
          { error: "Le domaine ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

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

    // Verify validatorId exists if provided
    if (validated.validatorId) {
      const validator = await db.user.findUnique({
        where: { id: validated.validatorId },
      });
      if (!validator) {
        return NextResponse.json(
          { error: "Le validateur spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    const activity = await db.activity.create({
      data: {
        activityCode,
        responsibleId: validated.responsibleId,
        directionId: validated.directionId ?? null,
        primaryAxisId: validated.primaryAxisId ?? null,
        secondaryAxisId: validated.secondaryAxisId ?? null,
        acbfDomainId: validated.acbfDomainId ?? null,
        acbfDeliverableId: validated.acbfDeliverableId ?? null,
        annualObjective: validated.annualObjective ?? null,
        title: validated.title,
        detailedTasks: validated.detailedTasks ?? null,
        expectedDeliverable: validated.expectedDeliverable ?? null,
        validatorId: validated.validatorId ?? null,
        startDate: validated.startDate ? new Date(validated.startDate) : null,
        endDate: validated.endDate ? new Date(validated.endDate) : null,
        priority: validated.priority,
        performanceIndicator: validated.performanceIndicator ?? null,
        verificationSource: validated.verificationSource ?? null,
        status: validated.status,
        progressRate: validated.progressRate,
        riskDescription: validated.riskDescription ?? null,
        comments: validated.comments ?? null,
        validationStatus: validated.validationStatus,
        nature: validated.nature ?? null,
        dependency: validated.dependency ?? null,
        duration: validated.duration ?? null,
        createdById: currentUser.id,
      },
      include: {
        responsible: {
          select: { id: true, name: true, email: true, ptaCode: true },
        },
        direction: {
          select: { id: true, code: true, name: true },
        },
        primaryAxis: {
          select: { id: true, code: true, name: true },
        },
        acbfDomain: {
          select: { id: true, code: true, name: true },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Activity",
        entityId: activity.id,
        newValue: JSON.stringify({
          activityCode: activity.activityCode,
          title: activity.title,
          responsibleId: activity.responsibleId,
          directionId: activity.directionId,
          primaryAxisId: activity.primaryAxisId,
          status: activity.status,
          priority: activity.priority,
          validationStatus: activity.validationStatus,
        }),
        details: `Création de l'activité ${activity.title} (${activity.activityCode})`,
      },
    });

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/activities:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
