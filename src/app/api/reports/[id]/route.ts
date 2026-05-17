import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/request-context";
import {
  updateReportTemplateSchema,
  generateReportSchema,
  reportActionSchema,
} from "@/lib/validations";
import { z } from "zod";

// ============================================================
// GET /api/reports/[id] — Détail d'un modèle de rapport ou rapport généré
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "reports:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    // Try to find as ReportTemplate first
    const template = await db.reportTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        reports: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            period: true,
            status: true,
            generatedAt: true,
            generatedBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { generatedAt: "desc" as const },
          take: 10,
        },
      },
    });

    if (template) {
      return NextResponse.json({ data: template, kind: "template" });
    }

    // Try to find as Report
    const report = await db.report.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            category: true,
            periodFormat: true,
            sections: true,
            filters: true,
            isSystem: true,
          },
        },
        generatedBy: {
          select: { id: true, name: true, email: true },
        },
        validatedBy: {
          select: { id: true, name: true, email: true },
        },
        direction: {
          select: { id: true, code: true, name: true },
        },
        strategicAxis: {
          select: { id: true, code: true, name: true },
        },
        acbfDomain: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (report) {
      return NextResponse.json({ data: report, kind: "report" });
    }

    return NextResponse.json(
      { error: "Rapport non trouvé" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Erreur GET /api/reports/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PUT /api/reports/[id] — Mettre à jour un modèle de rapport
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // M9 fix: Use reports:update instead of reports:write
    const hasAccess =
      userHasPermission(currentUser, "reports:create") ||
      userHasPermission(currentUser, "reports:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingTemplate = await db.reportTemplate.findUnique({
      where: { id },
    });
    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Modèle de rapport non trouvé" },
        { status: 404 }
      );
    }

    if (existingTemplate.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier un modèle archivé" },
        { status: 400 }
      );
    }

    if (existingTemplate.isSystem) {
      return NextResponse.json(
        { error: "Impossible de modifier un modèle système" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateReportTemplateSchema.parse(body);

    // E5 fix: Check for duplicate code on update
    if (validated.code !== undefined && validated.code !== existingTemplate.code) {
      const duplicate = await db.reportTemplate.findUnique({
        where: { code: validated.code },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Un modèle avec ce code existe déjà" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.type !== undefined) updateData.type = validated.type;
    if (validated.category !== undefined)
      updateData.category = validated.category;
    if (validated.periodFormat !== undefined)
      updateData.periodFormat = validated.periodFormat;
    if (validated.sections !== undefined) updateData.sections = validated.sections;
    if (validated.filters !== undefined) updateData.filters = validated.filters;

    const updatedTemplate = await db.reportTemplate.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // C1 fix: Include IP and User-Agent in audit logs
    const { ip, userAgent } = getIpAndUserAgent(request);

    // Audit log with oldValue/newValue comparison
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldValue[key] = (existingTemplate as Record<string, unknown>)[key];
      newValue[key] = updateData[key];
    }

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "ReportTemplate",
        entityId: id,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        details: `Mise à jour du modèle de rapport ${updatedTemplate.name}`,
        ipAddress: ip,
        userAgent: userAgent,
      },
    });

    return NextResponse.json({ data: updatedTemplate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/reports/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/reports/[id] — Actions: generate, validate, reject, archive, restore
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // C4 fix: Validate action body before switch
    const actionCheck = z.object({ action: z.string() }).safeParse(body);
    if (!actionCheck.success) {
      return NextResponse.json(
        { error: "Action invalide", details: actionCheck.error.issues },
        { status: 400 }
      );
    }
    const { action } = actionCheck.data;

    // C1 fix: Get IP and User-Agent once for all audit logs
    const { ip, userAgent } = getIpAndUserAgent(request);

    // ============================================================
    // GENERATE — Create a new Report from a template
    // ============================================================
    if (action === "generate") {
      const hasAccess = userHasPermission(currentUser, "reports:create");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const validated = generateReportSchema.parse(body);

      // Find the template
      const template = await db.reportTemplate.findUnique({
        where: { id },
      });
      if (!template) {
        return NextResponse.json(
          { error: "Modèle de rapport non trouvé" },
          { status: 404 }
        );
      }
      if (template.deletedAt) {
        return NextResponse.json(
          { error: "Impossible de générer un rapport à partir d'un modèle archivé" },
          { status: 400 }
        );
      }

      // Verify optional filter FKs
      if (validated.directionId) {
        const direction = await db.direction.findUnique({
          where: { id: validated.directionId },
        });
        if (!direction) {
          return NextResponse.json(
            { error: "La direction spécifiée n'existe pas" },
            { status: 400 }
          );
        }
      }

      if (validated.strategicAxisId) {
        const axis = await db.strategicAxis.findUnique({
          where: { id: validated.strategicAxisId },
        });
        if (!axis) {
          return NextResponse.json(
            { error: "L'axe stratégique spécifié n'existe pas" },
            { status: 400 }
          );
        }
      }

      if (validated.acbfDomainId) {
        const domain = await db.acbfDomain.findUnique({
          where: { id: validated.acbfDomainId },
        });
        if (!domain) {
          return NextResponse.json(
            { error: "Le domaine ACBF spécifié n'existe pas" },
            { status: 400 }
          );
        }
      }

      // Build where clause for activity aggregation
      const activityWhere: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };
      if (validated.directionId) {
        activityWhere.directionId = validated.directionId;
      }
      if (validated.strategicAxisId) {
        activityWhere.primaryAxisId = validated.strategicAxisId;
      }
      if (validated.acbfDomainId) {
        activityWhere.acbfDomainId = validated.acbfDomainId;
      }

      // Evidence where clause
      const evidenceWhere: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };

      // RACI where clause
      const raciWhere: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };

      // KPI where clause
      const kpiWhere: Record<string, unknown> = {
        deletedAt: null,
        isActive: true,
      };

      // Run parallel aggregation queries for performance
      const [
        activitiesByStatusRaw,
        avgProgressResult,
        activitiesByPriorityRaw,
        overdueCount,
        activitiesByDirectionRaw,
        activitiesByAxisRaw,
        evidenceTotal,
        evidenceVerified,
        raciCount,
        activitiesWithRaciCount,
        totalActivities,
      ] = await Promise.all([
        // Activities count by status
        db.activity.findMany({
          where: activityWhere,
          select: { status: true },
        }),

        // Average progress rate
        db.activity.aggregate({
          where: activityWhere,
          _avg: { progressRate: true },
        }),

        // Activities count by priority
        db.activity.findMany({
          where: activityWhere,
          select: { priority: true },
        }),

        // Overdue count (endDate < now, status not Terminé/Annulé)
        db.activity.count({
          where: {
            ...activityWhere,
            endDate: { lt: new Date() },
            status: { notIn: ["Terminé", "Annulé"] },
          },
        }),

        // Activities by direction
        db.activity.findMany({
          where: activityWhere,
          select: {
            directionId: true,
            direction: {
              select: { id: true, code: true, name: true },
            },
          },
        }),

        // Activities by strategic axis
        db.activity.findMany({
          where: activityWhere,
          select: {
            primaryAxisId: true,
            primaryAxis: {
              select: { id: true, code: true, name: true },
            },
          },
        }),

        // Evidence total
        db.evidenceFile.count({ where: evidenceWhere }),

        // Evidence verified
        db.evidenceFile.count({
          where: { ...evidenceWhere, isVerified: true },
        }),

        // RACI entries count
        db.raciMatrix.count({ where: raciWhere }),

        // Activities with RACI
        db.activity.count({
          where: {
            ...activityWhere,
            raciMatrix: { isNot: null },
          },
        }),

        // Total activities count
        db.activity.count({ where: activityWhere }),
      ]);

      // E7 fix: KPI average achievement — compute properly from individual rates
      const kpiDefinitions = await db.kpiDefinition.findMany({
        where: kpiWhere,
        select: { currentValue: true, targetValue: true },
      });
      const kpiAchievementRates = kpiDefinitions
        .filter((k) => k.targetValue && k.targetValue > 0)
        .map((k) => (k.currentValue || 0) / k.targetValue);
      const kpiAvgAchievementRate =
        kpiAchievementRates.length > 0
          ? Math.round(
              (kpiAchievementRates.reduce((a, b) => a + b, 0) /
                kpiAchievementRates.length) *
                1000
            ) / 10
          : 0;

      // Process aggregation data
      // By status
      const statusMap = new Map<string, number>();
      for (const a of activitiesByStatusRaw) {
        const status = a.status || "Non défini";
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      }
      const activitiesByStatus = Array.from(statusMap.entries()).map(
        ([status, count]) => ({ status, count })
      );

      // By priority
      const priorityMap = new Map<string, number>();
      for (const a of activitiesByPriorityRaw) {
        const priority = a.priority || "Non défini";
        priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
      }
      const activitiesByPriority = Array.from(priorityMap.entries()).map(
        ([priority, count]) => ({ priority, count })
      );

      // By direction
      const directionMap = new Map<
        string,
        { code: string; name: string; count: number }
      >();
      for (const a of activitiesByDirectionRaw) {
        const dirId = a.directionId || "none";
        if (!directionMap.has(dirId)) {
          directionMap.set(dirId, {
            code: a.direction?.code || "Non assigné",
            name: a.direction?.name || "Non assigné",
            count: 0,
          });
        }
        directionMap.get(dirId)!.count++;
      }
      const activitiesByDirection = Array.from(directionMap.entries()).map(
        ([id, val]) => ({ id, ...val })
      );

      // By axis
      const axisMap = new Map<
        string,
        { code: string; name: string; count: number }
      >();
      for (const a of activitiesByAxisRaw) {
        const axisId = a.primaryAxisId || "none";
        if (!axisMap.has(axisId)) {
          axisMap.set(axisId, {
            code: a.primaryAxis?.code || "Non assigné",
            name: a.primaryAxis?.name || "Non assigné",
            count: 0,
          });
        }
        axisMap.get(axisId)!.count++;
      }
      const activitiesByAxis = Array.from(axisMap.entries()).map(
        ([id, val]) => ({ id, ...val })
      );

      const avgProgress =
        Math.round((avgProgressResult._avg.progressRate || 0) * 10) / 10;

      const raciCoverage =
        totalActivities > 0
          ? Math.round((activitiesWithRaciCount / totalActivities) * 1000) / 10
          : 0;

      // Compose aggregated data
      const reportData = {
        generatedAt: new Date().toISOString(),
        filters: {
          directionId: validated.directionId || null,
          strategicAxisId: validated.strategicAxisId || null,
          acbfDomainId: validated.acbfDomainId || null,
          period: validated.period,
        },
        activities: {
          total: totalActivities,
          byStatus: activitiesByStatus,
          averageProgress: avgProgress,
          byPriority: activitiesByPriority,
          overdueCount,
          byDirection: activitiesByDirection,
          byAxis: activitiesByAxis,
        },
        evidence: {
          total: evidenceTotal,
          verified: evidenceVerified,
          verificationRate:
            evidenceTotal > 0
              ? Math.round((evidenceVerified / evidenceTotal) * 1000) / 10
              : 0,
        },
        raci: {
          totalRaciEntries: raciCount,
          activitiesWithRaci: activitiesWithRaciCount,
          coverage: raciCoverage,
        },
        kpis: {
          averageAchievementRate: kpiAvgAchievementRate,
        },
      };

      // Build report title
      const reportTitle = `${template.name} — ${validated.period}`;

      const report = await db.report.create({
        data: {
          templateId: template.id,
          title: reportTitle,
          period: validated.period,
          status: "Généré",
          type: template.type,
          data: JSON.stringify(reportData),
          generatedAt: new Date(),
          generatedById: currentUser.id,
          directionId: validated.directionId ?? null,
          strategicAxisId: validated.strategicAxisId ?? null,
          acbfDomainId: validated.acbfDomainId ?? null,
        },
        include: {
          template: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              category: true,
            },
          },
          generatedBy: {
            select: { id: true, name: true, email: true },
          },
          validatedBy: {
            select: { id: true, name: true, email: true },
          },
          direction: {
            select: { id: true, code: true, name: true },
          },
          strategicAxis: {
            select: { id: true, code: true, name: true },
          },
          acbfDomain: {
            select: { id: true, code: true, name: true },
          },
        },
      });

      // Audit log — C1 fix
      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "GENERATE",
          entity: "Report",
          entityId: report.id,
          newValue: JSON.stringify({
            title: report.title,
            period: report.period,
            templateId: template.id,
            templateName: template.name,
          }),
          details: `Génération du rapport ${report.title} à partir du modèle ${template.name}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({ data: report }, { status: 201 });
    }

    // ============================================================
    // TEMPLATE-ARCHIVE — Soft delete a template
    // ============================================================
    if (action === "template-archive") {
      reportActionSchema.parse(body);
      // C3 fix: Use reports:archive instead of reports:create
      const hasAccess = userHasPermission(currentUser, "reports:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const existingTemplate = await db.reportTemplate.findUnique({
        where: { id },
      });
      if (!existingTemplate) {
        return NextResponse.json(
          { error: "Modèle de rapport non trouvé" },
          { status: 404 }
        );
      }
      if (existingTemplate.deletedAt) {
        return NextResponse.json(
          { error: "Ce modèle est déjà archivé" },
          { status: 400 }
        );
      }

      const updatedTemplate = await db.reportTemplate.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "ReportTemplate",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedTemplate.deletedAt,
          }),
          details: `Archive du modèle de rapport ${existingTemplate.name}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    }

    // ============================================================
    // TEMPLATE-RESTORE — Unarchive a template
    // ============================================================
    if (action === "template-restore") {
      reportActionSchema.parse(body);
      // C3 fix: Use reports:archive instead of reports:create
      const hasAccess = userHasPermission(currentUser, "reports:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const existingTemplate = await db.reportTemplate.findUnique({
        where: { id },
      });
      if (!existingTemplate) {
        return NextResponse.json(
          { error: "Modèle de rapport non trouvé" },
          { status: 404 }
        );
      }
      if (!existingTemplate.deletedAt) {
        return NextResponse.json(
          { error: "Ce modèle n'est pas archivé" },
          { status: 400 }
        );
      }

      const updatedTemplate = await db.reportTemplate.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "ReportTemplate",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingTemplate.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration du modèle de rapport ${existingTemplate.name}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    // ============================================================
    // For all other actions, find the report first
    // ============================================================
    const existingReport = await db.report.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return NextResponse.json(
        { error: "Rapport non trouvé" },
        { status: 404 }
      );
    }

    // ============================================================
    // VALIDATE — Set status to "Validé" (only from "Généré")
    // ============================================================
    if (action === "validate") {
      reportActionSchema.parse(body);
      const hasAccess = userHasPermission(currentUser, "reports:validate");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (existingReport.status !== "Généré") {
        return NextResponse.json(
          {
            error:
              "Seul un rapport avec le statut 'Généré' peut être validé",
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const updatedReport = await db.report.update({
        where: { id },
        data: {
          status: "Validé",
          validatedAt: now,
          validatedById: currentUser.id,
        },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "VALIDATE",
          entity: "Report",
          entityId: id,
          oldValue: JSON.stringify({ status: "Généré" }),
          newValue: JSON.stringify({
            status: "Validé",
            validatedAt: now,
            validatedById: currentUser.id,
          }),
          details: `Validation du rapport ${existingReport.title}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({
        data: { id, status: "Validé", validatedAt: now },
      });
    }

    // ============================================================
    // REJECT — Set status to "Rejeté" (only from "Généré")
    // ============================================================
    if (action === "reject") {
      reportActionSchema.parse(body);
      const hasAccess = userHasPermission(currentUser, "reports:validate");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (existingReport.status !== "Généré") {
        return NextResponse.json(
          {
            error:
              "Seul un rapport avec le statut 'Généré' peut être rejeté",
          },
          { status: 400 }
        );
      }

      const updatedReport = await db.report.update({
        where: { id },
        data: { status: "Rejeté" },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "REJECT",
          entity: "Report",
          entityId: id,
          oldValue: JSON.stringify({ status: "Généré" }),
          newValue: JSON.stringify({ status: "Rejeté" }),
          details: `Rejet du rapport ${existingReport.title}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({
        data: { id, status: "Rejeté" },
      });
    }

    // ============================================================
    // ARCHIVE — Soft delete
    // ============================================================
    if (action === "archive") {
      reportActionSchema.parse(body);
      // C3 fix: Use reports:archive instead of reports:create
      const hasAccess = userHasPermission(currentUser, "reports:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (existingReport.deletedAt) {
        return NextResponse.json(
          { error: "Ce rapport est déjà archivé" },
          { status: 400 }
        );
      }

      const updatedReport = await db.report.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "Report",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedReport.deletedAt,
          }),
          details: `Archive du rapport ${existingReport.title}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    }

    // ============================================================
    // RESTORE — Unarchive
    // ============================================================
    if (action === "restore") {
      reportActionSchema.parse(body);
      // C3 fix: Use reports:archive instead of reports:create
      const hasAccess = userHasPermission(currentUser, "reports:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (!existingReport.deletedAt) {
        return NextResponse.json(
          { error: "Ce rapport n'est pas archivé" },
          { status: 400 }
        );
      }

      const updatedReport = await db.report.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Report",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingReport.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration du rapport ${existingReport.title}`,
          ipAddress: ip,
          userAgent: userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      {
        error:
          "Action invalide. Utilisez 'generate', 'validate', 'reject', 'archive', 'restore', 'template-archive' ou 'template-restore'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PATCH /api/reports/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
