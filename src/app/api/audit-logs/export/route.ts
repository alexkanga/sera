import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";

// GET /api/audit-logs/export — Export audit logs as CSV or JSON
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

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const entity = searchParams.get("entity") || "";
    const action = searchParams.get("action") || "";
    const severity = searchParams.get("severity") || "";
    const search = searchParams.get("search") || "";
    const userId = searchParams.get("userId") || "";
    const entityId = searchParams.get("entityId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    // Build where clause (same as main route)
    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (severity) where.severity = severity;
    if (userId) where.userId = userId;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.createdAt = dateFilter;
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const logs = await db.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, ptaCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Audit the export action
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EXPORT",
        entity: "AuditLog",
        details: `Export journal d'audit (${format}, ${logs.length} entrées)`,
        severity: "info",
      },
    });

    if (format === "json") {
      const jsonData = logs.map((log) => ({
        id: log.id,
        date: log.createdAt.toISOString(),
        utilisateur: log.user?.name ?? "Système",
        email: log.user?.email ?? "",
        action: log.action,
        entite: log.entity,
        entiteId: log.entityId ?? "",
        severite: log.severity,
        details: log.details ?? "",
        ancienneValeur: log.oldValue ?? "",
        nouvelleValeur: log.newValue ?? "",
        adresseIp: log.ipAddress ?? "",
        userAgent: log.userAgent ?? "",
      }));

      return new NextResponse(JSON.stringify({ data: jsonData, exportedAt: new Date().toISOString(), totalRecords: jsonData.length }, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // CSV format
    const headers = [
      "ID",
      "Date/Heure",
      "Utilisateur",
      "Email",
      "Action",
      "Entité",
      "ID Entité",
      "Sévérité",
      "Détails",
      "Ancienne valeur",
      "Nouvelle valeur",
      "Adresse IP",
      "User Agent",
    ];

    const escapeCSV = (val: string): string => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvRows = [
      headers.map(escapeCSV).join(","),
      ...logs.map((log) =>
        [
          log.id,
          log.createdAt.toISOString(),
          log.user?.name ?? "Système",
          log.user?.email ?? "",
          log.action,
          log.entity,
          log.entityId ?? "",
          log.severity,
          (log.details ?? "").replace(/[\r\n]+/g, " "),
          (log.oldValue ?? "").replace(/[\r\n]+/g, " "),
          (log.newValue ?? "").replace(/[\r\n]+/g, " "),
          log.ipAddress ?? "",
          (log.userAgent ?? "").replace(/[\r\n]+/g, " "),
        ]
          .map(escapeCSV)
          .join(",")
      ),
    ];

    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const csvContent = bom + csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/audit-logs/export:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
