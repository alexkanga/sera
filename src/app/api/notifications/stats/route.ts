import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/notifications/stats — KPIs des notifications pour l'utilisateur courant
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "notifications:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userId = currentUser.id;

    // Base where clause: active, non-deleted, user's notifications
    const baseWhere = {
      userId,
      isActive: true,
      deletedAt: null,
    };

    // Run all queries in parallel for performance
    const [
      total,
      unread,
      read,
      byType,
      byCategory,
      byPriority,
      lastNotification,
    ] = await Promise.all([
      // Total notifications
      db.notification.count({ where: baseWhere }),

      // Unread count
      db.notification.count({
        where: { ...baseWhere, isRead: false },
      }),

      // Read count
      db.notification.count({
        where: { ...baseWhere, isRead: true },
      }),

      // By type
      db.notification.groupBy({
        by: ["type"],
        where: baseWhere,
        _count: { type: true },
      }),

      // By category
      db.notification.groupBy({
        by: ["category"],
        where: baseWhere,
        _count: { category: true },
      }),

      // By priority
      db.notification.groupBy({
        by: ["priority"],
        where: baseWhere,
        _count: { priority: true },
      }),

      // Last notification date
      db.notification.findFirst({
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // Format grouped results
    const notificationsByType = Object.fromEntries(
      byType.map((item) => [item.type, item._count.type])
    );

    const notificationsByCategory = Object.fromEntries(
      byCategory.map((item) => [item.category, item._count.category])
    );

    const notificationsByPriority = Object.fromEntries(
      byPriority.map((item) => [item.priority, item._count.priority])
    );

    return NextResponse.json({
      data: {
        total,
        unread,
        read,
        byType: notificationsByType,
        byCategory: notificationsByCategory,
        byPriority: notificationsByPriority,
        lastNotificationAt: lastNotification?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/notifications/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
