import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createPermissionSchema = z.object({
  code: z.string().min(3, "Le code doit contenir au moins 3 caractères"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  module: z.string().min(2, "Le module est requis"),
  description: z.string().optional().nullable(),
});

// GET /api/permissions — Liste des permissions
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "permissions:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleFilter = searchParams.get("module") || "";

    const where: Record<string, unknown> = { isActive: true, deletedAt: null };
    if (moduleFilter) where.module = moduleFilter;

    const permissions = await db.permission.findMany({
      where,
      include: {
        roles: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: [{ module: "asc" }, { code: "asc" }],
    });

    const formatted = permissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      module: p.module,
      description: p.description,
      isActive: p.isActive,
      createdAt: p.createdAt,
      roles: p.roles.map((rp) => ({
        id: rp.role.id,
        code: rp.role.code,
        name: rp.role.name,
      })),
    }));

    // Grouper par module
    const grouped = formatted.reduce(
      (acc, p) => {
        if (!acc[p.module]) acc[p.module] = [];
        acc[p.module].push(p);
        return acc;
      },
      {} as Record<string, typeof formatted>
    );

    return NextResponse.json({ data: formatted, grouped });
  } catch (error) {
    console.error("Erreur GET /api/permissions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/permissions — Créer une permission
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "permissions:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createPermissionSchema.parse(body);

    const existing = await db.permission.findUnique({
      where: { code: validated.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Une permission avec ce code existe déjà" },
        { status: 409 }
      );
    }

    const permission = await db.permission.create({
      data: validated,
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Permission",
        entityId: permission.id,
        newValue: JSON.stringify(validated),
        details: `Création de la permission ${permission.name} (${permission.code})`,
      },
    });

    return NextResponse.json({ data: permission }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/permissions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
