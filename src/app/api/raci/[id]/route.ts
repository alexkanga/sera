import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/request-context";
import { updateRaciSchema, raciActionSchema } from "@/lib/validations";
import { z } from "zod";

// GET /api/raci/[id] — Détail d'une entrée RACI
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "raci:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const raciEntry = await db.raciMatrix.findUnique({
      where: { id },
      include: {
        acbfDeliverable: {
          select: {
            id: true,
            code: true,
            name: true,
            domain: { select: { code: true, name: true } },
          },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        strategicAxis: {
          select: { id: true, code: true, name: true },
        },
        responsibleUser: {
          select: { id: true, name: true, email: true },
        },
        accountableUser: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!raciEntry) {
      return NextResponse.json(
        { error: "Entrée RACI non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: raciEntry });
  } catch (error) {
    console.error("Erreur GET /api/raci/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/raci/[id] — Mettre à jour une entrée RACI
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "raci:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingRaci = await db.raciMatrix.findUnique({
      where: { id },
    });
    if (!existingRaci) {
      return NextResponse.json(
        { error: "Entrée RACI non trouvée" },
        { status: 404 }
      );
    }
    if (existingRaci.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier une entrée RACI archivée" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateRaciSchema.parse(body);

    // C4: Archived FK checks
    if (validated.acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: validated.acbfDeliverableId },
        include: { domain: { select: { deletedAt: true } } },
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
          { error: "Le domaine du livrable ACBF est archivé" },
          { status: 400 }
        );
      }
    }

    if (validated.activityId) {
      const activity = await db.activity.findUnique({
        where: { id: validated.activityId },
      });
      if (!activity) {
        return NextResponse.json(
          { error: "L'activité spécifiée n'existe pas" },
          { status: 400 }
        );
      }
      if (activity.deletedAt) {
        return NextResponse.json(
          { error: "L'activité spécifiée est archivée" },
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
      if (axis.deletedAt) {
        return NextResponse.json(
          { error: "L'axe stratégique spécifié est archivé" },
          { status: 400 }
        );
      }
    }

    if (validated.responsibleUserId) {
      const user = await db.user.findUnique({
        where: { id: validated.responsibleUserId },
      });
      if (!user) {
        return NextResponse.json(
          { error: "L'utilisateur responsable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    if (validated.accountableUserId) {
      const user = await db.user.findUnique({
        where: { id: validated.accountableUserId },
      });
      if (!user) {
        return NextResponse.json(
          { error: "L'utilisateur redevable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.acbfDeliverableId !== undefined)
      updateData.acbfDeliverableId = validated.acbfDeliverableId;
    if (validated.activityId !== undefined)
      updateData.activityId = validated.activityId;
    if (validated.strategicAxisId !== undefined)
      updateData.strategicAxisId = validated.strategicAxisId;
    if (validated.responsible !== undefined)
      updateData.responsible = validated.responsible;
    if (validated.responsibleUserId !== undefined)
      updateData.responsibleUserId = validated.responsibleUserId;
    if (validated.accountable !== undefined)
      updateData.accountable = validated.accountable;
    if (validated.accountableUserId !== undefined)
      updateData.accountableUserId = validated.accountableUserId;
    if (validated.contributors !== undefined)
      updateData.contributors = validated.contributors;
    if (validated.informed !== undefined)
      updateData.informed = validated.informed;
    if (validated.priority !== undefined)
      updateData.priority = validated.priority;
    if (validated.indicativeDeadline !== undefined)
      updateData.indicativeDeadline = validated.indicativeDeadline;
    if (validated.verificationSource !== undefined)
      updateData.verificationSource = validated.verificationSource;
    if (validated.comments !== undefined)
      updateData.comments = validated.comments;

    const updatedRaci = await db.raciMatrix.update({
      where: { id },
      data: updateData,
      include: {
        acbfDeliverable: {
          select: {
            id: true,
            code: true,
            name: true,
            domain: { select: { code: true, name: true } },
          },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        strategicAxis: {
          select: { id: true, code: true, name: true },
        },
        responsibleUser: {
          select: { id: true, name: true, email: true },
        },
        accountableUser: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Journal d'audit with oldValue/newValue comparison
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldValue[key] = (existingRaci as Record<string, unknown>)[key];
      newValue[key] = updateData[key];
    }

    // C2: Audit log with IP and User-Agent
    const { ip, userAgent } = getIpAndUserAgent(request);
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "RaciMatrix",
        entityId: id,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        details: `Mise à jour de l'entrée RACI ${id}`,
        ipAddress: ip,
        userAgent,
      },
    });

    return NextResponse.json({ data: updatedRaci });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/raci/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/raci/[id] — Archive / Restore
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

    const existingRaci = await db.raciMatrix.findUnique({
      where: { id },
    });
    if (!existingRaci) {
      return NextResponse.json(
        { error: "Entrée RACI non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // C1: Use raciActionSchema instead of type assertion
    let action: "archive" | "restore";
    try {
      const parsed = raciActionSchema.parse(body);
      action = parsed.action;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Données invalides", details: error.issues },
          { status: 400 }
        );
      }
      throw error;
    }

    // C2: Get IP and User-Agent for audit logs
    const { ip, userAgent } = getIpAndUserAgent(request);

    if (action === "archive") {
      const hasAccess = userHasPermission(currentUser, "raci:update");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const updatedRaci = await db.raciMatrix.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "RaciMatrix",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedRaci.deletedAt,
          }),
          details: `Archive de l'entrée RACI ${id}`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const hasAccess = userHasPermission(currentUser, "raci:update");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      await db.raciMatrix.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "RaciMatrix",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingRaci.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de l'entrée RACI ${id}`,
          ipAddress: ip,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'archive' ou 'restore'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/raci/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
