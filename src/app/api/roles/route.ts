import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { createRoleSchema } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";

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
    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    const existingRole = await db.role.findUnique({
      where: { code: validated.code },
    });
    if (existingRole) {
      return NextResponse.json(
        { error: "Un rôle avec ce code existe déjà" },
        { status: 409 }
      );
    }

    // Valider que les permissionIds existent et sont actifs
    if (validated.permissionIds.length > 0) {
      const validPermissions = await db.permission.findMany({
        where: { id: { in: validated.permissionIds }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (validPermissions.length !== validated.permissionIds.length) {
        return NextResponse.json(
          { error: "Une ou plusieurs permissions sont invalides ou archivées" },
          { status: 400 }
        );
      }
    }

    // Use create with include to avoid double query (fix 1.10)
    const createdRole = await db.role.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
        permissions: validated.permissionIds.length > 0
          ? {
              create: validated.permissionIds.map((permissionId: string) => ({ permissionId })),
            }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Role",
        entityId: createdRole.id,
        newValue: JSON.stringify({
          code: createdRole.code,
          name: createdRole.name,
          permissionIds: validated.permissionIds,
        }),
        details: `Création du rôle ${createdRole.name} (${createdRole.code})`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: createdRole.id,
          code: createdRole.code,
          name: createdRole.name,
          description: createdRole.description,
          isSystem: createdRole.isSystem,
          permissions: createdRole.permissions.map((rp) => ({
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
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/roles:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
