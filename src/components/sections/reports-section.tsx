"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileText,
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
  ShieldCheck,
  Clock,
  BarChart3,
  Play,
  CheckCircle2,
  XCircle,
  LayoutTemplate,
  TrendingUp,
  Calendar,
  Hash,
  Filter,
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

interface AcbfDomainOption {
  id: string;
  code: string;
  name: string;
}

interface ReportTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  category: string;
  periodFormat: string;
  sections: string | null;
  filters: string | null;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string; email: string } | null;
  _count?: { reports: number };
}

interface Report {
  id: string;
  templateId: string;
  title: string;
  period: string;
  status: string;
  type: string;
  data: string | null;
  summary: string | null;
  generatedAt: string | null;
  validatedAt: string | null;
  validatedById: string | null;
  generatedById: string | null;
  directionId: string | null;
  strategicAxisId: string | null;
  acbfDomainId: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; code: string; name: string; type: string };
  generatedBy?: { name: string; email: string } | null;
  validatedBy?: { name: string; email: string } | null;
  direction?: { id: string; code: string; name: string } | null;
  strategicAxis?: { id: string; code: string; name: string } | null;
  acbfDomain?: { id: string; code: string; name: string } | null;
}

interface ReportStats {
  totalTemplates: number;
  totalReports: number;
  generatedReports: number;
  validatedReports: number;
  rejectedReports: number;
  draftReports: number;
  archivedReports: number;
  lastGeneration: string | null;
  pendingValidation: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  recentReports: {
    id: string;
    title: string;
    period: string;
    status: string;
    generatedAt: string | null;
    templateName: string;
  }[];
}

// ============================================================
// Constants
// ============================================================

const TEMPLATE_TYPES = [
  "Mensuel",
  "Trimestriel",
  "Annuel",
  "ACBF",
  "Par axe",
  "Par direction",
  "Personnalisé",
];

const TEMPLATE_CATEGORIES = [
  "Général",
  "Stratégique",
  "Opérationnel",
  "ACBF",
  "Finance",
];

const PERIOD_FORMATS = ["YYYY-MM", "YYYY-QN", "YYYY", "custom"];

const REPORT_STATUSES = [
  "Brouillon",
  "Généré",
  "Validé",
  "Rejeté",
  "Archivé",
] as const;

const STATUS_BADGE_COLORS: Record<string, string> = {
  Brouillon:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Généré: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  Validé:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  Rejeté: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  Archivé:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

const TYPE_COLORS: Record<string, string> = {
  Mensuel: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  Trimestriel:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  Annuel:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  ACBF: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  "Par axe":
    "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  "Par direction":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400",
  Personnalisé:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// ============================================================
// Permission Helper
// ============================================================

function hasPermission(
  roles: Array<{ permissions: string[] }>,
  permission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === permission || p === "reports:*" || p === "admin:*"
    )
  );
}

// ============================================================
// Date formatting
// ============================================================

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ============================================================
// Report Data Renderer
// ============================================================

