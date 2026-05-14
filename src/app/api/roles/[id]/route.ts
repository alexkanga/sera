import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { updateRoleSchema } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";

// GET /api/roles/[id] — Détail d'un rôle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "roles:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const role = await db.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
        users: {
          include: {
            user: { select: { id: true, name: true, email: true, ptaCode: true } },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Rôle non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
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
        users: role.users.map((ur) => ({
          id: ur.user.id,
          name: ur.user.name,
          email: ur.user.email,
          ptaCode: ur.user.ptaCode,
        })),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/roles/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/roles/[id] — Mettre à jour un rôle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "roles:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const existingRole = await db.role.findUnique({ where: { id } });
    if (!existingRole) {
      return NextResponse.json({ error: "Rôle non trouvé" }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "Les rôles système ne peuvent pas être modifiés" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateRoleSchema.parse(body);
    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;

    const updatedRole = await db.role.update({
      where: { id },
      data: updateData,
    });

    // Mettre à jour les permissions
    if (validated.permissionIds !== undefined) {
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

      await db.rolePermission.deleteMany({ where: { roleId: id } });
      if (validated.permissionIds.length > 0) {
        await db.rolePermission.createMany({
          data: validated.permissionIds.map((permissionId: string) => ({
            roleId: id,
            permissionId,
          })),
        });
      }
    }

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "Role",
        entityId: id,
        oldValue: JSON.stringify({
          name: existingRole.name,
          description: existingRole.description,
        }),
        newValue: JSON.stringify(validated),
        details: `Mise à jour du rôle ${updatedRole.name}`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedRole.id,
        code: updatedRole.code,
        name: updatedRole.name,
        description: updatedRole.description,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/roles/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/roles/[id] — Archiver / Restaurer un rôle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "roles:archive");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const existingRole = await db.role.findUnique({ where: { id } });
    if (!existingRole) {
      return NextResponse.json({ error: "Rôle non trouvé" }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: "Les rôles système ne peuvent pas être archivés" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };
    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    if (action === "archive") {
      await db.role.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "Role",
          entityId: id,
          details: `Archive du rôle ${existingRole.name}`,
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      await db.role.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Role",
          entityId: id,
          details: `Restauration du rôle ${existingRole.name}`,
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    console.error("Erreur PATCH /api/roles/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
