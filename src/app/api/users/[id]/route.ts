import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  ptaCode: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  password: z.string().min(6).optional(),
  roleIds: z.array(z.string()).optional(),
});

// GET /api/users/[id] — Détail d'un utilisateur
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = currentUser.roles.some((r) =>
      r.permissions.some((p) => p === "users:read" || p === "users:*")
    );
    // Un utilisateur peut voir son propre profil
    const { id } = await params;
    if (!hasAccess && currentUser.id !== id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const user = await db.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        ptaCode: user.ptaCode,
        position: user.position,
        department: user.department,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        isLocked: user.isLocked,
        lastLoginAt: user.lastLoginAt,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roles: user.roles.map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
          isSystem: ur.role.isSystem,
          permissions: ur.role.permissions.map((rp) => rp.permission.code),
        })),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/users/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT /api/users/[id] — Mettre à jour un utilisateur
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const hasAccess = currentUser.roles.some((r) =>
      r.permissions.some((p) => p === "users:update" || p === "users:*")
    );
    // Un utilisateur peut modifier son propre profil (nom, téléphone, avatar)
    if (!hasAccess && currentUser.id !== id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    if (existingUser.deletedAt) {
      return NextResponse.json({ error: "Impossible de modifier un utilisateur archivé" }, { status: 400 });
    }

    const body = await request.json();

    // Si c'est l'utilisateur lui-même, restreindre les champs modifiables
    if (!hasAccess) {
      const selfUpdateSchema = z.object({
        name: z.string().min(2).optional(),
        phone: z.string().optional().nullable(),
        avatar: z.string().optional().nullable(),
      });
      const selfValidated = selfUpdateSchema.parse(body);
      const updatedUser = await db.user.update({
        where: { id },
        data: selfValidated,
      });
      return NextResponse.json({ data: { id: updatedUser.id, name: updatedUser.name } });
    }

    const validated = updateUserSchema.parse(body);

    // Vérifier l'unicité de l'email
    if (validated.email && validated.email !== existingUser.email) {
      const emailExists = await db.user.findUnique({ where: { email: validated.email } });
      if (emailExists) {
        return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
      }
    }

    // Vérifier l'unicité du code PTA
    if (validated.ptaCode && validated.ptaCode !== existingUser.ptaCode) {
      const ptaExists = await db.user.findUnique({ where: { ptaCode: validated.ptaCode } });
      if (ptaExists) {
        return NextResponse.json({ error: "Ce code PTA est déjà utilisé" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.email !== undefined) updateData.email = validated.email;
    if (validated.ptaCode !== undefined) updateData.ptaCode = validated.ptaCode;
    if (validated.position !== undefined) updateData.position = validated.position;
    if (validated.department !== undefined) updateData.department = validated.department;
    if (validated.phone !== undefined) updateData.phone = validated.phone;
    if (validated.avatar !== undefined) updateData.avatar = validated.avatar;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    if (validated.isLocked !== undefined) updateData.isLocked = validated.isLocked;
    if (validated.password) {
      updateData.password = await hash(validated.password, 12);
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    });

    // Mettre à jour les rôles
    if (validated.roleIds !== undefined) {
      await db.userRole.deleteMany({ where: { userId: id } });
      if (validated.roleIds.length > 0) {
        await db.userRole.createMany({
          data: validated.roleIds.map((roleId: string) => ({ userId: id, roleId })),
        });
      }
    }

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "User",
        entityId: id,
        oldValue: JSON.stringify({
          name: existingUser.name,
          email: existingUser.email,
          ptaCode: existingUser.ptaCode,
          position: existingUser.position,
          department: existingUser.department,
          isActive: existingUser.isActive,
          isLocked: existingUser.isLocked,
        }),
        newValue: JSON.stringify(updateData),
        details: `Mise à jour de l'utilisateur ${updatedUser.name}`,
      },
    });

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        ptaCode: updatedUser.ptaCode,
        position: updatedUser.position,
        department: updatedUser.department,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
        isLocked: updatedUser.isLocked,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/users/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/users/[id] — Archiver / Restaurer un utilisateur (soft delete)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = currentUser.roles.some((r) =>
      r.permissions.some((p) => p === "users:archive" || p === "users:*")
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    // Empêcher l'auto-archive
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas archiver votre propre compte" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body as { action: "archive" | "restore" };

    if (action === "archive") {
      const updatedUser = await db.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "User",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({ isActive: false, deletedAt: updatedUser.deletedAt }),
          details: `Archive de l'utilisateur ${existingUser.name}`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedUser = await db.user.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "User",
          entityId: id,
          oldValue: JSON.stringify({ isActive: false, deletedAt: existingUser.deletedAt }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de l'utilisateur ${existingUser.name}`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json({ error: "Action invalide. Utilisez 'archive' ou 'restore'" }, { status: 400 });
  } catch (error) {
    console.error("Erreur PATCH /api/users/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
