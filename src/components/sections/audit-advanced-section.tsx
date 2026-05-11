"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ScrollText,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck,
  Calendar,
  Search,
  FileText,
  Clock,
  ArrowRight,
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  Activity,
  Users,
  Flame,
  TrendingUp,
  Eye,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// Types
// ============================================================

interface AuditLogUser {
  id: string;
  name: string;
  email: string;
  ptaCode: string | null;
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  severity: string;
  createdAt: string;
  user: AuditLogUser | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DailyActivity {
  date: string;
  count: number;
}

interface TopUser {
  userId: string | null;
  userName: string;
  userEmail: string;
  count: number;
}

interface AuditStats {
  totalLogs: number;
  todayCount: number;
  weekCount: number;
  criticalCount: number;
  warningCount: number;
  activeUsersCount: number;
  dailyActivity: DailyActivity[];
  recentCritical: AuditLog[];
  byUser: TopUser[];
}

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 25;

const ENTITY_OPTIONS = [
  { value: "User", label: "Utilisateur" },
  { value: "Role", label: "Rôle" },
  { value: "Permission", label: "Permission" },
  { value: "Activity", label: "Activité" },
  { value: "Direction", label: "Direction" },
  { value: "Unit", label: "Unité" },
  { value: "StrategicAxis", label: "Axe stratégique" },
  { value: "AcbfDomain", label: "Domaine ACBF" },
  { value: "AcbfDeliverable", label: "Livrable ACBF" },
  { value: "EvidenceFile", label: "Fichier preuve" },
  { value: "RaciMatrix", label: "Matrice RACI" },
  { value: "KpiDefinition", label: "Définition KPI" },
  { value: "ReportTemplate", label: "Modèle rapport" },
  { value: "Report", label: "Rapport" },
  { value: "Notification", label: "Notification" },
  { value: "Setting", label: "Paramètre" },
];

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Création" },
  { value: "UPDATE", label: "Modification" },
  { value: "ARCHIVE", label: "Archivage" },
  { value: "RESTORE", label: "Restauration" },
  { value: "DELETE", label: "Suppression" },
  { value: "LOGIN", label: "Connexion" },
  { value: "LOGOUT", label: "Déconnexion" },
  { value: "LOCK", label: "Verrouillage" },
  { value: "UNLOCK", label: "Déverrouillage" },
  { value: "PASSWORD_CHANGE", label: "Changement mot de passe" },
  { value: "ROLE_ASSIGN", label: "Attribution rôle" },
  { value: "ROLE_REMOVE", label: "Retrait rôle" },
  { value: "PERMISSION_CHANGE", label: "Changement permission" },
  { value: "SUBMIT", label: "Soumission" },
  { value: "VALIDATE", label: "Validation" },
  { value: "REJECT", label: "Rejet" },
  { value: "VERIFY", label: "Vérification" },
  { value: "EXPORT", label: "Export" },
  { value: "IMPORT", label: "Import" },
];

const SEVERITY_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Attention" },
  { value: "critical", label: "Critique" },
];

// ============================================================
// Helpers
// ============================================================

function hasAuditPermission(
  roles: Array<{ permissions: string[] }> | undefined
): boolean {
  if (!roles) return false;
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === "audit:read" || p === "audit:*" || p === "admin:*"
    )
  );
}

function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM", { locale: fr });
  } catch {
    return dateStr;
  }
}

