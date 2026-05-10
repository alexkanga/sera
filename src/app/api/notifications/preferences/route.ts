import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

// ============================================================
// GET /api/notifications/preferences — Préférences de notification
// ============================================================

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "notifications:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    let preferences = await db.notificationPreference.findUnique({
      where: { userId: currentUser.id },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await db.notificationPreference.create({
        data: {
          userId: currentUser.id,
          emailEnabled: true,
          pushEnabled: false,
          activityAlerts: true,
          deadlineReminders: true,
          validationAlerts: true,
          reportAlerts: true,
          systemAlerts: true,
          deadlineReminderDays: 3,
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      });
    }

    return NextResponse.json({ data: preferences });
  } catch (error) {
    console.error("Erreur GET /api/notifications/preferences:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PUT /api/notifications/preferences — Mettre à jour les préférences
// ============================================================

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  activityAlerts: z.boolean().optional(),
  deadlineReminders: z.boolean().optional(),
  validationAlerts: z.boolean().optional(),
  reportAlerts: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  deadlineReminderDays: z.number().int().min(1).max(30).optional(),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "notifications:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updatePreferencesSchema.parse(body);

    // Build update data from validated fields
    const updateData: Record<string, unknown> = {};
    if (validated.emailEnabled !== undefined) updateData.emailEnabled = validated.emailEnabled;
    if (validated.pushEnabled !== undefined) updateData.pushEnabled = validated.pushEnabled;
    if (validated.activityAlerts !== undefined) updateData.activityAlerts = validated.activityAlerts;
    if (validated.deadlineReminders !== undefined) updateData.deadlineReminders = validated.deadlineReminders;
    if (validated.validationAlerts !== undefined) updateData.validationAlerts = validated.validationAlerts;
    if (validated.reportAlerts !== undefined) updateData.reportAlerts = validated.reportAlerts;
    if (validated.systemAlerts !== undefined) updateData.systemAlerts = validated.systemAlerts;
    if (validated.deadlineReminderDays !== undefined) updateData.deadlineReminderDays = validated.deadlineReminderDays;
    if (validated.quietHoursStart !== undefined) updateData.quietHoursStart = validated.quietHoursStart;
    if (validated.quietHoursEnd !== undefined) updateData.quietHoursEnd = validated.quietHoursEnd;

    // Upsert: create if not exists, update if exists
    const preferences = await db.notificationPreference.upsert({
      where: { userId: currentUser.id },
      update: updateData,
      create: {
        userId: currentUser.id,
        emailEnabled: (validated.emailEnabled !== undefined) ? validated.emailEnabled : true,
        pushEnabled: (validated.pushEnabled !== undefined) ? validated.pushEnabled : false,
        activityAlerts: (validated.activityAlerts !== undefined) ? validated.activityAlerts : true,
        deadlineReminders: (validated.deadlineReminders !== undefined) ? validated.deadlineReminders : true,
        validationAlerts: (validated.validationAlerts !== undefined) ? validated.validationAlerts : true,
        reportAlerts: (validated.reportAlerts !== undefined) ? validated.reportAlerts : true,
        systemAlerts: (validated.systemAlerts !== undefined) ? validated.systemAlerts : true,
        deadlineReminderDays: (validated.deadlineReminderDays !== undefined) ? validated.deadlineReminderDays : 3,
        quietHoursStart: validated.quietHoursStart !== undefined ? validated.quietHoursStart : null,
        quietHoursEnd: validated.quietHoursEnd !== undefined ? validated.quietHoursEnd : null,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "UPDATE",
        entity: "NotificationPreference",
        entityId: preferences.id,
        newValue: JSON.stringify(updateData),
        details: `Mise à jour des préférences de notification`,
      },
    });

    return NextResponse.json({ data: preferences });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PUT /api/notifications/preferences:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
