import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";

const createDirectionSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional().nullable(),
  headUserId: z.string().optional().nullable(),
});

// GET /api/directions — Liste des directions (pas les archivées par défaut)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "org:read");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const includeUnits = searchParams.get("includeUnits") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter
    if (status === "archived") {
      where.deletedAt = { not: null };
    } else if (status === "all") {
      // No filter on deletedAt
    } else {
      // Default: only active (non-archived)
      where.deletedAt = null;
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const baseInclude = {
      headUser: true as const,
    };

    const include = includeUnits
      ? {
          ...baseInclude,
          units: {
            where: { deletedAt: null },
            orderBy: { name: "asc" as const },
          },
        }
      : baseInclude;

    const [directions, total] = await Promise.all([
      db.direction.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.direction.count({ where }),
    ]);

    type DirectionWithHead = {
      id: string;
      code: string;
      name: string;
      description: string | null;
      headUserId: string | null;
      isActive: boolean;
      deletedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      headUser: { id: string; name: string; email: string; position: string | null } | null;
      units?: { id: string; code: string; name: string; isActive: boolean }[];
    };

    const formattedDirections = (directions as DirectionWithHead[]).map((direction) => ({
      id: direction.id,
      code: direction.code,
      name: direction.name,
      description: direction.description,
      headUserId: direction.headUserId,
      headUser: direction.headUser
        ? {
            id: direction.headUser.id,
            name: direction.headUser.name,
            email: direction.headUser.email,
            position: direction.headUser.position,
          }
        : null,
      isActive: direction.isActive,
      deletedAt: direction.deletedAt,
      createdAt: direction.createdAt,
      updatedAt: direction.updatedAt,
      ...(includeUnits && direction.units
        ? {
            units: direction.units.map((unit) => ({
              id: unit.id,
              code: unit.code,
              name: unit.name,
              isActive: unit.isActive,
            })),
          }
        : {}),
    }));

    return NextResponse.json({
      data: formattedDirections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/directions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/directions — Créer une direction
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess = userHasPermission(currentUser, "org:create");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createDirectionSchema.parse(body);

    // Vérifier si le code existe déjà
    const existingDirection = await db.direction.findUnique({
      where: { code: validated.code },
    });
    if (existingDirection) {
      return NextResponse.json(
        { error: "Une direction avec ce code existe déjà" },
        { status: 409 }
      );
    }

    // Vérifier que le headUserId existe si fourni
    if (validated.headUserId) {
      const headUser = await db.user.findUnique({
        where: { id: validated.headUserId },
      });
      if (!headUser) {
        return NextResponse.json(
          { error: "L'utilisateur responsable spécifié n'existe pas" },
          { status: 400 }
        );
      }
    }

    const direction = await db.direction.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
        headUserId: validated.headUserId,
      },
      include: {
        headUser: true,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Direction",
        entityId: direction.id,
        newValue: JSON.stringify({
          code: direction.code,
          name: direction.name,
          description: direction.description,
          headUserId: direction.headUserId,
        }),
        details: `Création de la direction ${direction.name} (${direction.code})`,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: direction.id,
          code: direction.code,
          name: direction.name,
          description: direction.description,
          headUserId: direction.headUserId,
          headUser: direction.headUser
            ? {
                id: direction.headUser.id,
                name: direction.headUser.name,
                email: direction.headUser.email,
                position: direction.headUser.position,
              }
            : null,
          isActive: direction.isActive,
          createdAt: direction.createdAt,
          updatedAt: direction.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur POST /api/directions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
