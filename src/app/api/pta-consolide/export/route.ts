import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { ptaConsolideExportSchema, type PtaConsolideExportValues } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/request-context";

// ============================================================
// GET /api/pta-consolide/export — Export consolidated data
// Query params: format=csv|json + same filters as main route
// ============================================================

// C1: Simple in-memory rate limiter (1 export per minute per user)
const exportTimestamps = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastExport = exportTimestamps.get(userId);
  if (lastExport && now - lastExport < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  exportTimestamps.set(userId, now);
  // Clean up old entries every 100 exports
  if (exportTimestamps.size > 100) {
    for (const [key, timestamp] of exportTimestamps) {
      if (now - timestamp > RATE_LIMIT_MS * 2) {
        exportTimestamps.delete(key);
      }
    }
  }
  return true;
}

// Flatten activity with relations for export
interface ActivityExportRow {
  activityCode: string;
  title: string;
  nature: string | null;
  annualObjective: string | null;
  detailedTasks: string | null;
  expectedDeliverable: string | null;
  responsibleName: string | null;
  responsibleEmail: string | null;
  responsiblePtaCode: string | null;
  directionCode: string | null;
  directionName: string | null;
  primaryAxisCode: string | null;
  primaryAxisName: string | null;
  secondaryAxisCode: string | null;
  secondaryAxisName: string | null;
  acbfDomainCode: string | null;
  acbfDomainName: string | null;
  acbfDeliverableCode: string | null;
  acbfDeliverableName: string | null;
  validatorName: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  priority: string;
  status: string;
  progressRate: number;
  performanceIndicator: string | null;
  verificationSource: string | null;
  validationStatus: string;
  riskDescription: string | null;
  dependency: string | null;
  comments: string | null;
  isLocked: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

function flattenActivity(activity: Record<string, unknown>): ActivityExportRow {
  const responsible = activity.responsible as Record<string, unknown> | null;
  const direction = activity.direction as Record<string, unknown> | null;
  const primaryAxis = activity.primaryAxis as Record<string, unknown> | null;
  const secondaryAxis = activity.secondaryAxis as Record<string, unknown> | null;
  const acbfDomain = activity.acbfDomain as Record<string, unknown> | null;
  const acbfDeliverable = activity.acbfDeliverable as Record<string, unknown> | null;
  const validator = activity.validator as Record<string, unknown> | null;
  const createdBy = activity.createdBy as Record<string, unknown> | null;
  const updatedBy = activity.updatedBy as Record<string, unknown> | null;

  return {
    activityCode: activity.activityCode as string,
    title: activity.title as string,
    nature: (activity.nature as string) ?? null,
    annualObjective: (activity.annualObjective as string) ?? null,
    detailedTasks: (activity.detailedTasks as string) ?? null,
    expectedDeliverable: (activity.expectedDeliverable as string) ?? null,
    responsibleName: (responsible?.name as string) ?? null,
    responsibleEmail: (responsible?.email as string) ?? null,
    responsiblePtaCode: (responsible?.ptaCode as string) ?? null,
    directionCode: (direction?.code as string) ?? null,
    directionName: (direction?.name as string) ?? null,
    primaryAxisCode: (primaryAxis?.code as string) ?? null,
    primaryAxisName: (primaryAxis?.name as string) ?? null,
    secondaryAxisCode: (secondaryAxis?.code as string) ?? null,
    secondaryAxisName: (secondaryAxis?.name as string) ?? null,
    acbfDomainCode: (acbfDomain?.code as string) ?? null,
    acbfDomainName: (acbfDomain?.name as string) ?? null,
    acbfDeliverableCode: (acbfDeliverable?.code as string) ?? null,
    acbfDeliverableName: (acbfDeliverable?.name as string) ?? null,
    validatorName: (validator?.name as string) ?? null,
    startDate: activity.startDate
      ? new Date(activity.startDate as string | Date).toISOString().split("T")[0]
      : null,
    endDate: activity.endDate
      ? new Date(activity.endDate as string | Date).toISOString().split("T")[0]
      : null,
    duration: (activity.duration as string) ?? null,
    priority: activity.priority as string,
    status: activity.status as string,
    progressRate: activity.progressRate as number,
    performanceIndicator: (activity.performanceIndicator as string) ?? null,
    verificationSource: (activity.verificationSource as string) ?? null,
    validationStatus: activity.validationStatus as string,
    riskDescription: (activity.riskDescription as string) ?? null,
    dependency: (activity.dependency as string) ?? null,
    comments: (activity.comments as string) ?? null,
    isLocked: activity.isLocked as boolean,
    createdByName: (createdBy?.name as string) ?? null,
    updatedByName: (updatedBy?.name as string) ?? null,
    createdAt: new Date(activity.createdAt as string | Date).toISOString(),
    updatedAt: new Date(activity.updatedAt as string | Date).toISOString(),
  };
}

// CSV headers in French
const csvHeaders: Record<keyof ActivityExportRow, string> = {
  activityCode: "Code activité",
  title: "Titre",
  nature: "Nature",
  annualObjective: "Objectif annuel",
  detailedTasks: "Tâches détaillées",
  expectedDeliverable: "Livrable attendu",
  responsibleName: "Responsable",
  responsibleEmail: "Email responsable",
  responsiblePtaCode: "Code PTA responsable",
  directionCode: "Code direction",
  directionName: "Direction",
  primaryAxisCode: "Code axe principal",
  primaryAxisName: "Axe principal",
  secondaryAxisCode: "Code axe secondaire",
  secondaryAxisName: "Axe secondaire",
  acbfDomainCode: "Code domaine ACBF",
  acbfDomainName: "Domaine ACBF",
  acbfDeliverableCode: "Code livrable ACBF",
  acbfDeliverableName: "Livrable ACBF",
  validatorName: "Validateur",
  startDate: "Date début",
  endDate: "Date fin",
  duration: "Durée",
  priority: "Priorité",
  status: "Statut",
  progressRate: "Taux avancement (%)",
  performanceIndicator: "Indicateur performance",
  verificationSource: "Source vérification",
  validationStatus: "Statut validation",
  riskDescription: "Description risque",
  dependency: "Dépendance",
  comments: "Commentaires",
  isLocked: "Verrouillé",
  createdByName: "Créé par",
  updatedByName: "Modifié par",
  createdAt: "Date création",
  updatedAt: "Date modification",
};

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}`;
  }
  return str;
}

function generateCSV(rows: ActivityExportRow[]): string {
  const headerKeys = Object.keys(csvHeaders) as (keyof ActivityExportRow)[];
  const headerLine = headerKeys.map((key) => escapeCSV(csvHeaders[key])).join(",");
  const dataLines = rows.map((row) =>
    headerKeys.map((key) => escapeCSV(row[key])).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

// Build filter where clause from export params (E4: apply filters)
function buildExportFilterWhere(params: PtaConsolideExportValues): Record<string, unknown> {
  const where: Record<string, unknown> = {
    deletedAt: null,
    isActive: true,
  };

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { activityCode: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (params.directionId) {
    where.directionId = params.directionId;
  }

  if (params.primaryAxisId) {
    where.primaryAxisId = params.primaryAxisId;
  }

  if (params.secondaryAxisId) {
    where.secondaryAxisId = params.secondaryAxisId;
  }

  if (params.acbfDomainId) {
    where.acbfDomainId = params.acbfDomainId;
  }

  if (params.priority) {
    where.priority = params.priority;
  }

  if (params.validationStatus) {
    where.validationStatus = params.validationStatus;
  }

  if (params.activityStatus) {
    where.status = params.activityStatus;
  }

  if (params.responsibleId) {
    where.responsibleId = params.responsibleId;
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "pta:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // C1: Rate limiting check
    if (!checkRateLimit(currentUser.id)) {
      return NextResponse.json(
        { error: "Export limité à une requête par minute. Veuillez réessayer plus tard." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);

    // C3: Use centralized validation schema with filter support
    const parseResult = ptaConsolideExportSchema.safeParse({
      format: searchParams.get("format") || "json",
      search: searchParams.get("search") || undefined,
      directionId: searchParams.get("directionId") || undefined,
      primaryAxisId: searchParams.get("primaryAxisId") || undefined,
      secondaryAxisId: searchParams.get("secondaryAxisId") || undefined,
      acbfDomainId: searchParams.get("acbfDomainId") || undefined,
      priority: searchParams.get("priority") || undefined,
      validationStatus: searchParams.get("validationStatus") || undefined,
      activityStatus: searchParams.get("activityStatus") || undefined,
      responsibleId: searchParams.get("responsibleId") || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;
    const { format } = params;

    // E4: Apply filters from params (not just all active activities)
    const where = buildExportFilterWhere(params);

    // Fetch filtered activities with all relations
    const activities = await db.activity.findMany({
      where,
      include: {
        responsible: {
          select: { id: true, name: true, email: true, ptaCode: true },
        },
        direction: {
          select: { id: true, code: true, name: true },
        },
        primaryAxis: {
          select: { id: true, code: true, name: true },
        },
        secondaryAxis: {
          select: { id: true, code: true, name: true },
        },
        acbfDomain: {
          select: { id: true, code: true, name: true },
        },
        acbfDeliverable: {
          select: { id: true, code: true, name: true },
        },
        validator: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        updatedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { activityCode: "asc" },
    });

    // Flatten for export
    const flatRows = activities.map((a) =>
      flattenActivity(a as unknown as Record<string, unknown>)
    );

    // C2: Audit log with IP and User-Agent
    const { ip, userAgent } = getIpAndUserAgent(request);
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "EXPORT",
        entity: "Activity",
        newValue: JSON.stringify({
          format,
          count: flatRows.length,
          filters: {
            search: params.search || null,
            directionId: params.directionId || null,
            priority: params.priority || null,
            validationStatus: params.validationStatus || null,
            activityStatus: params.activityStatus || null,
          },
        }),
        details: `Export PTA consolidé au format ${format.toUpperCase()} (${flatRows.length} activités)`,
        ip,
        userAgent,
      },
    });

    // Return based on format
    if (format === "csv") {
      const csvContent = generateCSV(flatRows);
      const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
      return new NextResponse(bom + csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pta-consolide-aaea-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // JSON format (default)
    return NextResponse.json({
      data: flatRows,
      exportedAt: new Date().toISOString(),
      totalRecords: flatRows.length,
      format: "json",
    });
  } catch (error) {
    console.error("Erreur GET /api/pta-consolide/export:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
