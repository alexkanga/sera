import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateDirectionSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  headUserId: z.string().optional().nullable(),
});

// GET /api/directions/[id] — Détail d'une direction
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

    const direction = await db.direction.findUnique({
      where: { id },
      include: {
        headUser: true,
        units: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!direction) {
      return NextResponse.json(
        { error: "Direction non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: direction.id,
        code: direction.code,
        name: direction.name,
        description: direction.description,
        headUserId: direction.headUserId,
        headUser: direction.headUser
          ? {
              id: direction.headUser.id,
              name: direction.headUser.name,
              email: direction.headUser.email,
              position: direction.headUser.position,
            }
          : null,
        units: direction.units.map((unit) => ({
          id: unit.id,
          code: unit.code,
          name: unit.name,
          description: unit.description,
          headUserId: unit.headUserId,
          isActive: unit.isActive,
          createdAt: unit.createdAt,
          updatedAt: unit.updatedAt,
        })),
        isActive: direction.isActive,
        deletedAt: direction.deletedAt,
        createdAt: direction.createdAt,
        updatedAt: direction.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/directions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/directions/[id] — Mettre à jour une direction
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

    const existingDirection = await db.direction.findUnique({ where: { id } });
    if (!existingDirection) {
      return NextResponse.json(
        { error: "Direction non trouvée" },
        { status: 404 }
      );
    }
    if (existingDirection.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier une direction archivée" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateDirectionSchema.parse(body);

    // Vérifier l'unicité du code
    if (validated.code && validated.code !== existingDirection.code) {
      const codeExists = await db.direction.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code est déjà utilisé par une autre direction" },
          { status: 409 }
        );
      }
    }

    // Vérifier que le headUserId existe si fourni
    if (validated.headUserId) {
      const headUser = await db.user.findUnique({
        where: { id: validated.headUserId },
      });
      if (!headUser) {
        return NextResponse.json(
          { error: "L'utilisateur responsable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined)
      updateData.description = validated.description;
    if (validated.headUserId !== undefined)
      updateData.headUserId = validated.headUserId;

    const updatedDirection = await db.direction.update({
      where: { id },
      data: updateData,
      include: {
        headUser: true,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "Direction",
        entityId: id,
        oldValue: JSON.stringify({
          code: existingDirection.code,
          name: existingDirection.name,
          description: existingDirection.description,
          headUserId: existingDirection.headUserId,
        }),
        newValue: JSON.stringify(updateData),
        details: `Mise à jour de la direction ${updatedDirection.name}`,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedDirection.id,
        code: updatedDirection.code,
        name: updatedDirection.name,
        description: updatedDirection.description,
        headUserId: updatedDirection.headUserId,
        headUser: updatedDirection.headUser
          ? {
              id: updatedDirection.headUser.id,
              name: updatedDirection.headUser.name,
              email: updatedDirection.headUser.email,
              position: updatedDirection.headUser.position,
            }
          : null,
        isActive: updatedDirection.isActive,
        updatedAt: updatedDirection.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/directions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/directions/[id] — Archiver / Restaurer une direction (soft delete)
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

    const existingDirection = await db.direction.findUnique({ where: { id } });
    if (!existingDirection) {
      return NextResponse.json(
        { error: "Direction non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };

    if (action === "archive") {
      const updatedDirection = await db.direction.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "Direction",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedDirection.deletedAt,
          }),
          details: `Archive de la direction ${existingDirection.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedDirection = await db.direction.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Direction",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingDirection.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de la direction ${existingDirection.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'archive' ou 'restore'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/directions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
