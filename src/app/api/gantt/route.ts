import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { ganttFilterSchema, type GanttFilterValues } from "@/lib/validations";

// ============================================================
// GET /api/gantt — Activities for Gantt chart with filters
// ============================================================

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

    // C1: Use centralized ganttFilterSchema from validations.ts
    const parseResult = ganttFilterSchema.safeParse({
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

    // E4: Remove unused backend grouping computation — frontend handles grouping locally
    return NextResponse.json({
      data: activities,
      total: activities.length,
    });
  } catch (error) {
    console.error("Erreur GET /api/gantt:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
