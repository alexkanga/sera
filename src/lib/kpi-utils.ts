// ============================================================
// Shared KPI utility objects (Module 10)
// ============================================================

/**
 * Common Prisma include object for KPI list views.
 * Includes strategicAxis, orgDirection, and the latest snapshot.
 */
export const kpiInclude = {
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
};

/**
 * Extended Prisma include object for KPI detail views.
 * Same as kpiInclude but includes ALL snapshots (not just the latest).
 */
export const kpiDetailInclude = {
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
