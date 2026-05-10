import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/evidence/stats — Statistiques des fichiers de preuve
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "evidence:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Base filter: only active (non-archived) evidence
    const baseWhere = {
      deletedAt: null,
      isActive: true,
    };

    // Run parallel queries for performance
    const [
      totalActive,
      byCategoryRaw,
      byFileTypeRaw,
      verifiedCount,
      unverifiedCount,
      recentUploads,
      evidencePerActivityRaw,
    ] = await Promise.all([
      // Total active evidence files
      db.evidenceFile.count({ where: baseWhere }),

      // By category
      db.evidenceFile.groupBy({
        by: ["category"],
        where: baseWhere,
        _count: { category: true },
      }),

      // By fileType (file vs link)
      db.evidenceFile.groupBy({
        by: ["fileType"],
        where: baseWhere,
        _count: { fileType: true },
      }),

      // Verified count
      db.evidenceFile.count({
        where: { ...baseWhere, isVerified: true },
      }),

      // Unverified count
      db.evidenceFile.count({
        where: { ...baseWhere, isVerified: false },
      }),

      // Recent uploads (last 7 days)
      db.evidenceFile.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Evidence per activity (top activities by evidence count)
      db.evidenceFile.groupBy({
        by: ["activityId"],
        where: {
          ...baseWhere,
          activityId: { not: null },
        },
        _count: { activityId: true },
        orderBy: { _count: { activityId: "desc" } },
        take: 10,
      }),
    ]);

    // Enrich category counts
    const byCategory: Record<string, number> = {};
    for (const item of byCategoryRaw) {
      byCategory[item.category] = item._count.category;
    }

    // Enrich fileType counts
    const byFileType: Record<string, number> = {};
    for (const item of byFileTypeRaw) {
      byFileType[item.fileType] = item._count.fileType;
    }

    // Enrich evidence per activity with activity names
    const evidencePerActivity: Array<{
      activityId: string;
      activityCode: string;
      activityTitle: string;
      evidenceCount: number;
    }> = [];
    for (const item of evidencePerActivityRaw) {
      if (item.activityId) {
        const activity = await db.activity.findUnique({
          where: { id: item.activityId },
          select: { id: true, activityCode: true, title: true },
        });
        if (activity) {
          evidencePerActivity.push({
            activityId: activity.id,
            activityCode: activity.activityCode,
            activityTitle: activity.title,
            evidenceCount: item._count.activityId,
          });
        }
      }
    }

    return NextResponse.json({
      data: {
        totalActive,
        byCategory,
        byFileType,
        verifiedCount,
        unverifiedCount,
        recentUploads,
        evidencePerActivity,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/evidence/stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
