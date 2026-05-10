import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateEvidenceSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z
    .enum(["Rapport", "PV", "Photo", "Lien", "Source de vérification", "Autre"])
    .optional(),
  version: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
});

// GET /api/evidence/[id] — Détail d'un fichier de preuve
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "evidence:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const evidenceFile = await db.evidenceFile.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        acbfDeliverable: {
          select: { id: true, code: true, name: true },
        },
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!evidenceFile) {
      return NextResponse.json(
        { error: "Fichier de preuve non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: evidenceFile });
  } catch (error) {
    console.error("Erreur GET /api/evidence/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/evidence/[id] — Mettre à jour les métadonnées d'une preuve
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "evidence:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingEvidence = await db.evidenceFile.findUnique({
      where: { id },
    });
    if (!existingEvidence) {
      return NextResponse.json(
        { error: "Fichier de preuve non trouvé" },
        { status: 404 }
      );
    }
    if (existingEvidence.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier une preuve archivée" },
        { status: 400 }
      );
    }

    // If associated activity is locked, only admin can modify
    if (existingEvidence.activityId) {
      const activity = await db.activity.findUnique({
        where: { id: existingEvidence.activityId },
        select: { isLocked: true },
      });
      if (activity?.isLocked) {
        const isAdmin = userHasPermission(currentUser, "admin:*");
        if (!isAdmin) {
          return NextResponse.json(
            {
              error:
                "Cette preuve est liée à une activité verrouillée et ne peut être modifiée que par un administrateur",
            },
            { status: 403 }
          );
        }
      }
    }

    const body = await request.json();
    const validated = updateEvidenceSchema.parse(body);

    // Verify activityId exists if changed
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
    }

    // Verify acbfDeliverableId exists if changed
    if (validated.acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: validated.acbfDeliverableId },
      });
      if (!deliverable) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.version !== undefined) updateData.version = validated.version;
    if (validated.activityId !== undefined)
      updateData.activityId = validated.activityId;
    if (validated.acbfDeliverableId !== undefined)
      updateData.acbfDeliverableId = validated.acbfDeliverableId;

    const updatedEvidence = await db.evidenceFile.update({
      where: { id },
      data: updateData,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        acbfDeliverable: {
          select: { id: true, code: true, name: true },
        },
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Journal d'audit with oldValue/newValue comparison
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldValue[key] = (existingEvidence as Record<string, unknown>)[key];
      newValue[key] = updateData[key];
    }

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "EvidenceFile",
        entityId: id,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        details: `Mise à jour de la preuve ${updatedEvidence.name}`,
      },
    });

    return NextResponse.json({ data: updatedEvidence });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/evidence/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/evidence/[id] — Archive / Restore / Verify / Unverify
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

    const existingEvidence = await db.evidenceFile.findUnique({
      where: { id },
    });
    if (!existingEvidence) {
      return NextResponse.json(
        { error: "Fichier de preuve non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body as {
      action: "archive" | "restore" | "verify" | "unverify";
    };

    if (action === "archive") {
      const hasAccess = userHasPermission(currentUser, "evidence:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const updatedEvidence = await db.evidenceFile.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "EvidenceFile",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedEvidence.deletedAt,
          }),
          details: `Archive de la preuve ${existingEvidence.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const hasAccess = userHasPermission(currentUser, "evidence:archive");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      const updatedEvidence = await db.evidenceFile.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "EvidenceFile",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingEvidence.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de la preuve ${existingEvidence.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    } else if (action === "verify") {
      const hasAccess = userHasPermission(currentUser, "evidence:verify");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (existingEvidence.isVerified) {
        return NextResponse.json(
          { error: "Cette preuve est déjà vérifiée" },
          { status: 400 }
        );
      }

      const now = new Date();
      await db.evidenceFile.update({
        where: { id },
        data: {
          isVerified: true,
          verifiedById: currentUser.id,
          verifiedAt: now,
        },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "VERIFY",
          entity: "EvidenceFile",
          entityId: id,
          oldValue: JSON.stringify({
            isVerified: false,
            verifiedById: null,
            verifiedAt: null,
          }),
          newValue: JSON.stringify({
            isVerified: true,
            verifiedById: currentUser.id,
            verifiedAt: now,
          }),
          details: `Vérification de la preuve ${existingEvidence.name}`,
        },
      });

      return NextResponse.json({
        data: { id, isVerified: true, verifiedById: currentUser.id },
      });
    } else if (action === "unverify") {
      const hasAccess = userHasPermission(currentUser, "evidence:verify");
      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      if (!existingEvidence.isVerified) {
        return NextResponse.json(
          { error: "Cette preuve n'est pas vérifiée" },
          { status: 400 }
        );
      }

      await db.evidenceFile.update({
        where: { id },
        data: {
          isVerified: false,
          verifiedById: null,
          verifiedAt: null,
        },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "UNVERIFY",
          entity: "EvidenceFile",
          entityId: id,
          oldValue: JSON.stringify({
            isVerified: true,
            verifiedById: existingEvidence.verifiedById,
            verifiedAt: existingEvidence.verifiedAt,
          }),
          newValue: JSON.stringify({
            isVerified: false,
            verifiedById: null,
            verifiedAt: null,
          }),
          details: `Annulation de la vérification de la preuve ${existingEvidence.name}`,
        },
      });

      return NextResponse.json({
        data: { id, isVerified: false },
      });
    }

    return NextResponse.json(
      {
        error:
          "Action invalide. Utilisez 'archive', 'restore', 'verify' ou 'unverify'",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/evidence/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
