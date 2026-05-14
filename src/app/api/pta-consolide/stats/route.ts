import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/pta-consolide/stats — Statistiques consolidées
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

    // Only active (non-archived) activities
    const baseWhere = {
      deletedAt: null,
      isActive: true,
    };

    const [
      totalActivities,
      avgProgress,
      lateActivities,
      highPriorityActivities,
      validatedCount,
      totalWithRisk,
    ] = await Promise.all([
      // Total active activities
      db.activity.count({ where: baseWhere }),

      // Average progress rate
      db.activity.aggregate({
        where: baseWhere,
        _avg: { progressRate: true },
      }),

      // Activities en retard (endDate < now AND status not in terminal states)
      db.activity.count({
        where: {
          ...baseWhere,
          endDate: { lt: new Date() },
          status: { notIn: ["Réalisé", "Terminé", "Annulé"] },
        },
      }),

      // High priority activities
      db.activity.count({
        where: {
          ...baseWhere,
          priority: "Haute",
        },
      }),

      // Validated activities
      db.activity.count({
        where: {
          ...baseWhere,
          validationStatus: "Validé",
        },
      }),

      // Activities with risk description
      db.activity.count({
        where: {
          ...baseWhere,
          riskDescription: { not: null },
          NOT: { riskDescription: "" },
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        totalActivities,
        avgProgressRate: Math.round((avgProgress._avg.progressRate || 0) * 10) / 10,
        lateActivities,
        highPriorityActivities,
        validatedCount,
        totalWithRisk,
        validationRate: totalActivities > 0
          ? Math.round((validatedCount / totalActivities) * 1000) / 10
          : 0,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/pta-consolide/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
