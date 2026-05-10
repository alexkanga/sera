import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

// ============================================================
// GET /api/notifications — Liste des notifications
// ============================================================

const querySchema = z.object({
  tab: z.enum(["all", "unread", "read", "sent"]).default("all"),
  category: z.string().optional(),
  type: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "notifications:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      tab: searchParams.get("tab") || undefined,
      category: searchParams.get("category") || undefined,
      type: searchParams.get("type") || undefined,
      priority: searchParams.get("priority") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres invalides", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tab, category, type, priority, search, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      isActive: true,
      deletedAt: null,
    };

    // Tab filter: determines whose notifications we see
    if (tab === "sent") {
      where.createdById = currentUser.id;
    } else {
      // "all", "unread", "read" — show user's received notifications
      where.userId = currentUser.id;
    }

    // Read/unread filter
    if (tab === "unread") {
      where.isRead = false;
    } else if (tab === "read") {
      where.isRead = true;
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Type filter
    if (type) {
      where.type = type;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Search filter (title, message)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    const include = {
      user: {
        select: { id: true, name: true, email: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    };

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    return NextResponse.json({
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/notifications:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// POST /api/notifications — Créer une notification
// ============================================================

const createNotificationSchema = z.object({
  userId: z.string().min(1, "Le destinataire est requis"),
  title: z.string().min(1, "Le titre est requis"),
  message: z.string().min(1, "Le message est requis"),
  type: z.enum(["info", "warning", "error", "success", "alert"]).default("info"),
  category: z
    .enum(["activité", "échéance", "validation", "rapport", "système", "alerte"])
    .default("système"),
  priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  actionUrl: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only admins/managers can create manual notifications
    const hasAccess = userHasPermission(currentUser, "notifications:*");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès refusé — seuls les administrateurs peuvent créer des notifications manuelles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createNotificationSchema.parse(body);

    // Verify userId exists in DB
    const recipient = await db.user.findUnique({
      where: { id: validated.userId },
    });
    if (!recipient) {
      return NextResponse.json(
        { error: "Le destinataire spécifié n'existe pas" },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        userId: validated.userId,
        title: validated.title,
        message: validated.message,
        type: validated.type,
        category: validated.category,
        priority: validated.priority,
        actionUrl: validated.actionUrl ?? null,
        entityId: validated.entityId ?? null,
        entityType: validated.entityType ?? null,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        createdById: currentUser.id,
        sentAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Notification",
        entityId: notification.id,
        newValue: JSON.stringify({
          userId: notification.userId,
          title: notification.title,
          type: notification.type,
          category: notification.category,
          priority: notification.priority,
        }),
        details: `Création de la notification "${notification.title}" pour ${recipient.name}`,
      },
    });

    return NextResponse.json({ data: notification }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/notifications:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
