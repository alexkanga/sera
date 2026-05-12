import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["mark-read", "mark-unread", "delete", "restore"]),
});

// PATCH /api/notifications/[id] — Actions sur une notification
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "notifications:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingNotification = await db.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: "Notification non trouvée" },
        { status: 404 }
      );
    }

    // User can only modify their own received notifications
    // Admin:* can modify any notification
    const isAdmin = userHasPermission(currentUser, "admin:*");
    if (!isAdmin && existingNotification.userId !== currentUser.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres notifications" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = patchSchema.parse(body);
    const { action } = validated;

    if (action === "mark-read") {
      if (existingNotification.isRead) {
        return NextResponse.json(
          { error: "Cette notification est déjà marquée comme lue" },
          { status: 400 }
        );
      }

      const now = new Date();
      const updated = await db.notification.update({
        where: { id },
        data: { isRead: true, readAt: now },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "MARK_READ",
          entity: "Notification",
          entityId: id,
          oldValue: JSON.stringify({ isRead: false, readAt: null }),
          newValue: JSON.stringify({ isRead: true, readAt: now }),
          details: `Notification "${existingNotification.title}" marquée comme lue`,
        },
      });

      return NextResponse.json({
        data: { id, isRead: true, readAt: now },
      });
    } else if (action === "mark-unread") {
      if (!existingNotification.isRead) {
        return NextResponse.json(
          { error: "Cette notification est déjà marquée comme non lue" },
          { status: 400 }
        );
      }

      const updated = await db.notification.update({
        where: { id },
        data: { isRead: false, readAt: null },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "MARK_UNREAD",
          entity: "Notification",
          entityId: id,
          oldValue: JSON.stringify({
            isRead: true,
            readAt: existingNotification.readAt,
          }),
          newValue: JSON.stringify({ isRead: false, readAt: null }),
          details: `Notification "${existingNotification.title}" marquée comme non lue`,
        },
      });

      return NextResponse.json({
        data: { id, isRead: false, readAt: null },
      });
    } else if (action === "delete") {
      if (existingNotification.deletedAt) {
        return NextResponse.json(
          { error: "Cette notification est déjà supprimée" },
          { status: 400 }
        );
      }

      const now = new Date();
      await db.notification.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "DELETE",
          entity: "Notification",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({ isActive: false, deletedAt: now }),
          details: `Suppression (archivage) de la notification "${existingNotification.title}"`,
        },
      });

      return NextResponse.json({ data: { id, deleted: true } });
    } else if (action === "restore") {
      if (!existingNotification.deletedAt) {
        return NextResponse.json(
          { error: "Cette notification n'est pas supprimée" },
          { status: 400 }
        );
      }

      await db.notification.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "Notification",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingNotification.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration de la notification "${existingNotification.title}"`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    }

    return NextResponse.json(
      {
        error:
          "Action invalide. Utilisez 'mark-read', 'mark-unread', 'delete' ou 'restore'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PATCH /api/notifications/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
