"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  BarChart3,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ============================================================
// Types
// ============================================================

interface UserOption {
  id: string;
  name: string;
  email: string;
  ptaCode?: string;
}

interface DirectionOption {
  id: string;
  code: string;
  name: string;
}

interface AxisOption {
  id: string;
  code: string;
  name: string;
}

interface DomainOption {
  id: string;
  code: string;
  name: string;
}

interface Activity {
  id: string;
  activityCode: string;
  title: string;
  responsibleId: string;
  directionId: string | null;
  primaryAxisId: string | null;
  secondaryAxisId: string | null;
  acbfDomainId: string | null;
  acbfDeliverableId: string | null;
  annualObjective: string | null;
  detailedTasks: string | null;
  expectedDeliverable: string | null;
  validatorId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  performanceIndicator: string | null;
  verificationSource: string | null;
  status: string;
  progressRate: number;
  riskDescription: string | null;
  comments: string | null;
  validationStatus: string;
  nature: string | null;
  dependency: string | null;
  duration: string | null;
  isLocked: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: UserOption;
  direction?: DirectionOption;
  primaryAxis?: AxisOption;
  secondaryAxis?: AxisOption;
  acbfDomain?: DomainOption;
  acbfDeliverable?: { id: string; code: string; name: string };
  validator?: UserOption;
  createdBy?: UserOption;
  updatedBy?: UserOption;
}

interface Stats {
  totalActivities: number;
  avgProgressRate: number;
  lateActivities: number;
  highPriorityActivities: number;
  validatedCount: number;
  totalWithRisk: number;
  validationRate: number;
}

type GroupBy = "none" | "direction" | "axis" | "domain" | "responsible";

interface GroupData {
  key: string;
  label: string;
  activities: Activity[];
  avgProgress: number;
}

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 50;

const ACTIVITY_STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "Non démarré", label: "Non démarré" },
  { value: "En cours", label: "En cours" },
  { value: "Terminé", label: "Terminé" },
  { value: "Annulé", label: "Annulé" },
];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "direction", label: "Par direction" },
  { value: "axis", label: "Par axe stratégique" },
  { value: "domain", label: "Par domaine ACBF" },
  { value: "responsible", label: "Par responsable" },
];

// ============================================================
// Permission Helpers
// ============================================================

function hasPermission(
  roles: Array<{ permissions: string[] }>,
  permission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === permission || p === "pta:*" || p === "admin:*"
    )
  );
}

// ============================================================
// Format Helpers
// ============================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function getPriorityBadge(priority: string | null) {
  if (!priority) return null;
  switch (priority) {
    case "Haute":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Haute
        </Badge>
      );
    case "Moyenne":
      return (
        <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
          Moyenne
        </Badge>
      );
    case "Basse":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Basse
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {priority}
        </Badge>
      );
  }
}

function getActivityStatusBadge(status: string | null) {
  if (!status) return null;
  switch (status) {
    case "Non démarré":
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
          Non démarré
        </Badge>
      );
    case "En cours":
      return (
        <Badge className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 border-0">
          En cours
        </Badge>
      );
    case "Terminé":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Terminé
        </Badge>
      );
    case "Annulé":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Annulé
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {status}
        </Badge>
      );
  }
}

function getValidationStatusBadge(validationStatus: string | null) {
  if (!validationStatus) return null;
  switch (validationStatus) {
    case "Brouillon":
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
          Brouillon
        </Badge>
      );
    case "Soumis":
      return (
        <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
          Soumis
        </Badge>
      );
    case "Validé":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Validé
        </Badge>
      );
    case "Rejeté":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Rejeté
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {validationStatus}
        </Badge>
      );
  }
}

