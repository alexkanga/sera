import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createRoleSchema = z.object({
  code: z.string().min(2, "Le code doit contenir au moins 2 caractères"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).optional().default([]),
});

// GET /api/roles — Liste des rôles
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "roles:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("archived") === "true";

    const where: Record<string, unknown> = {};
    if (!includeArchived) {
      where.deletedAt = null;
      where.isActive = true;
    }

    const roles = await db.role.findMany({
      where,
      include: {
        permissions: {
          include: { permission: true },
        },
        users: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      deletedAt: role.deletedAt,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissions: role.permissions.map((rp) => ({
        id: rp.permission.id,
        code: rp.permission.code,
        name: rp.permission.name,
        module: rp.permission.module,
      })),
      userCount: role.users.length,
    }));

    return NextResponse.json({ data: formattedRoles });
  } catch (error) {
    console.error("Erreur GET /api/roles:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/roles — Créer un rôle
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "roles:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createRoleSchema.parse(body);

    const existingRole = await db.role.findUnique({
      where: { code: validated.code },
    });
    if (existingRole) {
      return NextResponse.json(
        { error: "Un rôle avec ce code existe déjà" },
        { status: 409 }
      );
    }

    const role = await db.role.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
      },
    });

    // Assigner les permissions
    if (validated.permissionIds && validated.permissionIds.length > 0) {
      await db.rolePermission.createMany({
        data: validated.permissionIds.map((permissionId: string) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Role",
        entityId: role.id,
        newValue: JSON.stringify({
          code: role.code,
          name: role.name,
          permissionIds: validated.permissionIds,
        }),
        details: `Création du rôle ${role.name} (${role.code})`,
      },
    });

    const createdRole = await db.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return NextResponse.json(
      {
        data: {
          id: createdRole!.id,
          code: createdRole!.code,
          name: createdRole!.name,
          description: createdRole!.description,
          isSystem: createdRole!.isSystem,
          permissions: createdRole!.permissions.map((rp) => ({
            id: rp.permission.id,
            code: rp.permission.code,
            name: rp.permission.name,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/roles:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
