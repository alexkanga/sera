import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// ============================================================
// GET /api/reports/stats — Statistiques de la section rapports
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "reports:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Base filters for active records
    const templateWhere = {
      deletedAt: null,
      isActive: true,
    };

    const reportWhere = {
      deletedAt: null,
      isActive: true,
    };

    // Run parallel queries for performance
    const [
      totalTemplates,
      totalReports,
      reportsByStatusRaw,
      reportsByTypeRaw,
      lastGeneratedReport,
      archivedReportsCount,
      recentReportsRaw,
    ] = await Promise.all([
      // Total active templates
      db.reportTemplate.count({ where: templateWhere }),

      // Total generated reports (active)
      db.report.count({ where: reportWhere }),

      // Reports by status — E8 fix: Use groupBy for efficiency
      db.report.groupBy({
        by: ['status'],
        where: reportWhere,
        _count: { status: true },
      }),

      // Reports by type — E8 fix: Use groupBy for efficiency
      db.report.groupBy({
        by: ['type'],
        where: reportWhere,
        _count: { type: true },
      }),

      // Last generated report date
      db.report.findFirst({
        where: reportWhere,
        orderBy: { generatedAt: "desc" as const },
        select: {
          id: true,
          title: true,
          generatedAt: true,
          generatedBy: {
            select: { id: true, name: true },
          },
        },
      }),

      // Archived reports count
      db.report.count({
        where: { deletedAt: { not: null } },
      }),

      // Recent 5 reports
      db.report.findMany({
        where: reportWhere,
        orderBy: { generatedAt: "desc" as const },
        take: 5,
        select: {
          id: true,
          title: true,
          period: true,
          status: true,
          generatedAt: true,
          template: {
            select: { name: true },
          },
        },
      }),
    ]);

    // Process reports by status — E8 fix: groupBy result format
    const reportsByStatus = reportsByStatusRaw.map((r) => ({
      status: r.status || "Non défini",
      count: r._count.status,
    }));
    // Rebuild statusMap from groupBy results
    const statusMap = new Map<string, number>();
    for (const r of reportsByStatus) {
      statusMap.set(r.status, r.count);
    }

    // Process reports by type — E8 fix: groupBy result format
    const reportsByType = reportsByTypeRaw.map((r) => ({
      type: r.type || "Non défini",
      count: r._count.type,
    }));

    // E1 fix: Return full stats matching frontend ReportStats interface
    return NextResponse.json({
      data: {
        totalTemplates,
        totalReports,
        generatedReports: statusMap.get("Généré") || 0,
        validatedReports: statusMap.get("Validé") || 0,
        rejectedReports: statusMap.get("Rejeté") || 0,
        draftReports: statusMap.get("Brouillon") || 0,
        archivedReports: archivedReportsCount,
        lastGeneration: lastGeneratedReport?.generatedAt || null,
        pendingValidation: statusMap.get("Généré") || 0,
        byStatus: reportsByStatus,
        byType: reportsByType,
        recentReports: recentReportsRaw.map((r) => ({
          id: r.id,
          title: r.title,
          period: r.period,
          status: r.status,
          generatedAt: r.generatedAt,
          templateName: r.template?.name || "—",
        })),
      },
    }, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (error) {
    console.error("Erreur GET /api/reports/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
