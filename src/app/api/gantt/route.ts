import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

// ============================================================
// GET /api/gantt — Activities for Gantt chart with filters
// ============================================================

const filterSchema = z.object({
  search: z.string().optional(),
  directionId: z.string().optional(),
  primaryAxisId: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  groupBy: z.enum(["none", "direction", "axis", "responsible", "status"]).optional(),
});

// Common include for Gantt activities
const ganttInclude = {
  responsible: {
    select: { id: true, name: true, email: true, ptaCode: true },
  },
  direction: {
    select: { id: true, code: true, name: true },
  },
  primaryAxis: {
    select: { id: true, code: true, name: true },
  },
  secondaryAxis: {
    select: { id: true, code: true, name: true },
  },
  acbfDomain: {
    select: { id: true, code: true, name: true },
  },
  acbfDeliverable: {
    select: { id: true, code: true, name: true },
  },
  validator: {
    select: { id: true, name: true, email: true },
  },
};

// Base where clause: only active activities WITH dates
function getBaseWhere(): Record<string, unknown> {
  return {
    deletedAt: null,
    isActive: true,
    startDate: { not: null },
  };
}

// Build filter where clause
function buildFilterWhere(params: z.infer<typeof filterSchema>): Record<string, unknown> {
  const where: Record<string, unknown> = getBaseWhere();

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { activityCode: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.directionId) {
    where.directionId = params.directionId;
  }

  if (params.primaryAxisId) {
    where.primaryAxisId = params.primaryAxisId;
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.priority) {
    where.priority = params.priority;
  }

  return where;
}

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

    const parseResult = filterSchema.safeParse({
      search: searchParams.get("search") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      primaryAxisId: searchParams.get("primaryAxisId") || undefined,
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      groupBy: searchParams.get("groupBy") || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    const where = buildFilterWhere(params);

    // Fetch all activities with dates (no pagination — Gantt needs all)
    const activities = await db.activity.findMany({
      where,
      include: ganttInclude,
      orderBy: [
        { startDate: "asc" },
        { activityCode: "asc" },
      ],
    });

    // If groupBy is specified, group activities
    if (params.groupBy && params.groupBy !== "none") {
      const groups = new Map<string, Activity[]>();

      activities.forEach((activity: Activity) => {
        let key = "Non assigné";
        switch (params.groupBy) {
          case "direction":
            key = activity.direction
              ? `${activity.direction.code} — ${activity.direction.name}`
              : "Non assigné";
            break;
          case "axis":
            key = activity.primaryAxis
              ? `${activity.primaryAxis.code} — ${activity.primaryAxis.name}`
              : "Non assigné";
            break;
          case "responsible":
            key = activity.responsible?.name || "Non assigné";
            break;
          case "status":
            key = activity.status || "Non défini";
            break;
        }

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(activity);
      });

      const groupedData = Array.from(groups.entries()).map(([key, acts]) => ({
        key,
        label: key,
        activities: acts,
        avgProgress: acts.length > 0
          ? Math.round((acts.reduce((sum: number, a: Activity) => sum + a.progressRate, 0) / acts.length) * 10) / 10
          : 0,
      }));

      return NextResponse.json({
        data: activities,
        grouped: groupedData,
        total: activities.length,
      });
    }

    return NextResponse.json({
      data: activities,
      total: activities.length,
    });
  } catch (error) {
    console.error("Erreur GET /api/gantt:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Type alias for activity with includes
interface Activity {
  id: string;
  activityCode: string;
  title: string;
  responsibleId: string;
  directionId: string | null;
  primaryAxisId: string | null;
  secondaryAxisId: string | null;
  acbfDomainId: string | null;
  acbfDeliverableId: string | null;
  annualObjective: string | null;
  detailedTasks: string | null;
  expectedDeliverable: string | null;
  validatorId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  performanceIndicator: string | null;
  verificationSource: string | null;
  status: string;
  progressRate: number;
  riskDescription: string | null;
  comments: string | null;
  validationStatus: string;
  nature: string | null;
  dependency: string | null;
  duration: string | null;
  isLocked: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: { id: string; name: string; email: string; ptaCode?: string };
  direction?: { id: string; code: string; name: string };
  primaryAxis?: { id: string; code: string; name: string };
  secondaryAxis?: { id: string; code: string; name: string };
  acbfDomain?: { id: string; code: string; name: string };
  acbfDeliverable?: { id: string; code: string; name: string };
  validator?: { id: string; name: string; email: string };
}
