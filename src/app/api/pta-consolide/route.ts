import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { ptaConsolideFilterSchema } from "@/lib/validations";

// ============================================================
// GET /api/pta-consolide — Liste consolidée avec filtres et groupBy
// Note: Stats are served by /api/pta-consolide/stats (dedicated endpoint)
// ============================================================

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
function buildFilterWhere(params: z.infer<typeof ptaConsolideFilterSchema>): Record<string, unknown> {
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
// GROUPED endpoint — when groupBy is specified
// ============================================================

interface GroupedResult {
  groupKey: string;
  groupLabel: string;
  count: number;
  avgProgress: number;
  [key: string]: unknown;
}

async function handleGrouped(params: z.infer<typeof ptaConsolideFilterSchema>): Promise<GroupedResult[]> {
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

  // Use type assertion to satisfy Prisma's groupBy type requirements
  const grouped = await db.activity.groupBy({
    by: [fieldName] as unknown as ["directionId"],
    where,
    _count: true,
    _avg: { progressRate: true },
  });

  // Enrich with names based on groupBy type
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
    return grouped.map((g) => {
      const dirInfo = entityMap.get((g as Record<string, unknown>).directionId as string);
      return {
        groupKey: "direction",
        groupLabel: dirInfo?.name ?? "Sans direction",
        directionId: (g as Record<string, unknown>).directionId,
        directionCode: dirInfo?.code ?? null,
        directionName: dirInfo?.name ?? "Sans direction",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  }

  if (groupBy === "axis") {
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
    return grouped.map((g) => {
      const axisInfo = entityMap.get((g as Record<string, unknown>).primaryAxisId as string);
      return {
        groupKey: "axis",
        groupLabel: axisInfo?.name ?? "Sans axe",
        axisId: (g as Record<string, unknown>).primaryAxisId,
        axisCode: axisInfo?.code ?? null,
        axisName: axisInfo?.name ?? "Sans axe",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  }

  if (groupBy === "domain") {
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
    return grouped.map((g) => {
      const domainInfo = entityMap.get((g as Record<string, unknown>).acbfDomainId as string);
      return {
        groupKey: "domain",
        groupLabel: domainInfo?.name ?? "Sans domaine",
        domainId: (g as Record<string, unknown>).acbfDomainId,
        domainCode: domainInfo?.code ?? null,
        domainName: domainInfo?.name ?? "Sans domaine",
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  }

  if (groupBy === "responsible") {
    const ids = grouped
      .map((g) => (g as Record<string, unknown>).responsibleId as string | null)
      .filter((id): id is string => id !== null);
    const entities = ids.length > 0
      ? await db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, ptaCode: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));
    return grouped.map((g) => {
      const userInfo = entityMap.get((g as Record<string, unknown>).responsibleId as string);
      return {
        groupKey: "responsible",
        groupLabel: userInfo?.name ?? "Inconnu",
        responsibleId: (g as Record<string, unknown>).responsibleId,
        responsibleName: userInfo?.name ?? "Inconnu",
        responsibleEmail: userInfo?.email ?? null,
        responsiblePtaCode: userInfo?.ptaCode ?? null,
        count: g._count,
        avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
      };
    });
  }

  if (groupBy === "priority") {
    return grouped.map((g) => ({
      groupKey: "priority",
      groupLabel: String((g as Record<string, unknown>).priority),
      priority: (g as Record<string, unknown>).priority,
      count: g._count,
      avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
    }));
  }

  // status
  return grouped.map((g) => ({
    groupKey: "status",
    groupLabel: String((g as Record<string, unknown>).status),
    status: (g as Record<string, unknown>).status,
    count: g._count,
    avgProgress: Math.round((g._avg.progressRate ?? 0) * 100) / 100,
  }));
}

// ============================================================
// LIST endpoint — consolidated activities with filters
// ============================================================
async function handleList(params: z.infer<typeof ptaConsolideFilterSchema>) {
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

    // Parse and validate filters using centralized schema
    const parseResult = ptaConsolideFilterSchema.safeParse({
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
      const enrichedGroups = await handleGrouped(params);
      return NextResponse.json({
        data: enrichedGroups,
        groupBy: params.groupBy,
        total: enrichedGroups.reduce((sum, g) => sum + g.count, 0),
      });
    }

    // List mode (default)
    return await handleList(params);
  } catch (error) {
    console.error("Erreur GET /api/pta-consolide:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
