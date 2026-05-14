import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/raci/stats — Statistiques de la matrice RACI
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "raci:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Base filter: only active (non-archived) entries
    const baseWhere = {
      deletedAt: null,
      isActive: true,
    };

    // Run parallel queries for performance
    const [
      totalActive,
      byPriorityRaw,
      byStrategicAxisRaw,
      linkedUsersCount,
      linkedDeliverablesCount,
      linkedActivitiesCount,
      overdueCount,
      allActiveEntries,
    ] = await Promise.all([
      // Total active entries
      db.raciMatrix.count({ where: baseWhere }),

      // By priority distribution
      db.raciMatrix.groupBy({
        by: ["priority"],
        where: { ...baseWhere, priority: { not: null } },
        _count: { priority: true },
      }),

      // By strategic axis (need axis names)
      db.raciMatrix.groupBy({
        by: ["strategicAxisId"],
        where: { ...baseWhere, strategicAxisId: { not: null } },
        _count: { strategicAxisId: true },
      }),

      // Entries with linked users (responsibleUserId or accountableUserId not null)
      db.raciMatrix.count({
        where: {
          ...baseWhere,
          OR: [
            { responsibleUserId: { not: null } },
            { accountableUserId: { not: null } },
          ],
        },
      }),

      // Entries with linked deliverables
      db.raciMatrix.count({
        where: {
          ...baseWhere,
          acbfDeliverableId: { not: null },
        },
      }),

      // Entries with linked activities
      db.raciMatrix.count({
        where: {
          ...baseWhere,
          activityId: { not: null },
        },
      }),

      // Overdue count (indicativeDeadline < now AND isActive)
      db.raciMatrix.count({
        where: {
          ...baseWhere,
          indicativeDeadline: { lt: new Date() },
        },
      }),

      // Get all active entries for RACI role distribution
      db.raciMatrix.findMany({
        where: baseWhere,
        select: {
          responsible: true,
          accountable: true,
          contributors: true,
          informed: true,
        },
      }),
    ]);

    // Compute RACI role distribution
    const raciRoleDistribution = {
      responsibleFilled: 0,
      accountableFilled: 0,
      contributorsFilled: 0,
      informedFilled: 0,
    };

    for (const entry of allActiveEntries) {
      if (entry.responsible && entry.responsible.trim() !== "") {
        raciRoleDistribution.responsibleFilled++;
      }
      if (entry.accountable && entry.accountable.trim() !== "") {
        raciRoleDistribution.accountableFilled++;
      }
      if (entry.contributors && entry.contributors.trim() !== "") {
        raciRoleDistribution.contributorsFilled++;
      }
      if (entry.informed && entry.informed.trim() !== "") {
        raciRoleDistribution.informedFilled++;
      }
    }

    // Enrich priority counts
    const byPriority: Record<string, number> = {};
    for (const item of byPriorityRaw) {
      byPriority[item.priority ?? "Non défini"] = item._count.priority;
    }

    // E1: Fix N+1 query — batch load strategic axes instead of sequential findUnique
    const axisIds = byStrategicAxisRaw
      .map((item) => item.strategicAxisId)
      .filter((id): id is string => id !== null);

    const axes = await db.strategicAxis.findMany({
      where: { id: { in: axisIds } },
      select: { id: true, code: true, name: true },
    });
    const axisMap = new Map(axes.map((a) => [a.id, a]));

    // E3: Use axisId key instead of strategicAxisId for frontend alignment
    const byStrategicAxis: Array<{
      axisId: string;
      axisCode: string;
      axisName: string;
      count: number;
    }> = [];
    for (const item of byStrategicAxisRaw) {
      if (item.strategicAxisId) {
        const axis = axisMap.get(item.strategicAxisId);
        if (axis) {
          byStrategicAxis.push({
            axisId: item.strategicAxisId,
            axisCode: axis.code,
            axisName: axis.name,
            count: item._count.strategicAxisId,
          });
        }
      }
    }

    // E3: Align stats response with frontend interface
    return NextResponse.json({
      data: {
        total: totalActive,
        withR: raciRoleDistribution.responsibleFilled,
        withA: raciRoleDistribution.accountableFilled,
        withC: raciRoleDistribution.contributorsFilled,
        withI: raciRoleDistribution.informedFilled,
        byPriority,
        byStrategicAxis,
        withLinkedUsers: linkedUsersCount,
        withLinkedDeliverables: linkedDeliverablesCount,
        withLinkedActivities: linkedActivitiesCount,
        overdue: overdueCount,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/raci/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
