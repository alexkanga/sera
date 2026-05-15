import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { ganttFilterSchema, type GanttFilterValues } from "@/lib/validations";

// Base where clause: only active activities WITH dates
function getBaseWhere(): Record<string, unknown> {
  return {
    deletedAt: null,
    isActive: true,
    startDate: { not: null },
  };
}

// Build filter where clause (same logic as main gantt route)
function buildFilterWhere(params: GanttFilterValues): Record<string, unknown> {
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

  if (params.validationStatus) {
    where.validationStatus = params.validationStatus;
  }

  return where;
}

// GET /api/gantt/stats — Gantt timeline statistics (with filter support)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "gantt:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Parse filter parameters using ganttFilterSchema
    const { searchParams } = new URL(request.url);
    const parseResult = ganttFilterSchema.safeParse({
      search: searchParams.get("search") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      primaryAxisId: searchParams.get("primaryAxisId") || undefined,
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      validationStatus: searchParams.get("validationStatus") || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    const where = buildFilterWhere(params);

    // Overdue where: same base + endDate < now AND status not Terminé/Annulé/Réalisé
    const overdueWhere: Record<string, unknown> = {
      ...where,
      endDate: { lt: new Date() },
      status: { notIn: ["Réalisé", "Terminé", "Annulé"] },
    };

    const [
      totalPlanned,
      avgProgress,
      overdueCount,
      minMaxDates,
      // C3: Replace findMany with aggregate for avg duration calculation
      durationStats,
    ] = await Promise.all([
      // Total activities matching filters
      db.activity.count({ where }),

      // Average progress rate
      db.activity.aggregate({
        where,
        _avg: { progressRate: true },
      }),

      // Overdue count (endDate < now AND status not Terminé/Annulé/Réalisé)
      db.activity.count({ where: overdueWhere }),

      // Min start date and max end date
      db.activity.aggregate({
        where,
        _min: { startDate: true },
        _max: { endDate: true },
      }),

      // C3: Use aggregate with _avg for duration instead of findMany
      // Calculate average duration using SQL aggregate (no memory bomb)
      // Note: raw query can't accept Prisma where object, so we build SQL conditions
      buildDurationQuery(params),
    ]);

    // Calculate average duration from aggregate
    const avgDurationDays = durationStats[0]?.avgDays
      ? Math.round(durationStats[0].avgDays)
      : 0;

    // Date range
    // M4: Handle null timelineStart/timelineEnd (DateTime fields return Date | null)
    const timelineStart = minMaxDates._min.startDate ?? null;
    const timelineEnd = minMaxDates._max.endDate ?? null;

    // m2: Handle NaN in stats (null progressRate from aggregate)
    const rawAvg = avgProgress._avg.progressRate;
    const avgProgressRate = rawAvg !== null && !isNaN(rawAvg) ? Math.round(rawAvg * 10) / 10 : 0;

    return NextResponse.json({
      data: {
        totalPlanned,
        avgProgressRate,
        overdueCount,
        avgDurationDays,
        timelineStart,
        timelineEnd,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/gantt/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Build a raw SQL duration query that respects the same filters as buildFilterWhere.
 * This avoids loading all activities into memory just to compute an average.
 */
function buildDurationQuery(params: GanttFilterValues) {
  const conditions: string[] = [
    '"deletedAt" IS NULL',
    '"isActive" = true',
    '"startDate" IS NOT NULL',
    '"endDate" IS NOT NULL',
  ];

  if (params.search) {
    const escaped = params.search.replace(/'/g, "''");
    conditions.push(`("title" ILIKE '%${escaped}%' OR "activityCode" ILIKE '%${escaped}%')`);
  }

  if (params.directionId) {
    conditions.push(`"directionId" = '${params.directionId.replace(/'/g, "''")}'`);
  }

  if (params.primaryAxisId) {
    conditions.push(`"primaryAxisId" = '${params.primaryAxisId.replace(/'/g, "''")}'`);
  }

  if (params.status) {
    conditions.push(`"status" = '${params.status.replace(/'/g, "''")}'`);
  }

  if (params.priority) {
    conditions.push(`"priority" = '${params.priority.replace(/'/g, "''")}'`);
  }

  if (params.validationStatus) {
    conditions.push(`"validationStatus" = '${params.validationStatus.replace(/'/g, "''")}'`);
  }

  const whereClause = conditions.join(" AND ");
  return db.$queryRawUnsafe<
    Array<{ avgDays: number | null }>
  >(`SELECT AVG(EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400) as "avgDays" FROM "Activity" WHERE ${whereClause}`);
}
