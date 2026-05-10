import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateStrategicAxisSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  objective: z.string().optional().nullable(),
  expectedResults: z.string().optional().nullable(),
  indicators: z.string().optional().nullable(),
  concernedUnits: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

// GET /api/strategic-axes/[id] — Détail d'un axe stratégique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "strategic:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const axis = await db.strategicAxis.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            activitiesPrimary: true,
            activitiesSecondary: true,
          },
        },
      },
    });

    if (!axis) {
      return NextResponse.json(
        { error: "Axe stratégique non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: axis.id,
        code: axis.code,
        name: axis.name,
        objective: axis.objective,
        expectedResults: axis.expectedResults,
        indicators: axis.indicators,
        concernedUnits: axis.concernedUnits,
        order: axis.order,
        isActive: axis.isActive,
        deletedAt: axis.deletedAt,
        createdAt: axis.createdAt,
        updatedAt: axis.updatedAt,
        _count: {
          activitiesPrimary: axis._count.activitiesPrimary,
          activitiesSecondary: axis._count.activitiesSecondary,
        },
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/strategic-axes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/strategic-axes/[id] — Mettre à jour un axe stratégique
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "strategic:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingAxis = await db.strategicAxis.findUnique({ where: { id } });
    if (!existingAxis) {
      return NextResponse.json(
        { error: "Axe stratégique non trouvé" },
        { status: 404 }
      );
    }
    if (existingAxis.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier un axe stratégique archivé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateStrategicAxisSchema.parse(body);

    // Vérifier l'unicité du code
    if (validated.code && validated.code !== existingAxis.code) {
      const codeExists = await db.strategicAxis.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code est déjà utilisé par un autre axe stratégique" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.objective !== undefined)
      updateData.objective = validated.objective;
    if (validated.expectedResults !== undefined)
      updateData.expectedResults = validated.expectedResults;
    if (validated.indicators !== undefined)
      updateData.indicators = validated.indicators;
    if (validated.concernedUnits !== undefined)
      updateData.concernedUnits = validated.concernedUnits;
    if (validated.order !== undefined) updateData.order = validated.order;

    const updatedAxis = await db.strategicAxis.update({
      where: { id },
      data: updateData,
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "StrategicAxis",
        entityId: id,
        oldValue: JSON.stringify({
          code: existingAxis.code,
          name: existingAxis.name,
          objective: existingAxis.objective,
          expectedResults: existingAxis.expectedResults,
          indicators: existingAxis.indicators,
          concernedUnits: existingAxis.concernedUnits,
          order: existingAxis.order,
        }),
        newValue: JSON.stringify(updateData),
        details: `Mise à jour de l'axe stratégique ${updatedAxis.name}`,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedAxis.id,
        code: updatedAxis.code,
        name: updatedAxis.name,
        objective: updatedAxis.objective,
        expectedResults: updatedAxis.expectedResults,
        indicators: updatedAxis.indicators,
        concernedUnits: updatedAxis.concernedUnits,
        order: updatedAxis.order,
        isActive: updatedAxis.isActive,
        updatedAt: updatedAxis.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/strategic-axes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/strategic-axes/[id] — Archiver / Restaurer un axe stratégique (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "strategic:archive");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingAxis = await db.strategicAxis.findUnique({ where: { id } });
    if (!existingAxis) {
      return NextResponse.json(
        { error: "Axe stratégique non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };

    if (action === "archive") {
      const updatedAxis = await db.strategicAxis.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "StrategicAxis",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedAxis.deletedAt,
          }),
          details: `Archive de l'axe stratégique ${existingAxis.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedAxis = await db.strategicAxis.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "StrategicAxis",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingAxis.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de l'axe stratégique ${existingAxis.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'archive' ou 'restore'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur PATCH /api/strategic-axes/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
