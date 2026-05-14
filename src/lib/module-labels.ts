/**
 * Shared module label mappings.
 * Single source of truth for module display names used across the application.
 */

export const MODULE_OPTIONS = [
  { value: "auth", label: "Authentification" },
  { value: "org", label: "Organisation" },
  { value: "strategic", label: "Stratégie" },
  { value: "acbf", label: "ACBF" },
  { value: "pta", label: "PTA" },
  { value: "raci", label: "RACI" },
  { value: "gantt", label: "Gantt" },
  { value: "dashboard", label: "Tableau de bord" },
  { value: "docs", label: "Documents" },
  { value: "reports", label: "Rapports" },
  { value: "notifications", label: "Notifications" },
  { value: "audit", label: "Audit" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
  { value: "users", label: "Utilisateurs" },
  { value: "roles", label: "Rôles" },
  { value: "permissions", label: "Permissions" },
  { value: "evidence", label: "Preuves" },
  { value: "performance", label: "Performance" },
] as const;

export const MODULE_LABELS: Record<string, string> = {};
MODULE_OPTIONS.forEach((m) => {
  MODULE_LABELS[m.value] = m.label;
});

export function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] || module.charAt(0).toUpperCase() + module.slice(1);
}
