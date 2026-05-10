import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/gantt/stats — Gantt timeline statistics
export async function GET() {
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
      avgDurationResult,
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

      // Average duration in days (activities with both start and end dates)
      db.activity.findMany({
        where: {
          ...baseWhere,
          endDate: { not: null },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);

    // Calculate average duration
    let avgDurationDays = 0;
    if (avgDurationResult.length > 0) {
      const totalDays = avgDurationResult.reduce((sum, a) => {
        if (a.startDate && a.endDate) {
          const diff = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
          return sum + Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }
        return sum;
      }, 0);
      avgDurationDays = Math.round(totalDays / avgDurationResult.length);
    }

    // Date range
    const timelineStart = minMaxDates._min.startDate;
    const timelineEnd = minMaxDates._max.endDate;

    return NextResponse.json({
      data: {
        totalPlanned,
        avgProgressRate: Math.round((avgProgress._avg.progressRate || 0) * 10) / 10,
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
