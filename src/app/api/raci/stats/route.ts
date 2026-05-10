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

    // Enrich strategic axis counts with axis names
    const byStrategicAxis: Array<{
      strategicAxisId: string;
      axisCode: string;
      axisName: string;
      count: number;
    }> = [];
    for (const item of byStrategicAxisRaw) {
      if (item.strategicAxisId) {
        const axis = await db.strategicAxis.findUnique({
          where: { id: item.strategicAxisId },
          select: { code: true, name: true },
        });
        if (axis) {
          byStrategicAxis.push({
            strategicAxisId: item.strategicAxisId,
            axisCode: axis.code,
            axisName: axis.name,
            count: item._count.strategicAxisId,
          });
        }
      }
    }

    return NextResponse.json({
      data: {
        totalActive,
        raciRoleDistribution,
        byPriority,
        byStrategicAxis,
        linkedUsersCount,
        linkedDeliverablesCount,
        linkedActivitiesCount,
        overdueCount,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/raci/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
