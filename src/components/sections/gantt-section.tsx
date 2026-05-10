"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  GanttChart,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  Search,
  Filter,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Diamond,
  ClipboardList,
  Building2,
} from "lucide-react";
import { format, differenceInDays, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfWeek as endOfQuarterWeek, eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval } from "date-fns";
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
  Dialog,
  DialogContent,
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
  acbfDomain?: { id: string; code: string; name: string };
  acbfDeliverable?: { id: string; code: string; name: string };
  validator?: UserOption;
}

interface GanttStats {
  totalPlanned: number;
  avgProgressRate: number;
  overdueCount: number;
  avgDurationDays: number;
  timelineStart: string | null;
  timelineEnd: string | null;
}

interface GroupData {
  key: string;
  label: string;
  activities: Activity[];
  avgProgress: number;
}

type ZoomLevel = "day" | "week" | "month" | "quarter";
type GroupBy = "none" | "direction" | "axis" | "responsible" | "status";

// ============================================================
// Constants
// ============================================================

const LEFT_PANEL_WIDTH = 300;
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;
const TODAY = new Date();

const ZOOM_CONFIG: Record<ZoomLevel, { columnWidth: number; label: string }> = {
  day: { columnWidth: 40, label: "Jour" },
  week: { columnWidth: 120, label: "Semaine" },
  month: { columnWidth: 200, label: "Mois" },
  quarter: { columnWidth: 400, label: "Trimestre" },
};

