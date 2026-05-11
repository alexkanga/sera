import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/exports/stats — Export statistics
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!userHasPermission(user, "export:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [
    totalExports,
    byType,
    byFormat,
    byStatus,
    recentExports,
    sizeStats,
    recordStats,
  ] = await Promise.all([
    db.exportJob.count(),

    db.exportJob.groupBy({ by: ["type"], _count: { type: true } }),

    db.exportJob.groupBy({ by: ["format"], _count: { format: true } }),

    db.exportJob.groupBy({ by: ["status"], _count: { status: true } }),

    db.exportJob.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { generatedBy: { select: { name: true } } },
    }),

    db.exportJob.aggregate({ _sum: { fileSize: true }, _avg: { fileSize: true } }),

    db.exportJob.aggregate({ _sum: { recordCount: true } }),
  ]);

  const typeCounts: Record<string, number> = {};
  for (const item of byType) {
    typeCounts[item.type] = item._count.type;
  }

  const formatCounts: Record<string, number> = {};
  for (const item of byFormat) {
    formatCounts[item.format] = item._count.format;
  }

  const statusCounts: Record<string, number> = {};
  for (const item of byStatus) {
    statusCounts[item.status] = item._count.status;
  }

  const successRate = totalExports > 0
    ? Math.round(((statusCounts["Terminé"] || 0) / totalExports) * 100)
    : 0;

  return NextResponse.json({
    totalExports,
    typeCounts,
    formatCounts,
    statusCounts,
    successRate,
    totalFileSize: sizeStats._sum.fileSize || 0,
    averageFileSize: Math.round(sizeStats._avg.fileSize || 0),
    totalRecords: recordStats._sum.recordCount || 0,
    recentExports,
  });
}