function getProgressColor(rate: number): string {
  if (rate >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 50) return "text-blue-600 dark:text-blue-400";
  if (rate >= 25) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

function getProgressBg(rate: number): string {
  if (rate >= 75) return "bg-emerald-500";
  if (rate >= 50) return "bg-blue-500";
  if (rate >= 25) return "bg-amber-500";
  return "bg-slate-400";
}

// ============================================================
// Main Component
// ============================================================

export function PtaConsolideSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = hasPermission(session?.user?.roles ?? [], "pta:read");

  // ----- Stats state -----
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ----- List state -----
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [axisFilter, setAxisFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [validationFilter, setValidationFilter] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Sort state -----
  const [sortColumn, setSortColumn] = useState<string>("activityCode");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // ----- Dialog state -----
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // ----- Group expansion state -----
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ----- Dropdown options -----
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>([]);
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([]);

  // ----- Export state -----
  const [exporting, setExporting] = useState(false);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/pta-consolide/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) {
      fetchStats();
    }
  }, [canRead, fetchStats, refreshKey]);

  // ============================================================
  // Fetch Activities
  // ============================================================

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (directionFilter) params.set("directionId", directionFilter);
      if (axisFilter) params.set("primaryAxisId", axisFilter);
      if (domainFilter) params.set("acbfDomainId", domainFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (validationFilter) params.set("validationStatus", validationFilter);
      if (activityStatusFilter) params.set("activityStatus", activityStatusFilter);

      const res = await fetch(`/api/pta-consolide?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setActivities(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, directionFilter, axisFilter, domainFilter, priorityFilter, validationFilter, activityStatusFilter]);

  useEffect(() => {
    if (canRead) {
      fetchActivities();
    }
  }, [canRead, fetchActivities, refreshKey]);

  // ============================================================
  // Fetch Dropdown Options
  // ============================================================

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [directionsRes, axesRes, domainsRes] = await Promise.all([
          fetch("/api/directions?limit=100&status=active"),
          fetch("/api/strategic-axes?limit=100&status=active"),
          fetch("/api/acbf-domains?limit=100&status=active"),
        ]);

        if (directionsRes.ok) {
          const data = await directionsRes.json();
          setDirectionOptions(data.data.map((d: DirectionOption) => ({ id: d.id, code: d.code, name: d.name })));
        }
        if (axesRes.ok) {
          const data = await axesRes.json();
          setAxisOptions(data.data.map((a: AxisOption) => ({ id: a.id, code: a.code, name: a.name })));
        }
        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setDomainOptions(data.data.map((d: DomainOption) => ({ id: d.id, code: d.code, name: d.name })));
        }
      } catch {
        // Silently fail
      }
    }
    fetchOptions();
  }, []);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, directionFilter, axisFilter, domainFilter, priorityFilter, validationFilter, activityStatusFilter]);

  // ============================================================
  // Sorting
  // ============================================================

  const sortedActivities = useMemo(() => {
    const sorted = [...activities];
    sorted.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      switch (sortColumn) {
        case "activityCode":
          valA = a.activityCode;
          valB = b.activityCode;
          break;
        case "title":
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case "responsible":
          valA = a.responsible?.name?.toLowerCase() || "";
          valB = b.responsible?.name?.toLowerCase() || "";
          break;
        case "direction":
          valA = a.direction?.name?.toLowerCase() || "";
          valB = b.direction?.name?.toLowerCase() || "";
          break;
        case "priority":
          const pOrder: Record<string, number> = { Haute: 3, Moyenne: 2, Basse: 1 };
          valA = pOrder[a.priority] || 0;
          valB = pOrder[b.priority] || 0;
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "progressRate":
          valA = a.progressRate;
          valB = b.progressRate;
          break;
        case "validationStatus":
          valA = a.validationStatus;
          valB = b.validationStatus;
          break;
        default:
          valA = a.activityCode;
          valB = b.activityCode;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [activities, sortColumn, sortDirection]);

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  // ============================================================
  // Grouping
  // ============================================================

  const groupedActivities = useMemo((): GroupData[] => {
    if (groupBy === "none") return [];

    const groups = new Map<string, Activity[]>();

    sortedActivities.forEach((activity) => {
      let key = "Non assigné";
      switch (groupBy) {
        case "direction":
          key = activity.direction
            ? `${activity.direction.code} — ${activity.direction.name}`
            : "Non assigné";
          break;
        case "axis":
          key = activity.primaryAxis
            ? `${activity.primaryAxis.code} — ${activity.primaryAxis.name}`
            : "Non assigné";
          break;
        case "domain":
          key = activity.acbfDomain
            ? `${activity.acbfDomain.code} — ${activity.acbfDomain.name}`
            : "Non assigné";
          break;
        case "responsible":
          key = activity.responsible?.name || "Non assigné";
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(activity);
    });

    return Array.from(groups.entries()).map(([key, acts]) => ({
      key,
      label: key,
      activities: acts,
      avgProgress: acts.length > 0
        ? Math.round(acts.reduce((sum, a) => sum + a.progressRate, 0) / acts.length * 10) / 10
        : 0,
    }));
  }, [sortedActivities, groupBy]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function resetFilters() {
    setSearch("");
    setDirectionFilter("");
    setAxisFilter("");
    setDomainFilter("");
    setPriorityFilter("");
    setValidationFilter("");
    setActivityStatusFilter("");
    setGroupBy("none");
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleView(activity: Activity) {
    setSelectedActivity(activity);
    setViewDialogOpen(true);

    try {
      const res = await fetch(`/api/activities/${activity.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedActivity((prev) =>
          prev ? { ...prev, ...data.data } : prev
        );
      }
    } catch {
      // Keep existing data
    }
  }

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (search) params.set("search", search);
      if (directionFilter) params.set("directionId", directionFilter);
      if (axisFilter) params.set("primaryAxisId", axisFilter);
      if (domainFilter) params.set("acbfDomainId", domainFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (validationFilter) params.set("validationStatus", validationFilter);
      if (activityStatusFilter) params.set("activityStatus", activityStatusFilter);

      const res = await fetch(`/api/pta-consolide/export?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Erreur lors de l'export");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pta-consolide-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Export ${format.toUpperCase()} téléchargé avec succès`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  // ============================================================
  // Has active filters
  // ============================================================

  const hasActiveFilters = useMemo(() => {
    return !!(
      search ||
      directionFilter ||
      axisFilter ||
      domainFilter ||
      priorityFilter ||
      validationFilter ||
      activityStatusFilter
    );
  }, [search, directionFilter, axisFilter, domainFilter, priorityFilter, validationFilter, activityStatusFilter]);

  // ============================================================
  // Sort header helper
  // ============================================================

  function SortableHeader({ column, children }: { column: string; children: React.ReactNode }) {
    return (
      <button
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
      >
        {children}
        {sortColumn === column && (
          <ChevronRight
            className={`h-3 w-3 transition-transform ${
              sortDirection === "desc" ? "rotate-90" : "-rotate-90"
            }`}
          />
        )}
      </button>
    );
  }

  // ============================================================
  // Render: Loading
  // ============================================================

  if (loading && activities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            PTA consolidé AAEA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue consolidée de toutes les activités PTA
          </p>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (error && activities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            PTA consolidé AAEA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue consolidée de toutes les activités PTA
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Erreur de chargement
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Render: No Permission
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            PTA consolidé AAEA
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <ShieldCheck className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Accès restreint
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
              Vous n&apos;avez pas la permission &quot;pta:read&quot; nécessaire pour consulter le PTA consolidé.
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            PTA consolidé AAEA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue consolidée et en lecture seule de toutes les activités PTA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exporting}
                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exporter CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exporter les données au format CSV</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={exporting}
                className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter JSON
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exporter les données au format JSON</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rafraîchir les données</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* ============================================================ */}
      {/* KPI Stats Cards */}
      {/* ============================================================ */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total activités */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Activités
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stats?.totalActivities ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taux d'avancement moyen */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Avancement moyen
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {stats?.avgProgressRate ?? 0}%
                    </p>
                    <Progress
                      value={stats?.avgProgressRate ?? 0}
                      className="h-1.5 mt-2"
                    />
                  </>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900 ml-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activités en retard */}
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  En retard
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {stats?.lateActivities ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900">
                <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Haute priorité */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Haute priorité
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {stats?.highPriorityActivities ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taux de validation */}
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Taux validation
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                    {stats?.validationRate ?? 0}%
                  </p>
                )}
                {!statsLoading && stats && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {stats.validatedCount} / {stats.totalActivities} validées
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risques identifiés */}
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Risques
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    {stats?.totalWithRisk ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Filter Bar */}
      {/* ============================================================ */}

      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Row 1: Search + Group By */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par titre ou code d'activité..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Regroupement" />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_BY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes les directions</SelectItem>
                  {directionOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={axisFilter} onValueChange={(v) => setAxisFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les axes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les axes</SelectItem>
                  {axisOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={domainFilter} onValueChange={(v) => setDomainFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les domaines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les domaines</SelectItem>
                  {domainOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={activityStatusFilter} onValueChange={(v) => setActivityStatusFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les statuts</SelectItem>
                  {ACTIVITY_STATUS_OPTIONS.filter(o => o.value).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="text-slate-500 hover:text-red-600"
                >
                  <X className="h-4 w-4 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>

            {/* Row 3: Priority + Validation tabs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Priorité
                </p>
                <Tabs value={priorityFilter || "__all__"} onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="__all__" className="text-xs px-2.5">Toutes</TabsTrigger>
                    <TabsTrigger value="Haute" className="text-xs px-2.5">Haute</TabsTrigger>
                    <TabsTrigger value="Moyenne" className="text-xs px-2.5">Moyenne</TabsTrigger>
                    <TabsTrigger value="Basse" className="text-xs px-2.5">Basse</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Validation
                </p>
                <Tabs value={validationFilter || "__all__"} onValueChange={(v) => setValidationFilter(v === "__all__" ? "" : v)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="__all__" className="text-xs px-2.5">Toutes</TabsTrigger>
                    <TabsTrigger value="Brouillon" className="text-xs px-2.5">Brouillon</TabsTrigger>
                    <TabsTrigger value="Soumis" className="text-xs px-2.5">Soumis</TabsTrigger>
                    <TabsTrigger value="Validé" className="text-xs px-2.5">Validé</TabsTrigger>
                    <TabsTrigger value="Rejeté" className="text-xs px-2.5">Rejeté</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Results count */}
      {/* ============================================================ */}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span>{" "}
          activité{total !== 1 ? "s" : ""} trouvée{total !== 1 ? "s" : ""}
          {groupBy !== "none" && (
            <span className="ml-2 text-muted-foreground">
              — regroupées par {GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label.toLowerCase()}
            </span>
          )}
        </p>
      </div>

      {/* ============================================================ */}
      {/* Grouped View */}
      {/* ============================================================ */}

      {groupBy !== "none" && groupedActivities.length > 0 && (
        <div className="space-y-3">
          {groupedActivities.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            return (
              <Collapsible
                key={group.key}
                open={isExpanded}
                onOpenChange={() => toggleGroup(group.key)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <button className="w-full">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                            <div className="text-left">
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {group.label}
                              </h3>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {group.activities.length} activité{group.activities.length !== 1 ? "s" : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Avancement :</span>
                                  <div className="flex items-center gap-1.5">
                                    <Progress value={group.avgProgress} className="h-1.5 w-20" />
                                    <span className={`text-xs font-medium ${getProgressColor(group.avgProgress)}`}>
                                      {group.avgProgress}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getPriorityBadge(
                              group.activities.some((a) => a.priority === "Haute") ? "Haute" : group.activities.some((a) => a.priority === "Moyenne") ? "Moyenne" : "Basse"
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-slate-200 dark:border-slate-700">
                      <ScrollArea className="max-h-96">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-[10px] w-[100px]">Code</TableHead>
                              <TableHead className="text-[10px]">Titre</TableHead>
                              <TableHead className="text-[10px] w-[120px]">Responsable</TableHead>
                              <TableHead className="text-[10px] w-[80px]">Priorité</TableHead>
                              <TableHead className="text-[10px] w-[90px]">Statut</TableHead>
                              <TableHead className="text-[10px] w-[100px]">Avancement</TableHead>
                              <TableHead className="text-[10px] w-[80px]">Validation</TableHead>
                              <TableHead className="text-[10px] w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.activities.map((activity) => (
                              <TableRow key={activity.id} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer" onClick={() => handleView(activity)}>
                                <TableCell className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                                  {activity.activityCode}
                                </TableCell>
                                <TableCell className="text-xs max-w-[300px] truncate">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="truncate block">{activity.title}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      {activity.title}
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground truncate">
                                  {activity.responsible?.name || "—"}
                                </TableCell>
                                <TableCell>{getPriorityBadge(activity.priority)}</TableCell>
                                <TableCell>{getActivityStatusBadge(activity.status)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <Progress value={activity.progressRate} className={`h-1.5 w-12 ${getProgressBg(activity.progressRate)}`} />
                                    <span className={`text-[10px] font-medium ${getProgressColor(activity.progressRate)}`}>
                                      {Math.round(activity.progressRate)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>{getValidationStatusBadge(activity.validationStatus)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleView(activity);
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* Flat Data Table (no grouping) */}
      {/* ============================================================ */}

      {groupBy === "none" && (
        <Card>
          <CardContent className="p-0">
            {sortedActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <ClipboardList className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Aucune activité trouvée
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                  {hasActiveFilters
                    ? "Essayez de modifier les filtres pour afficher des résultats."
                    : "Aucune activité PTA n'a été créée pour le moment."}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-4"
                  >
                    Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] w-[110px]">
                          <SortableHeader column="activityCode">Code</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px]">
                          <SortableHeader column="title">Titre</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[130px]">
                          <SortableHeader column="responsible">Responsable</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[120px]">
                          <SortableHeader column="direction">Direction</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[120px]">
                          Axe strat.
                        </TableHead>
                        <TableHead className="text-[10px] w-[120px]">
                          Domaine ACBF
                        </TableHead>
                        <TableHead className="text-[10px] w-[80px]">
                          <SortableHeader column="priority">Priorité</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[90px]">
                          <SortableHeader column="status">Statut</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[110px]">
                          <SortableHeader column="progressRate">Avancement</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[85px]">
                          <SortableHeader column="validationStatus">Validation</SortableHeader>
                        </TableHead>
                        <TableHead className="text-[10px] w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedActivities.map((activity) => (
                        <TableRow
                          key={activity.id}
                          className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer"
                          onClick={() => handleView(activity)}
                        >
                          <TableCell className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                            {activity.activityCode}
                          </TableCell>
                          <TableCell className="text-xs max-w-[250px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block">{activity.title}</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                {activity.title}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {activity.responsible?.name || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {activity.direction ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block">{activity.direction.code} — {activity.direction.name}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {activity.direction.code} — {activity.direction.name}
                                </TooltipContent>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {activity.primaryAxis ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block">{activity.primaryAxis.code} — {activity.primaryAxis.name}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {activity.primaryAxis.code} — {activity.primaryAxis.name}
                                </TooltipContent>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {activity.acbfDomain ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block">{activity.acbfDomain.code} — {activity.acbfDomain.name}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {activity.acbfDomain.code} — {activity.acbfDomain.name}
                                </TooltipContent>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{getPriorityBadge(activity.priority)}</TableCell>
                          <TableCell>{getActivityStatusBadge(activity.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Progress value={activity.progressRate} className="h-1.5 w-14" />
                              <span className={`text-[10px] font-medium ${getProgressColor(activity.progressRate)}`}>
                                {Math.round(activity.progressRate)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getValidationStatusBadge(activity.validationStatus)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(activity);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="lg:hidden space-y-2 p-3">
                  {sortedActivities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => handleView(activity)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                              {activity.activityCode}
                            </span>
                            {getPriorityBadge(activity.priority)}
                            {getValidationStatusBadge(activity.validationStatus)}
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {activity.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>{activity.responsible?.name || "—"}</span>
                            {activity.direction && <span>{activity.direction.code}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            {getActivityStatusBadge(activity.status)}
                            <div className="flex items-center gap-1.5 flex-1">
                              <Progress value={activity.progressRate} className="h-1.5 flex-1" />
                              <span className={`text-[10px] font-medium ${getProgressColor(activity.progressRate)}`}>
                                {Math.round(activity.progressRate)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 text-slate-400 shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Pagination */}
      {/* ============================================================ */}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="h-8 w-8 p-0"
            >
              <span className="text-xs">1</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {(() => {
              const pages: number[] = [];
              const start = Math.max(2, page - 2);
              const end = Math.min(totalPages - 1, page + 2);

              for (let i = start; i <= end; i++) {
                pages.push(i);
              }

              return pages.map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 p-0 ${
                    p === page
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                >
                  <span className="text-xs">{p}</span>
                </Button>
              ));
            })()}

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2"
            >
              <ChevronUp className="h-4 w-4 rotate-90" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="h-8 w-8 p-0"
            >
              <span className="text-xs">{totalPages}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* View Activity Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Détail de l&apos;activité
            </DialogTitle>
            <DialogDescription>
              {selectedActivity && (
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {selectedActivity.activityCode}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-6 py-2">
                {/* Identification */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Identification</h4>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Titre</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedActivity.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Responsable</p>
                        <p className="text-sm text-slate-900 dark:text-white">{selectedActivity.responsible?.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nature</p>
                        <p className="text-sm text-slate-900 dark:text-white">{selectedActivity.nature || "—"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Organisation */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Organisation</h4>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Direction</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.direction ? `${selectedActivity.direction.code} — ${selectedActivity.direction.name}` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Axe strat. principal</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.primaryAxis ? `${selectedActivity.primaryAxis.code} — ${selectedActivity.primaryAxis.name}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Axe strat. secondaire</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.secondaryAxis ? `${selectedActivity.secondaryAxis.code} — ${selectedActivity.secondaryAxis.name}` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Domaine ACBF</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.acbfDomain ? `${selectedActivity.acbfDomain.code} — ${selectedActivity.acbfDomain.name}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Livrable ACBF</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.acbfDeliverable ? `${selectedActivity.acbfDeliverable.code} — ${selectedActivity.acbfDeliverable.name}` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Validateur</p>
                        <p className="text-sm text-slate-900 dark:text-white">
                          {selectedActivity.validator?.name || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Planification */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Planification</h4>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Objectif annuel</p>
                      <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.annualObjective || "—"}</p>
                    </div>
                    {selectedActivity.detailedTasks && (
                      <div>
                        <p className="text-xs text-muted-foreground">Tâches détaillées</p>
                        <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.detailedTasks}</p>
                      </div>
                    )}
                    {selectedActivity.expectedDeliverable && (
                      <div>
                        <p className="text-xs text-muted-foreground">Livrable attendu</p>
                        <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.expectedDeliverable}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Date de début</p>
                        <p className="text-sm text-slate-900 dark:text-white">{formatDate(selectedActivity.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date de fin</p>
                        <p className="text-sm text-slate-900 dark:text-white">{formatDate(selectedActivity.endDate)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Suivi */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Suivi</h4>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Priorité</p>
                        <div className="mt-0.5">{getPriorityBadge(selectedActivity.priority)}</div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Statut</p>
                        <div className="mt-0.5">{getActivityStatusBadge(selectedActivity.status)}</div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Validation</p>
                        <div className="mt-0.5">{getValidationStatusBadge(selectedActivity.validationStatus)}</div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avancement</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={selectedActivity.progressRate} className="h-2.5 flex-1" />
                        <span className={`text-sm font-semibold ${getProgressColor(selectedActivity.progressRate)}`}>
                          {Math.round(selectedActivity.progressRate)}%
                        </span>
                      </div>
                    </div>
                    {selectedActivity.performanceIndicator && (
                      <div>
                        <p className="text-xs text-muted-foreground">Indicateur de performance</p>
                        <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.performanceIndicator}</p>
                      </div>
                    )}
                    {selectedActivity.verificationSource && (
                      <div>
                        <p className="text-xs text-muted-foreground">Source de vérification</p>
                        <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.verificationSource}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Risques */}
                {(selectedActivity.riskDescription || selectedActivity.comments) && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Risques & Commentaires</h4>
                      </div>
                      <div className="space-y-3 pl-6">
                        {selectedActivity.riskDescription && (
                          <div>
                            <p className="text-xs text-muted-foreground">Description du risque</p>
                            <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.riskDescription}</p>
                          </div>
                        )}
                        {selectedActivity.comments && (
                          <div>
                            <p className="text-xs text-muted-foreground">Commentaires</p>
                            <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.comments}</p>
                          </div>
                        )}
                        {selectedActivity.dependency && (
                          <div>
                            <p className="text-xs text-muted-foreground">Dépendance</p>
                            <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">{selectedActivity.dependency}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Metadata */}
                <div className="text-xs text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Créé le : {formatDate(selectedActivity.createdAt)}</div>
                    <div>Modifié le : {formatDate(selectedActivity.updatedAt)}</div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
