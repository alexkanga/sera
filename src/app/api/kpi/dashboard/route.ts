import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// ============================================================
// GET /api/kpi/dashboard — Données agrégées du tableau de bord
// ============================================================

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "kpi:read") ||
      userHasPermission(currentUser, "pta:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Base where clause: only active (non-archived) activities
    const baseWhere = {
      deletedAt: null,
      isActive: true,
    };

    // ============================================================
    // Parallel queries for maximum performance
    // ============================================================

    const [
      totalActivities,
      avgProgressResult,
      validatedCount,
      overdueCount,
      byDirectionRaw,
      byAxisRaw,
      byStatusRaw,
      byPriorityRaw,
      byDomainRaw,
      byValidationRaw,
      evidenceTotal,
      evidenceVerified,
      evidenceByCategoryRaw,
      raciCount,
      activitiesWithRaciCount,
      kpiDefinitions,
      monthlyProgressRaw,
    ] = await Promise.all([
      // 1. Total active activities
      db.activity.count({ where: baseWhere }),

      // 2. Average progress rate
      db.activity.aggregate({
        where: baseWhere,
        _avg: { progressRate: true },
      }),

      // 3. Validated activities count
      db.activity.count({
        where: { ...baseWhere, validationStatus: "Validé" },
      }),

      // 4. Overdue count (endDate < now AND status not Terminé/Annulé)
      db.activity.count({
        where: {
          ...baseWhere,
          endDate: { lt: new Date() },
          status: { notIn: ["Terminé", "Annulé"] },
        },
      }),

      // 5. By Direction
      db.activity.findMany({
        where: baseWhere,
        select: {
          directionId: true,
          progressRate: true,
          direction: { select: { id: true, code: true, name: true } },
        },
      }),

      // 6. By Strategic Axis
      db.activity.findMany({
        where: baseWhere,
        select: {
          primaryAxisId: true,
          progressRate: true,
          primaryAxis: { select: { id: true, code: true, name: true } },
        },
      }),

      // 7. By Status
      db.activity.findMany({
        where: baseWhere,
        select: { status: true },
      }),

      // 8. By Priority
      db.activity.findMany({
        where: baseWhere,
        select: { priority: true },
      }),

      // 9. By ACBF Domain
      db.activity.findMany({
        where: baseWhere,
        select: {
          acbfDomainId: true,
          acbfDomain: { select: { id: true, code: true, name: true } },
        },
      }),

      // 10. By Validation Status
      db.activity.findMany({
        where: baseWhere,
        select: { validationStatus: true },
      }),

      // 11. Evidence total
      db.evidenceFile.count({
        where: { deletedAt: null, isActive: true },
      }),

      // 12. Evidence verified
      db.evidenceFile.count({
        where: { deletedAt: null, isActive: true, isVerified: true },
      }),

      // 13. Evidence by category
      db.evidenceFile.findMany({
        where: { deletedAt: null, isActive: true },
        select: { category: true },
      }),

      // 14. RACI entries count
      db.raciMatrix.count({
        where: { deletedAt: null, isActive: true },
      }),

      // 15. Activities with RACI
      db.activity.count({
        where: {
          ...baseWhere,
          raciMatrix: { isNot: null },
        },
      }),

      // 16. KPI Definitions with current values
      db.kpiDefinition.findMany({
        where: { deletedAt: null, isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          direction: true,
          frequency: true,
          strategicAxis: { select: { code: true, name: true } },
          orgDirection: { select: { code: true, name: true } },
          snapshots: {
            orderBy: { capturedAt: "desc" as const },
            take: 1,
            select: {
              value: true,
              targetValue: true,
              period: true,
              capturedAt: true,
            },
          },
        },
        orderBy: { category: "asc" },
      }),

      // 17. Monthly progress trend (last 6 months)
      db.activity.findMany({
        where: {
          ...baseWhere,
          updatedAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
        select: {
          progressRate: true,
          updatedAt: true,
        },
      }),
    ]);

    // ============================================================
    // Process aggregated data
    // ============================================================

    const avgProgress = Math.round((avgProgressResult._avg.progressRate || 0) * 10) / 10;
    const validationRate = totalActivities > 0
      ? Math.round((validatedCount / totalActivities) * 1000) / 10
      : 0;

    // By Direction aggregation
    const directionMap = new Map<string, { code: string; name: string; count: number; totalProgress: number }>();
    for (const a of byDirectionRaw) {
      const dirId = a.directionId || "none";
      if (!directionMap.has(dirId)) {
        directionMap.set(dirId, {
          code: a.direction?.code || "Non assigné",
          name: a.direction?.name || "Non assigné",
          count: 0,
          totalProgress: 0,
        });
      }
      const entry = directionMap.get(dirId)!;
      entry.count++;
      entry.totalProgress += a.progressRate;
    }
    const byDirection = Array.from(directionMap.entries()).map(([id, val]) => ({
      id,
      code: val.code,
      name: val.name,
      count: val.count,
      avgProgress: Math.round((val.totalProgress / val.count) * 10) / 10,
    }));

    // By Strategic Axis aggregation
    const axisMap = new Map<string, { code: string; name: string; count: number; totalProgress: number }>();
    for (const a of byAxisRaw) {
      const axisId = a.primaryAxisId || "none";
      if (!axisMap.has(axisId)) {
        axisMap.set(axisId, {
          code: a.primaryAxis?.code || "Non assigné",
          name: a.primaryAxis?.name || "Non assigné",
          count: 0,
          totalProgress: 0,
        });
      }
      const entry = axisMap.get(axisId)!;
      entry.count++;
      entry.totalProgress += a.progressRate;
    }
    const byStrategicAxis = Array.from(axisMap.entries()).map(([id, val]) => ({
      id,
      code: val.code,
      name: val.name,
      count: val.count,
      avgProgress: Math.round((val.totalProgress / val.count) * 10) / 10,
    }));

    // By Status distribution
    const statusMap = new Map<string, number>();
    for (const a of byStatusRaw) {
      const status = a.status || "Non défini";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    }
    const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // By Priority distribution
    const priorityMap = new Map<string, number>();
    for (const a of byPriorityRaw) {
      const priority = a.priority || "Non défini";
      priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
    }
    const byPriority = Array.from(priorityMap.entries()).map(([priority, count]) => ({
      priority,
      count,
    }));

    // By ACBF Domain aggregation
    const domainMap = new Map<string, { code: string; name: string; count: number }>();
    for (const a of byDomainRaw) {
      const domainId = a.acbfDomainId || "none";
      if (!domainMap.has(domainId)) {
        domainMap.set(domainId, {
          code: a.acbfDomain?.code || "Non assigné",
          name: a.acbfDomain?.name || "Non assigné",
          count: 0,
        });
      }
      domainMap.get(domainId)!.count++;
    }
    const byAcbfDomain = Array.from(domainMap.entries()).map(([id, val]) => ({
      id,
      code: val.code,
      name: val.name,
      count: val.count,
    }));

    // By Validation Status distribution
    const validationMap = new Map<string, number>();
    for (const a of byValidationRaw) {
      const vStatus = a.validationStatus || "Non défini";
      validationMap.set(vStatus, (validationMap.get(vStatus) || 0) + 1);
    }
    const validationPipeline = Array.from(validationMap.entries()).map(([status, count]) => ({
      status,
      count,
    }));

    // Evidence by category
    const evidenceCategoryMap = new Map<string, number>();
    for (const e of evidenceByCategoryRaw) {
      const cat = e.category || "Autre";
      evidenceCategoryMap.set(cat, (evidenceCategoryMap.get(cat) || 0) + 1);
    }
    const evidenceByCategory = Array.from(evidenceCategoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    // Monthly progress trend (last 6 months)
    const monthlyMap = new Map<string, { totalProgress: number; count: number }>();
    for (const a of monthlyProgressRaw) {
      const date = new Date(a.updatedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { totalProgress: 0, count: 0 });
      }
      const entry = monthlyMap.get(monthKey)!;
      entry.totalProgress += a.progressRate;
      entry.count++;
    }
    const monthlyProgressTrend = Array.from(monthlyMap.entries())
      .map(([month, val]) => ({
        month,
        avgProgress: val.count > 0
          ? Math.round((val.totalProgress / val.count) * 10) / 10
          : 0,
        activityCount: val.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months

    // RACI Coverage
    const raciCoverage = totalActivities > 0
      ? Math.round((activitiesWithRaciCount / totalActivities) * 1000) / 10
      : 0;

    // ============================================================
    // Compose dashboard response
    // ============================================================

    return NextResponse.json({
      data: {
        // Global KPIs
        global: {
          totalActivities,
          avgProgress,
          validationRate,
          overdueCount,
          validatedCount,
        },

        // Breakdowns
        byDirection,
        byStrategicAxis,
        byStatus,
        byPriority,
        byAcbfDomain,

        // Validation Pipeline
        validationPipeline,

        // Evidence Stats
        evidence: {
          total: evidenceTotal,
          verified: evidenceVerified,
          verificationRate: evidenceTotal > 0
            ? Math.round((evidenceVerified / evidenceTotal) * 1000) / 10
            : 0,
          byCategory: evidenceByCategory,
        },

        // RACI Coverage
        raci: {
          totalRaciEntries: raciCount,
          activitiesWithRaci: activitiesWithRaciCount,
          coverage: raciCoverage,
        },

        // Monthly Progress Trend
        monthlyProgressTrend,

        // KPI Definitions
        kpiDefinitions: kpiDefinitions.map((kpi) => {
          const snapshot = kpi.snapshots[0];
          return {
            id: kpi.id,
            code: kpi.code,
            name: kpi.name,
            category: kpi.category,
            targetValue: kpi.targetValue,
            currentValue: kpi.currentValue,
            unit: kpi.unit,
            direction: kpi.direction,
            frequency: kpi.frequency,
            strategicAxis: kpi.strategicAxis,
            orgDirection: kpi.orgDirection,
            latestSnapshot: snapshot || null,
            achievementRate: kpi.targetValue !== 0
              ? Math.round((kpi.currentValue / kpi.targetValue) * 1000) / 10
              : 0,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/kpi/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
