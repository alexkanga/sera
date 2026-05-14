import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/request-context";
import { updateActivitySchema, activityActionSchema } from "@/lib/validations";
import { z } from "zod";

// GET /api/activities/[id] — Détail d'une activité
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "pta:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const activity = await db.activity.findUnique({
      where: { id },
      include: {
        responsible: {
          select: { id: true, name: true, email: true, ptaCode: true },
        },
        direction: {
          select: { id: true, code: true, name: true },
        },
        primaryAxis: {
          select: { id: true, code: true, name: true },
        },
        secondaryAxis: {
          select: { id: true, code: true, name: true },
        },
        acbfDomain: {
          select: { id: true, code: true, name: true },
        },
        acbfDeliverable: {
          select: { id: true, code: true, name: true },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: "Activité non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error("Erreur GET /api/activities/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/activities/[id] — Mettre à jour une activité
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "pta:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingActivity = await db.activity.findUnique({
      where: { id },
    });
    if (!existingActivity) {
      return NextResponse.json(
        { error: "Activité non trouvée" },
        { status: 404 }
      );
    }
    if (existingActivity.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier une activité archivée" },
        { status: 400 }
      );
    }

    // If activity is locked, only admin:* can update
    if (existingActivity.isLocked) {
      const isAdmin = userHasPermission(currentUser, "admin:*");
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Cette activité est verrouillée et ne peut être modifiée que par un administrateur" },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const validated = updateActivitySchema.parse(body);

    // Check unique activityCode if changed
    if (validated.activityCode && validated.activityCode !== existingActivity.activityCode) {
      const codeExists = await db.activity.findUnique({
        where: { activityCode: validated.activityCode },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code d'activité est déjà utilisé" },
          { status: 409 }
        );
      }
    }

    // Verify responsibleId exists if changed
    if (validated.responsibleId) {
      const responsible = await db.user.findUnique({
        where: { id: validated.responsibleId },
      });
      if (!responsible) {
        return NextResponse.json(
          { error: "L'utilisateur responsable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify directionId exists and is not archived (E4)
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
      if (direction.deletedAt) {
        return NextResponse.json(
          { error: "La direction spécifiée est archivée" },
          { status: 400 }
        );
      }
    }

    // Verify primaryAxisId exists and is not archived (E4)
    if (validated.primaryAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.primaryAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique principal spécifié n'existe pas" },
          { status: 400 }
        );
      }
      if (axis.deletedAt) {
        return NextResponse.json(
          { error: "L'axe stratégique principal spécifié est archivé" },
          { status: 400 }
        );
      }
    }

    // Verify secondaryAxisId exists and is not archived (E4)
    if (validated.secondaryAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.secondaryAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique secondaire spécifié n'existe pas" },
          { status: 400 }
        );
      }
      if (axis.deletedAt) {
        return NextResponse.json(
          { error: "L'axe stratégique secondaire spécifié est archivé" },
          { status: 400 }
        );
      }
    }

    // Verify acbfDomainId exists and is not archived (E4)
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
      if (domain.deletedAt) {
        return NextResponse.json(
          { error: "Le domaine ACBF spécifié est archivé" },
          { status: 400 }
        );
      }
    }

    // Verify acbfDeliverableId exists and is not archived (E4)
    // Also check that the deliverable's domain is not archived
    if (validated.acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: validated.acbfDeliverableId },
        include: { domain: true },
      });
      if (!deliverable) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
      if (deliverable.deletedAt) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié est archivé" },
          { status: 400 }
        );
      }
      if (deliverable.domain?.deletedAt) {
        return NextResponse.json(
          { error: "Le domaine du livrable ACBF spécifié est archivé" },
          { status: 400 }
        );
      }
    }

    // Verify validatorId exists if changed
    if (validated.validatorId) {
      const validator = await db.user.findUnique({
        where: { id: validated.validatorId },
      });
      if (!validator) {
        return NextResponse.json(
          { error: "Le validateur spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Build update data — C3: validationStatus is completely excluded
    const updateData: Record<string, unknown> = {};
    if (validated.activityCode !== undefined)
      updateData.activityCode = validated.activityCode;
    if (validated.responsibleId !== undefined)
      updateData.responsibleId = validated.responsibleId;
    if (validated.directionId !== undefined)
      updateData.directionId = validated.directionId;
    if (validated.primaryAxisId !== undefined)
      updateData.primaryAxisId = validated.primaryAxisId;
    if (validated.secondaryAxisId !== undefined)
      updateData.secondaryAxisId = validated.secondaryAxisId;
    if (validated.acbfDomainId !== undefined)
      updateData.acbfDomainId = validated.acbfDomainId;
    if (validated.acbfDeliverableId !== undefined)
      updateData.acbfDeliverableId = validated.acbfDeliverableId;
    if (validated.annualObjective !== undefined)
      updateData.annualObjective = validated.annualObjective;
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.detailedTasks !== undefined)
      updateData.detailedTasks = validated.detailedTasks;
    if (validated.expectedDeliverable !== undefined)
      updateData.expectedDeliverable = validated.expectedDeliverable;
    if (validated.validatorId !== undefined)
      updateData.validatorId = validated.validatorId;
    if (validated.startDate !== undefined)
      updateData.startDate = validated.startDate
        ? new Date(validated.startDate)
        : null;
    if (validated.endDate !== undefined)
      updateData.endDate = validated.endDate
        ? new Date(validated.endDate)
        : null;
    if (validated.priority !== undefined)
      updateData.priority = validated.priority;
    if (validated.performanceIndicator !== undefined)
      updateData.performanceIndicator = validated.performanceIndicator;
    if (validated.verificationSource !== undefined)
      updateData.verificationSource = validated.verificationSource;
    if (validated.status !== undefined) updateData.status = validated.status;
    if (validated.progressRate !== undefined)
      updateData.progressRate = validated.progressRate;
    if (validated.riskDescription !== undefined)
      updateData.riskDescription = validated.riskDescription;
    if (validated.comments !== undefined)
      updateData.comments = validated.comments;
    // C3: validationStatus is NOT included — can only be changed via PATCH actions
    if (validated.nature !== undefined) updateData.nature = validated.nature;
    if (validated.dependency !== undefined)
      updateData.dependency = validated.dependency;
    if (validated.duration !== undefined)
      updateData.duration = validated.duration;

    // Set updatedById
    updateData.updatedById = currentUser.id;

    const updatedActivity = await db.activity.update({
      where: { id },
      data: updateData,
      include: {
        responsible: {
          select: { id: true, name: true, email: true, ptaCode: true },
        },
        direction: {
          select: { id: true, code: true, name: true },
        },
        primaryAxis: {
          select: { id: true, code: true, name: true },
        },
        acbfDomain: {
          select: { id: true, code: true, name: true },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Journal d'audit with oldValue/newValue comparison — C4: Include IP and User-Agent
    const { ip, userAgent } = getIpAndUserAgent(request);
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      if (key === "updatedById") continue;
      oldValue[key] = (existingActivity as Record<string, unknown>)[key];
      newValue[key] = updateData[key];
    }

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "Activity",
        entityId: id,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        details: `Mise à jour de l'activité ${updatedActivity.title} (${updatedActivity.activityCode})`,
        ipAddress: ip,
        userAgent,
      },
    });

    return NextResponse.json({ data: updatedActivity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/activities/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/activities/[id] — Archive / Restore / Submit / Validate / Reject
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

    const existingActivity = await db.activity.findUnique({
      where: { id },
    });
    if (!existingActivity) {
      return NextResponse.json(
        { error: "Activité non trouvée" },
        { status: 404 }
      );
    }

    // C1: Use activityActionSchema for proper Zod validation
    const body = await request.json();
    const validated = activityActionSchema.parse(body);
    const { action } = validated;

    // C4: Get IP and User-Agent once for all audit logs
    const { ip, userAgent } = getIpAndUserAgent(request);

    if (action === "archive") {
      const hasAccess = userHasPermission(currentUser, "pta:archive");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Accès refusé" },
          { status: 403 }
        );
      }

      const updatedActivity = await db.activity.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "Activity",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedActivity.deletedAt,
          }),
          details: `Archive de l'activité ${existingActivity.title} (${existingActivity.activityCode})`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const hasAccess = userHasPermission(currentUser, "pta:archive");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Accès refusé" },
          { status: 403 }
        );
      }

      const updatedActivity = await db.activity.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Activity",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingActivity.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de l'activité ${existingActivity.title} (${existingActivity.activityCode})`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    } else if (action === "submit") {
      const hasAccess = userHasPermission(currentUser, "pta:submit");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Accès refusé" },
          { status: 403 }
        );
      }

      if (existingActivity.validationStatus === "Soumis") {
        return NextResponse.json(
          { error: "Cette activité est déjà soumise" },
          { status: 400 }
        );
      }

      await db.activity.update({
        where: { id },
        data: { validationStatus: "Soumis", updatedById: currentUser.id },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "SUBMIT",
          entity: "Activity",
          entityId: id,
          oldValue: JSON.stringify({
            validationStatus: existingActivity.validationStatus,
          }),
          newValue: JSON.stringify({ validationStatus: "Soumis" }),
          details: `Soumission de l'activité ${existingActivity.title} (${existingActivity.activityCode})`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({
        data: { id, validationStatus: "Soumis" },
      });
    } else if (action === "validate") {
      const hasAccess = userHasPermission(currentUser, "pta:validate");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Accès refusé" },
          { status: 403 }
        );
      }

      if (existingActivity.validationStatus !== "Soumis") {
        return NextResponse.json(
          { error: "Seule une activité soumise peut être validée" },
          { status: 400 }
        );
      }

      await db.activity.update({
        where: { id },
        data: { validationStatus: "Validé", updatedById: currentUser.id },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "VALIDATE",
          entity: "Activity",
          entityId: id,
          oldValue: JSON.stringify({
            validationStatus: existingActivity.validationStatus,
          }),
          newValue: JSON.stringify({ validationStatus: "Validé" }),
          details: `Validation de l'activité ${existingActivity.title} (${existingActivity.activityCode})`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({
        data: { id, validationStatus: "Validé" },
      });
    } else if (action === "reject") {
      const hasAccess = userHasPermission(currentUser, "pta:validate");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Accès refusé" },
          { status: 403 }
        );
      }

      if (existingActivity.validationStatus !== "Soumis") {
        return NextResponse.json(
          { error: "Seule une activité soumise peut être rejetée" },
          { status: 400 }
        );
      }

      await db.activity.update({
        where: { id },
        data: { validationStatus: "Rejeté", updatedById: currentUser.id },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "REJECT",
          entity: "Activity",
          entityId: id,
          oldValue: JSON.stringify({
            validationStatus: existingActivity.validationStatus,
          }),
          newValue: JSON.stringify({ validationStatus: "Rejeté" }),
          details: `Rejet de l'activité ${existingActivity.title} (${existingActivity.activityCode})`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({
        data: { id, validationStatus: "Rejeté" },
      });
    }

    return NextResponse.json(
      {
        error:
          "Action invalide. Utilisez 'archive', 'restore', 'submit', 'validate' ou 'reject'",
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
    console.error("Erreur PATCH /api/activities/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
