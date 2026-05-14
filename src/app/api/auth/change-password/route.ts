import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { changePasswordSchema } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/audit-utils";
import { z } from "zod";

// POST /api/auth/change-password
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = changePasswordSchema.parse(body);
    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    if (validated.newPassword !== validated.confirmPassword) {
      return NextResponse.json(
        { error: "Les mots de passe ne correspondent pas" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    const isPasswordValid = await compare(validated.currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(validated.newPassword, 12);
    const now = new Date();
    await db.user.update({
      where: { id: currentUser.id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        passwordChangedAt: now,
      },
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: currentUser.id,
        details: "Changement de mot de passe",
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ message: "Mot de passe modifié avec succès" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/auth/change-password:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
