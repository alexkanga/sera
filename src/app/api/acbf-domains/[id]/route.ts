import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateDomainSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
});

// GET /api/acbf-domains/[id] — Détail d'un domaine ACBF
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

    const domain = await db.acbfDomain.findUnique({
      where: { id },
      include: {
        deliverables: {
          where: { deletedAt: null },
          orderBy: { code: "asc" },
        },
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domaine ACBF non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: domain.id,
        code: domain.code,
        name: domain.name,
        order: domain.order,
        isActive: domain.isActive,
        deletedAt: domain.deletedAt,
        createdAt: domain.createdAt,
        updatedAt: domain.updatedAt,
        deliverables: domain.deliverables.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          description: d.description,
          priority: d.priority,
          status: d.status,
          isActive: d.isActive,
        })),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/acbf-domains/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/acbf-domains/[id] — Mettre à jour un domaine ACBF
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

    const existingDomain = await db.acbfDomain.findUnique({ where: { id } });
    if (!existingDomain) {
      return NextResponse.json(
        { error: "Domaine ACBF non trouvé" },
        { status: 404 }
      );
    }
    if (existingDomain.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier un domaine ACBF archivé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateDomainSchema.parse(body);

    // Vérifier l'unicité du code
    if (validated.code && validated.code !== existingDomain.code) {
      const codeExists = await db.acbfDomain.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code est déjà utilisé par un autre domaine ACBF" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.order !== undefined) updateData.order = validated.order;

    const updatedDomain = await db.acbfDomain.update({
      where: { id },
      data: updateData,
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "AcbfDomain",
        entityId: id,
        oldValue: JSON.stringify({
          code: existingDomain.code,
          name: existingDomain.name,
          order: existingDomain.order,
        }),
        newValue: JSON.stringify(updateData),
        details: `Mise à jour du domaine ACBF ${updatedDomain.name}`,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedDomain.id,
        code: updatedDomain.code,
        name: updatedDomain.name,
        order: updatedDomain.order,
        isActive: updatedDomain.isActive,
        updatedAt: updatedDomain.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/acbf-domains/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/acbf-domains/[id] — Archiver / Restaurer un domaine ACBF (soft delete)
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

    const existingDomain = await db.acbfDomain.findUnique({ where: { id } });
    if (!existingDomain) {
      return NextResponse.json(
        { error: "Domaine ACBF non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };

    if (action === "archive") {
      const updatedDomain = await db.acbfDomain.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "AcbfDomain",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedDomain.deletedAt,
          }),
          details: `Archive du domaine ACBF ${existingDomain.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedDomain = await db.acbfDomain.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "AcbfDomain",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingDomain.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration du domaine ACBF ${existingDomain.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'archive' ou 'restore'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/acbf-domains/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
