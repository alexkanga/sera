import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { generateExportFile } from "@/lib/export-generators";

const exportCreateSchema = z.object({
  type: z.enum(["pta", "dashboard", "report", "gantt", "raci", "evidence"]),
  format: z.enum(["pdf", "xlsx", "docx"]),
  title: z.string().min(1).max(200).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const exportListSchema = z.object({
  search: z.string().optional(),
  type: z.enum(["pta", "dashboard", "report", "gantt", "raci", "evidence"]).optional(),
  format: z.enum(["pdf", "xlsx", "docx"]).optional(),
  status: z.enum(["En attente", "En cours", "Terminé", "Erreur"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/exports — List export jobs
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!userHasPermission(user, "export:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = exportListSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { search, type, format, status, page, limit } = parsed.data;

  const where: Record<string, unknown> = {};
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }
  if (type) where.type = type;
  if (format) where.format = format;
  if (status) where.status = status;

  const [exports, total] = await Promise.all([
    db.exportJob.findMany({
      where,
      include: {
        generatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.exportJob.count({ where }),
  ]);

  return NextResponse.json({
    exports,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/exports — Create and execute export
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!userHasPermission(user, "export:execute")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = exportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { type, format, title, filters } = parsed.data;
  const autoTitle = title || `Export ${type.toUpperCase()} - ${format.toUpperCase()} - ${new Date().toLocaleDateString("fr-FR")}`;

  // Create export job
  const exportJob = await db.exportJob.create({
    data: {
      type,
      format,
      title: autoTitle,
      status: "En cours",
      filters: filters ? JSON.stringify(filters) : null,
      generatedById: user.id,
      startedAt: new Date(),
    },
  });

  // Generate the file asynchronously
  try {
    const result = await generateExportFile(type, format, filters, exportJob.id);

    await db.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "Terminé",
        fileName: result.fileName,
        fileSize: result.fileSize,
        filePath: result.filePath,
        recordCount: result.recordCount,
        completedAt: new Date(),
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "ExportJob",
        entityId: exportJob.id,
        newValue: JSON.stringify({ type, format, title: autoTitle, recordCount: result.recordCount }),
        details: `Export ${type} en format ${format} généré avec succès`,
        severity: "info",
      },
    });

    const updated = await db.exportJob.findUnique({
      where: { id: exportJob.id },
      include: { generatedBy: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";

    await db.exportJob.update({
      where: { id: exportJob.id },
      data: {
        status: "Erreur",
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    // Audit log for error
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entity: "ExportJob",
        entityId: exportJob.id,
        newValue: JSON.stringify({ type, format, title: autoTitle }),
        details: `Échec de l'export: ${errorMsg}`,
        severity: "warning",
      },
    });

    return NextResponse.json(
      { error: "Erreur lors de la génération de l'export", details: errorMsg },
      { status: 500 }
    );
  }
}
