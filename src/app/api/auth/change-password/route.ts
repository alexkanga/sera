import { NextRequest, NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
});

// POST /api/auth/change-password
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = changePasswordSchema.parse(body);

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
    await db.user.update({
      where: { id: currentUser.id },
      data: { password: hashedPassword },
    });

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "PASSWORD_CHANGE",
        entity: "User",
        entityId: currentUser.id,
        details: "Changement de mot de passe",
      },
    });

    return NextResponse.json({ message: "Mot de passe modifié avec succès" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/auth/change-password:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
