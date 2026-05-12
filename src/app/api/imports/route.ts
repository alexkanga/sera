import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// GET /api/imports — Liste de l'historique des imports
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "import:execute") ||
      userHasPermission(currentUser, "admin:*");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    const [imports, total] = await Promise.all([
      db.importHistory.findMany({
        where,
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.importHistory.count({ where }),
    ]);

    return NextResponse.json({
      data: imports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/imports:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/imports — Upload et parsing d'un fichier Excel
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "import:execute") ||
      userHasPermission(currentUser, "admin:*");
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

    // Validate file type
    const allowedExtensions = ["xlsx", "xls", "csv"];
    const originalName = file.name;
    const extension = originalName.split(".").pop()?.toLowerCase() || "";

    if (!allowedExtensions.includes(extension)) {
      return NextResponse.json(
        { error: "Type de fichier non supporté. Formats acceptés: xlsx, xls, csv" },
        { status: 400 }
      );
    }

    // Save file to /upload/imports/ with unique name
    const uploadDir = path.join(process.cwd(), "upload", "imports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = `${Date.now()}_${originalName}`;
    const filePath = path.join(uploadDir, uniqueName);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, fileBuffer);

    // Parse the Excel file
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;

    // Extract preview data and row counts per sheet
    const previewData: Record<string, { rows: Record<string, unknown>[]; totalRows: number }> = {};
    let totalRows = 0;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const sheetRows = allRows.length;
      totalRows += sheetRows;

      // First 5 rows as preview
      previewData[sheetName] = {
        rows: allRows.slice(0, 5),
        totalRows: sheetRows,
      };
    }

    // Create ImportHistory record
    const importRecord = await db.importHistory.create({
      data: {
        fileName: originalName,
        fileSize: file.size,
        fileType: extension,
        status: "En attente",
        sheets: JSON.stringify(sheetNames),
        previewData: JSON.stringify(previewData),
        totalRows,
        uploadedById: currentUser.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "IMPORT",
        entity: "ImportHistory",
        entityId: importRecord.id,
        details: `Upload fichier Excel: ${originalName}`,
      },
    });

    return NextResponse.json({ data: importRecord }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/imports:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
