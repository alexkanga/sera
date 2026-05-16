import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// ============================================================
// GET /api/kpi/dashboard — Données agrégées du tableau de bord
// Supports ?format=csv for CSV export, ?format=json (default) for JSON
// ============================================================

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

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
      byStatusGrouped,
      byPriorityGrouped,
      byDomainRaw,
      byValidationGrouped,
      totalActivitiesLastMonth,
      validationByDirectionRaw,
      evidenceTotal,
      evidenceVerified,
      evidenceByCategoryGrouped,
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

      // 5. By Direction — only select needed fields
      db.activity.findMany({
        where: baseWhere,
        select: {
          directionId: true,
          progressRate: true,
          direction: { select: { id: true, code: true, name: true } },
        },
      }),

      // 6. By Strategic Axis — only select needed fields
      db.activity.findMany({
        where: baseWhere,
        select: {
          primaryAxisId: true,
          progressRate: true,
          primaryAxis: { select: { id: true, code: true, name: true } },
        },
      }),

      // 7. By Status — use groupBy
      db.activity.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: { status: true },
      }),

      // 8. By Priority — use groupBy
      db.activity.groupBy({
        by: ["priority"],
        where: baseWhere,
        _count: { priority: true },
      }),

      // 9. By ACBF Domain — only select needed fields
      db.activity.findMany({
        where: baseWhere,
        select: {
          acbfDomainId: true,
          acbfDomain: { select: { id: true, code: true, name: true } },
        },
      }),

      // 10. By Validation Status — use groupBy
      db.activity.groupBy({
        by: ["validationStatus"],
        where: baseWhere,
        _count: { validationStatus: true },
      }),

      // 11. C2: Total activities from previous month
      db.activity.count({
        where: {
          ...baseWhere,
          OR: [
            {
              createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
                lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
            {
              updatedAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
                lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          ],
        },
      }),

      // 12. C3: Validation pipeline by direction — select direction + validationStatus
      db.activity.findMany({
        where: baseWhere,
        select: {
          validationStatus: true,
          directionId: true,
          direction: { select: { id: true, name: true } },
        },
      }),

      // 13. Evidence total
      db.evidenceFile.count({
        where: { deletedAt: null, isActive: true },
      }),

      // 14. Evidence verified
      db.evidenceFile.count({
        where: { deletedAt: null, isActive: true, isVerified: true },
      }),

      // 15. Evidence by category — use groupBy
      db.evidenceFile.groupBy({
        by: ["category"],
        where: { deletedAt: null, isActive: true },
        _count: { category: true },
      }),

      // 16. RACI entries count
      db.raciMatrix.count({
        where: { deletedAt: null, isActive: true },
      }),

      // 17. Activities with RACI
      db.activity.count({
        where: {
          ...baseWhere,
          raciMatrix: { isNot: null },
        },
      }),

      // 18. KPI Definitions with current values
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
          isPublic: true,
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

      // 19. Monthly progress trend (last 6 months)
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

    // By Status distribution — from groupBy results
    const byStatus = byStatusGrouped.map((row) => ({
      status: row.status || "Non défini",
      count: row._count.status,
    }));

    // By Priority distribution — from groupBy results
    const byPriority = byPriorityGrouped.map((row) => ({
      priority: row.priority || "Non défini",
      count: row._count.priority,
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

    // By Validation Status distribution — from groupBy results
    const validationPipeline = byValidationGrouped.map((row) => ({
      status: row.validationStatus || "Non défini",
      count: row._count.validationStatus,
    }));

    // C3: Validation pipeline by direction — pivoted structure
    const validationDirMap = new Map<string, string>();
    for (const a of validationByDirectionRaw) {
      const dirName = a.direction?.name || "Non assigné";
      const vStatus = a.validationStatus || "Non défini";
      const key = `${dirName}__${vStatus}`;
      validationDirMap.set(key, (validationDirMap.get(key) || "0"));
      // We need to count, so let's use a counter map
    }

    // Recount with a proper counter map
    const validationDirCountMap = new Map<string, number>();
    const directionNames = new Set<string>();
    for (const a of validationByDirectionRaw) {
      const dirName = a.direction?.name || "Non assigné";
      const vStatus = a.validationStatus || "Non défini";
      directionNames.add(dirName);
      const key = `${dirName}|||${vStatus}`;
      validationDirCountMap.set(key, (validationDirCountMap.get(key) || 0) + 1);
    }

    const validationPipelineByDirection = Array.from(directionNames).map((dirName) => {
      const row: Record<string, string | number> = { direction: dirName };
      const statuses = ["Brouillon", "Soumis", "Validé", "Rejeté"];
      for (const s of statuses) {
        const key = `${dirName}|||${s}`;
        row[s] = validationDirCountMap.get(key) || 0;
      }
      return row;
    });

    // Evidence by category — from groupBy results
    const evidenceByCategory = evidenceByCategoryGrouped.map((row) => ({
      category: row.category || "Autre",
      count: row._count.category,
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

    const dashboardData = {
      // Global KPIs
      global: {
        totalActivities,
        avgProgress,
        validationRate,
        overdueCount,
        validatedCount,
        totalActivitiesLastMonth,
      },

      // Breakdowns
      byDirection,
      byStrategicAxis,
      byStatus,
      byPriority,
      byAcbfDomain,

      // Validation Pipeline
      validationPipeline,
      validationPipelineByDirection,

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
          isPublic: kpi.isPublic,
          strategicAxis: kpi.strategicAxis,
          orgDirection: kpi.orgDirection,
          latestSnapshot: snapshot || null,
          achievementRate: kpi.targetValue !== 0
            ? Math.round((kpi.currentValue / kpi.targetValue) * 1000) / 10
            : 0,
        };
      }),
    };

    // ============================================================
    // C5: CSV export support
    // ============================================================
    if (format === "csv") {
      const lines: string[] = [];

      // UTF-8 BOM for Excel compatibility
      const BOM = "\uFEFF";
      lines.push(BOM);

      // Global KPIs section
      lines.push("=== Indicateurs Globaux ===");
      lines.push("Indicateur,Valeur");
      lines.push(`Total activités,${dashboardData.global.totalActivities}`);
      lines.push(`Avancement moyen (%),${dashboardData.global.avgProgress}`);
      lines.push(`Taux validation (%),${dashboardData.global.validationRate}`);
      lines.push(`En retard,${dashboardData.global.overdueCount}`);
      lines.push(`Validées,${dashboardData.global.validatedCount}`);
      lines.push(`Activités mois précédent,${dashboardData.global.totalActivitiesLastMonth}`);
      lines.push("");

      // By Direction
      lines.push("=== Par Direction ===");
      lines.push("Code,Nom,Nombre,Avancement moyen (%)");
      for (const d of dashboardData.byDirection) {
        lines.push(`"${d.code}","${d.name}",${d.count},${d.avgProgress}`);
      }
      lines.push("");

      // By Strategic Axis
      lines.push("=== Par Axe Stratégique ===");
      lines.push("Code,Nom,Nombre,Avancement moyen (%)");
      for (const a of dashboardData.byStrategicAxis) {
        lines.push(`"${a.code}","${a.name}",${a.count},${a.avgProgress}`);
      }
      lines.push("");

      // By Status
      lines.push("=== Par Statut ===");
      lines.push("Statut,Nombre");
      for (const s of dashboardData.byStatus) {
        lines.push(`"${s.status}",${s.count}`);
      }
      lines.push("");

      // By Priority
      lines.push("=== Par Priorité ===");
      lines.push("Priorité,Nombre");
      for (const p of dashboardData.byPriority) {
        lines.push(`"${p.priority}",${p.count}`);
      }
      lines.push("");

      // By ACBF Domain
      lines.push("=== Par Domaine ACBF ===");
      lines.push("Code,Nom,Nombre");
      for (const d of dashboardData.byAcbfDomain) {
        lines.push(`"${d.code}","${d.name}",${d.count}`);
      }
      lines.push("");

      // Validation Pipeline
      lines.push("=== Pipeline de Validation ===");
      lines.push("Statut,Nombre");
      for (const v of dashboardData.validationPipeline) {
        lines.push(`"${v.status}",${v.count}`);
      }
      lines.push("");

      // Validation Pipeline by Direction
      lines.push("=== Pipeline de Validation par Direction ===");
      lines.push("Direction,Brouillon,Soumis,Validé,Rejeté");
      for (const row of dashboardData.validationPipelineByDirection) {
        lines.push(`"${row.direction}",${row["Brouillon"] || 0},${row["Soumis"] || 0},${row["Validé"] || 0},${row["Rejeté"] || 0}`);
      }
      lines.push("");

      // Evidence
      lines.push("=== Preuves ===");
      lines.push("Indicateur,Valeur");
      lines.push(`Total,${dashboardData.evidence.total}`);
      lines.push(`Vérifiées,${dashboardData.evidence.verified}`);
      lines.push(`Taux vérification (%),${dashboardData.evidence.verificationRate}`);
      lines.push("");
      lines.push("Catégorie,Nombre");
      for (const c of dashboardData.evidence.byCategory) {
        lines.push(`"${c.category}",${c.count}`);
      }
      lines.push("");

      // RACI
      lines.push("=== RACI ===");
      lines.push("Indicateur,Valeur");
      lines.push(`Total entrées RACI,${dashboardData.raci.totalRaciEntries}`);
      lines.push(`Activités avec RACI,${dashboardData.raci.activitiesWithRaci}`);
      lines.push(`Couverture (%),${dashboardData.raci.coverage}`);
      lines.push("");

      // KPI Definitions
      lines.push("=== Définitions KPI ===");
      lines.push("Code,Nom,Catégorie,Cible,Actuel,Unité,Taux atteinte (%)");
      for (const kpi of dashboardData.kpiDefinitions) {
        lines.push(`"${kpi.code}","${kpi.name}","${kpi.category}",${kpi.targetValue},${kpi.currentValue},"${kpi.unit || ""}",${kpi.achievementRate}`);
      }

      const csvContent = lines.join("\n");
      const filename = `dashboard-kpi-${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: JSON response
    return NextResponse.json({
      data: dashboardData,
    });
  } catch (error) {
    console.error("Erreur GET /api/kpi/dashboard:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
