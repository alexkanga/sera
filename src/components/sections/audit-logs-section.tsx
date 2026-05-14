"use client";

import { useState, useEffect, useCallback } from "react";
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
  User,
  ShieldCheck,
  Calendar,
  Search,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { checkPermission } from "@/lib/client-permissions";

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
  createdAt: string;
  user: AuditLogUser | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

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
  { value: "Setting", label: "Paramètre" },
];

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Création" },
  { value: "UPDATE", label: "Modification" },
  { value: "ARCHIVE", label: "Archivage" },
  { value: "RESTORE", label: "Restauration" },
  { value: "DELETE", label: "Suppression" },
  { value: "LOGIN", label: "Connexion" },
  { value: "LOGIN_FAILED", label: "Tentative échouée" },
  { value: "LOGOUT", label: "Déconnexion" },
  { value: "LOCK", label: "Verrouillage" },
  { value: "UNLOCK", label: "Déverrouillage" },
  { value: "PASSWORD_CHANGE", label: "Changement mot de passe" },
  { value: "ROLE_ASSIGN", label: "Attribution rôle" },
  { value: "ROLE_REMOVE", label: "Retrait rôle" },
  { value: "PERMISSION_CHANGE", label: "Changement permission" },
];

// ============================================================
// Helpers
// ============================================================

function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: fr });
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
    case "LOGIN_FAILED":
      return {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-800 dark:text-red-300",
        label: "Tentative échouée",
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

// ============================================================
// Main Component
// ============================================================

export function AuditLogsSection() {
  const { data: session } = useSession();
  const canRead = checkPermission(session?.user?.roles ?? [], "audit:read");

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
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // ─── Expanded rows ─────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ─── Page state ─────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

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

      if (filterEntity) params.set("entity", filterEntity);
      if (filterAction) params.set("action", filterAction);
      if (filterUser) params.set("userId", filterUser);
      if (filterStartDate) {
        params.set("startDate", filterStartDate.toISOString());
      }
      if (filterEndDate) {
        // Set to end of day
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
  }, [page, filterEntity, filterAction, filterUser, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (canRead) {
      fetchLogs();
    }
  }, [canRead, fetchLogs, refreshKey]);

  // ─── Reset page when filters change ─────────────────────────────────

  useEffect(() => {
    setPage(1);
  }, [filterEntity, filterAction, filterUser, filterStartDate, filterEndDate]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleResetFilters() {
    setFilterEntity("");
    setFilterAction("");
    setFilterUser("");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setPage(1);
    toast.success("Filtres réinitialisés");
  }

  const hasActiveFilters =
    filterEntity || filterAction || filterUser || filterStartDate || filterEndDate;

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

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Journal d&apos;audit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Traçabilité de toutes les actions sensibles dans l&apos;application
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
            Journal d&apos;audit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Traçabilité de toutes les actions sensibles dans l&apos;application
          </p>
        </div>
      </div>

      {/* ─── Stats Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total entrées</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {pagination.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Page actuelle</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {pagination.page} / {pagination.totalPages || 1}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Filtre entité</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white truncate" title={filterEntity ? getEntityLabel(filterEntity) : "Toutes"}>
              {filterEntity ? getEntityLabel(filterEntity) : "Toutes"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Filtre action</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white truncate" title={filterAction || "Toutes"}>
              {filterAction
                ? ACTION_OPTIONS.find((a) => a.value === filterAction)?.label || filterAction
                : "Toutes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filters Row ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Entity Filter */}
            <Select
              value={filterEntity || "__all__"}
              onValueChange={(val) => setFilterEntity(val === "__all__" ? "" : val)}
            >
              <SelectTrigger className="w-full lg:w-[200px] h-9">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Toutes les entités" />
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

            {/* Action Filter */}
            <Select
              value={filterAction || "__all__"}
              onValueChange={(val) => setFilterAction(val === "__all__" ? "" : val)}
            >
              <SelectTrigger className="w-full lg:w-[200px] h-9">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Toutes les actions" />
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

            {/* User Filter */}
            <div className="relative flex-1 min-w-0 lg:max-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un utilisateur..."
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

            {/* Start Date Picker */}
            <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full lg:w-[180px] h-9 justify-start text-left font-normal ${
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
                  className={`w-full lg:w-[180px] h-9 justify-start text-left font-normal ${
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

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Audit Logs Table ─────────────────────────────────────────── */}
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
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[160px]">
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
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        Détails
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const isExpanded = expandedRows.has(log.id);
                      const isUpdateAction = log.action === "UPDATE";
                      const badgeConfig = getActionBadgeConfig(log.action);

                      return (
                        <Collapsible
                          key={log.id}
                          open={isExpanded}
                          onOpenChange={() => {
                            if (isUpdateAction && (log.oldValue || log.newValue)) {
                              toggleRowExpanded(log.id);
                            }
                          }}
                        >
                          <TableRow
                            className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                              isUpdateAction && (log.oldValue || log.newValue)
                                ? "cursor-pointer"
                                : ""
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
                                className={`text-[10px] font-medium border-0 ${badgeConfig.bg} ${badgeConfig.text}`}
                              >
                                {badgeConfig.label}
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
                              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate block max-w-[100px]" title={log.entityId ?? ""}>
                                {log.entityId ? (
                                  <span title={log.entityId}>
                                    {log.entityId.length > 12
                                      ? `${log.entityId.slice(0, 6)}…${log.entityId.slice(-4)}`
                                      : log.entityId}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </span>
                            </TableCell>

                            {/* Détails */}
                            <TableCell className="hidden xl:table-cell">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[200px]" title={log.details ?? ""}>
                                  {log.details || "—"}
                                </span>
                                {isUpdateAction && (log.oldValue || log.newValue) && (
                                  <CollapsibleTrigger asChild>
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
                                  </CollapsibleTrigger>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Collapsible details row for UPDATE actions */}
                          {isUpdateAction && (log.oldValue || log.newValue) && (
                            <TableRow className="bg-slate-50/70 dark:bg-slate-800/20 hover:bg-slate-50/70 dark:hover:bg-slate-800/20">
                              <TableCell colSpan={6} className="p-0">
                                <CollapsibleContent>
                                  <div className="px-6 py-3">
                                    <div className="flex items-start gap-3 text-xs">
                                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                        <ArrowRight className="h-3 w-3 text-teal-500" />
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Changement :</span>
                                      </div>
                                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                        {log.oldValue && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-400 dark:text-slate-500 shrink-0">Ancien :</span>
                                            <code className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-[11px] font-mono break-all">
                                              {log.oldValue}
                                            </code>
                                          </div>
                                        )}
                                        {log.newValue && (
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-400 dark:text-slate-500 shrink-0">Nouveau :</span>
                                            <code className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-[11px] font-mono break-all">
                                              {log.newValue}
                                            </code>
                                          </div>
                                        )}
                                      </div>
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
  );
}

// ============================================================
// Pagination Helper
// ============================================================

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
    pages.push(-1); // ellipsis
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
