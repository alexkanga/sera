"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  X,
  Camera,
  Target,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Gauge,
  Activity,
  ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  Bar,
  BarChart,
  Pie,
  PieChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { checkPermission } from "@/lib/client-permissions";

// ============================================================
// Types
// ============================================================

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

interface KpiDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  direction: string;
  frequency: string;
  strategicAxisId: string | null;
  directionId: string | null;
  isPublic: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  strategicAxis?: AxisOption;
  orgDirection?: DirectionOption;
  snapshots?: KpiSnapshot[];
}

interface KpiSnapshot {
  id: string;
  kpiId: string;
  value: number;
  targetValue: number;
  period: string;
  capturedAt: string;
  notes: string | null;
}

interface DashboardData {
  totalActivities: number;
  totalActivitiesLastMonth: number;
  avgProgress: number;
  validationRate: number;
  lateCount: number;
  raciRate: number;
  verifiedEvidenceCount: number;
  byStatus: { status: string; count: number }[];
  byDirection: { name: string; avgProgress: number }[];
  monthlyTrend: { month: string; avgProgress: number }[];
  validationPipeline: { direction: string; Brouillon: number; Soumis: number; Validé: number; Rejeté: number }[];
  byStrategicAxis: { name: string; avgProgress: number; count: number }[];
  byAcbfDomain: { name: string; count: number }[];
}

// ============================================================
// Constants
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  "Non démarré": "#94a3b8",
  "En cours": "#3b82f6",
  "Réalisé": "#10b981",
  "En retard": "#ef4444",
  "Suspendu": "#f59e0b",
  "À reprogrammer": "#8b5cf6",
  "Terminé": "#059669",
  "Annulé": "#6b7280",
};

const KPI_CATEGORIES = ["Stratégique", "Opérationnel", "Organisationnel", "Qualité"];
const KPI_UNITS = ["%", "Nombre", "Jours", "Score", "Ratio"];
const KPI_FREQUENCIES = ["Quotidien", "Hebdomadaire", "Mensuel", "Trimestriel", "Annuel"];
const KPI_DIRECTIONS_VAL = ["higher", "lower"];

// ============================================================
// Permission Helper
// ============================================================
// ============================================================
// Chart Configs
// ============================================================

const statusPieConfig: ChartConfig = {
  count: { label: "Activités" },
  "Non démarré": { label: "Non démarré", color: "#94a3b8" },
  "En cours": { label: "En cours", color: "#3b82f6" },
  "Réalisé": { label: "Réalisé", color: "#10b981" },
  "En retard": { label: "En retard", color: "#ef4444" },
  "Suspendu": { label: "Suspendu", color: "#f59e0b" },
  "À reprogrammer": { label: "À reprogrammer", color: "#8b5cf6" },
  "Terminé": { label: "Terminé", color: "#059669" },
  "Annulé": { label: "Annulé", color: "#6b7280" },
};

const directionBarConfig: ChartConfig = {
  avgProgress: { label: "Avancement %", color: "hsl(160, 60%, 45%)" },
};

const trendLineConfig: ChartConfig = {
  avgProgress: { label: "Avancement moyen %", color: "hsl(160, 60%, 45%)" },
};

const pipelineBarConfig: ChartConfig = {
  Brouillon: { label: "Brouillon", color: "#94a3b8" },
  Soumis: { label: "Soumis", color: "#f59e0b" },
  Validé: { label: "Validé", color: "#10b981" },
  Rejeté: { label: "Rejeté", color: "#ef4444" },
};

// ============================================================
// Helpers
// ============================================================

function getKpiStatusColor(kpi: KpiDefinition): string {
  const { currentValue, targetValue, direction } = kpi;
  if (targetValue === 0) return "amber";
  const ratio = direction === "higher"
    ? currentValue / targetValue
    : targetValue / currentValue;
  if (ratio >= 0.9) return "green";
  if (ratio >= 0.7) return "amber";
  return "red";
}

