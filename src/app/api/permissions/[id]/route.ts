import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updatePermissionSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
});

// GET /api/permissions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "permissions:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const permission = await db.permission.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    if (!permission) {
      return NextResponse.json({ error: "Permission non trouvée" }, { status: 404 });
    }

    return NextResponse.json({ data: permission });
  } catch (error) {
    console.error("Erreur GET /api/permissions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/permissions/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "permissions:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updatePermissionSchema.parse(body);

    const existing = await db.permission.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Permission non trouvée" }, { status: 404 });
    }

    const updated = await db.permission.update({
      where: { id },
      data: validated,
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "Permission",
        entityId: id,
        oldValue: JSON.stringify({ name: existing.name, description: existing.description }),
        newValue: JSON.stringify(validated),
        details: `Mise à jour de la permission ${updated.name}`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/permissions/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
