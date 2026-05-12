import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateKpiSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.enum(["Stratégique", "Opérationnel", "Organisationnel", "Qualité"]).optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional().nullable(),
  direction: z.enum(["higher", "lower"]).optional(),
  frequency: z.enum(["Quotidien", "Hebdomadaire", "Mensuel", "Trimestriel", "Annuel"]).optional(),
  strategicAxisId: z.string().optional().nullable(),
  directionId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

const captureSnapshotSchema = z.object({
  value: z.number({ message: "La valeur est requise" }),
  targetValue: z.number().optional(),
  period: z.string().min(1, "La période est requise"),
  notes: z.string().optional().nullable(),
});

// Common include for KPI detail
const kpiDetailInclude = {
  strategicAxis: {
    select: { id: true, code: true, name: true },
  },
  orgDirection: {
    select: { id: true, code: true, name: true },
  },
  snapshots: {
    orderBy: { capturedAt: "desc" as const },
    select: {
      id: true,
      value: true,
      targetValue: true,
      period: true,
      capturedAt: true,
      notes: true,
    },
  },
};

// ============================================================
// GET /api/kpi/[id] — Détail d'une définition KPI avec snapshots
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "kpi:read") ||
      userHasPermission(currentUser, "pta:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const kpi = await db.kpiDefinition.findUnique({
      where: { id },
      include: kpiDetailInclude,
    });

    if (!kpi) {
      return NextResponse.json(
        { error: "KPI non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: kpi });
  } catch (error) {
    console.error("Erreur GET /api/kpi/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PUT /api/kpi/[id] — Mettre à jour une définition KPI
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "kpi:write") ||
      userHasPermission(currentUser, "pta:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingKpi = await db.kpiDefinition.findUnique({
      where: { id },
    });
    if (!existingKpi) {
      return NextResponse.json(
        { error: "KPI non trouvé" },
        { status: 404 }
      );
    }
    if (existingKpi.deletedAt) {
      return NextResponse.json(
        { error: "Impossible de modifier un KPI archivé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateKpiSchema.parse(body);

    // Check unique code if changed
    if (validated.code && validated.code !== existingKpi.code) {
      const codeExists = await db.kpiDefinition.findUnique({
        where: { code: validated.code },
      });
      if (codeExists) {
        return NextResponse.json(
          { error: "Ce code KPI est déjà utilisé" },
          { status: 409 }
        );
      }
    }

    // Verify strategicAxisId exists if changed
    if (validated.strategicAxisId) {
      const axis = await db.strategicAxis.findUnique({
        where: { id: validated.strategicAxisId },
      });
      if (!axis) {
        return NextResponse.json(
          { error: "L'axe stratégique spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Verify directionId exists if changed
    if (validated.directionId) {
      const direction = await db.direction.findUnique({
        where: { id: validated.directionId },
      });
      if (!direction) {
        return NextResponse.json(
          { error: "La direction spécifiée n'existe pas" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.category !== undefined) updateData.category = validated.category;
    if (validated.targetValue !== undefined) updateData.targetValue = validated.targetValue;
    if (validated.currentValue !== undefined) updateData.currentValue = validated.currentValue;
    if (validated.unit !== undefined) updateData.unit = validated.unit;
    if (validated.direction !== undefined) updateData.direction = validated.direction;
    if (validated.frequency !== undefined) updateData.frequency = validated.frequency;
    if (validated.strategicAxisId !== undefined) updateData.strategicAxisId = validated.strategicAxisId;
    if (validated.directionId !== undefined) updateData.directionId = validated.directionId;
    if (validated.isPublic !== undefined) updateData.isPublic = validated.isPublic;

    const updatedKpi = await db.kpiDefinition.update({
      where: { id },
      data: updateData,
      include: {
        strategicAxis: {
          select: { id: true, code: true, name: true },
        },
        orgDirection: {
          select: { id: true, code: true, name: true },
        },
        snapshots: {
          orderBy: { capturedAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            value: true,
            targetValue: true,
            period: true,
            capturedAt: true,
            notes: true,
          },
        },
      },
    });

    // Audit log with oldValue/newValue comparison
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldValue[key] = (existingKpi as Record<string, unknown>)[key];
      newValue[key] = updateData[key];
    }

    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "KpiDefinition",
        entityId: id,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        details: `Mise à jour du KPI ${updatedKpi.name} (${updatedKpi.code})`,
      },
    });

    return NextResponse.json({ data: updatedKpi });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/kpi/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/kpi/[id] — Actions: archive, restore, capture-snapshot
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "kpi:write") ||
      userHasPermission(currentUser, "pta:update");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;

    const existingKpi = await db.kpiDefinition.findUnique({
      where: { id },
    });
    if (!existingKpi) {
      return NextResponse.json(
        { error: "KPI non trouvé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action } = body as {
      action: "archive" | "restore" | "capture-snapshot";
    };

    if (action === "archive") {
      const updatedKpi = await db.kpiDefinition.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "ARCHIVE",
          entity: "KpiDefinition",
          entityId: id,
          oldValue: JSON.stringify({ isActive: true, deletedAt: null }),
          newValue: JSON.stringify({
            isActive: false,
            deletedAt: updatedKpi.deletedAt,
          }),
          details: `Archive du KPI ${existingKpi.name} (${existingKpi.code})`,
        },
      });

      return NextResponse.json({ data: { id, archived: true } });
    } else if (action === "restore") {
      const updatedKpi = await db.kpiDefinition.update({
        where: { id },
        data: { deletedAt: null, isActive: true },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "RESTORE",
          entity: "KpiDefinition",
          entityId: id,
          oldValue: JSON.stringify({
            isActive: false,
            deletedAt: existingKpi.deletedAt,
          }),
          newValue: JSON.stringify({ isActive: true, deletedAt: null }),
          details: `Restauration du KPI ${existingKpi.name} (${existingKpi.code})`,
        },
      });

      return NextResponse.json({ data: { id, restored: true } });
    } else if (action === "capture-snapshot") {
      const snapshotData = captureSnapshotSchema.parse(
        (body as Record<string, unknown>).data ?? body
      );

      const targetValue = snapshotData.targetValue ?? existingKpi.targetValue;

      // Check unique period for this KPI
      const existingSnapshot = await db.kpiSnapshot.findUnique({
        where: {
          kpiId_period: {
            kpiId: id,
            period: snapshotData.period,
          },
        },
      });
      if (existingSnapshot) {
        return NextResponse.json(
          { error: `Un snapshot existe déjà pour la période "${snapshotData.period}"` },
          { status: 409 }
        );
      }

      const snapshot = await db.kpiSnapshot.create({
        data: {
          kpiId: id,
          value: snapshotData.value,
          targetValue,
          period: snapshotData.period,
          notes: snapshotData.notes ?? null,
        },
      });

      // Update the currentValue on the KPI definition
      await db.kpiDefinition.update({
        where: { id },
        data: { currentValue: snapshotData.value },
      });

      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "CAPTURE_SNAPSHOT",
          entity: "KpiSnapshot",
          entityId: snapshot.id,
          newValue: JSON.stringify({
            kpiCode: existingKpi.code,
            kpiName: existingKpi.name,
            value: snapshotData.value,
            targetValue,
            period: snapshotData.period,
          }),
          details: `Capture snapshot KPI ${existingKpi.name} (${existingKpi.code}) — période: ${snapshotData.period}, valeur: ${snapshotData.value}`,
        },
      });

      return NextResponse.json({ data: snapshot }, { status: 201 });
    }

    return NextResponse.json(
      {
        error:
          "Action invalide. Utilisez 'archive', 'restore' ou 'capture-snapshot'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PATCH /api/kpi/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
