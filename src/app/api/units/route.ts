import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";
import { createUnitSchema } from "@/lib/validations";
import { getIpAndUserAgent } from "@/lib/audit-utils";

// GET /api/units — Liste des unités (actives par défaut)
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
    const directionId = searchParams.get("directionId") || "";
    const status = searchParams.get("status") || ""; // "active", "archived", "all"
    const rawPage = parseInt(searchParams.get("page") || "1");
    const rawLimit = parseInt(searchParams.get("limit") || "20");
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
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
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    if (directionId) {
      where.directionId = directionId;
    }

    const [units, total] = await Promise.all([
      db.unit.findMany({
        where,
        include: {
          direction: true,
          headUser: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.unit.count({ where }),
    ]);

    const formattedUnits = units.map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      description: unit.description,
      directionId: unit.directionId,
      headUserId: unit.headUserId,
      isActive: unit.isActive,
      deletedAt: unit.deletedAt,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      direction: unit.direction
        ? {
            id: unit.direction.id,
            code: unit.direction.code,
            name: unit.direction.name,
          }
        : null,
      headUser: unit.headUser
        ? {
            id: unit.headUser.id,
            name: unit.headUser.name,
            email: unit.headUser.email,
            position: unit.headUser.position,
          }
        : null,
    }));

    return NextResponse.json({
      data: formattedUnits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/units:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/units — Créer une unité
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

    const { ipAddress, userAgent } = getIpAndUserAgent(request);

    const body = await request.json();
    const validated = createUnitSchema.parse(body);

    // Vérifier si le code existe déjà
    const existingUnit = await db.unit.findUnique({
      where: { code: validated.code },
    });
    if (existingUnit) {
      return NextResponse.json(
        { error: "Une unité avec ce code existe déjà" },
        { status: 409 }
      );
    }

    // Vérifier que la direction existe
    const direction = await db.direction.findUnique({
      where: { id: validated.directionId },
    });
    if (!direction) {
      return NextResponse.json(
        { error: "Direction non trouvée" },
        { status: 404 }
      );
    }
    if (direction.deletedAt) {
      return NextResponse.json(
        { error: "Impossible d'ajouter une unité à une direction archivée" },
        { status: 400 }
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

    const unit = await db.unit.create({
      data: {
        code: validated.code,
        name: validated.name,
        description: validated.description,
        directionId: validated.directionId,
        headUserId: validated.headUserId,
      },
      include: {
        direction: true,
        headUser: true,
      },
    });

    // Journal d'audit
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "CREATE",
        entity: "Unit",
        entityId: unit.id,
        newValue: JSON.stringify({
          code: unit.code,
          name: unit.name,
          description: unit.description,
          directionId: unit.directionId,
          headUserId: unit.headUserId,
        }),
        details: `Création de l'unité ${unit.name} (${unit.code})`,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          description: unit.description,
          directionId: unit.directionId,
          headUserId: unit.headUserId,
          isActive: unit.isActive,
          createdAt: unit.createdAt,
          updatedAt: unit.updatedAt,
          direction: unit.direction
            ? {
                id: unit.direction.id,
                code: unit.direction.code,
                name: unit.direction.name,
              }
            : null,
          headUser: unit.headUser
            ? {
                id: unit.headUser.id,
                name: unit.headUser.name,
                email: unit.headUser.email,
                position: unit.headUser.position,
              }
            : null,
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
    console.error("Erreur POST /api/units:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
