import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  ptaCode: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  roleIds: z.array(z.string()).optional().default([]),
});

// GET /api/users — Liste des utilisateurs (pas les archivés par défaut)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "users:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("archived") === "true";
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const department = searchParams.get("department") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter takes priority over archived param
    if (status === "archived") {
      where.deletedAt = { not: null };
    } else if (status === "all") {
      // No filter on deletedAt
    } else if (status === "active") {
      where.deletedAt = null;
      where.isActive = true;
    } else if (!includeArchived) {
      // Default: only active, non-archived users
      where.deletedAt = null;
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { ptaCode: { contains: search } },
        { position: { contains: search } },
      ];
    }

    if (role) {
      where.roles = { some: { role: { code: role } } };
    }

    if (department) {
      where.department = { contains: department };
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    const formattedUsers = users.map((user) => ({
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
        permissions: ur.role.permissions.map((rp) => rp.permission.code),
      })),
    }));

    return NextResponse.json({
      data: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/users — Créer un utilisateur
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "users:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createUserSchema.parse(body);

    // Vérifier si l'email existe déjà
    const existingUser = await db.user.findUnique({
      where: { email: validated.email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Un compte avec cet email existe déjà" },
        { status: 409 }
      );
    }

    // Vérifier si le code PTA existe déjà
    if (validated.ptaCode) {
      const existingPtaCode = await db.user.findUnique({
        where: { ptaCode: validated.ptaCode },
      });
      if (existingPtaCode) {
        return NextResponse.json(
          { error: "Un compte avec ce code PTA existe déjà" },
          { status: 409 }
        );
      }
    }

    const hashedPassword = await hash(validated.password, 12);

    const user = await db.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        ptaCode: validated.ptaCode,
        position: validated.position,
        department: validated.department,
        phone: validated.phone,
      },
    });

    // Assigner les rôles
    if (validated.roleIds && validated.roleIds.length > 0) {
      await db.userRole.createMany({
        data: validated.roleIds.map((roleId: string) => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        newValue: JSON.stringify({
          email: user.email,
          name: user.name,
          ptaCode: user.ptaCode,
          position: user.position,
          department: user.department,
          roleIds: validated.roleIds,
        }),
        details: `Création de l'utilisateur ${user.name} (${user.email})`,
      },
    });

    const createdUser = await db.user.findUnique({
      where: { id: user.id },
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

    return NextResponse.json(
      {
        data: {
          id: createdUser!.id,
          email: createdUser!.email,
          name: createdUser!.name,
          ptaCode: createdUser!.ptaCode,
          position: createdUser!.position,
          department: createdUser!.department,
          phone: createdUser!.phone,
          isActive: createdUser!.isActive,
          isLocked: createdUser!.isLocked,
          createdAt: createdUser!.createdAt,
          roles: createdUser!.roles.map((ur) => ({
            id: ur.role.id,
            code: ur.role.code,
            name: ur.role.name,
            permissions: ur.role.permissions.map((rp) => rp.permission.code),
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
    console.error("Erreur POST /api/users:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