function getActionBadgeConfig(action: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (action) {
    case "CREATE":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Création",
      };
    case "UPDATE":
      return {
        bg: "bg-teal-100 dark:bg-teal-900/40",
        text: "text-teal-800 dark:text-teal-300",
        label: "Modification",
      };
    case "ARCHIVE":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-800 dark:text-amber-300",
        label: "Archivage",
      };
    case "RESTORE":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Restauration",
      };
    case "DELETE":
      return {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-800 dark:text-red-300",
        label: "Suppression",
      };
    case "LOGIN":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Connexion",
      };
    case "LOGOUT":
      return {
        bg: "bg-slate-200 dark:bg-slate-700/60",
        text: "text-slate-700 dark:text-slate-300",
        label: "Déconnexion",
      };
    case "LOCK":
      return {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-800 dark:text-red-300",
        label: "Verrouillage",
      };
    case "UNLOCK":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Déverrouillage",
      };
    case "PASSWORD_CHANGE":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-800 dark:text-amber-300",
        label: "Chgmt MDP",
      };
    case "ROLE_ASSIGN":
      return {
        bg: "bg-teal-100 dark:bg-teal-900/40",
        text: "text-teal-800 dark:text-teal-300",
        label: "Attribution rôle",
      };
    case "ROLE_REMOVE":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-800 dark:text-amber-300",
        label: "Retrait rôle",
      };
    case "PERMISSION_CHANGE":
      return {
        bg: "bg-teal-100 dark:bg-teal-900/40",
        text: "text-teal-800 dark:text-teal-300",
        label: "Chgmt permission",
      };
    case "SUBMIT":
      return {
        bg: "bg-sky-100 dark:bg-sky-900/40",
        text: "text-sky-800 dark:text-sky-300",
        label: "Soumission",
      };
    case "VALIDATE":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Validation",
      };
    case "REJECT":
      return {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-800 dark:text-red-300",
        label: "Rejet",
      };
    case "VERIFY":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-800 dark:text-emerald-300",
        label: "Vérification",
      };
    case "EXPORT":
      return {
        bg: "bg-slate-200 dark:bg-slate-700/60",
        text: "text-slate-700 dark:text-slate-300",
        label: "Export",
      };
    case "IMPORT":
      return {
        bg: "bg-slate-200 dark:bg-slate-700/60",
        text: "text-slate-700 dark:text-slate-300",
        label: "Import",
      };
    default:
      return {
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-700 dark:text-slate-300",
        label: action,
      };
  }
}

function getEntityLabel(entity: string): string {
  const found = ENTITY_OPTIONS.find((e) => e.value === entity);
  return found ? found.label : entity;
}