function renderReportData(jsonStr: string | null): React.ReactNode {
  if (!jsonStr) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucune donnée disponible
      </p>
    );
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return (
      <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
        {jsonStr}
      </pre>
    );
  }

  const sections: React.ReactNode[] = [];

  // Summary statistics
  const summaryKeys = [
    "totalActivities",
    "activeActivities",
    "avgProgress",
    "overdueCount",
    "startingThisMonth",
    "highRiskCount",
    "totalEvidence",
    "verifiedEvidence",
  ];
  const hasSummary = summaryKeys.some((k) => k in data);
  if (hasSummary) {
    sections.push(
      <div key="summary" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          Statistiques résumées
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryKeys
            .filter((k) => k in data)
            .map((k) => (
              <div
                key={k}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {k === "totalActivities"
                    ? "Total activités"
                    : k === "activeActivities"
                    ? "Actives"
                    : k === "avgProgress"
                    ? "Avancement moyen"
                    : k === "overdueCount"
                    ? "En retard"
                    : k === "startingThisMonth"
                    ? "Début ce mois"
                    : k === "highRiskCount"
                    ? "Risques élevés"
                    : k === "totalEvidence"
                    ? "Total preuves"
                    : k === "verifiedEvidence"
                    ? "Preuves vérifiées"
                    : k}
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {k === "avgProgress"
                    ? `${Math.round(Number(data[k]))}%`
                    : String(data[k])}
                </p>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Breakdown by status
  const byStatus = data.byStatus as
    | Array<{ status: string; count: number }> | undefined;
  if (byStatus && Array.isArray(byStatus) && byStatus.length > 0) {
    const maxCount = Math.max(...byStatus.map((s) => s.count), 1);
    sections.push(
      <div key="byStatus" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          Répartition par statut
        </h4>
        <div className="space-y-2">
          {byStatus.map((s) => (
            <div key={s.status} className="flex items-center gap-3">
              <span className="text-xs w-28 text-muted-foreground truncate">
                {s.status}
              </span>
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${Math.round((s.count / maxCount) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-slate-900 dark:text-white w-8 text-right">
                {s.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Breakdown by direction
  const byDirection = data.byDirection as
    | Array<{ name: string; count: number; avgProgress: number }> | undefined;
  if (byDirection && Array.isArray(byDirection) && byDirection.length > 0) {
    sections.push(
      <div key="byDirection" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Répartition par direction
        </h4>
        <div className="space-y-2">
          {byDirection.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-2"
            >
              <span className="text-xs w-32 text-muted-foreground truncate">
                {d.name}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <Progress value={d.avgProgress} className="h-2 flex-1" />
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {Math.round(d.avgProgress)}%
                </span>
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              >
                {d.count}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Breakdown by strategic axis
  const byAxis = data.byStrategicAxis as
    | Array<{ name: string; count: number; avgProgress: number }> | undefined;
  if (byAxis && Array.isArray(byAxis) && byAxis.length > 0) {
    sections.push(
      <div key="byAxis" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Répartition par axe stratégique
        </h4>
        <div className="space-y-2">
          {byAxis.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-2"
            >
              <span className="text-xs w-32 text-muted-foreground truncate">
                {a.name}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <Progress value={a.avgProgress} className="h-2 flex-1" />
                <span className="text-[10px] text-muted-foreground w-10 text-right">
                  {Math.round(a.avgProgress)}%
                </span>
              </div>
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              >
                {a.count}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Evidence & RACI stats
  const evidenceKeys = [
    "totalEvidence",
    "verifiedEvidence",
    "evidenceByCategory",
  ];
  const hasEvidence = evidenceKeys.some((k) => k in data);
  if (hasEvidence) {
    sections.push(
      <div key="evidence" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Preuves &amp; RACI
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {evidenceKeys
            .filter((k) => k in data)
            .map((k) => (
              <div
                key={k}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {k === "totalEvidence"
                    ? "Total preuves"
                    : k === "verifiedEvidence"
                    ? "Vérifiées"
                    : "Par catégorie"}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                  {typeof data[k] === "object"
                    ? JSON.stringify(data[k], null, 2)
                    : String(data[k])}
                </p>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // KPI achievement rates
  const kpiData = data.kpiAchievement as
    | Array<{ name: string; rate: number }> | undefined;
  if (kpiData && Array.isArray(kpiData) && kpiData.length > 0) {
    sections.push(
      <div key="kpi" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Taux de réalisation des KPI
        </h4>
        <div className="space-y-2">
          {kpiData.map((k) => (
            <div key={k.name} className="flex items-center gap-3">
              <span className="text-xs w-32 text-muted-foreground truncate">
                {k.name}
              </span>
              <Progress value={k.rate} className="h-2 flex-1" />
              <span className="text-xs font-medium text-slate-900 dark:text-white w-10 text-right">
                {Math.round(k.rate)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback: show raw JSON if no recognized sections
  if (sections.length === 0) {
    return (
      <ScrollArea className="max-h-96">
        <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </ScrollArea>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <div key={i}>{s}</div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ReportsSection() {
  const { data: session } = useSession();
  const canRead = hasPermission(session?.user?.roles ?? [], "reports:read");
  const canCreate = hasPermission(
    session?.user?.roles ?? [],
    "reports:create"
  );
  const canValidate = hasPermission(
    session?.user?.roles ?? [],
    "reports:validate"
  );

  // Main tab state
  const [mainTab, setMainTab] = useState("templates");

  // Refresh key
  const [refreshKey, setRefreshKey] = useState(0);

  // Template state
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateTypeFilter, setTemplateTypeFilter] = useState("");
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState("");

  // Reports state
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("Tous");
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [reportPeriodFilter, setReportPeriodFilter] = useState("");
  const [reportDirectionFilter, setReportDirectionFilter] = useState("");

  // Stats state
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Dropdown options
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>(
    []
  );
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);
  const [acbfDomainOptions, setAcbfDomainOptions] = useState<
    AcbfDomainOption[]
  >([]);

  // Dialog states
  const [createTemplateDialogOpen, setCreateTemplateDialogOpen] =
    useState(false);
  const [editTemplateDialogOpen, setEditTemplateDialogOpen] = useState(false);
  const [viewTemplateDialogOpen, setViewTemplateDialogOpen] = useState(false);
  const [generateReportDialogOpen, setGenerateReportDialogOpen] =
    useState(false);
  const [viewReportDialogOpen, setViewReportDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    name: string;
    isActive: boolean;
    type: "template" | "report";
  } | null>(null);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ReportTemplate | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [saving, setSaving] = useState(false);

  // Template form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("");
  const [formCategory, setFormCategory] = useState("Général");
  const [formPeriodFormat, setFormPeriodFormat] = useState("YYYY-MM");
  const [formSections, setFormSections] = useState("");
  const [formFilters, setFormFilters] = useState("");

  // Generate report form state
  const [genPeriod, setGenPeriod] = useState("");
  const [genDirectionId, setGenDirectionId] = useState("");
  const [genStrategicAxisId, setGenStrategicAxisId] = useState("");
  const [genAcbfDomainId, setGenAcbfDomainId] = useState("");

  // View template: related reports
  const [templateReports, setTemplateReports] = useState<Report[]>([]);
  const [templateReportsLoading, setTemplateReportsLoading] = useState(false);

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
          setDirectionOptions(
            (data.data || []).map((d: DirectionOption) => ({
              id: d.id,
              code: d.code,
              name: d.name,
            }))
          );
        }
        if (axesRes.ok) {
          const data = await axesRes.json();
          setAxisOptions(
            (data.data || []).map((a: AxisOption) => ({
              id: a.id,
              code: a.code,
              name: a.name,
            }))
          );
        }
        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setAcbfDomainOptions(
            (data.data || []).map((d: AcbfDomainOption) => ({
              id: d.id,
              code: d.code,
              name: d.name,
            }))
          );
        }
      } catch {
        // Silently fail
      }
    }
    fetchOptions();
  }, []);

  // ============================================================
  // Fetch Templates
  // ============================================================

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const params = new URLSearchParams();
      params.set("mode", "templates");
      if (templateSearch) params.set("search", templateSearch);
      if (templateTypeFilter) params.set("type", templateTypeFilter);
      if (templateCategoryFilter)
        params.set("category", templateCategoryFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Erreur lors du chargement des modèles"
        );
      }
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (err) {
      setTemplatesError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setTemplatesLoading(false);
    }
  }, [templateSearch, templateTypeFilter, templateCategoryFilter]);

  // ============================================================
  // Fetch Reports
  // ============================================================

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const params = new URLSearchParams();
      params.set("mode", "reports");
      if (reportSearch) params.set("search", reportSearch);
      if (reportStatusFilter && reportStatusFilter !== "Tous")
        params.set("status", reportStatusFilter);
      if (reportTypeFilter) params.set("type", reportTypeFilter);
      if (reportPeriodFilter) params.set("period", reportPeriodFilter);
      if (reportDirectionFilter) params.set("directionId", reportDirectionFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Erreur lors du chargement des rapports"
        );
      }
      const data = await res.json();
      setReports(data.data || []);
    } catch (err) {
      setReportsError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setReportsLoading(false);
    }
  }, [
    reportSearch,
    reportStatusFilter,
    reportTypeFilter,
    reportPeriodFilter,
    reportDirectionFilter,
  ]);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/reports/stats");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Erreur lors du chargement des statistiques"
        );
      }
      const data = await res.json();
      setStats(data.data || data);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============================================================
  // Effects
  // ============================================================

  useEffect(() => {
    if (canRead) fetchTemplates();
  }, [canRead, fetchTemplates, refreshKey]);

  useEffect(() => {
    if (canRead) fetchReports();
  }, [canRead, fetchReports, refreshKey]);

  useEffect(() => {
    if (canRead) fetchStats();
  }, [canRead, fetchStats, refreshKey]);

  // ============================================================
  // Form Reset Helpers
  // ============================================================

  function resetTemplateForm() {
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormType("");
    setFormCategory("Général");
    setFormPeriodFormat("YYYY-MM");
    setFormSections("");
    setFormFilters("");
  }

  function fillTemplateForm(t: ReportTemplate) {
    setFormCode(t.code);
    setFormName(t.name);
    setFormDescription(t.description || "");
    setFormType(t.type);
    setFormCategory(t.category);
    setFormPeriodFormat(t.periodFormat);
    setFormSections(t.sections || "");
    setFormFilters(t.filters || "");
  }

  function resetGenerateForm() {
    setGenPeriod("");
    setGenDirectionId("");
    setGenStrategicAxisId("");
    setGenAcbfDomainId("");
  }

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleCreateTemplate() {
    resetTemplateForm();
    setCreateTemplateDialogOpen(true);
  }

  function handleEditTemplate(t: ReportTemplate) {
    fillTemplateForm(t);
    setSelectedTemplate(t);
    setEditTemplateDialogOpen(true);
  }

  async function handleViewTemplate(t: ReportTemplate) {
    setSelectedTemplate(t);
    setViewTemplateDialogOpen(true);
    setTemplateReportsLoading(true);
    try {
      const res = await fetch(`/api/reports/${t.id}?mode=template-reports`);
      if (res.ok) {
        const data = await res.json();
        setTemplateReports(data.data || []);
      } else {
        setTemplateReports([]);
      }
    } catch {
      setTemplateReports([]);
    } finally {
      setTemplateReportsLoading(false);
    }
  }

  function handleGenerateReport(t: ReportTemplate) {
    setSelectedTemplate(t);
    resetGenerateForm();
    setGenerateReportDialogOpen(true);
  }

  function handleViewReport(r: Report) {
    setSelectedReport(r);
    setViewReportDialogOpen(true);
  }

  function handleArchive(
    id: string,
    name: string,
    isActive: boolean,
    type: "template" | "report"
  ) {
    setArchiveTarget({ id, name, isActive, type });
    setArchiveDialogOpen(true);
  }

  async function saveCreateTemplate() {
    if (!formCode.trim() || !formName.trim() || !formType) {
      toast.error(
        "Veuillez remplir les champs obligatoires (code, nom, type)"
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "template",
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim() || null,
          type: formType,
          category: formCategory,
          periodFormat: formPeriodFormat,
          sections: formSections.trim() || null,
          filters: formFilters.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }
      toast.success("Modèle créé avec succès");
      setCreateTemplateDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la création"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEditTemplate() {
    if (!selectedTemplate) return;
    if (!formCode.trim() || !formName.trim() || !formType) {
      toast.error("Veuillez remplir les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/reports/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "template",
          code: formCode.trim(),
          name: formName.trim(),
          description: formDescription.trim() || null,
          type: formType,
          category: formCategory,
          periodFormat: formPeriodFormat,
          sections: formSections.trim() || null,
          filters: formFilters.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }
      toast.success("Modèle mis à jour avec succès");
      setEditTemplateDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveGenerateReport() {
    if (!selectedTemplate) return;
    if (!genPeriod.trim()) {
      toast.error("Veuillez spécifier une période");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "report",
          templateId: selectedTemplate.id,
          period: genPeriod.trim(),
          directionId: genDirectionId || null,
          strategicAxisId: genStrategicAxisId || null,
          acbfDomainId: genAcbfDomainId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la génération");
      }
      toast.success("Rapport généré avec succès");
      setGenerateReportDialogOpen(false);
      setMainTab("reports");
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la génération"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveArchive() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      const action = archiveTarget.isActive ? "archive" : "restore";
      const res = await fetch(`/api/reports/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          mode: archiveTarget.type,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'archivage");
      }
      toast.success(
        archiveTarget.isActive
          ? archiveTarget.type === "template"
            ? "Modèle archivé"
            : "Rapport archivé"
          : archiveTarget.type === "template"
          ? "Modèle restauré"
          : "Rapport restauré"
      );
      setArchiveDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleValidateReport(reportId: string, action: "validate" | "reject") {
    setSaving(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, mode: "report" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'action");
      }
      toast.success(
        action === "validate"
          ? "Rapport validé avec succès"
          : "Rapport rejeté"
      );
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // Filtered data
  // ============================================================

  const filteredTemplates = useMemo(() => {
    return templates;
  }, [templates]);

  const filteredReports = useMemo(() => {
    return reports;
  }, [reports]);

  // Template KPI cards data
  const templateKpis = useMemo(() => {
    const activeTemplates = templates.filter((t) => t.isActive);
    const allReports = reports;
    const generated = allReports.filter(
      (r) => r.status === "Généré" || r.status === "Validé" || r.status === "Brouillon"
    );
    const lastGen = allReports
      .filter((r) => r.generatedAt)
      .sort(
        (a, b) =>
          new Date(b.generatedAt!).getTime() -
          new Date(a.generatedAt!).getTime()
      )[0];
    const pendingVal = allReports.filter((r) => r.status === "Généré").length;

    return {
      totalTemplates: activeTemplates.length,
      totalReportsGenerated: generated.length,
      lastGeneration: lastGen?.generatedAt || null,
      pendingValidation: pendingVal,
    };
  }, [templates, reports]);

  // ============================================================
  // Render: Loading
  // ============================================================

  if (templatesLoading && !templates.length) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Reporting automatique
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Générer et gérer les rapports de pilotage AAEA
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
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
            Reporting automatique
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
              Vous n&apos;avez pas la permission &quot;reports:read&quot;
              nécessaire pour consulter les rapports.
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
            Reporting automatique
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Générer et gérer les rapports de pilotage AAEA
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
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="templates" className="text-xs sm:text-sm">
            <LayoutTemplate className="h-4 w-4 mr-1.5" />
            Modèles
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">
            <FileText className="h-4 w-4 mr-1.5" />
            Rapports générés
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Statistiques
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: MODÈLES (TEMPLATES) */}
        {/* ============================================================ */}
        <TabsContent value="templates" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Total modèles
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {templateKpis.totalTemplates}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                    <LayoutTemplate className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Rapports générés
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {templateKpis.totalReportsGenerated}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-teal-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Dernière génération
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {templateKpis.lastGeneration
                        ? formatDate(templateKpis.lastGeneration)
                        : "—"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                    <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      En attente validation
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {templateKpis.pendingValidation}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un modèle..."
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={templateTypeFilter}
                  onValueChange={(v) =>
                    setTemplateTypeFilter(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les types</SelectItem>
                    {TEMPLATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={templateCategoryFilter}
                  onValueChange={(v) =>
                    setTemplateCategoryFilter(v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      Toutes les catégories
                    </SelectItem>
                    {TEMPLATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {canCreate && (
                  <Button
                    onClick={handleCreateTemplate}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau modèle
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Templates Data Table */}
          {templatesError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Erreur de chargement
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
                  {templatesError}
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
          ) : filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <LayoutTemplate className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Aucun modèle trouvé
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Créez votre premier modèle de rapport
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Code
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Nom
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Type
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Catégorie
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Format période
                            </th>
                            <th className="text-center p-3 font-medium text-muted-foreground">
                              Nb rapports
                            </th>
                            <th className="text-center p-3 font-medium text-muted-foreground">
                              Système
                            </th>
                            <th className="text-right p-3 font-medium text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTemplates.map((t) => (
                            <tr
                              key={t.id}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="p-3">
                                <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                  {t.code}
                                </span>
                              </td>
                              <td className="p-3 font-medium text-slate-900 dark:text-white max-w-[200px] truncate">
                                {t.name}
                              </td>
                              <td className="p-3">
                                <Badge
                                  className={`text-[10px] border-0 ${
                                    TYPE_COLORS[t.type] || ""
                                  }`}
                                >
                                  {t.type}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary" className="text-[10px]">
                                  {t.category}
                                </Badge>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {t.periodFormat}
                              </td>
                              <td className="p-3 text-center">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {t._count?.reports ?? 0}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                {t.isSystem ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-slate-300 dark:text-slate-600 mx-auto" />
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleViewTemplate(t)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Voir</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEditTemplate(t)}
                                        disabled={t.isSystem && !canCreate}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Modifier</TooltipContent>
                                  </Tooltip>
                                  {canCreate && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                          onClick={() =>
                                            handleGenerateReport(t)
                                          }
                                        >
                                          <Play className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Générer un rapport
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!t.isSystem && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() =>
                                            handleArchive(
                                              t.id,
                                              t.name,
                                              t.isActive,
                                              "template"
                                            )
                                          }
                                        >
                                          {t.isActive ? (
                                            <Archive className="h-4 w-4" />
                                          ) : (
                                            <ArchiveRestore className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t.isActive ? "Archiver" : "Restaurer"}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredTemplates.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            {t.code}
                          </p>
                          <p className="font-medium text-slate-900 dark:text-white mt-1 truncate">
                            {t.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge
                              className={`text-[10px] border-0 ${
                                TYPE_COLORS[t.type] || ""
                              }`}
                            >
                              {t.type}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {t.category}
                            </Badge>
                            {t.isSystem && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                                Système
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewTemplate(t)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              onClick={() => handleGenerateReport(t)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: RAPPORTS GÉNÉRÉS */}
        {/* ============================================================ */}
        <TabsContent value="reports" className="space-y-6 mt-6">
          {/* Filter Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un rapport..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={reportTypeFilter}
                    onValueChange={(v) =>
                      setReportTypeFilter(v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tous les types</SelectItem>
                      {TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Période (ex: 2026-01)"
                    value={reportPeriodFilter}
                    onChange={(e) => setReportPeriodFilter(e.target.value)}
                    className="w-full sm:w-40"
                  />
                  <Select
                    value={reportDirectionFilter}
                    onValueChange={(v) =>
                      setReportDirectionFilter(v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">
                        Toutes les directions
                      </SelectItem>
                      {directionOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Status Tabs */}
                <div className="flex flex-wrap gap-2">
                  {["Tous", ...REPORT_STATUSES].map((s) => (
                    <Button
                      key={s}
                      variant={reportStatusFilter === s ? "default" : "outline"}
                      size="sm"
                      className={
                        reportStatusFilter === s
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : ""
                      }
                      onClick={() => setReportStatusFilter(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reports Data */}
          {reportsError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Erreur de chargement
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
                  {reportsError}
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
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                  <FileText className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Aucun rapport trouvé
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Générez votre premier rapport à partir d&apos;un modèle
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Titre
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Modèle
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Période
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Type
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Statut
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Généré par
                            </th>
                            <th className="text-left p-3 font-medium text-muted-foreground">
                              Généré le
                            </th>
                            <th className="text-right p-3 font-medium text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReports.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="p-3 font-medium text-slate-900 dark:text-white max-w-[200px] truncate">
                                {r.title}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground max-w-[150px] truncate">
                                {r.template?.name || "—"}
                              </td>
                              <td className="p-3">
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {r.period}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge
                                  className={`text-[10px] border-0 ${
                                    TYPE_COLORS[r.type] || ""
                                  }`}
                                >
                                  {r.type}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge
                                  className={`text-[10px] border-0 ${
                                    STATUS_BADGE_COLORS[r.status] || ""
                                  }`}
                                >
                                  {r.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {r.generatedBy?.name || "—"}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {formatDate(r.generatedAt)}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleViewReport(r)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Voir</TooltipContent>
                                  </Tooltip>
                                  {canValidate && r.status === "Généré" && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                            onClick={() =>
                                              handleValidateReport(
                                                r.id,
                                                "validate"
                                              )
                                            }
                                          >
                                            <CheckCircle2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Valider
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 hover:text-red-700"
                                            onClick={() =>
                                              handleValidateReport(
                                                r.id,
                                                "reject"
                                              )
                                            }
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Rejeter</TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          handleArchive(
                                            r.id,
                                            r.title,
                                            r.isActive,
                                            "report"
                                          )
                                        }
                                      >
                                        {r.isActive ? (
                                          <Archive className="h-4 w-4" />
                                        ) : (
                                          <ArchiveRestore className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {r.isActive ? "Archiver" : "Restaurer"}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {filteredReports.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {r.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.template?.name || "—"} • {r.period}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge
                              className={`text-[10px] border-0 ${
                                STATUS_BADGE_COLORS[r.status] || ""
                              }`}
                            >
                              {r.status}
                            </Badge>
                            <Badge
                              className={`text-[10px] border-0 ${
                                TYPE_COLORS[r.type] || ""
                              }`}
                            >
                              {r.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewReport(r)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canValidate && r.status === "Généré" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600"
                              onClick={() =>
                                handleValidateReport(r.id, "validate")
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>
                          Par {r.generatedBy?.name || "—"}
                        </span>
                        <span>•</span>
                        <span>{formatDate(r.generatedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: STATISTIQUES */}
        {/* ============================================================ */}
        <TabsContent value="stats" className="space-y-6 mt-6">
          {statsError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Erreur de chargement
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
                  {statsError}
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
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-emerald-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Total modèles
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {statsLoading ? (
                            <Skeleton className="h-7 w-10 inline-block" />
                          ) : (
                            stats?.totalTemplates ?? 0
                          )}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                        <LayoutTemplate className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Total rapports
                        </p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                          {statsLoading ? (
                            <Skeleton className="h-7 w-10 inline-block" />
                          ) : (
                            stats?.totalReports ?? 0
                          )}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-teal-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Validés
                        </p>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                          {statsLoading ? (
                            <Skeleton className="h-7 w-10 inline-block" />
                          ) : (
                            stats?.validatedReports ?? 0
                          )}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                        <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          En attente
                        </p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                          {statsLoading ? (
                            <Skeleton className="h-7 w-10 inline-block" />
                          ) : (
                            stats?.pendingValidation ?? 0
                          )}
                        </p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900">
                        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Distribution Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Distribution by status */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <CardTitle className="text-base">
                        Distribution par statut
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Répartition des rapports selon leur statut
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-6 w-full" />
                        ))}
                      </div>
                    ) : (stats?.byStatus?.length ?? 0) === 0 ? (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        <p className="text-sm">Aucune donnée disponible</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(stats?.byStatus || []).map((s) => {
                          const maxCount = Math.max(
                            ...(stats?.byStatus || []).map((x) => x.count),
                            1
                          );
                          return (
                            <div key={s.status} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {s.status}
                                </span>
                                <span className="text-xs font-medium text-slate-900 dark:text-white">
                                  {s.count}
                                </span>
                              </div>
                              <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    s.status === "Validé"
                                      ? "bg-emerald-500"
                                      : s.status === "Généré"
                                      ? "bg-blue-500"
                                      : s.status === "Brouillon"
                                      ? "bg-slate-400"
                                      : s.status === "Rejeté"
                                      ? "bg-red-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{
                                    width: `${Math.round(
                                      (s.count / maxCount) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Distribution by type */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <CardTitle className="text-base">
                        Distribution par type
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Répartition des rapports selon leur type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-6 w-full" />
                        ))}
                      </div>
                    ) : (stats?.byType?.length ?? 0) === 0 ? (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        <p className="text-sm">Aucune donnée disponible</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(stats?.byType || []).map((t) => {
                          const maxCount = Math.max(
                            ...(stats?.byType || []).map((x) => x.count),
                            1
                          );
                          return (
                            <div key={t.type} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {t.type}
                                </span>
                                <span className="text-xs font-medium text-slate-900 dark:text-white">
                                  {t.count}
                                </span>
                              </div>
                              <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    TYPE_COLORS[t.type]
                                      ? TYPE_COLORS[t.type].split(" ")[0]
                                      : "bg-emerald-500"
                                  }`}
                                  style={{
                                    width: `${Math.round(
                                      (t.count / maxCount) * 100
                                    )}%`,
                                  }}
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

              {/* Recent Reports Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle className="text-base">
                      Rapports récents
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Derniers rapports générés
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (stats?.recentReports?.length ?? 0) === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <p className="text-sm">Aucun rapport récent</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-80">
                      <div className="space-y-3">
                        {(stats?.recentReports || []).map((r, i) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {r.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {r.templateName} • {r.period}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                className={`text-[10px] border-0 ${
                                  STATUS_BADGE_COLORS[r.status] || ""
                                }`}
                              >
                                {r.status}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateTime(r.generatedAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* DIALOGS */}
      {/* ============================================================ */}

      {/* Create Template Dialog */}
      <Dialog
        open={createTemplateDialogOpen}
        onOpenChange={setCreateTemplateDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Nouveau modèle de rapport
            </DialogTitle>
            <DialogDescription>
              Créez un modèle pour générer des rapports automatiquement
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-code">Code *</Label>
                  <Input
                    id="create-code"
                    placeholder="RAPP-MENS-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">Nom *</Label>
                  <Input
                    id="create-name"
                    placeholder="Rapport mensuel"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  placeholder="Description du modèle..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={formCategory}
                    onValueChange={setFormCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format période</Label>
                  <Select
                    value={formPeriodFormat}
                    onValueChange={setFormPeriodFormat}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_FORMATS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-sections">Sections (JSON)</Label>
                <Textarea
                  id="create-sections"
                  placeholder='{"sections": ["summary", "byDirection", "byStatus"]}'
                  value={formSections}
                  onChange={(e) => setFormSections(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-filters">Filtres par défaut (JSON)</Label>
                <Textarea
                  id="create-filters"
                  placeholder='{"directionId": null, "strategicAxisId": null}'
                  value={formFilters}
                  onChange={(e) => setFormFilters(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateTemplateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveCreateTemplate}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog
        open={editTemplateDialogOpen}
        onOpenChange={setEditTemplateDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier le modèle
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du modèle de rapport
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code *</Label>
                  <Input
                    id="edit-code"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nom *</Label>
                  <Input
                    id="edit-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={formCategory}
                    onValueChange={setFormCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format période</Label>
                  <Select
                    value={formPeriodFormat}
                    onValueChange={setFormPeriodFormat}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_FORMATS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sections">Sections (JSON)</Label>
                <Textarea
                  id="edit-sections"
                  value={formSections}
                  onChange={(e) => setFormSections(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-filters">Filtres par défaut (JSON)</Label>
                <Textarea
                  id="edit-filters"
                  value={formFilters}
                  onChange={(e) => setFormFilters(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTemplateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveEditTemplate}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog
        open={viewTemplateDialogOpen}
        onOpenChange={setViewTemplateDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Détails du modèle
            </DialogTitle>
            <DialogDescription>
              Informations du modèle de rapport
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Code</Label>
                    <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                      {selectedTemplate.code}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nom</Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                      {selectedTemplate.name}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Description
                  </Label>
                  <p className="text-sm text-slate-900 dark:text-white mt-1">
                    {selectedTemplate.description || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <div className="mt-1">
                      <Badge
                        className={`text-[10px] border-0 ${
                          TYPE_COLORS[selectedTemplate.type] || ""
                        }`}
                      >
                        {selectedTemplate.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Catégorie
                    </Label>
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {selectedTemplate.category}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Format période
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {selectedTemplate.periodFormat}
                    </p>
                  </div>
                </div>
                {selectedTemplate.sections && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Sections
                    </Label>
                    <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                      {selectedTemplate.sections}
                    </pre>
                  </div>
                )}
                {selectedTemplate.filters && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Filtres
                    </Label>
                    <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                      {selectedTemplate.filters}
                    </pre>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Créé par
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {selectedTemplate.createdBy?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Créé le
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDate(selectedTemplate.createdAt)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Related Reports */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Rapports générés ({templateReports.length})
                  </Label>
                  {templateReportsLoading ? (
                    <div className="space-y-2 mt-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : templateReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Aucun rapport généré à partir de ce modèle
                    </p>
                  ) : (
                    <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                      {templateReports.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg p-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {r.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {r.period} • {formatDate(r.generatedAt)}
                            </p>
                          </div>
                          <Badge
                            className={`text-[10px] border-0 ml-2 ${
                              STATUS_BADGE_COLORS[r.status] || ""
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewTemplateDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog
        open={generateReportDialogOpen}
        onOpenChange={setGenerateReportDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-emerald-600" />
              Générer un rapport
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? `À partir du modèle "${selectedTemplate.name}"`
                : "Sélectionnez les paramètres de génération"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gen-period">Période *</Label>
              <Input
                id="gen-period"
                placeholder={
                  selectedTemplate?.periodFormat === "YYYY-QN"
                    ? "2026-Q1"
                    : selectedTemplate?.periodFormat === "YYYY"
                    ? "2026"
                    : "2026-01"
                }
                value={genPeriod}
                onChange={(e) => setGenPeriod(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Format attendu : {selectedTemplate?.periodFormat || "YYYY-MM"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Direction (optionnel)</Label>
              <Select
                value={genDirectionId}
                onValueChange={(v) =>
                  setGenDirectionId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    Toutes les directions
                  </SelectItem>
                  {directionOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Axe stratégique (optionnel)</Label>
              <Select
                value={genStrategicAxisId}
                onValueChange={(v) =>
                  setGenStrategicAxisId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les axes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tous les axes</SelectItem>
                  {axisOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Domaine ACBF (optionnel)</Label>
              <Select
                value={genAcbfDomainId}
                onValueChange={(v) =>
                  setGenAcbfDomainId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les domaines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tous les domaines</SelectItem>
                  {acbfDomainOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateReportDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={saveGenerateReport}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Report Dialog */}
      <Dialog
        open={viewReportDialogOpen}
        onOpenChange={setViewReportDialogOpen}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Détails du rapport
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.title || "Détails du rapport"}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <ScrollArea className="max-h-[75vh]">
              <div className="space-y-4 p-1">
                {/* Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Modèle
                    </Label>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                      {selectedReport.template?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Période
                    </Label>
                    <Badge
                      variant="outline"
                      className="text-[10px] mt-1"
                    >
                      {selectedReport.period}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Statut
                    </Label>
                    <div className="mt-1">
                      <Badge
                        className={`text-[10px] border-0 ${
                          STATUS_BADGE_COLORS[selectedReport.status] || ""
                        }`}
                      >
                        {selectedReport.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <div className="mt-1">
                      <Badge
                        className={`text-[10px] border-0 ${
                          TYPE_COLORS[selectedReport.type] || ""
                        }`}
                      >
                        {selectedReport.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Généré par
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {selectedReport.generatedBy?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Généré le
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDateTime(selectedReport.generatedAt)}
                    </p>
                  </div>
                  {selectedReport.validatedBy && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Validé par
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedReport.validatedBy.name}
                      </p>
                    </div>
                  )}
                  {selectedReport.validatedAt && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Validé le
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDateTime(selectedReport.validatedAt)}
                      </p>
                    </div>
                  )}
                  {selectedReport.direction && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Direction
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedReport.direction.name}
                      </p>
                    </div>
                  )}
                  {selectedReport.strategicAxis && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Axe stratégique
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedReport.strategicAxis.name}
                      </p>
                    </div>
                  )}
                  {selectedReport.acbfDomain && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Domaine ACBF
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedReport.acbfDomain.name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {selectedReport.summary && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Résumé exécutif
                    </Label>
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg mt-1">
                      <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                        {selectedReport.summary}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Report Data */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Données du rapport
                  </Label>
                  <div className="mt-2">
                    {renderReportData(selectedReport.data)}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewReportDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive/Restore AlertDialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.isActive ? "Confirmer l'archivage" : "Confirmer la restauration"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isActive
                ? `Êtes-vous sûr de vouloir archiver "${archiveTarget?.name}" ? Cette action peut être annulée ultérieurement.`
                : `Êtes-vous sûr de vouloir restaurer "${archiveTarget?.name}" ?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveArchive}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {archiveTarget?.isActive ? "Archiver" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
