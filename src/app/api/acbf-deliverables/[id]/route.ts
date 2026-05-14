import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";
import { updateAcbfDeliverableSchema, archivePermissionSchema } from "@/lib/validations";

// GET /api/acbf-deliverables/[id] — Détail d'un livrable ACBF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "acbf:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const deliverable = await db.acbfDeliverable.findUnique({
      where: { id },
      include: {
        domain: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!deliverable) {
      return NextResponse.json(
        { error: "Livrable ACBF non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: deliverable.id,
        code: deliverable.code,
        name: deliverable.name,
        description: deliverable.description,
        priority: deliverable.priority,
        status: deliverable.status,
        domainId: deliverable.domainId,
        domain: deliverable.domain,
        isActive: deliverable.isActive,
        deletedAt: deliverable.deletedAt,
        createdAt: deliverable.createdAt,
        updatedAt: deliverable.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/acbf-deliverables/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/acbf-deliverables/[id] — Mettre à jour un livrable ACBF
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "acbf:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingDeliverable = await db.acbfDeliverable.findUnique({
      where: { id },
    });
    if (!existingDeliverable) {
      return NextResponse.json(
        { error: "Livrable ACBF non trouvé" },
        { status: 404 }
      );
    }
    if (existingDeliverable.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier un livrable ACBF archivé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateAcbfDeliverableSchema.parse(body);

    // Vérifier l'unicité du code
    if (validated.code && validated.code !== existingDeliverable.code) {
      const codeExists = await db.acbfDeliverable.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code est déjà utilisé par un autre livrable ACBF" },
          { status: 409 }
        );
      }
    }

    // Vérifier que le domaine existe et n'est pas archivé si modifié
    if (validated.domainId && validated.domainId !== existingDeliverable.domainId) {
      const domainExists = await db.acbfDomain.findUnique({
        where: { id: validated.domainId },
      });
      if (!domainExists) {
        return NextResponse.json(
          { error: "Le domaine ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
      if (domainExists.deletedAt) {
        return NextResponse.json(
          { error: "Impossible de déplacer un livrable vers un domaine ACBF archivé" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.domainId !== undefined) updateData.domainId = validated.domainId;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.status !== undefined) updateData.status = validated.status;

    const updatedDeliverable = await db.acbfDeliverable.update({
      where: { id },
      data: updateData,
      include: {
        domain: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Journal d'audit
    const { ipAddress, userAgent } = getIpAndUserAgent(request);
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "AcbfDeliverable",
        entityId: id,
        oldValue: JSON.stringify({
          code: existingDeliverable.code,
          name: existingDeliverable.name,
          domainId: existingDeliverable.domainId,
          priority: existingDeliverable.priority,
          status: existingDeliverable.status,
        }),
        newValue: JSON.stringify({
          code: updatedDeliverable.code,
          name: updatedDeliverable.name,
          domainId: updatedDeliverable.domainId,
          priority: updatedDeliverable.priority,
          status: updatedDeliverable.status,
        }),
        details: `Mise à jour du livrable ACBF ${updatedDeliverable.name}`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedDeliverable.id,
        code: updatedDeliverable.code,
        name: updatedDeliverable.name,
        description: updatedDeliverable.description,
        priority: updatedDeliverable.priority,
        status: updatedDeliverable.status,
        domainId: updatedDeliverable.domainId,
        domain: updatedDeliverable.domain,
        isActive: updatedDeliverable.isActive,
        updatedAt: updatedDeliverable.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/acbf-deliverables/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/acbf-deliverables/[id] — Archiver / Restaurer un livrable ACBF (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "acbf:archive");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingDeliverable = await db.acbfDeliverable.findUnique({
      where: { id },
    });
    if (!existingDeliverable) {
      return NextResponse.json(
        { error: "Livrable ACBF non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = archivePermissionSchema.parse(body);
    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    if (action === "archive") {
      const updatedDeliverable = await db.acbfDeliverable.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "AcbfDeliverable",
          entityId: id,
          oldValue: JSON.stringify({ isActive: existingDeliverable.isActive, deletedAt: existingDeliverable.deletedAt }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedDeliverable.deletedAt,
          }),
          details: `Archive du livrable ACBF ${existingDeliverable.name}`,
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else {
      const updatedDeliverable = await db.acbfDeliverable.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "AcbfDeliverable",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingDeliverable.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration du livrable ACBF ${existingDeliverable.name}`,
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PATCH /api/acbf-deliverables/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