function getSeverityBadge(severity: string): { bg: string; text: string; label: string; icon: React.ElementType } {
  switch (severity) {
    case "critical":
      return { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-800 dark:text-red-300", label: "Critique", icon: Flame };
    case "warning":
      return { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-300", label: "Attention", icon: AlertTriangle };
    default:
      return { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-800 dark:text-emerald-300", label: "Info", icon: Info };
  }
}

function generatePageNumbers(
  currentPage: number,
  totalPages: number
): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: number[] = [];

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push(-1);
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push(-1);
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push(-1);
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push(-1);
    pages.push(totalPages);
  }

  return pages;
}

// ============================================================
// Main Component
// ============================================================

export function AuditAdvancedSection() {
  const { data: session } = useSession();
  const canRead = hasAuditPermission(session?.user?.roles);

  // ─── Stats state ─────────────────────────────────────────────────
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ─── List state ─────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Filter state ───────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterEntityId, setFilterEntityId] = useState("");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // ─── Expanded rows ─────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ─── Page state ─────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ─── Export loading ────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/audit-logs/stats");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des statistiques");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Stats error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============================================================
  // Fetch Audit Logs
  // ============================================================

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (filterSearch) params.set("search", filterSearch);
      if (filterEntity) params.set("entity", filterEntity);
      if (filterAction) params.set("action", filterAction);
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterUser) params.set("userId", filterUser);
      if (filterEntityId) params.set("entityId", filterEntityId);
      if (filterStartDate) {
        params.set("startDate", filterStartDate.toISOString());
      }
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        params.set("endDate", endOfDay.toISOString());
      }

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setLogs(data.data || []);
      setPagination(data.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, filterSearch, filterEntity, filterAction, filterSeverity, filterUser, filterEntityId, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (canRead) {
      fetchLogs();
    }
  }, [canRead, fetchLogs, refreshKey]);

  useEffect(() => {
    if (canRead) {
      fetchStats();
    }
  }, [canRead, fetchStats, refreshKey]);

  // ─── Reset page when filters change ─────────────────────────────────

  useEffect(() => {
    setPage(1);
  }, [filterSearch, filterEntity, filterAction, filterSeverity, filterUser, filterEntityId, filterStartDate, filterEndDate]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleResetFilters() {
    setFilterSearch("");
    setFilterEntity("");
    setFilterAction("");
    setFilterSeverity("");
    setFilterUser("");
    setFilterEntityId("");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setPage(1);
    toast.success("Filtres réinitialisés");
  }

  const hasActiveFilters =
    filterSearch || filterEntity || filterAction || filterSeverity || filterUser || filterEntityId || filterStartDate || filterEndDate;

  function toggleRowExpanded(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleEntityIdClick(entityId: string) {
    setFilterEntityId(entityId);
    setPage(1);
    toast.info("Filtrage par ID entité appliqué");
  }

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (filterSearch) params.set("search", filterSearch);
      if (filterEntity) params.set("entity", filterEntity);
      if (filterAction) params.set("action", filterAction);
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterStartDate) params.set("startDate", filterStartDate.toISOString());
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        params.set("endDate", endOfDay.toISOString());
      }

      const res = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'export");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Export ${format.toUpperCase()} téléchargé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  // ─── Computed values ──────────────────────────────────────────────

  const dailyActivityMax = useMemo(() => {
    if (!stats?.dailyActivity) return 0;
    return Math.max(...stats.dailyActivity.map((d) => d.count), 1);
  }, [stats?.dailyActivity]);

  const topUserMax = useMemo(() => {
    if (!stats?.byUser) return 0;
    return Math.max(...stats.byUser.map((u) => u.count), 1);
  }, [stats?.byUser]);

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Journal d&apos;audit avancé
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyse approfondie de la traçabilité
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Accès refusé
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
              Vous n&apos;avez pas la permission de consulter le journal d&apos;audit.
              Contactez votre administrateur si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <div className="space-y-6">
      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Journal d&apos;audit avancé
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyse approfondie de la traçabilité et des actions sensibles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="h-8 text-xs"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
            )}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={exporting}
            className="h-8 text-xs"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FileJson className="h-3.5 w-3.5 mr-1" />
            )}
            JSON
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Actualiser</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ─── KPI Stats Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total entrées */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Total entrées</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.totalLogs ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activité aujourd'hui */}
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3.5 w-3.5 text-teal-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Aujourd&apos;hui</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.todayCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activité cette semaine */}
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Cette semaine</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.weekCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions critiques */}
        <Card className={`border-l-4 ${(stats?.criticalCount ?? 0) > 0 ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-l-red-300"}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-3.5 w-3.5 text-red-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Critiques</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className={`text-xl font-bold ${(stats?.criticalCount ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                {stats?.criticalCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions warning */}
        <Card className={`border-l-4 ${(stats?.warningCount ?? 0) > 0 ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "border-l-amber-300"}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Attention</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className={`text-xl font-bold ${(stats?.warningCount ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
                {stats?.warningCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Utilisateurs actifs */}
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Utilisateurs actifs</p>
            </div>
            {statsLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {stats?.activeUsersCount ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Activity Timeline (last 30 days) ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-sm font-semibold">Activité des 30 derniers jours</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {statsLoading ? (
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 30 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-full rounded-sm" />
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-[2px] h-24">
              {stats?.dailyActivity.map((day) => {
                const heightPercent = day.count > 0 ? Math.max((day.count / dailyActivityMax) * 100, 8) : 4;
                const intensity = day.count > 0 ? Math.min(day.count / dailyActivityMax, 1) : 0;
                const bgColor = day.count === 0
                  ? "bg-slate-200 dark:bg-slate-700"
                  : intensity > 0.66
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : intensity > 0.33
                      ? "bg-emerald-400 dark:bg-emerald-500"
                      : "bg-emerald-300 dark:bg-emerald-600";

                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex-1 rounded-sm cursor-pointer transition-all hover:opacity-80 ${bgColor}`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <span className="font-medium">{formatDateShort(day.date)}</span> — {day.count} action{day.count !== 1 ? "s" : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            <span>Il y a 30 jours</span>
            <span>Aujourd&apos;hui</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Two-column Layout: Main Table + Side Panels ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main Column (2/3) ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* ─── Filters Bar (Collapsible) ────────────────────────────── */}
          <Card>
            <CardContent className="p-0">
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setFiltersOpen(!filtersOpen)}>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filtres avancés</span>
                    {hasActiveFilters && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                        Actifs
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </div>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {/* Row 1: Search + Entity + Action */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Full-text search */}
                      <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Recherche texte (action, entité, détails, utilisateur)..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="pl-9 h-9"
                        />
                        {filterSearch && (
                          <button
                            onClick={() => setFilterSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Entity + Action + Severity */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Select
                        value={filterEntity || "__all__"}
                        onValueChange={(val) => setFilterEntity(val === "__all__" ? "" : val)}
                      >
                        <SelectTrigger className="w-full sm:w-[200px] h-9">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Entité" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Toutes les entités</SelectItem>
                          {ENTITY_OPTIONS.map((ent) => (
                            <SelectItem key={ent.value} value={ent.value}>
                              {ent.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filterAction || "__all__"}
                        onValueChange={(val) => setFilterAction(val === "__all__" ? "" : val)}
                      >
                        <SelectTrigger className="w-full sm:w-[200px] h-9">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Action" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Toutes les actions</SelectItem>
                          {ACTION_OPTIONS.map((act) => (
                            <SelectItem key={act.value} value={act.value}>
                              {act.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filterSeverity || "__all__"}
                        onValueChange={(val) => setFilterSeverity(val === "__all__" ? "" : val)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px] h-9">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <SelectValue placeholder="Sévérité" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Toutes sévérités</SelectItem>
                          {SEVERITY_OPTIONS.map((sev) => (
                            <SelectItem key={sev.value} value={sev.value}>
                              {sev.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 3: User + Entity ID + Date pickers */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* User search */}
                      <div className="relative flex-1 min-w-0 sm:max-w-[220px]">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Utilisateur (nom/email)..."
                          value={filterUser}
                          onChange={(e) => setFilterUser(e.target.value)}
                          className="pl-9 h-9"
                        />
                        {filterUser && (
                          <button
                            onClick={() => setFilterUser("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Entity ID filter */}
                      <div className="relative flex-1 min-w-0 sm:max-w-[200px]">
                        <Input
                          placeholder="ID Entité (cuid)..."
                          value={filterEntityId}
                          onChange={(e) => setFilterEntityId(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                        {filterEntityId && (
                          <button
                            onClick={() => setFilterEntityId("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Start Date Picker */}
                      <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full sm:w-[160px] h-9 justify-start text-left font-normal ${
                              !filterStartDate ? "text-muted-foreground" : ""
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            {filterStartDate ? (
                              format(filterStartDate, "dd/MM/yyyy", { locale: fr })
                            ) : (
                              "Date début"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filterStartDate}
                            onSelect={(date) => {
                              setFilterStartDate(date ?? undefined);
                              setStartPickerOpen(false);
                            }}
                            initialFocus
                          />
                          {filterStartDate && (
                            <div className="border-t p-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFilterStartDate(undefined);
                                  setStartPickerOpen(false);
                                }}
                                className="text-xs text-slate-500"
                              >
                                Effacer
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      {/* End Date Picker */}
                      <Popover open={endPickerOpen} onOpenChange={setEndPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full sm:w-[160px] h-9 justify-start text-left font-normal ${
                              !filterEndDate ? "text-muted-foreground" : ""
                            }`}
                          >
                            <Calendar className="h-3.5 w-3.5 mr-2 text-slate-400" />
                            {filterEndDate ? (
                              format(filterEndDate, "dd/MM/yyyy", { locale: fr })
                            ) : (
                              "Date fin"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filterEndDate}
                            onSelect={(date) => {
                              setFilterEndDate(date ?? undefined);
                              setEndPickerOpen(false);
                            }}
                            initialFocus
                          />
                          {filterEndDate && (
                            <div className="border-t p-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFilterEndDate(undefined);
                                  setEndPickerOpen(false);
                                }}
                                className="text-xs text-slate-500"
                              >
                                Effacer
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Reset Filters */}
                    {hasActiveFilters && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetFilters}
                          className="h-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Réinitialiser les filtres
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* ─── Enhanced Audit Table ──────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                    <ScrollText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Journal d&apos;audit</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pagination.total} entrée{pagination.total !== 1 ? "s" : ""} au total
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Loading State */}
              {loading && (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                    <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Erreur de chargement
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
                    {error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                    <ScrollText className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Aucune entrée trouvée
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                    {hasActiveFilters
                      ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                      : "Le journal d'audit est vide. Les actions sensibles y seront enregistrées automatiquement."}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="mt-4"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Effacer les filtres
                    </Button>
                  )}
                </div>
              )}

              {/* Table */}
              {!loading && !error && logs.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[150px]">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              Date/Heure
                            </div>
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3" />
                              Utilisateur
                            </div>
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Action
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                            Entité
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                            ID Entité
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                            Sévérité
                          </TableHead>
                          <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                            Détails
                          </TableHead>
                          <TableHead className="w-[40px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => {
                          const isExpanded = expandedRows.has(log.id);
                          const actionBadge = getActionBadgeConfig(log.action);
                          const severityBadge = getSeverityBadge(log.severity);
                          const SeverityIcon = severityBadge.icon;
                          const hasExpandableContent = log.action === "UPDATE" || log.oldValue || log.newValue || log.ipAddress || log.userAgent || log.entityId || log.details;

                          return (
                            <Collapsible
                              key={log.id}
                              open={isExpanded}
                              onOpenChange={() => {
                                if (hasExpandableContent) {
                                  toggleRowExpanded(log.id);
                                }
                              }}
                            >
                              <TableRow
                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                                  hasExpandableContent ? "cursor-pointer" : ""
                                }`}
                              >
                                {/* Date/Heure */}
                                <TableCell className="text-sm whitespace-nowrap">
                                  <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                                    {formatDateTime(log.createdAt)}
                                  </span>
                                </TableCell>

                                {/* Utilisateur */}
                                <TableCell>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold shrink-0">
                                      {log.user
                                        ? log.user.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)
                                        : "—"}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate block max-w-[120px]" title={log.user?.name ?? "Système"}>
                                        {log.user?.name ?? "Système"}
                                      </span>
                                      {log.user && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block max-w-[120px]" title={log.user.email}>
                                          {log.user.email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Action Badge */}
                                <TableCell>
                                  <Badge
                                    className={`text-[10px] font-medium border-0 ${actionBadge.bg} ${actionBadge.text}`}
                                  >
                                    {actionBadge.label}
                                  </Badge>
                                </TableCell>

                                {/* Entité */}
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant="outline" className="text-xs font-normal text-slate-600 dark:text-slate-400">
                                    {getEntityLabel(log.entity)}
                                  </Badge>
                                </TableCell>

                                {/* ID Entité */}
                                <TableCell className="hidden lg:table-cell">
                                  {log.entityId ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEntityIdClick(log.entityId!);
                                      }}
                                      className="text-xs font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline truncate block max-w-[100px]"
                                      title={`Filtrer par ${log.entityId}`}
                                    >
                                      {log.entityId.length > 12
                                        ? `${log.entityId.slice(0, 6)}…${log.entityId.slice(-4)}`
                                        : log.entityId}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </TableCell>

                                {/* Sévérité */}
                                <TableCell className="hidden md:table-cell">
                                  <Badge
                                    className={`text-[10px] font-medium border-0 ${severityBadge.bg} ${severityBadge.text} gap-1`}
                                  >
                                    <SeverityIcon className="h-2.5 w-2.5" />
                                    {severityBadge.label}
                                  </Badge>
                                </TableCell>

                                {/* Détails */}
                                <TableCell className="hidden xl:table-cell">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[200px]" title={log.details ?? ""}>
                                    {log.details || "—"}
                                  </span>
                                </TableCell>

                                {/* Expand button */}
                                <TableCell>
                                  {hasExpandableContent && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 shrink-0 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                                    >
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform ${
                                          isExpanded ? "rotate-180" : ""
                                        }`}
                                      />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* Expanded details row */}
                              {hasExpandableContent && (
                                <TableRow className="bg-slate-50/70 dark:bg-slate-800/20 hover:bg-slate-50/70 dark:hover:bg-slate-800/20">
                                  <TableCell colSpan={8} className="p-0">
                                    <CollapsibleContent>
                                      <div className="px-6 py-3 space-y-3">
                                        {/* UPDATE diff display */}
                                        {log.action === "UPDATE" && (log.oldValue || log.newValue) && (
                                          <div className="flex flex-col sm:flex-row gap-3">
                                            {log.oldValue && (
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase mb-1">Ancienne valeur</p>
                                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md p-2 text-xs font-mono text-red-700 dark:text-red-300 break-all max-h-32 overflow-y-auto">
                                                  {log.oldValue}
                                                </div>
                                              </div>
                                            )}
                                            {log.newValue && (
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Nouvelle valeur</p>
                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-md p-2 text-xs font-mono text-emerald-700 dark:text-emerald-300 break-all max-h-32 overflow-y-auto">
                                                  {log.newValue}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Full details grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                          {log.details && log.action !== "UPDATE" && (
                                            <div className="col-span-full">
                                              <span className="text-slate-400 dark:text-slate-500">Détails :</span>{" "}
                                              <span className="text-slate-700 dark:text-slate-300">{log.details}</span>
                                            </div>
                                          )}
                                          {log.entityId && (
                                            <div>
                                              <span className="text-slate-400 dark:text-slate-500">ID Entité :</span>{" "}
                                              <button
                                                onClick={() => handleEntityIdClick(log.entityId!)}
                                                className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                                              >
                                                {log.entityId}
                                              </button>
                                            </div>
                                          )}
                                          {log.ipAddress && (
                                            <div>
                                              <span className="text-slate-400 dark:text-slate-500">Adresse IP :</span>{" "}
                                              <span className="text-slate-700 dark:text-slate-300 font-mono">{log.ipAddress}</span>
                                            </div>
                                          )}
                                          {log.userAgent && (
                                            <div className="col-span-full">
                                              <span className="text-slate-400 dark:text-slate-500">User Agent :</span>{" "}
                                              <span className="text-slate-700 dark:text-slate-300 break-all">{log.userAgent}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </CollapsibleContent>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Collapsible>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {pagination.total > 0
                        ? `Affichage de ${(pagination.page - 1) * ITEMS_PER_PAGE + 1} à ${Math.min(
                            pagination.page * ITEMS_PER_PAGE,
                            pagination.total
                          )} sur ${pagination.total}`
                        : "Aucun résultat"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={pagination.page <= 1}
                        className="h-8"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                      </Button>
                      <div className="flex items-center gap-1">
                        {generatePageNumbers(pagination.page, pagination.totalPages).map(
                          (pageNum, idx) =>
                            pageNum === -1 ? (
                              <span
                                key={`ellipsis-${idx}`}
                                className="h-8 w-8 flex items-center justify-center text-sm text-slate-400"
                              >
                                …
                              </span>
                            ) : (
                              <Button
                                key={pageNum}
                                variant={pagination.page === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPage(pageNum)}
                                className={`h-8 w-8 p-0 ${
                                  pagination.page === pageNum
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : ""
                                }`}
                              >
                                {pageNum}
                              </Button>
                            )
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={pagination.page >= pagination.totalPages}
                        className="h-8"
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Side Panels (1/3) ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* ─── Recent Critical Actions ────────────────────────────── */}
          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                  <Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400">Actions critiques</CardTitle>
                  <p className="text-[10px] text-slate-400">Les 5 dernières actions critiques</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {statsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : stats?.recentCritical && stats.recentCritical.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {stats.recentCritical.map((log) => {
                    const actionBadge = getActionBadgeConfig(log.action);
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 p-2 rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-[9px] font-semibold shrink-0 mt-0.5">
                          {log.user
                            ? log.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                            : "!"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-[9px] font-medium border-0 ${actionBadge.bg} ${actionBadge.text} px-1 py-0`}>
                              {actionBadge.label}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] font-normal text-slate-500 px-1 py-0">
                              {getEntityLabel(log.entity)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate" title={log.user?.name ?? "Système"}>
                            {log.user?.name ?? "Système"}
                          </p>
                          {log.details && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={log.details}>
                              {log.details}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {formatDateTime(log.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <ShieldCheck className="h-8 w-8 text-emerald-400 dark:text-emerald-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Aucune action critique</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Tout semble normal</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Top Active Users ────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                  <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Utilisateurs les plus actifs</CardTitle>
                  <p className="text-[10px] text-slate-400">Top 5 — toutes périodes</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {statsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-3 flex-1" />
                    </div>
                  ))}
                </div>
              ) : stats?.byUser && stats.byUser.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.byUser.map((user, idx) => {
                    const barPercent = (user.count / topUserMax) * 100;
                    return (
                      <div key={user.userId ?? idx} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-[9px] font-semibold shrink-0">
                              {user.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={user.userName}>
                              {user.userName}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            {user.count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${barPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Aucune donnée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