function getKpiTrendIcon(kpi: KpiDefinition) {
  const snapshots = kpi.snapshots || [];
  if (snapshots.length < 2) return <Minus className="h-3.5 w-3.5 text-slate-400" />;
  const lastTwo = snapshots.slice(-2);
  const diff = lastTwo[1].value - lastTwo[0].value;
  if (diff > 0) return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
  if (diff < 0) return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

function getKpiProgress(kpi: KpiDefinition): number {
  if (kpi.targetValue === 0) return 0;
  const ratio = kpi.direction === "higher"
    ? kpi.currentValue / kpi.targetValue
    : kpi.targetValue / kpi.currentValue;
  return Math.min(Math.round(ratio * 100), 100);
}

function getProgressBg(rate: number): string {
  if (rate >= 75) return "bg-emerald-500";
  if (rate >= 50) return "bg-blue-500";
  if (rate >= 25) return "bg-amber-500";
  return "bg-slate-400";
}

function getCategoryBadge(category: string) {
  const colors: Record<string, string> = {
    "Stratégique": "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
    "Opérationnel": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
    "Organisationnel": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    "Qualité": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
  };
  return (
    <Badge className={`text-[10px] border-0 ${colors[category] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
      {category}
    </Badge>
  );
}

// ============================================================
// Main Component
// ============================================================

export function PerformanceSection() {
  const { data: session } = useSession();
  const canRead = checkPermission(session?.user?.roles ?? [], "kpi:read");
  const canWrite = checkPermission(session?.user?.roles ?? [], "kpi:write");

  // Main tab state
  const [mainTab, setMainTab] = useState("dashboard");

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // KPI list state
  const [kpis, setKpis] = useState<KpiDefinition[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [axisFilter, setAxisFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [kpiStatusFilter, setKpiStatusFilter] = useState("active");
  const [refreshKey, setRefreshKey] = useState(0);

  // Dropdown options
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>([]);
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<KpiDefinition | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTargetValue, setFormTargetValue] = useState("0");
  const [formCurrentValue, setFormCurrentValue] = useState("0");
  const [formUnit, setFormUnit] = useState("");
  const [formDirection, setFormDirection] = useState("higher");
  const [formFrequency, setFormFrequency] = useState("Mensuel");
  const [formStrategicAxisId, setFormStrategicAxisId] = useState("");
  const [formDirectionId, setFormDirectionId] = useState("");

  // Snapshot form state
  const [snapshotPeriod, setSnapshotPeriod] = useState("");
  const [snapshotValue, setSnapshotValue] = useState("");
  const [snapshotNotes, setSnapshotNotes] = useState("");

  // Export state
  const [exporting, setExporting] = useState(false);

  // ============================================================
  // Fetch Dashboard
  // ============================================================

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const res = await fetch("/api/kpi/dashboard");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement du tableau de bord");
      }
      const data = await res.json();
      setDashboard(data.data);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // ============================================================
  // Fetch KPIs
  // ============================================================

  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (axisFilter) params.set("strategicAxisId", axisFilter);
      if (directionFilter) params.set("directionId", directionFilter);
      if (kpiStatusFilter) params.set("status", kpiStatusFilter);

      const res = await fetch(`/api/kpi?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des KPI");
      }
      const data = await res.json();
      setKpis(data.data || []);
    } catch (err) {
      setKpiError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setKpiLoading(false);
    }
  }, [search, categoryFilter, axisFilter, directionFilter, kpiStatusFilter]);

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
  // Effects
  // ============================================================

  useEffect(() => {
    if (canRead) fetchDashboard();
  }, [canRead, fetchDashboard, refreshKey]);

  useEffect(() => {
    if (canRead) fetchKpis();
  }, [canRead, fetchKpis, refreshKey]);

  // ============================================================
  // Form Reset Helpers
  // ============================================================

  function resetForm() {
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormCategory("");
    setFormTargetValue("0");
    setFormCurrentValue("0");
    setFormUnit("");
    setFormDirection("higher");
    setFormFrequency("Mensuel");
    setFormStrategicAxisId("");
    setFormDirectionId("");
  }

  function fillForm(kpi: KpiDefinition) {
    setFormCode(kpi.code);
    setFormName(kpi.name);
    setFormDescription(kpi.description || "");
    setFormCategory(kpi.category);
    setFormTargetValue(kpi.targetValue.toString());
    setFormCurrentValue(kpi.currentValue.toString());
    setFormUnit(kpi.unit || "");
    setFormDirection(kpi.direction);
    setFormFrequency(kpi.frequency);
    setFormStrategicAxisId(kpi.strategicAxisId || "");
    setFormDirectionId(kpi.directionId || "");
  }

  function resetSnapshotForm() {
    setSnapshotPeriod("");
    setSnapshotValue("");
    setSnapshotNotes("");
  }

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleCreate() {
    resetForm();
    setCreateDialogOpen(true);
  }

  function handleEdit(kpi: KpiDefinition) {
    fillForm(kpi);
    setSelectedKpi(kpi);
    setEditDialogOpen(true);
  }

  function handleView(kpi: KpiDefinition) {
    setSelectedKpi(kpi);
    setViewDialogOpen(true);
  }

  function handleCaptureSnapshot(kpi: KpiDefinition) {
    setSelectedKpi(kpi);
    resetSnapshotForm();
    setSnapshotValue(kpi.currentValue.toString());
    setSnapshotDialogOpen(true);
  }

  function handleArchive(kpi: KpiDefinition) {
    setSelectedKpi(kpi);
    setArchiveDialogOpen(true);
  }

  async function saveCreate() {
    if (!formCode.trim() || !formName.trim() || !formCategory) {
      toast.error("Veuillez remplir les champs obligatoires (code, nom, catégorie)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          targetValue: parseFloat(formTargetValue) || 0,
          currentValue: parseFloat(formCurrentValue) || 0,
          unit: formUnit || null,
          direction: formDirection,
          frequency: formFrequency,
          strategicAxisId: formStrategicAxisId || null,
          directionId: formDirectionId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }
      toast.success("KPI créé avec succès");
      setCreateDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!selectedKpi) return;
    if (!formCode.trim() || !formName.trim() || !formCategory) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/kpi/${selectedKpi.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          targetValue: parseFloat(formTargetValue) || 0,
          currentValue: parseFloat(formCurrentValue) || 0,
          unit: formUnit || null,
          direction: formDirection,
          frequency: formFrequency,
          strategicAxisId: formStrategicAxisId || null,
          directionId: formDirectionId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }
      toast.success("KPI mis à jour avec succès");
      setEditDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function saveSnapshot() {
    if (!selectedKpi) return;
    if (!snapshotPeriod.trim() || !snapshotValue.trim()) {
      toast.error("Veuillez remplir la période et la valeur");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/kpi/${selectedKpi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "capture-snapshot",
          period: snapshotPeriod.trim(),
          value: parseFloat(snapshotValue) || 0,
          targetValue: selectedKpi.targetValue,
          notes: snapshotNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la capture");
      }
      toast.success("Snapshot capturé avec succès");
      setSnapshotDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la capture");
    } finally {
      setSaving(false);
    }
  }

  async function saveArchive() {
    if (!selectedKpi) return;
    setSaving(true);
    try {
      const action = selectedKpi.isActive ? "archive" : "restore";
      const res = await fetch(`/api/kpi/${selectedKpi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'archivage");
      }
      toast.success(selectedKpi.isActive ? "KPI archivé" : "KPI restauré");
      setArchiveDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      const res = await fetch(`/api/kpi/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur lors de l'export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-performance-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  // ============================================================
  // Filtered KPIs
  // ============================================================

  const filteredKpis = useMemo(() => {
    return kpis;
  }, [kpis]);

  const hasActiveFilters = useMemo(() => {
    return !!(search || categoryFilter || axisFilter || directionFilter || kpiStatusFilter !== "active");
  }, [search, categoryFilter, axisFilter, directionFilter, kpiStatusFilter]);

  // ============================================================
  // Render: Loading
  // ============================================================

  if (dashboardLoading && !dashboard) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Performance &amp; KPI
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tableaux de bord et indicateurs de performance
          </p>
        </div>
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
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (dashboardError && !dashboard) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Performance &amp; KPI
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Erreur de chargement</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">{dashboardError}</p>
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
            Performance &amp; KPI
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
              <ShieldCheck className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Accès restreint</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
              Vous n&apos;avez pas la permission &quot;kpi:read&quot; nécessaire pour consulter les indicateurs de performance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Compute dashboard trend values
  // ============================================================

  const activityTrend = dashboard
    ? dashboard.totalActivities - dashboard.totalActivitiesLastMonth
    : 0;

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Performance &amp; KPI
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tableaux de bord et indicateurs de performance stratégique
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

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="kpi" className="text-xs sm:text-sm">
            <Gauge className="h-4 w-4 mr-2" />
            Indicateurs KPI
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: TABLEAU DE BORD */}
        {/* ============================================================ */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Total activités */}
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Activités
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {dashboard?.totalActivities ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                      <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {activityTrend !== 0 && (
                      <div className={`flex items-center text-[10px] font-medium ${activityTrend > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {activityTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(activityTrend)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Avancement moyen */}
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Avancement moyen
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {Math.round(dashboard?.avgProgress ?? 0)}%
                    </p>
                    <Progress value={dashboard?.avgProgress ?? 0} className="h-1.5 mt-2" />
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900 ml-2">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
                    <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                      {Math.round(dashboard?.validationRate ?? 0)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">% Validé</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                    <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
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
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {dashboard?.lateCount ?? 0}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900">
                    <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Taux RACI */}
            <Card className="border-l-4 border-l-violet-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Taux RACI
                    </p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                      {Math.round(dashboard?.raciRate ?? 0)}%
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900">
                    <Activity className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preuves vérifiées */}
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Preuves vérifiées
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {dashboard?.verifiedEvidenceCount ?? 0}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900">
                    <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid 2x2 */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Répartition par statut — Donut/Pie */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Répartition par statut</CardTitle>
                </div>
                <CardDescription className="text-xs">Distribution des activités selon leur statut</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.byStatus?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <p className="text-sm">Aucune donnée disponible</p>
                  </div>
                ) : (
                  <ChartContainer config={statusPieConfig} className="h-64 w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={dashboard?.byStatus || []}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {(dashboard?.byStatus || []).map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || "#94a3b8"}
                          />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Avancement par direction — Horizontal Bar */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Avancement par direction</CardTitle>
                </div>
                <CardDescription className="text-xs">Progression moyenne par direction</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.byDirection?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <p className="text-sm">Aucune donnée disponible</p>
                  </div>
                ) : (
                  <ChartContainer config={directionBarConfig} className="h-64 w-full">
                    <BarChart
                      data={dashboard?.byDirection || []}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value: string) =>
                          value.length > 18 ? value.slice(0, 18) + "…" : value
                        }
                      />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                      <Bar dataKey="avgProgress" fill="var(--color-avgProgress)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Tendance mensuelle — Line */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Tendance mensuelle</CardTitle>
                </div>
                <CardDescription className="text-xs">Avancement moyen sur les 6 derniers mois</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.monthlyTrend?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <p className="text-sm">Aucune donnée disponible</p>
                  </div>
                ) : (
                  <ChartContainer config={trendLineConfig} className="h-64 w-full">
                    <LineChart
                      data={dashboard?.monthlyTrend || []}
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                      <Line
                        type="monotone"
                        dataKey="avgProgress"
                        stroke="var(--color-avgProgress)"
                        strokeWidth={2}
                        dot={{ fill: "var(--color-avgProgress)", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Pipeline de validation — Stacked Bar */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Pipeline de validation</CardTitle>
                </div>
                <CardDescription className="text-xs">Statuts de validation par direction</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.validationPipeline?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <p className="text-sm">Aucune donnée disponible</p>
                  </div>
                ) : (
                  <ChartContainer config={pipelineBarConfig} className="h-64 w-full">
                    <BarChart
                      data={dashboard?.validationPipeline || []}
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="direction" tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.length > 15 ? value.slice(0, 15) + "…" : value} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="Brouillon" stackId="a" fill="var(--color-Brouillon)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Soumis" stackId="a" fill="var(--color-Soumis)" />
                      <Bar dataKey="Validé" stackId="a" fill="var(--color-Validé)" />
                      <Bar dataKey="Rejeté" stackId="a" fill="var(--color-Rejeté)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats Cards */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Par axe stratégique */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Par axe stratégique</CardTitle>
                </div>
                <CardDescription className="text-xs">Avancement par axe stratégique</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.byStrategicAxis?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">Aucune donnée</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {dashboard?.byStrategicAxis.map((axis) => (
                      <div key={axis.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate mr-2">{axis.name}</span>
                          <span className="text-xs font-medium text-slate-500 shrink-0">{Math.round(axis.avgProgress)}% ({axis.count})</span>
                        </div>
                        <Progress
                          value={axis.avgProgress}
                          className={`h-2 ${axis.avgProgress >= 75 ? "[&>div]:bg-emerald-500" : axis.avgProgress >= 50 ? "[&>div]:bg-blue-500" : axis.avgProgress >= 25 ? "[&>div]:bg-amber-500" : "[&>div]:bg-slate-400"}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Par domaine ACBF */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">Par domaine ACBF</CardTitle>
                </div>
                <CardDescription className="text-xs">Nombre d&apos;activités par domaine</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.byAcbfDomain?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <p className="text-sm">Aucune donnée</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dashboard?.byAcbfDomain.map((domain) => {
                      const maxCount = Math.max(...(dashboard?.byAcbfDomain || []).map((d) => d.count), 1);
                      const pct = Math.round((domain.count / maxCount) * 100);
                      return (
                        <div key={domain.name} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate mr-2">{domain.name}</span>
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 shrink-0">
                              {domain.count}
                            </Badge>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className={`h-full rounded-full ${getProgressBg(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Export */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
            >
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Exporter CSV
            </Button>
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
          </div>
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: INDICATEURS KPI */}
        {/* ============================================================ */}
        <TabsContent value="kpi" className="space-y-6 mt-6">
          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Row 1: Search + Create */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher par code ou nom de KPI..."
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
                  {canWrite && (
                    <Button
                      onClick={handleCreate}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau KPI
                    </Button>
                  )}
                </div>

                {/* Row 2: Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Toutes catégories</SelectItem>
                      {KPI_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
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

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setCategoryFilter("");
                        setAxisFilter("");
                        setDirectionFilter("");
                        setKpiStatusFilter("active");
                      }}
                      className="text-slate-500 hover:text-red-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Réinitialiser
                    </Button>
                  )}
                </div>

                {/* Row 3: Status tabs */}
                <Tabs value={kpiStatusFilter} onValueChange={setKpiStatusFilter}>
                  <TabsList>
                    <TabsTrigger value="active">Actifs</TabsTrigger>
                    <TabsTrigger value="archived">Archivés</TabsTrigger>
                    <TabsTrigger value="all">Tous</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards Grid */}
          {kpiLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : kpiError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-sm text-red-600 dark:text-red-400">{kpiError}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          ) : filteredKpis.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gauge className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                <h3 className="text-base font-medium text-slate-900 dark:text-white">Aucun KPI trouvé</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {hasActiveFilters
                    ? "Modifiez vos filtres pour voir plus de résultats"
                    : "Commencez par créer votre premier indicateur KPI"}
                </p>
                {canWrite && !hasActiveFilters && (
                  <Button onClick={handleCreate} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un KPI
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKpis.map((kpi) => {
                const statusColor = getKpiStatusColor(kpi);
                const progress = getKpiProgress(kpi);
                const progressColorClass =
                  statusColor === "green"
                    ? "[&>div]:bg-emerald-500"
                    : statusColor === "amber"
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-red-500";

                return (
                  <Card
                    key={kpi.id}
                    className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                      statusColor === "green"
                        ? "border-l-emerald-500"
                        : statusColor === "amber"
                        ? "border-l-amber-500"
                        : "border-l-red-500"
                    } ${!kpi.isActive ? "opacity-60" : ""}`}
                    onClick={() => handleView(kpi)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-slate-400">{kpi.code}</span>
                            {getCategoryBadge(kpi.category)}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={kpi.name}>
                            {kpi.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          {getKpiTrendIcon(kpi)}
                        </div>
                      </div>

                      {/* Gauge / Progress */}
                      <div className="mb-3">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-xl font-bold text-slate-900 dark:text-white">
                            {kpi.currentValue}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            / {kpi.targetValue} {kpi.unit || ""}
                          </span>
                        </div>
                        <Progress value={progress} className={`h-2 ${progressColorClass}`} />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-slate-400">{progress}% atteint</span>
                          <span className="text-[10px] text-slate-400">{kpi.frequency}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          {kpi.direction === "higher" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {kpi.direction === "higher" ? "Plus haut = mieux" : "Plus bas = mieux"}
                        </div>
                        <div className="flex items-center gap-1">
                          {canWrite && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCaptureSnapshot(kpi);
                                    }}
                                  >
                                    <Camera className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Capturer un snapshot</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(kpi);
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchive(kpi);
                                    }}
                                  >
                                    {kpi.isActive ? (
                                      <Archive className="h-3.5 w-3.5 text-slate-400 hover:text-red-600" />
                                    ) : (
                                      <ArchiveRestore className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{kpi.isActive ? "Archiver" : "Restaurer"}</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOGS */}
      {/* ============================================================ */}

      {/* Create KPI Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Nouvel indicateur KPI
            </DialogTitle>
            <DialogDescription>Créez un nouvel indicateur de performance</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-code">Code *</Label>
                  <Input id="create-code" placeholder="KPI-001" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-category">Catégorie *</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-name">Nom *</Label>
                <Input id="create-name" placeholder="Nom de l'indicateur" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <Textarea id="create-description" placeholder="Description de l'indicateur" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-target">Valeur cible</Label>
                  <Input id="create-target" type="number" value={formTargetValue} onChange={(e) => setFormTargetValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-current">Valeur actuelle</Label>
                  <Input id="create-current" type="number" value={formCurrentValue} onChange={(e) => setFormCurrentValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-unit">Unité</Label>
                  <Select value={formUnit} onValueChange={setFormUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unité" />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={formDirection} onValueChange={setFormDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_DIRECTIONS_VAL.map((d) => (
                        <SelectItem key={d} value={d}>{d === "higher" ? "Plus haut = mieux" : "Plus bas = mieux"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select value={formFrequency} onValueChange={setFormFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Axe stratégique</Label>
                  <Select value={formStrategicAxisId} onValueChange={setFormStrategicAxisId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction org.</Label>
                  <Select value={formDirectionId} onValueChange={setFormDirectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {directionOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveCreate} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KPI Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Modifier le KPI
            </DialogTitle>
            <DialogDescription>Modifiez les informations de l&apos;indicateur</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code *</Label>
                  <Input id="edit-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Catégorie *</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom *</Label>
                <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-target">Valeur cible</Label>
                  <Input id="edit-target" type="number" value={formTargetValue} onChange={(e) => setFormTargetValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-current">Valeur actuelle</Label>
                  <Input id="edit-current" type="number" value={formCurrentValue} onChange={(e) => setFormCurrentValue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unit">Unité</Label>
                  <Select value={formUnit} onValueChange={setFormUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={formDirection} onValueChange={setFormDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_DIRECTIONS_VAL.map((d) => (
                        <SelectItem key={d} value={d}>{d === "higher" ? "Plus haut = mieux" : "Plus bas = mieux"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select value={formFrequency} onValueChange={setFormFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KPI_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Axe stratégique</Label>
                  <Select value={formStrategicAxisId} onValueChange={setFormStrategicAxisId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Direction org.</Label>
                  <Select value={formDirectionId} onValueChange={setFormDirectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {directionOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View KPI Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Détail du KPI
            </DialogTitle>
            <DialogDescription>Informations complètes de l&apos;indicateur</DialogDescription>
          </DialogHeader>
          {selectedKpi && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 pr-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-slate-400">{selectedKpi.code}</span>
                      {getCategoryBadge(selectedKpi.category)}
                      {!selectedKpi.isActive && (
                        <Badge className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-0">
                          Archivé
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedKpi.name}</h3>
                  </div>
                </div>

                {/* Value gauge */}
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{selectedKpi.currentValue}</span>
                    <span className="text-sm text-slate-500">/ {selectedKpi.targetValue} {selectedKpi.unit || ""}</span>
                  </div>
                  <Progress
                    value={getKpiProgress(selectedKpi)}
                    className={`h-3 ${
                      getKpiStatusColor(selectedKpi) === "green"
                        ? "[&>div]:bg-emerald-500"
                        : getKpiStatusColor(selectedKpi) === "amber"
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-red-500"
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {getKpiProgress(selectedKpi)}% de l&apos;objectif atteint
                  </p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">Description</p>
                    <p className="text-slate-700 dark:text-slate-300">{selectedKpi.description || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Direction</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {selectedKpi.direction === "higher" ? "Plus haut = mieux" : "Plus bas = mieux"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Fréquence</p>
                    <p className="text-slate-700 dark:text-slate-300">{selectedKpi.frequency}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Axe stratégique</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {selectedKpi.strategicAxis
                        ? `${selectedKpi.strategicAxis.code} — ${selectedKpi.strategicAxis.name}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs">Direction org.</p>
                    <p className="text-slate-700 dark:text-slate-300">
                      {selectedKpi.orgDirection
                        ? `${selectedKpi.orgDirection.code} — ${selectedKpi.orgDirection.name}`
                        : "—"}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Snapshot History */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Historique des snapshots ({selectedKpi.snapshots?.length || 0})
                  </h4>
                  {(!selectedKpi.snapshots || selectedKpi.snapshots.length === 0) ? (
                    <p className="text-sm text-slate-400 text-center py-4">Aucun snapshot enregistré</p>
                  ) : (
                    <>
                      {/* Mini line chart */}
                      {selectedKpi.snapshots.length >= 2 && (
                        <div className="mb-4">
                          <ChartContainer
                            config={{
                              value: { label: "Valeur", color: "hsl(160, 60%, 45%)" },
                              targetValue: { label: "Cible", color: "hsl(0, 0%, 70%)" },
                            }}
                            className="h-32 w-full"
                          >
                            <LineChart data={selectedKpi.snapshots} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="targetValue" stroke="var(--color-targetValue)" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                            </LineChart>
                          </ChartContainer>
                        </div>
                      )}

                      {/* Table */}
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-slate-500">Période</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Valeur</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Cible</th>
                              <th className="px-3 py-2 text-right font-medium text-slate-500">Delta</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedKpi.snapshots.slice().reverse().slice(0, 10).map((snap) => {
                              const delta = snap.value - snap.targetValue;
                              return (
                                <tr key={snap.id} className="border-t border-slate-100 dark:border-slate-800">
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{snap.period}</td>
                                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{snap.value}</td>
                                  <td className="px-3 py-2 text-right text-slate-500">{snap.targetValue}</td>
                                  <td className={`px-3 py-2 text-right font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Fermer</Button>
            {selectedKpi && canWrite && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  handleCaptureSnapshot(selectedKpi);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capturer snapshot
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Snapshot Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              Capturer un snapshot
            </DialogTitle>
            <DialogDescription>
              Enregistrer la valeur du KPI pour une période donnée
              {selectedKpi && (
                <span className="block mt-1 font-medium text-slate-700 dark:text-slate-300">
                  {selectedKpi.code} — {selectedKpi.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-period">Période *</Label>
              <Input
                id="snapshot-period"
                placeholder="2026-03 ou 2026-Q1"
                value={snapshotPeriod}
                onChange={(e) => setSnapshotPeriod(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">Format : YYYY-MM pour mensuel, YYYY-QN pour trimestriel, YYYY pour annuel</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-value">Valeur *</Label>
              <Input
                id="snapshot-value"
                type="number"
                placeholder="Valeur mesurée"
                value={snapshotValue}
                onChange={(e) => setSnapshotValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snapshot-notes">Notes</Label>
              <Textarea
                id="snapshot-notes"
                placeholder="Commentaires ou observations..."
                value={snapshotNotes}
                onChange={(e) => setSnapshotNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveSnapshot} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Capturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive/Restore AlertDialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedKpi?.isActive ? "Archiver le KPI" : "Restaurer le KPI"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedKpi?.isActive
                ? `Voulez-vous archiver l'indicateur "${selectedKpi?.name}" ? Il ne sera plus visible dans les listes actives.`
                : `Voulez-vous restaurer l'indicateur "${selectedKpi?.name}" ? Il sera de nouveau visible dans les listes actives.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveArchive}
              disabled={saving}
              className={selectedKpi?.isActive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedKpi?.isActive ? "Archiver" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
