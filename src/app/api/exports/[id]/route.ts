import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/exports/[id] — Export detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!userHasPermission(user, "export:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const exportJob = await db.exportJob.findUnique({
    where: { id },
    include: { generatedBy: { select: { id: true, name: true, email: true } } },
  });

  if (!exportJob) {
    return NextResponse.json({ error: "Export non trouvé" }, { status: 404 });
  }

  return NextResponse.json(exportJob);
}

// DELETE /api/exports/[id] — Delete export job
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!userHasPermission(user, "export:execute")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const exportJob = await db.exportJob.findUnique({ where: { id } });

  if (!exportJob) {
    return NextResponse.json({ error: "Export non trouvé" }, { status: 404 });
  }

  if (exportJob.status === "En cours") {
    return NextResponse.json(
      { error: "Impossible de supprimer un export en cours" },
      { status: 400 }
    );
  }

  // Delete export job record (fileData is stored in DB, no physical file to delete)
  await db.exportJob.delete({ where: { id } });

  // Audit log
  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entity: "ExportJob",
      entityId: id,
      oldValue: JSON.stringify({ title: exportJob.title, type: exportJob.type, format: exportJob.format }),
      details: `Export "${exportJob.title}" supprimé`,
      severity: "info",
    },
  });

  return NextResponse.json({ message: "Export supprimé avec succès" });
}
