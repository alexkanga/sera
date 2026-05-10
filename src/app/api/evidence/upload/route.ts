import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST /api/evidence/upload — Téléverser un fichier de preuve
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Extract form fields
    const name = (formData.get("name") as string) || file.name;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string;
    const version = formData.get("version") as string | null;
    const activityId = formData.get("activityId") as string | null;
    const acbfDeliverableId = formData.get("acbfDeliverableId") as string | null;

    // Validate category
    const validCategories = [
      "Rapport",
      "PV",
      "Photo",
      "Lien",
      "Source de vérification",
      "Autre",
    ];
    if (!category || !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Catégorie invalide. Valeurs acceptées : ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify activityId exists if provided
    if (activityId) {
      const activity = await db.activity.findUnique({
        where: { id: activityId },
      });
      if (!activity) {
        return NextResponse.json(
          { error: "L'activité spécifiée n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify acbfDeliverableId exists if provided
    if (acbfDeliverableId) {
      const deliverable = await db.acbfDeliverable.findUnique({
        where: { id: acbfDeliverableId },
      });
      if (!deliverable) {
        return NextResponse.json(
          { error: "Le livrable ACBF spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Create upload directory if not exists
    const uploadDir = path.join(process.cwd(), "upload", "evidence");
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Relative path for storage in DB
    const relativePath = `/upload/evidence/${uniqueName}`;

    // Create EvidenceFile record
    const evidenceFile = await db.evidenceFile.create({
      data: {
        name,
        originalName: file.name,
        fileType: "file",
        mimeType: file.type || null,
        fileSize: file.size,
        url: relativePath,
        description: description || null,
        category,
        version: version || null,
        activityId: activityId || null,
        acbfDeliverableId: acbfDeliverableId || null,
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
          fileSize: evidenceFile.fileSize,
          mimeType: evidenceFile.mimeType,
        }),
        details: `Téléversement du fichier ${file.name} (${(file.size / 1024).toFixed(1)} Ko)`,
      },
    });

    return NextResponse.json({ data: evidenceFile }, { status: 201 });
  } catch (error) {
    console.error("Erreur POST /api/evidence/upload:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
