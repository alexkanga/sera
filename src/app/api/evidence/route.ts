import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createEvidenceSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  originalName: z.string().min(1, "Le nom original est requis"),
  fileType: z.enum(["file", "link"], {
    message: "Le type de fichier doit être 'file' ou 'link'",
  }),
  mimeType: z.string().optional().nullable(),
  fileSize: z.number().int().positive().optional().nullable(),
  url: z.string().min(1, "L'URL ou le chemin du fichier est requis"),
  description: z.string().optional().nullable(),
  category: z.enum(
    ["Rapport", "PV", "Photo", "Lien", "Source de vérification", "Autre"],
    { message: "Catégorie invalide" }
  ),
  version: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
});

// GET /api/evidence — Liste des fichiers de preuve
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "evidence:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const fileType = searchParams.get("fileType") || "";
    const activityId = searchParams.get("activityId") || "";
    const acbfDeliverableId = searchParams.get("acbfDeliverableId") || "";
    const isVerified = searchParams.get("isVerified") || "";
    const uploadedById = searchParams.get("uploadedById") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter (soft delete)
    if (status === "archived") {
      where.deletedAt = { not: null };
    } else if (status === "all") {
      // No filter on deletedAt
    } else {
      // Default: only active
      where.deletedAt = null;
      where.isActive = true;
    }

    // Search filter (by name, originalName)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { originalName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // FileType filter
    if (fileType) {
      where.fileType = fileType;
    }

    // ActivityId filter
    if (activityId) {
      where.activityId = activityId;
    }

    // AcbfDeliverableId filter
    if (acbfDeliverableId) {
      where.acbfDeliverableId = acbfDeliverableId;
    }

    // IsVerified filter
    if (isVerified === "true") {
      where.isVerified = true;
    } else if (isVerified === "false") {
      where.isVerified = false;
    }

    // UploadedById filter
    if (uploadedById) {
      where.uploadedById = uploadedById;
    }

    const include = {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
      activity: {
        select: { id: true, activityCode: true, title: true },
      },
      acbfDeliverable: {
        select: { id: true, code: true, name: true },
      },
      verifiedBy: {
        select: { id: true, name: true },
      },
    };

    const [evidenceFiles, total] = await Promise.all([
      db.evidenceFile.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.evidenceFile.count({ where }),
    ]);

    return NextResponse.json({
      data: evidenceFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/evidence:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/evidence — Créer une entrée de preuve (lien ou métadonnées uniquement)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "evidence:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createEvidenceSchema.parse(body);

    // Verify activityId exists if provided
    if (validated.activityId) {
      const activity = await db.activity.findUnique({
        where: { id: validated.activityId },
      });
      if (!activity) {
        return NextResponse.json(
          { error: "L'activité spécifiée n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify acbfDeliverableId exists if provided
    if (validated.acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: validated.acbfDeliverableId },
      });
      if (!deliverable) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    const evidenceFile = await db.evidenceFile.create({
      data: {
        name: validated.name,
        originalName: validated.originalName,
        fileType: validated.fileType,
        mimeType: validated.mimeType ?? null,
        fileSize: validated.fileSize ?? null,
        url: validated.url,
        description: validated.description ?? null,
        category: validated.category,
        version: validated.version ?? null,
        activityId: validated.activityId ?? null,
        acbfDeliverableId: validated.acbfDeliverableId ?? null,
        uploadedById: currentUser.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        activity: {
          select: { id: true, activityCode: true, title: true },
        },
        acbfDeliverable: {
          select: { id: true, code: true, name: true },
        },
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "EvidenceFile",
        entityId: evidenceFile.id,
        newValue: JSON.stringify({
          name: evidenceFile.name,
          originalName: evidenceFile.originalName,
          fileType: evidenceFile.fileType,
          category: evidenceFile.category,
          url: evidenceFile.url,
        }),
        details: `Création de la preuve ${evidenceFile.name} (${evidenceFile.fileType})`,
      },
    });

    return NextResponse.json({ data: evidenceFile }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/evidence:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
