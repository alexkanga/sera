import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/audit-logs/stats — Advanced audit log statistics
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "audit:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // KPI stats — parallel queries
    const [
      totalLogs,
      todayCount,
      weekCount,
      criticalCount,
      warningCount,
      activeUsersCount,
    ] = await Promise.all([
      db.auditLog.count(),
      db.auditLog.count({ where: { createdAt: { gte: todayStart } } }),
      db.auditLog.count({ where: { createdAt: { gte: weekStart } } }),
      db.auditLog.count({ where: { severity: "critical" } }),
      db.auditLog.count({ where: { severity: "warning" } }),
      db.auditLog.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    // Daily activity — last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyLogs = await db.auditLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Build daily activity map
    const dailyActivity: Array<{ date: string; count: number }> = [];
    const dayMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      dayMap.set(key, 0);
    }
    for (const log of dailyLogs) {
      const key = new Date(log.createdAt).toISOString().split("T")[0];
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }
    }
    for (const [date, count] of dayMap) {
      dailyActivity.push({ date, count });
    }

    // Recent critical actions
    const recentCritical = await db.auditLog.findMany({
      where: { severity: "critical" },
      include: {
        user: { select: { id: true, name: true, email: true, ptaCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Top active users — by action count
    const topUsersRaw = await db.auditLog.groupBy({
      by: ["userId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
      where: { userId: { not: null } },
    });

    // Get user details for top users
    const topUserIds = topUsersRaw.map((u) => u.userId as string).filter(Boolean);
    const topUsersData = await db.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, name: true, email: true },
    });

    const byUser = topUsersRaw.map((u) => {
      const user = topUsersData.find((ud) => ud.id === u.userId);
      return {
        userId: u.userId,
        userName: user?.name ?? "Inconnu",
        userEmail: user?.email ?? "",
        count: u._count.id,
      };
    });

    return NextResponse.json({
      totalLogs,
      todayCount,
      weekCount,
      criticalCount,
      warningCount,
      activeUsersCount: activeUsersCount.filter((u) => u.userId !== null).length,
      dailyActivity,
      recentCritical,
      byUser,
    });
  } catch (error) {
    console.error("Erreur GET /api/audit-logs/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
