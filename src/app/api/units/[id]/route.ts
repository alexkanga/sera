import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateUnitSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  directionId: z.string().min(1).optional(),
  headUserId: z.string().optional().nullable(),
});

// GET /api/units/[id] — Détail d'une unité
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "org:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const unit = await db.unit.findUnique({
      where: { id },
      include: {
        direction: true,
        headUser: true,
      },
    });

    if (!unit) {
      return NextResponse.json({ error: "Unité non trouvée" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        description: unit.description,
        directionId: unit.directionId,
        headUserId: unit.headUserId,
        isActive: unit.isActive,
        deletedAt: unit.deletedAt,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        direction: unit.direction
          ? {
              id: unit.direction.id,
              code: unit.direction.code,
              name: unit.direction.name,
            }
          : null,
        headUser: unit.headUser
          ? {
              id: unit.headUser.id,
              name: unit.headUser.name,
              email: unit.headUser.email,
              position: unit.headUser.position,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/units/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/units/[id] — Mettre à jour une unité
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "org:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingUnit = await db.unit.findUnique({
      where: { id },
      include: {
        direction: true,
        headUser: true,
      },
    });
    if (!existingUnit) {
      return NextResponse.json({ error: "Unité non trouvée" }, { status: 404 });
    }
    if (existingUnit.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier une unité archivée" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateUnitSchema.parse(body);

    // Vérifier l'unicité du code
    if (validated.code && validated.code !== existingUnit.code) {
      const codeExists = await db.unit.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code est déjà utilisé" },
          { status: 409 }
        );
      }
    }

    // Vérifier que la direction existe
    if (validated.directionId && validated.directionId !== existingUnit.directionId) {
      const direction = await db.direction.findUnique({
        where: { id: validated.directionId },
      });
      if (!direction) {
        return NextResponse.json(
          { error: "Direction non trouvée" },
          { status: 404 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.directionId !== undefined) updateData.directionId = validated.directionId;
    if (validated.headUserId !== undefined) updateData.headUserId = validated.headUserId;

    const updatedUnit = await db.unit.update({
      where: { id },
      data: updateData,
      include: {
        direction: true,
        headUser: true,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "Unit",
        entityId: id,
        oldValue: JSON.stringify({
          code: existingUnit.code,
          name: existingUnit.name,
          description: existingUnit.description,
          directionId: existingUnit.directionId,
          headUserId: existingUnit.headUserId,
        }),
        newValue: JSON.stringify(updateData),
        details: `Mise à jour de l'unité ${updatedUnit.name}`,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedUnit.id,
        code: updatedUnit.code,
        name: updatedUnit.name,
        description: updatedUnit.description,
        directionId: updatedUnit.directionId,
        headUserId: updatedUnit.headUserId,
        isActive: updatedUnit.isActive,
        updatedAt: updatedUnit.updatedAt,
        direction: updatedUnit.direction
          ? {
              id: updatedUnit.direction.id,
              code: updatedUnit.direction.code,
              name: updatedUnit.direction.name,
            }
          : null,
        headUser: updatedUnit.headUser
          ? {
              id: updatedUnit.headUser.id,
              name: updatedUnit.headUser.name,
              email: updatedUnit.headUser.email,
              position: updatedUnit.headUser.position,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/units/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/units/[id] — Archiver / Restaurer une unité (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "org:archive");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingUnit = await db.unit.findUnique({ where: { id } });
    if (!existingUnit) {
      return NextResponse.json({ error: "Unité non trouvée" }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };

    if (action === "archive") {
      const updatedUnit = await db.unit.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "Unit",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({ isActive: false, deletedAt: updatedUnit.deletedAt }),
          details: `Archive de l'unité ${existingUnit.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedUnit = await db.unit.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Unit",
          entityId: id,
          oldValue: JSON.stringify({ isActive: false, deletedAt: existingUnit.deletedAt }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de l'unité ${existingUnit.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'archive' ou 'restore'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/units/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
