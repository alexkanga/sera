import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

// GET /api/imports/stats — Statistiques des imports
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "import:execute") ||
      userHasPermission(currentUser, "admin:*");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Run all aggregations in parallel
    const [
      totalImports,
      completedImports,
      partialImports,
      errorImports,
      sumAggregations,
      recentImports,
      importsByMonthRaw,
    ] = await Promise.all([
      db.importHistory.count(),

      db.importHistory.count({
        where: { status: "Terminé" },
      }),

      db.importHistory.count({
        where: { status: "Partiel" },
      }),

      db.importHistory.count({
        where: { status: "Erreur" },
      }),

      db.importHistory.aggregate({
        _sum: {
          createdRows: true,
          skippedRows: true,
          errorRows: true,
        },
      }),

      db.importHistory.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),

      // Group by month for the last 12 months
      db.$queryRaw<
        Array<{ month: string; count: bigint }>
      >`
        SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
        FROM "import_history"
        WHERE "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month DESC
      `,
    ]);

    // Format importsByMonth
    const importsByMonth = importsByMonthRaw.map((row) => ({
      month: row.month,
      count: Number(row.count),
    }));

    return NextResponse.json({
      data: {
        totalImports,
        completedImports,
        partialImports,
        errorImports,
        totalRowsImported: sumAggregations._sum.createdRows || 0,
        totalRowsSkipped: sumAggregations._sum.skippedRows || 0,
        totalRowsErrors: sumAggregations._sum.errorRows || 0,
        recentImports,
        importsByMonth,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/imports/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
