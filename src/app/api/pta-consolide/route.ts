import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

// ============================================================
// GET /api/pta-consolide?mode=stats — Statistiques consolidées
// GET /api/pta-consolide — Liste consolidée avec filtres et groupBy
// ============================================================

const groupBySchema = z.enum([
  "direction",
  "axis",
  "domain",
  "responsible",
  "priority",
  "status",
]);

const filterSchema = z.object({
  search: z.string().optional(),
  directionId: z.string().optional(),
  primaryAxisId: z.string().optional(),
  secondaryAxisId: z.string().optional(),
  acbfDomainId: z.string().optional(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  validationStatus: z.enum(["Brouillon", "Soumis", "Validé", "Rejeté"]).optional(),
  activityStatus: z.string().optional(),
  responsibleId: z.string().optional(),
  groupBy: groupBySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// Common include for consolidated activities
const consolidatedInclude = {
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

// Base where clause: only active (non-archived) activities
function getBaseWhere(): Record<string, unknown> {
  return {
    deletedAt: null,
    isActive: true,
  };
}

// Build filter where clause from query parameters
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

  if (params.secondaryAxisId) {
    where.secondaryAxisId = params.secondaryAxisId;
  }

  if (params.acbfDomainId) {
    where.acbfDomainId = params.acbfDomainId;
  }

  if (params.priority) {
    where.priority = params.priority;
  }

  if (params.validationStatus) {
    where.validationStatus = params.validationStatus;
  }

  if (params.activityStatus) {
    where.status = params.activityStatus;
  }

  if (params.responsibleId) {
    where.responsibleId = params.responsibleId;
  }

  return where;
}

// ============================================================
// STATS endpoint
// ============================================================
async function handleStats() {
  const baseWhere = getBaseWhere();

  // Run all count queries in parallel
  const [
    totalCount,
    statusCounts,
    priorityCounts,
    validationCounts,
    directionCounts,
    axisCounts,
    domainCounts,
    avgProgress,
    overdueCount,
    startingThisMonthCount,
    highRiskCount,
  ] = await Promise.all([
    // Total active activities
    db.activity.count({ where: baseWhere }),

    // Activities by status
    db.activity.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { status: true },
    }),

    // Activities by priority
    db.activity.groupBy({
      by: ["priority"],
      where: baseWhere,
      _count: { priority: true },
    }),

    // Activities by validation status
    db.activity.groupBy({
      by: ["validationStatus"],
      where: baseWhere,
      _count: { validationStatus: true },
    }),

    // Activities by direction (with direction names)
    db.activity.groupBy({
      by: ["directionId"],
      where: { ...baseWhere, directionId: { not: null } },
      _count: { directionId: true },
      _avg: { progressRate: true },
    }),

    // Activities by primary axis (with axis names)
    db.activity.groupBy({
      by: ["primaryAxisId"],
      where: { ...baseWhere, primaryAxisId: { not: null } },
      _count: { primaryAxisId: true },
      _avg: { progressRate: true },
    }),

    // Activities by ACBF domain (with domain names)
    db.activity.groupBy({
      by: ["acbfDomainId"],
      where: { ...baseWhere, acbfDomainId: { not: null } },
      _count: { acbfDomainId: true },
      _avg: { progressRate: true },
    }),

    // Average progress rate overall
    db.activity.aggregate({
      where: baseWhere,
      _avg: { progressRate: true },
    }),

    // Overdue activities (endDate < now and status not "Réalisé")
    db.activity.count({
      where: {
        ...baseWhere,
        endDate: { lt: new Date() },
        status: { notIn: ["Réalisé", "Terminé", "Annulé"] },
      },
    }),

    // Activities starting this month
    db.activity.count({
      where: {
        ...baseWhere,
        startDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    }),

    // High-risk activities (those with a risk description filled)
    db.activity.count({
      where: {
        ...baseWhere,
        riskDescription: { not: "" },
      },
    }),
  ]);

  // Fetch direction names for directionCounts
  const directionIds = directionCounts
    .map((d) => d.directionId)
    .filter((id): id is string => id !== null);

  const directions = directionIds.length > 0
    ? await db.direction.findMany({
        where: { id: { in: directionIds } },
        select: { id: true, code: true, name: true },
      })
    : [];

  const directionMap = new Map(directions.map((d) => [d.id, d]));

  // Fetch axis names for axisCounts
  const axisIds = axisCounts
    .map((a) => a.primaryAxisId)
    .filter((id): id is string => id !== null);

  const axes = axisIds.length > 0
    ? await db.strategicAxis.findMany({
        where: { id: { in: axisIds } },
        select: { id: true, code: true, name: true },
      })
    : [];

  const axisMap = new Map(axes.map((a) => [a.id, a]));

  // Fetch domain names for domainCounts
  const domainIds = domainCounts
    .map((d) => d.acbfDomainId)
    .filter((id): id is string => id !== null);

  const domains = domainIds.length > 0
    ? await db.acbfDomain.findMany({
        where: { id: { in: domainIds } },
        select: { id: true, code: true, name: true },
      })
    : [];

  const domainMap = new Map(domains.map((d) => [d.id, d]));

  // Build response
  const byStatus: Record<string, number> = {};
  const allStatuses = [
    "Non démarré",
    "En cours",
    "Réalisé",
    "En retard",
    "Suspendu",
    "À reprogrammer",
    "Terminé",
    "Annulé",
  ];
  allStatuses.forEach((s) => (byStatus[s] = 0));
  statusCounts.forEach((s) => {
    byStatus[s.status] = s._count.status;
  });

  const byPriority: Record<string, number> = {};
  const allPriorities = ["Haute", "Moyenne", "Basse"];
  allPriorities.forEach((p) => (byPriority[p] = 0));
  priorityCounts.forEach((p) => {
    byPriority[p.priority] = byPriority[p.priority] ?? 0;
    byPriority[p.priority] += p._count.priority;
  });

  const byValidationStatus: Record<string, number> = {};
  const allValidations = ["Brouillon", "Soumis", "Validé", "Rejeté"];
  allValidations.forEach((v) => (byValidationStatus[v] = 0));
  validationCounts.forEach((v) => {
    byValidationStatus[v.validationStatus] = byValidationStatus[v.validationStatus] ?? 0;
    byValidationStatus[v.validationStatus] += v._count.validationStatus;
  });

  const byDirection = directionCounts.map((d) => {
    const dirInfo = directionMap.get(d.directionId as string);
    return {
      directionId: d.directionId,
      directionCode: dirInfo?.code ?? null,
      directionName: dirInfo?.name ?? "Sans direction",
      count: d._count.directionId,
      avgProgress: Math.round((d._avg.progressRate ?? 0) * 100) / 100,
    };
  });

  const byAxis = axisCounts.map((a) => {
    const axisInfo = axisMap.get(a.primaryAxisId as string);
    return {
      axisId: a.primaryAxisId,
      axisCode: axisInfo?.code ?? null,
      axisName: axisInfo?.name ?? "Sans axe",
      count: a._count.primaryAxisId,
      avgProgress: Math.round((a._avg.progressRate ?? 0) * 100) / 100,
    };
  });

  const byDomain = domainCounts.map((d) => {
    const domainInfo = domainMap.get(d.acbfDomainId as string);
    return {
      domainId: d.acbfDomainId,
      domainCode: domainInfo?.code ?? null,
      domainName: domainInfo?.name ?? "Sans domaine",
      count: d._count.acbfDomainId,
      avgProgress: Math.round((d._avg.progressRate ?? 0) * 100) / 100,
    };
  });

  // Average progress per direction (for response)
  const avgProgressPerDirection = byDirection.map((d) => ({
    directionId: d.directionId,
    directionName: d.directionName,
    avgProgress: d.avgProgress,
  }));

  // Average progress per axis (for response)
  const avgProgressPerAxis = byAxis.map((a) => ({
    axisId: a.axisId,
    axisName: a.axisName,
    avgProgress: a.avgProgress,
  }));

  return NextResponse.json({
    data: {
      totalActivities: totalCount,
      byStatus,
      byPriority,
      byValidationStatus,
      byDirection,
      byAxis,
      byDomain,
      avgProgressOverall: Math.round((avgProgress._avg.progressRate ?? 0) * 100) / 100,
      avgProgressPerDirection,
      avgProgressPerAxis,
      overdueCount,
      startingThisMonthCount,
      highRiskCount,
    },
  });
}

// ============================================================
// GROUPED endpoint — when groupBy is specified
// ============================================================
async function handleGrouped(params: z.infer<typeof filterSchema>) {
  const where = buildFilterWhere(params);
  const groupBy = params.groupBy!;

  // Map groupBy param to Activity field
  const groupByFieldMap: Record<string, string> = {
    direction: "directionId",
    axis: "primaryAxisId",
    domain: "acbfDomainId",
    responsible: "responsibleId",
    priority: "priority",
    status: "status",
  };

  const fieldName = groupByFieldMap[groupBy];

  // For null values in FK fields, we need special handling
  const whereForGroup = { ...where };

  // For FK fields, include null groups too
  if (["directionId", "primaryAxisId", "acbfDomainId"].includes(fieldName)) {
    // Don't filter out null values — include them in grouping
  }

  // Use type assertion to satisfy Prisma's groupBy type requirements
  const grouped = await db.activity.groupBy({
    by: [fieldName] as unknown as ["directionId"],
    where: whereForGroup,
    _count: true,
    _avg: { progressRate: true },
  });

  // Enrich with names
  let enrichedGroups: Array<Record<string, unknown>> = [];

  if (groupBy === "direction") {
    const ids = grouped
      .map((g) => (g as Record<string, unknown>).directionId as string | null)
      .filter((id): id is string => id !== null);
    const entities = ids.length > 0
      ? await db.direction.findMany({
          where: { id: { in: ids } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    enrichedGroups = grouped.map((g) => {
      const dirInfo = entityMap.get((g as Record<string, unknown>).directionId as string);
      return {
        directionId: (g as Record<string, unknown>).directionId,
        directionCode: dirInfo?.code ?? null,
        directionName: dirInfo?.name ?? "Sans direction",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  } else if (groupBy === "axis") {
    const ids = grouped
      .map((g) => (g as Record<string, unknown>).primaryAxisId as string | null)
      .filter((id): id is string => id !== null);
    const entities = ids.length > 0
      ? await db.strategicAxis.findMany({
          where: { id: { in: ids } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    enrichedGroups = grouped.map((g) => {
      const axisInfo = entityMap.get((g as Record<string, unknown>).primaryAxisId as string);
      return {
        axisId: (g as Record<string, unknown>).primaryAxisId,
        axisCode: axisInfo?.code ?? null,
        axisName: axisInfo?.name ?? "Sans axe",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  } else if (groupBy === "domain") {
    const ids = grouped
      .map((g) => (g as Record<string, unknown>).acbfDomainId as string | null)
      .filter((id): id is string => id !== null);
    const entities = ids.length > 0
      ? await db.acbfDomain.findMany({
          where: { id: { in: ids } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    enrichedGroups = grouped.map((g) => {
      const domainInfo = entityMap.get((g as Record<string, unknown>).acbfDomainId as string);
      return {
        domainId: (g as Record<string, unknown>).acbfDomainId,
        domainCode: domainInfo?.code ?? null,
        domainName: domainInfo?.name ?? "Sans domaine",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  } else if (groupBy === "responsible") {
    const ids = grouped
      .map((g) => (g as Record<string, unknown>).responsibleId as string)
      .filter((id): id is string => id !== null);
    const entities = ids.length > 0
      ? await db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, ptaCode: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    enrichedGroups = grouped.map((g) => {
      const userInfo = entityMap.get((g as Record<string, unknown>).responsibleId as string);
      return {
        responsibleId: (g as Record<string, unknown>).responsibleId,
        responsibleName: userInfo?.name ?? "Inconnu",
        responsibleEmail: userInfo?.email ?? null,
        responsiblePtaCode: userInfo?.ptaCode ?? null,
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  } else if (groupBy === "priority") {
    enrichedGroups = grouped.map((g) => ({
      priority: (g as Record<string, unknown>).priority,
      count: g._count,
      avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
    }));
  } else if (groupBy === "status") {
    enrichedGroups = grouped.map((g) => ({
      status: (g as Record<string, unknown>).status,
      count: g._count,
      avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
    }));
  }

  return NextResponse.json({
    data: enrichedGroups,
    groupBy,
    total: grouped.reduce((sum, g) => sum + g._count, 0),
  });
}

// ============================================================
// LIST endpoint — consolidated activities with filters
// ============================================================
async function handleList(params: z.infer<typeof filterSchema>) {
  const where = buildFilterWhere(params);
  const skip = (params.page - 1) * params.limit;

  const [activities, total] = await Promise.all([
    db.activity.findMany({
      where,
      include: consolidatedInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.limit,
    }),
    db.activity.count({ where }),
  ]);

  return NextResponse.json({
    data: activities,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
}

// ============================================================
// Main GET handler
// ============================================================
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
    const mode = searchParams.get("mode");

    // Stats mode
    if (mode === "stats") {
      return await handleStats();
    }

    // Parse and validate filters
    const parseResult = filterSchema.safeParse({
      search: searchParams.get("search") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      primaryAxisId: searchParams.get("primaryAxisId") || undefined,
      secondaryAxisId: searchParams.get("secondaryAxisId") || undefined,
      acbfDomainId: searchParams.get("acbfDomainId") || undefined,
      priority: searchParams.get("priority") || undefined,
      validationStatus: searchParams.get("validationStatus") || undefined,
      activityStatus: searchParams.get("activityStatus") || undefined,
      responsibleId: searchParams.get("responsibleId") || undefined,
      groupBy: searchParams.get("groupBy") || undefined,
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;

    // Grouped mode
    if (params.groupBy) {
      return await handleGrouped(params);
    }

    // List mode (default)
    return await handleList(params);
  } catch (error) {
    console.error("Erreur GET /api/pta-consolide:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
