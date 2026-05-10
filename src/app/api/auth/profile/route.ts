import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";

// GET /api/auth/profile — Profil de l'utilisateur courant
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: currentUser.id },
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
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: user.roles.map((ur) => ({
          id: ur.role.id,
          code: ur.role.code,
          name: ur.role.name,
          permissions: ur.role.permissions.map((rp) => ({
            code: rp.permission.code,
            name: rp.permission.name,
          })),
        })),
        allPermissions: user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.code)
        ),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/auth/profile:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
