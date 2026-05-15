import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/gantt/stats — Gantt timeline statistics
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

    // Only active activities with dates
    const baseWhere = {
      deletedAt: null,
      isActive: true,
      startDate: { not: null },
    };

    const [
      totalPlanned,
      avgProgress,
      overdueCount,
      minMaxDates,
      // C3: Replace findMany with aggregate for avg duration calculation
      // Use a raw aggregate approach instead of loading all activities into memory
      durationStats,
    ] = await Promise.all([
      // Total activities with dates planned
      db.activity.count({ where: baseWhere }),

      // Average progress rate
      db.activity.aggregate({
        where: baseWhere,
        _avg: { progressRate: true },
      }),

      // Overdue count (endDate < now AND status not Terminé/Annulé/Réalisé)
      db.activity.count({
        where: {
          ...baseWhere,
          endDate: { lt: new Date() },
          status: { notIn: ["Réalisé", "Terminé", "Annulé"] },
        },
      }),

      // Min start date and max end date
      db.activity.aggregate({
        where: baseWhere,
        _min: { startDate: true },
        _max: { endDate: true },
      }),

      // C3: Use aggregate with _avg for duration instead of findMany
      // Calculate average duration using SQL aggregate (no memory bomb)
      db.$queryRaw<
        Array<{ avgDays: number | null }>
      >`SELECT AVG(EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400) as "avgDays" FROM "Activity" WHERE "deletedAt" IS NULL AND "isActive" = true AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL`,
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
