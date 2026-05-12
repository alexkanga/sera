import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// GET /api/exports/[id]/download — Download generated file from DB
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
  const exportJob = await db.exportJob.findUnique({ where: { id } });

  if (!exportJob) {
    return NextResponse.json({ error: "Export non trouvé" }, { status: 404 });
  }

  if (exportJob.status !== "Terminé") {
    return NextResponse.json(
      { error: "L'export n'est pas encore prêt" },
      { status: 400 }
    );
  }

  if (!exportJob.fileData || !exportJob.fileName) {
    return NextResponse.json(
      { error: "Fichier d'export introuvable" },
      { status: 404 }
    );
  }

  const contentType = CONTENT_TYPES[exportJob.format] || "application/octet-stream";
  const fileBuffer = Buffer.from(exportJob.fileData);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${exportJob.fileName}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}