const STATUS_COLORS: Record<string, { bg: string; fill: string; text: string; border: string }> = {
  "Non démarré": { bg: "bg-slate-100 dark:bg-slate-800", fill: "bg-slate-400", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600" },
  "En cours": { bg: "bg-emerald-50 dark:bg-emerald-950", fill: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" },
  "Réalisé": { bg: "bg-green-50 dark:bg-green-950", fill: "bg-green-600", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  "En retard": { bg: "bg-red-50 dark:bg-red-950", fill: "bg-red-500", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  "Suspendu": { bg: "bg-amber-50 dark:bg-amber-950", fill: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "À reprogrammer": { bg: "bg-orange-50 dark:bg-orange-950", fill: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  "Terminé": { bg: "bg-emerald-50 dark:bg-emerald-950", fill: "bg-emerald-800", text: "text-emerald-900 dark:text-emerald-200", border: "border-emerald-500 dark:border-emerald-600" },
  "Annulé": { bg: "bg-slate-50 dark:bg-slate-900", fill: "bg-slate-400", text: "text-slate-500 dark:text-slate-400 line-through", border: "border-slate-200 dark:border-slate-700" },
};

const ACTIVITY_STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "Non démarré", label: "Non démarré" },
  { value: "En cours", label: "En cours" },
  { value: "Réalisé", label: "Réalisé" },
  { value: "En retard", label: "En retard" },
  { value: "Suspendu", label: "Suspendu" },
  { value: "À reprogrammer", label: "À reprogrammer" },
  { value: "Terminé", label: "Terminé" },
  { value: "Annulé", label: "Annulé" },
];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "Aucun" },
  { value: "direction", label: "Par direction" },
  { value: "axis", label: "Par axe stratégique" },
  { value: "responsible", label: "Par responsable" },
  { value: "status", label: "Par statut" },
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

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function getDaysBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return differenceInDays(new Date(end), new Date(start));
}

function getStatusBadge(status: string | null) {
  if (!status) return null;
  const colors = STATUS_COLORS[status];
  if (!colors) {
    return <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">{status}</Badge>;
  }
  return (
    <Badge className={`text-[10px] ${colors.bg} ${colors.text} border-0`}>
      {status}
    </Badge>
  );
}

function getPriorityBadge(priority: string | null) {
  if (!priority) return null;
  switch (priority) {
    case "Haute":
      return <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">Haute</Badge>;
    case "Moyenne":
      return <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">Moyenne</Badge>;
    case "Basse":
      return <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">Basse</Badge>;
    default:
      return <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">{priority}</Badge>;
  }
}

// ============================================================
// Main Component
// ============================================================

export function GanttSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = hasPermission(session?.user?.roles ?? [], "pta:read");

  // ----- Stats state -----
  const [stats, setStats] = useState<GanttStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ----- List state -----
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- Filter state -----
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [axisFilter, setAxisFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- View state -----
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // ----- Group expansion -----
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ----- Dropdown options -----
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>([]);
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);

  // ----- Scroll sync refs -----
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const isScrollSyncing = useRef(false);

  // ----- Is mobile -----
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/gantt/stats");
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
    if (canRead) fetchStats();
  }, [canRead, fetchStats, refreshKey]);

  // ============================================================
  // Fetch Activities
  // ============================================================

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (directionFilter) params.set("directionId", directionFilter);
      if (axisFilter) params.set("primaryAxisId", axisFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (groupBy !== "none") params.set("groupBy", groupBy);

      const res = await fetch(`/api/gantt?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setActivities(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [search, directionFilter, axisFilter, statusFilter, priorityFilter, groupBy]);

  useEffect(() => {
    if (canRead) fetchActivities();
  }, [canRead, fetchActivities, refreshKey]);

  // ============================================================
  // Fetch Dropdown Options
  // ============================================================

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [directionsRes, axesRes] = await Promise.all([
          fetch("/api/directions?limit=100&status=active"),
          fetch("/api/strategic-axes?limit=100&status=active"),
        ]);

        if (directionsRes.ok) {
          const data = await directionsRes.json();
          setDirectionOptions(data.data.map((d: DirectionOption) => ({ id: d.id, code: d.code, name: d.name })));
        }
        if (axesRes.ok) {
          const data = await axesRes.json();
          setAxisOptions(data.data.map((a: AxisOption) => ({ id: a.id, code: a.code, name: a.name })));
        }
      } catch {
        // Silently fail
      }
    }
    fetchOptions();
  }, []);

  // ============================================================
  // Scroll Sync
  // ============================================================

  const handleLeftScroll = useCallback(() => {
    if (isScrollSyncing.current) return;
    isScrollSyncing.current = true;
    if (leftPanelRef.current && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = leftPanelRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isScrollSyncing.current = false; });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isScrollSyncing.current) return;
    isScrollSyncing.current = true;
    if (leftPanelRef.current && rightPanelRef.current) {
      leftPanelRef.current.scrollTop = rightPanelRef.current.scrollTop;
    }
    requestAnimationFrame(() => { isScrollSyncing.current = false; });
  }, []);

  // ============================================================
  // Computed: Filtered Activities
  // ============================================================

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => a.startDate !== null);
  }, [activities]);

  // ============================================================
  // Computed: Timeline Range
  // ============================================================

  const timelineRange = useMemo(() => {
    if (filteredActivities.length === 0) {
      // Default: current year
      const yearStart = new Date(TODAY.getFullYear(), 0, 1);
      const yearEnd = new Date(TODAY.getFullYear(), 11, 31);
      return { start: yearStart, end: yearEnd };
    }

    let minDate = new Date(filteredActivities[0].startDate!);
    let maxDate = new Date(filteredActivities[0].startDate!);

    filteredActivities.forEach((a) => {
      if (a.startDate) {
        const s = new Date(a.startDate);
        if (s < minDate) minDate = s;
      }
      if (a.endDate) {
        const e = new Date(a.endDate);
        if (e > maxDate) maxDate = e;
      } else if (a.startDate) {
        // If no end date, use start date + 7 days
        const e = addDays(new Date(a.startDate), 7);
        if (e > maxDate) maxDate = e;
      }
    });

    // Add padding
    const padDays = zoom === "day" ? 7 : zoom === "week" ? 14 : 30;
    minDate = addDays(minDate, -padDays);
    maxDate = addDays(maxDate, padDays);

    // Ensure today is visible
    if (TODAY < minDate) minDate = addDays(TODAY, -padDays);
    if (TODAY > maxDate) maxDate = addDays(TODAY, padDays);

    return { start: minDate, end: maxDate };
  }, [filteredActivities, zoom]);

  // ============================================================
  // Computed: Timeline Columns (headers)
  // ============================================================

  const timelineColumns = useMemo(() => {
    const { start, end } = timelineRange;
    const colWidth = ZOOM_CONFIG[zoom].columnWidth;

    switch (zoom) {
      case "day": {
        const days = eachDayOfInterval({ start, end });
        return days.map((day) => ({
          date: day,
          label: format(day, "dd", { locale: fr }),
          subLabel: format(day, "EEE", { locale: fr }),
          width: colWidth,
          isWeekend: day.getDay() === 0 || day.getDay() === 6,
          isToday: format(day, "yyyy-MM-dd") === format(TODAY, "yyyy-MM-dd"),
        }));
      }
      case "week": {
        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
        return weeks.map((week) => ({
          date: week,
          label: `S${format(week, "ww", { locale: fr })}`,
          subLabel: format(week, "MMM yy", { locale: fr }),
          width: colWidth,
          isWeekend: false,
          isToday:
            TODAY >= startOfWeek(week, { weekStartsOn: 1 }) &&
            TODAY <= endOfWeek(week, { weekStartsOn: 1 }),
        }));
      }
      case "month": {
        const months = eachMonthOfInterval({ start, end });
        return months.map((month) => ({
          date: month,
          label: format(month, "MMM", { locale: fr }),
          subLabel: format(month, "yyyy", { locale: fr }),
          width: colWidth,
          isWeekend: false,
          isToday:
            TODAY.getMonth() === month.getMonth() &&
            TODAY.getFullYear() === month.getFullYear(),
        }));
      }
      case "quarter": {
        const months = eachMonthOfInterval({ start, end });
        // Group months into quarters
        const quarters: Array<{
          date: Date;
          label: string;
          subLabel: string;
          width: number;
          isWeekend: boolean;
          isToday: boolean;
        }> = [];
        let currentQuarter = -1;
        let quarterStart: Date | null = null;
        let monthCount = 0;

        months.forEach((month) => {
          const q = Math.floor(month.getMonth() / 3);
          if (q !== currentQuarter) {
            if (quarterStart !== null && monthCount > 0) {
              const qNum = Math.floor(quarterStart.getMonth() / 3) + 1;
              quarters.push({
                date: quarterStart,
                label: `T${qNum}`,
                subLabel: format(quarterStart, "yyyy", { locale: fr }),
                width: colWidth,
                isWeekend: false,
                isToday:
                  Math.floor(TODAY.getMonth() / 3) === Math.floor(quarterStart.getMonth() / 3) &&
                  TODAY.getFullYear() === quarterStart.getFullYear(),
              });
            }
            currentQuarter = q;
            quarterStart = month;
            monthCount = 1;
          } else {
            monthCount++;
          }
        });
        // Push last quarter
        if (quarterStart !== null && monthCount > 0) {
          const qNum = Math.floor(quarterStart.getMonth() / 3) + 1;
          quarters.push({
            date: quarterStart,
            label: `T${qNum}`,
            subLabel: format(quarterStart, "yyyy", { locale: fr }),
            width: colWidth,
            isWeekend: false,
            isToday:
              Math.floor(TODAY.getMonth() / 3) === Math.floor(quarterStart.getMonth() / 3) &&
              TODAY.getFullYear() === quarterStart.getFullYear(),
          });
        }

        return quarters;
      }
    }
  }, [timelineRange, zoom]);

  // ============================================================
  // Computed: Total timeline width
  // ============================================================

  const totalWidth = useMemo(() => {
    return timelineColumns.length * ZOOM_CONFIG[zoom].columnWidth;
  }, [timelineColumns, zoom]);

  // ============================================================
  // Computed: Get bar position for an activity
  // ============================================================

  const getBarPosition = useCallback((activity: Activity) => {
    if (!activity.startDate) return null;

    const { start: timelineStart } = timelineRange;
    const activityStart = new Date(activity.startDate);
    const activityEnd = activity.endDate ? new Date(activity.endDate) : addDays(activityStart, 1);
    const isMilestone = !activity.endDate || activity.endDate === activity.startDate;

    const totalDays = differenceInDays(timelineRange.end, timelineStart);
    if (totalDays <= 0) return null;

    const startOffset = differenceInDays(activityStart, timelineStart);
    const duration = isMilestone ? 0 : differenceInDays(activityEnd, activityStart);

    const left = (startOffset / totalDays) * totalWidth;
    const width = isMilestone ? 12 : Math.max((duration / totalDays) * totalWidth, 8);

    return {
      left: Math.max(0, left),
      width,
      isMilestone,
    };
  }, [timelineRange, totalWidth]);

  // ============================================================
  // Computed: Today line position
  // ============================================================

  const todayPosition = useMemo(() => {
    const { start } = timelineRange;
    const totalDays = differenceInDays(timelineRange.end, start);
    if (totalDays <= 0) return 0;
    const todayOffset = differenceInDays(TODAY, start);
    return (todayOffset / totalDays) * totalWidth;
  }, [timelineRange, totalWidth]);

  // ============================================================
  // Grouping
  // ============================================================

  const groupedActivities = useMemo((): GroupData[] => {
    if (groupBy === "none") return [];

    const groups = new Map<string, Activity[]>();

    filteredActivities.forEach((activity) => {
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
        case "responsible":
          key = activity.responsible?.name || "Non assigné";
          break;
        case "status":
          key = activity.status || "Non défini";
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
  }, [filteredActivities, groupBy]);

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
    setStatusFilter("");
    setPriorityFilter("");
    setGroupBy("none");
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
        setSelectedActivity((prev) => prev ? { ...prev, ...data.data } : prev);
      }
    } catch {
      // Keep existing data
    }
  }

  // ============================================================
  // Has active filters
  // ============================================================

  const hasActiveFilters = useMemo(() => {
    return !!(search || directionFilter || axisFilter || statusFilter || priorityFilter);
  }, [search, directionFilter, axisFilter, statusFilter, priorityFilter]);

  // ============================================================
  // Render: Loading
  // ============================================================

  if (loading && activities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gantt dynamique
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visualisation chronologique des activités
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

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
            Gantt dynamique
          </h2>
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
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
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
            Gantt dynamique
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
              Vous n&apos;avez pas la permission &quot;pta:read&quot; nécessaire pour consulter le Gantt.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Render: Activity Row (for Gantt left panel)
  // ============================================================

  function renderActivityRow(activity: Activity, isGrouped: boolean = false) {
    const colors = STATUS_COLORS[activity.status] || STATUS_COLORS["Non démarré"];
    return (
      <div
        key={activity.id}
        className={`flex items-center border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
          isGrouped ? "pl-4" : ""
        }`}
        style={{ height: ROW_HEIGHT }}
        onClick={() => handleView(activity)}
      >
        <div className="flex-1 min-w-0 px-3 flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
            {activity.activityCode}
          </span>
          <span className="text-xs text-slate-900 dark:text-white truncate" title={activity.title}>
            {activity.title.length > 35 ? activity.title.substring(0, 35) + "…" : activity.title}
          </span>
        </div>
        <div className="shrink-0 px-2">
          {getStatusBadge(activity.status)}
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Activity Bar (for Gantt right panel)
  // ============================================================

  function renderActivityBar(activity: Activity) {
    const pos = getBarPosition(activity);
    if (!pos) return null;

    const colors = STATUS_COLORS[activity.status] || STATUS_COLORS["Non démarré"];
    const isMilestone = pos.isMilestone;

    if (isMilestone) {
      // Diamond shape for milestones
      return (
        <Tooltip key={activity.id}>
          <TooltipTrigger asChild>
            <div
              className="absolute cursor-pointer"
              style={{
                left: pos.left - 6,
                top: (ROW_HEIGHT - 12) / 2,
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleView(activity);
              }}
            >
              <Diamond className={`h-3 w-3 ${colors.fill} fill-current`} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {renderTooltipContent(activity)}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip key={activity.id}>
        <TooltipTrigger asChild>
          <div
            className={`absolute rounded-sm border ${colors.border} cursor-pointer overflow-hidden transition-all hover:shadow-md hover:brightness-110 ${
              activity.status === "Annulé" ? "opacity-50" : ""
            }`}
            style={{
              left: pos.left,
              width: Math.max(pos.width, 8),
              top: (ROW_HEIGHT - 22) / 2,
              height: 22,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleView(activity);
            }}
          >
            {/* Progress fill */}
            <div
              className={`h-full ${colors.fill} transition-all`}
              style={{ width: `${activity.progressRate}%` }}
            />
            {/* Bar label */}
            {pos.width > 60 && (
              <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white dark:text-white truncate pointer-events-none">
                {activity.progressRate > 0 ? `${activity.progressRate}%` : activity.activityCode}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {renderTooltipContent(activity)}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ============================================================
  // Render: Tooltip Content
  // ============================================================

  function renderTooltipContent(activity: Activity) {
    const days = getDaysBetween(activity.startDate, activity.endDate);
    return (
      <div className="space-y-1.5 text-xs">
        <div className="font-semibold text-sm">{activity.activityCode}</div>
        <div className="text-muted-foreground">{activity.title}</div>
        <Separator className="my-1" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-muted-foreground">Responsable</span>
          <span>{activity.responsible?.name || "—"}</span>
          <span className="text-muted-foreground">Direction</span>
          <span>{activity.direction?.name || "—"}</span>
          <span className="text-muted-foreground">Début</span>
          <span>{formatDateShort(activity.startDate)}</span>
          <span className="text-muted-foreground">Fin</span>
          <span>{formatDateShort(activity.endDate)}</span>
          <span className="text-muted-foreground">Durée</span>
          <span>{days > 0 ? `${days} j` : "—"}</span>
          <span className="text-muted-foreground">Avancement</span>
          <span>{activity.progressRate}%</span>
          <span className="text-muted-foreground">Statut</span>
          <span>{activity.status}</span>
          <span className="text-muted-foreground">Priorité</span>
          <span>{activity.priority}</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Mobile Card View
  // ============================================================

  function renderMobileCard(activity: Activity) {
    const colors = STATUS_COLORS[activity.status] || STATUS_COLORS["Non démarré"];
    const days = getDaysBetween(activity.startDate, activity.endDate);

    return (
      <Card
        key={activity.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleView(activity)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-400">{activity.activityCode}</span>
              <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {activity.title}
              </h4>
            </div>
            <div className="shrink-0">{getStatusBadge(activity.status)}</div>
          </div>

          {/* Mini timeline bar */}
          <div className={`h-3 rounded-sm border ${colors.border} overflow-hidden mb-2`}>
            <div
              className={`h-full ${colors.fill}`}
              style={{ width: `${activity.progressRate}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDateShort(activity.startDate)} → {formatDateShort(activity.endDate)}</span>
            <span className="font-medium">{activity.progressRate}%</span>
          </div>
          {days > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1">
              {days} jours · {activity.responsible?.name || "—"}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // Render: View Dialog
  // ============================================================

  function renderViewDialog() {
    if (!selectedActivity) return null;
    const a = selectedActivity;
    const days = getDaysBetween(a.startDate, a.endDate);

    return (
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GanttChart className="h-5 w-5 text-emerald-600" />
              {a.activityCode} — Détail de l&apos;activité
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-2">
            <div className="space-y-5 py-2">
              {/* Identification */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Identification</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 text-sm">
                  <div><span className="text-muted-foreground">Code :</span> <span className="font-medium">{a.activityCode}</span></div>
                  <div><span className="text-muted-foreground">Priorité :</span> {getPriorityBadge(a.priority)}</div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Titre :</span> <span className="font-medium">{a.title}</span></div>
                  <div><span className="text-muted-foreground">Nature :</span> <span>{a.nature || "—"}</span></div>
                  <div><span className="text-muted-foreground">Statut :</span> {getStatusBadge(a.status)}</div>
                  <div><span className="text-muted-foreground">Validation :</span> <span>{a.validationStatus}</span></div>
                </div>
              </div>

              <Separator />

              {/* Organisation */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Organisation</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 text-sm">
                  <div><span className="text-muted-foreground">Responsable :</span> <span>{a.responsible?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Direction :</span> <span>{a.direction?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Axe principal :</span> <span>{a.primaryAxis?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Axe secondaire :</span> <span>{a.secondaryAxis?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Domaine ACBF :</span> <span>{a.acbfDomain?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Livrable ACBF :</span> <span>{a.acbfDeliverable?.name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Validateur :</span> <span>{a.validator?.name || "—"}</span></div>
                </div>
              </div>

              <Separator />

              {/* Planification */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Planification</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 text-sm">
                  <div><span className="text-muted-foreground">Date début :</span> <span>{formatDate(a.startDate)}</span></div>
                  <div><span className="text-muted-foreground">Date fin :</span> <span>{formatDate(a.endDate)}</span></div>
                  <div><span className="text-muted-foreground">Durée :</span> <span>{days > 0 ? `${days} jours` : "—"}</span></div>
                  <div><span className="text-muted-foreground">Dépendance :</span> <span>{a.dependency || "—"}</span></div>
                </div>
              </div>

              <Separator />

              {/* Suivi */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Suivi</h4>
                </div>
                <div className="space-y-3 pl-6 text-sm">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground">Avancement</span>
                      <span className="font-semibold">{a.progressRate}%</span>
                    </div>
                    <Progress value={a.progressRate} className="h-2" />
                  </div>
                  <div><span className="text-muted-foreground">Objectif annuel :</span> <span>{a.annualObjective || "—"}</span></div>
                  <div><span className="text-muted-foreground">Indicateur :</span> <span>{a.performanceIndicator || "—"}</span></div>
                  <div><span className="text-muted-foreground">Source de vérification :</span> <span>{a.verificationSource || "—"}</span></div>
                  <div><span className="text-muted-foreground">Livrable attendu :</span> <span>{a.expectedDeliverable || "—"}</span></div>
                </div>
              </div>

              {/* Risques & Commentaires */}
              {(a.riskDescription || a.comments) && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-emerald-600" />
                      <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Risques & Commentaires</h4>
                    </div>
                    <div className="space-y-2 pl-6 text-sm">
                      {a.riskDescription && (
                        <div>
                          <span className="text-muted-foreground">Risque :</span>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{a.riskDescription}</p>
                        </div>
                      )}
                      {a.comments && (
                        <div>
                          <span className="text-muted-foreground">Commentaires :</span>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{a.comments}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
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
            Gantt dynamique
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visualisation chronologique des activités PTA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Total activités planifiées */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Activités planifiées
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-12 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stats?.totalPlanned ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                <GanttChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Période */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Période
                </p>
                {statsLoading ? (
                  <Skeleton className="h-5 w-28 mt-1" />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    {stats?.timelineStart
                      ? `${formatDateShort(stats.timelineStart)} → ${formatDateShort(stats.timelineEnd)}`
                      : "—"}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Durée moyenne */}
        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Durée moyenne
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                    {stats?.avgDurationDays ?? 0} j
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                <Clock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* En retard */}
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
                    {stats?.overdueCount ?? 0}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avancement moyen */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Avancement moyen
                </p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {stats?.avgProgressRate ?? 0}%
                    </p>
                    <Progress
                      value={stats?.avgProgressRate ?? 0}
                      className="h-1.5 mt-2"
                    />
                  </>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900 ml-2">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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
          <div className="space-y-3">
            {/* Row 1: Search + Group By + Zoom */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par titre ou code..."
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
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-slate-400 shrink-0" />
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger className="w-[180px]">
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

                {/* Zoom controls */}
                <div className="flex items-center border rounded-md overflow-hidden">
                  {(["day", "week", "month", "quarter"] as ZoomLevel[]).map((z) => (
                    <Button
                      key={z}
                      variant={zoom === z ? "default" : "ghost"}
                      size="sm"
                      className={`h-8 px-2 text-xs rounded-none ${
                        zoom === z
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => setZoom(z)}
                    >
                      {ZOOM_CONFIG[z].label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les statuts</SelectItem>
                  {ACTIVITY_STATUS_OPTIONS.filter((o) => o.value).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Tabs value={priorityFilter || "__all__"} onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}>
                  <TabsList className="h-9">
                    <TabsTrigger value="__all__" className="text-xs px-2">Tous</TabsTrigger>
                    <TabsTrigger value="Haute" className="text-xs px-2 text-red-600">H</TabsTrigger>
                    <TabsTrigger value="Moyenne" className="text-xs px-2 text-amber-600">M</TabsTrigger>
                    <TabsTrigger value="Basse" className="text-xs px-2 text-emerald-600">B</TabsTrigger>
                  </TabsList>
                </Tabs>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Gantt Chart or Mobile View */}
      {/* ============================================================ */}

      {filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <GanttChart className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Aucune activité planifiée
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
              {hasActiveFilters
                ? "Aucune activité ne correspond aux filtres appliqués. Essayez de modifier vos critères."
                : "Aucune activité avec des dates de planification n'a été trouvée."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                <X className="h-4 w-4 mr-2" />
                Réinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* ============ Mobile Card View ============ */
        <div className="grid grid-cols-1 gap-3">
          {groupBy !== "none" && groupedActivities.length > 0
            ? groupedActivities.map((group) => (
                <Collapsible
                  key={group.key}
                  open={expandedGroups.has(group.key)}
                  onOpenChange={() => toggleGroup(group.key)}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(group.key) ? (
                            <ChevronDown className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-emerald-600" />
                          )}
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{group.label}</span>
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 border-0">
                            {group.activities.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{group.avgProgress}%</span>
                          <Progress value={group.avgProgress} className="w-16 h-1.5" />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        {group.activities.map((a) => renderMobileCard(a))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            : filteredActivities.map((a) => renderMobileCard(a))}
        </div>
      ) : (
        /* ============ Desktop Gantt Chart ============ */
        <Card className="overflow-hidden">
          <div className="flex">
            {/* Left Panel — Activity List */}
            <div
              className="shrink-0 border-r border-slate-200 dark:border-slate-700"
              style={{ width: LEFT_PANEL_WIDTH }}
            >
              {/* Left Header */}
              <div
                className="flex items-center px-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                style={{ height: HEADER_HEIGHT }}
              >
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Activités ({filteredActivities.length})
                </span>
              </div>
              {/* Left Body */}
              <div
                ref={leftPanelRef}
                onScroll={handleLeftScroll}
                className="overflow-y-auto"
                style={{ maxHeight: 500 }}
              >
                {groupBy !== "none" && groupedActivities.length > 0
                  ? groupedActivities.map((group) => (
                      <div key={group.key}>
                        {/* Group Header Row */}
                        <div
                          className="flex items-center px-3 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => toggleGroup(group.key)}
                        >
                          {expandedGroups.has(group.key) ? (
                            <ChevronDown className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600 mr-1.5 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {group.label}
                          </span>
                          <Badge className="ml-auto text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 border-0 shrink-0">
                            {group.activities.length}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                            {group.avgProgress}%
                          </span>
                        </div>
                        {/* Group Activities */}
                        {expandedGroups.has(group.key) &&
                          group.activities.map((a) => renderActivityRow(a, true))}
                      </div>
                    ))
                  : filteredActivities.map((a) => renderActivityRow(a))}
              </div>
            </div>

            {/* Right Panel — Timeline */}
            <div className="flex-1 min-w-0">
              {/* Timeline Header */}
              <div
                className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden"
                style={{ height: HEADER_HEIGHT }}
              >
                <div
                  className="flex"
                  style={{ width: totalWidth }}
                >
                  {timelineColumns.map((col, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 shrink-0 ${
                        col.isToday
                          ? "bg-emerald-50 dark:bg-emerald-950/30"
                          : col.isWeekend
                          ? "bg-slate-100/50 dark:bg-slate-800/30"
                          : ""
                      }`}
                      style={{ width: col.width }}
                    >
                      <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        {col.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {col.subLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Body */}
              <div
                ref={rightPanelRef}
                onScroll={handleRightScroll}
                className="overflow-auto"
                style={{ maxHeight: 500 }}
              >
                <div
                  className="relative"
                  style={{ width: totalWidth, minHeight: filteredActivities.length * ROW_HEIGHT }}
                >
                  {/* Today Line */}
                  {todayPosition >= 0 && todayPosition <= totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 dark:bg-red-400 z-10"
                      style={{ left: todayPosition }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] px-1 rounded-b-sm whitespace-nowrap">
                        Aujourd&apos;hui
                      </div>
                    </div>
                  )}

                  {/* Activity Rows */}
                  {groupBy !== "none" && groupedActivities.length > 0
                    ? groupedActivities.map((group) => {
                        let groupStartIdx = 0;
                        // Find the start index of this group in the flat list
                        for (const g of groupedActivities) {
                          if (g.key === group.key) break;
                          groupStartIdx += 1 + (expandedGroups.has(g.key) ? g.activities.length : 0);
                        }

                        return (
                          <div key={group.key}>
                            {/* Group header row in timeline */}
                            <div
                              className="absolute left-0 right-0 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center px-2"
                              style={{
                                top: groupStartIdx * ROW_HEIGHT,
                                height: ROW_HEIGHT,
                              }}
                            >
                              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${group.avgProgress}%` }}
                                />
                              </div>
                            </div>

                            {/* Activity bars */}
                            {expandedGroups.has(group.key) &&
                              group.activities.map((a, idx) => {
                                const rowIdx = groupStartIdx + 1 + idx;
                                return (
                                  <div
                                    key={a.id}
                                    className="absolute left-0 right-0 border-b border-slate-50 dark:border-slate-800/50"
                                    style={{
                                      top: rowIdx * ROW_HEIGHT,
                                      height: ROW_HEIGHT,
                                    }}
                                  >
                                    {renderActivityBar(a)}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })
                    : filteredActivities.map((a, idx) => (
                        <div
                          key={a.id}
                          className="absolute left-0 right-0 border-b border-slate-50 dark:border-slate-800/50"
                          style={{
                            top: idx * ROW_HEIGHT,
                            height: ROW_HEIGHT,
                          }}
                        >
                          {renderActivityBar(a)}
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* View Dialog */}
      {renderViewDialog()}
    </div>
  );
}
