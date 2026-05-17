"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileText,
  RefreshCw,
  Loader2,
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
  CheckCircle2,
  XCircle,
  LayoutTemplate,
  TrendingUp,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
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
  reportsCount?: number;
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
  // m6 fix: template field should include category
  template?: { id: string; code: string; name: string; type: string; category: string };
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

// m3 fix: Replace indigo with rose for "Par direction"
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
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  Personnalisé:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

// ============================================================
// Date formatting — m5 fix: consistent formatting
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
// Report Data Renderer — E3 fix: match API response structure
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

  // Activities section — E3 fix: access data.activities sub-object
  const activities = data.activities as Record<string, unknown> | undefined;
  if (activities) {
    const summaryItems: Array<{ label: string; value: string | number }> = [];
    if ("total" in activities) summaryItems.push({ label: "Total activités", value: activities.total as number });
    if ("averageProgress" in activities) summaryItems.push({ label: "Avancement moyen", value: `${Math.round(activities.averageProgress as number)}%` });
    if ("overdueCount" in activities) summaryItems.push({ label: "En retard", value: activities.overdueCount as number });

    if (summaryItems.length > 0) {
      sections.push(
        <div key="summary" className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Statistiques résumées
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Breakdown by status — E3 fix: access activities.byStatus
    const byStatus = activities.byStatus as
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

    // Breakdown by direction — E3 fix: access activities.byDirection
    const byDirection = activities.byDirection as
      | Array<{ name: string; code: string; count: number }> | undefined;
    if (byDirection && Array.isArray(byDirection) && byDirection.length > 0) {
      sections.push(
        <div key="byDirection" className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Répartition par direction
          </h4>
          <div className="space-y-2">
            {byDirection.map((d) => (
              <div
                key={d.code}
                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-2"
              >
                <span className="text-xs w-32 text-muted-foreground truncate">
                  {d.name}
                </span>
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

    // Breakdown by axis — E3 fix: access activities.byAxis (not byStrategicAxis)
    const byAxis = activities.byAxis as
      | Array<{ name: string; code: string; count: number }> | undefined;
    if (byAxis && Array.isArray(byAxis) && byAxis.length > 0) {
      sections.push(
        <div key="byAxis" className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
            Répartition par axe stratégique
          </h4>
          <div className="space-y-2">
            {byAxis.map((a) => (
              <div
                key={a.code}
                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-2"
              >
                <span className="text-xs w-32 text-muted-foreground truncate">
                  {a.name}
                </span>
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
  }

  // Evidence section — E3 fix: access data.evidence sub-object
  const evidence = data.evidence as Record<string, unknown> | undefined;
  if (evidence) {
    sections.push(
      <div key="evidence" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Preuves &amp; RACI
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {("total" in evidence) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Total preuves
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {String(evidence.total)}
              </p>
            </div>
          )}
          {("verified" in evidence) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Vérifiées
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {String(evidence.verified)}
              </p>
            </div>
          )}
          {("verificationRate" in evidence) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Taux vérification
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {String(evidence.verificationRate)}%
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // RACI section — E3 fix: access data.raci sub-object
  const raci = data.raci as Record<string, unknown> | undefined;
  if (raci) {
    sections.push(
      <div key="raci" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Matrice RACI
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {("totalRaciEntries" in raci) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Entrées RACI
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {String(raci.totalRaciEntries)}
              </p>
            </div>
          )}
          {("coverage" in raci) && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Couverture
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {String(raci.coverage)}%
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // KPI section — E3 fix: access data.kpis sub-object
  const kpis = data.kpis as Record<string, unknown> | undefined;
  if (kpis && "averageAchievementRate" in kpis) {
    sections.push(
      <div key="kpis" className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          Taux de réalisation des KPI
        </h4>
        <div className="flex items-center gap-3">
          <Progress value={Math.min(100, kpis.averageAchievementRate as number)} className="h-3 flex-1" />
          <span className="text-sm font-medium text-slate-900 dark:text-white w-12 text-right">
            {Math.round(Math.min(100, kpis.averageAchievementRate as number))}%
          </span>
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
// CSV Export — M6
// ============================================================

function exportReportsCSV(reports: Report[]) {
  // M6 fix: Include Direction and Strategic Axis columns
  const headers = [
    "Titre",
    "Modèle",
    "Période",
    "Type",
    "Statut",
    "Direction",
    "Axe stratégique",
    "Généré par",
    "Date de génération",
    "Validé par",
    "Date de validation",
  ];
  const rows = reports.map((r) => [
    r.title,
    r.template?.name || "",
    r.period,
    r.type,
    r.status,
    r.direction?.name || "",
    r.strategicAxis?.name || "",
    r.generatedBy?.name || "",
    r.generatedAt ? formatDate(r.generatedAt) : "",
    r.validatedBy?.name || "",
    r.validatedAt ? formatDate(r.validatedAt) : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapports_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Main Component
// ============================================================

export function ReportsSection() {
  const { data: session } = useSession();
  const canRead = checkPermission(session?.user?.roles ?? [], "reports:read");
  const canCreate = checkPermission(
    session?.user?.roles ?? [],
    "reports:create"
  );
  const canUpdate = checkPermission(
    session?.user?.roles ?? [],
    "reports:update"
  );
  const canArchive = checkPermission(
    session?.user?.roles ?? [],
    "reports:archive"
  );
  const canValidate = checkPermission(
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
  const [reportAxisFilter, setReportAxisFilter] = useState(""); // E8 fix
  const [reportAcbfDomainFilter, setReportAcbfDomainFilter] = useState(""); // M9 fix

  // Pagination state — M7 fix
  const [templatePage, setTemplatePage] = useState(1);
  const [templateTotalPages, setTemplateTotalPages] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const PAGE_SIZE = 20;

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
  const [templateReports, setTemplateReports] = useState<Array<{
    id: string;
    title: string;
    period: string;
    status: string;
    generatedAt: string | null;
    generatedBy: { id: string; name: string } | null;
  }>>([]);
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
  // Fetch Templates — M7 fix: proper pagination
  // ============================================================

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "templates");
      if (templateSearch) params.set("search", templateSearch);
      if (templateTypeFilter) params.set("type", templateTypeFilter);
      if (templateCategoryFilter)
        params.set("category", templateCategoryFilter);
      params.set("page", String(templatePage));
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Erreur lors du chargement des modèles"
        );
      }
      const data = await res.json();
      setTemplates(data.data || []);
      setTemplateTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setTemplatesError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setTemplatesLoading(false);
    }
  }, [templateSearch, templateTypeFilter, templateCategoryFilter, templatePage]);

  // ============================================================
  // Fetch Reports — M7 fix: proper pagination + E8 fix: strategicAxis filter
  // ============================================================

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "reports");
      if (reportSearch) params.set("search", reportSearch);
      if (reportStatusFilter && reportStatusFilter !== "Tous")
        params.set("status", reportStatusFilter);
      if (reportTypeFilter) params.set("type", reportTypeFilter);
      if (reportPeriodFilter) params.set("period", reportPeriodFilter);
      if (reportDirectionFilter) params.set("directionId", reportDirectionFilter);
      if (reportAxisFilter) params.set("strategicAxisId", reportAxisFilter); // E8 fix
      if (reportAcbfDomainFilter) params.set("acbfDomainId", reportAcbfDomainFilter); // M9 fix
      params.set("page", String(reportPage));
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Erreur lors du chargement des rapports"
        );
      }
      const data = await res.json();
      setReports(data.data || []);
      setReportTotalPages(data.pagination?.totalPages || 1);
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
    reportAxisFilter,
    reportAcbfDomainFilter,
    reportPage,
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

  // m4 fix: Auto-refresh every 60 seconds — M1 fix: use setRefreshKey directly
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Reset page when filters change
  useEffect(() => { setTemplatePage(1); }, [templateSearch, templateTypeFilter, templateCategoryFilter]);
  useEffect(() => { setReportPage(1); }, [reportSearch, reportStatusFilter, reportTypeFilter, reportPeriodFilter, reportDirectionFilter, reportAxisFilter, reportAcbfDomainFilter]);

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

  // E2 fix: Remove ?mode=template-reports query param — use template detail response's reports array
  async function handleViewTemplate(t: ReportTemplate) {
    setSelectedTemplate(t);
    setViewTemplateDialogOpen(true);
    setTemplateReportsLoading(true);
    try {
      const res = await fetch(`/api/reports/${t.id}`);
      if (res.ok) {
        const result = await res.json();
        if (result.kind === "template" && result.data?.reports) {
          setTemplateReports(result.data.reports);
        } else {
          setTemplateReports([]);
        }
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
      const res = await fetch(`/api/reports/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
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
      const patchAction = archiveTarget.type === "template"
        ? `template-${action}`
        : action;
      const res = await fetch(`/api/reports/${archiveTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: patchAction,
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
        body: JSON.stringify({ action }),
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
  // KPI data
  // ============================================================

  const templateKpis = useMemo(() => {
    // E2 fix: Use stats from API instead of computing from local page data
    return {
      totalTemplates: stats?.totalTemplates ?? templates.filter((t) => t.isActive).length,
      totalReportsGenerated: stats?.totalReports ?? reports.length,
      lastGeneration: stats?.lastGeneration ?? null,
      pendingValidation: stats?.pendingValidation ?? 0,
    };
  }, [stats, templates, reports]);

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
  // Pagination Controls — M7 fix
  // m3 note: Inline version kept because shared PaginationControls has a different interface
  // (requires total, itemsPerPage, onPageChange props)
  // ============================================================

  function PaginationControls({
    page,
    totalPages,
    setPage,
  }: {
    page: number;
    totalPages: number;
    setPage: (p: number) => void;
  }) {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
          {/* M6: CSV Export */}
          {mainTab === "reports" && reports.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportReportsCSV(reports)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter en CSV</TooltipContent>
            </Tooltip>
          )}
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
                  <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
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
          ) : templates.length === 0 ? (
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
                          {templates.map((t) => (
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
                                  {t.reportsCount ?? t._count?.reports ?? 0}
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
                                        disabled={t.isSystem || !canUpdate}
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
                                          <BarChart3 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Générer un rapport
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!t.isSystem && canArchive && (
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
                {templates.map((t) => (
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
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <PaginationControls page={templatePage} totalPages={templateTotalPages} setPage={setTemplatePage} />
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
                  {/* E8 fix: Strategic axis filter */}
                  <Select
                    value={reportAxisFilter}
                    onValueChange={(v) =>
                      setReportAxisFilter(v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Axe stratégique" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">
                        Tous les axes
                      </SelectItem>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* M9 fix: ACBF Domain filter */}
                  <Select
                    value={reportAcbfDomainFilter}
                    onValueChange={(v) =>
                      setReportAcbfDomainFilter(v === "__all__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Domaine ACBF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">
                        Tous les domaines
                      </SelectItem>
                      {acbfDomainOptions.map((d) => (
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
                  <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
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
          ) : reports.length === 0 ? (
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
                          {reports.map((r) => (
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
                                {formatDateTime(r.generatedAt)}
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
                                  {canArchive && (
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
              <div className="lg:hidden space-y-3">
                {reports.map((r) => (
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
                        <span>{formatDateTime(r.generatedAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <PaginationControls page={reportPage} totalPages={reportTotalPages} setPage={setReportPage} />
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: STATISTIQUES — M5 fix: properly rendered */}
        {/* ============================================================ */}
        <TabsContent value="stats" className="space-y-6 mt-6">
          {statsError ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
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

              {/* Additional KPI Row — M5 fix */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Rejetés
                    </p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-10 inline-block" />
                      ) : (
                        stats?.rejectedReports ?? 0
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Brouillons
                    </p>
                    <p className="text-2xl font-bold text-slate-600 dark:text-slate-400 mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-10 inline-block" />
                      ) : (
                        stats?.draftReports ?? 0
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Archivés
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-10 inline-block" />
                      ) : (
                        stats?.archivedReports ?? 0
                      )}
                    </p>
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
                      <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
        onOpenChange={(open) => { if (!open) setSaving(false); setCreateTemplateDialogOpen(open); }}
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
        onOpenChange={(open) => { if (!open) setSaving(false); setEditTemplateDialogOpen(open); }}
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
                    {/* m5 fix: consistent date formatting */}
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDateTime(selectedTemplate.createdAt)}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Related Reports — E2 fix: data from template detail */}
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
                    <ScrollArea className="max-h-60 mt-2">
                      <div className="space-y-2">
                        {templateReports.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                                {r.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {r.period} • {formatDateTime(r.generatedAt)}
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
                    </ScrollArea>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog
        open={generateReportDialogOpen}
        onOpenChange={(open) => { if (!open) setSaving(false); setGenerateReportDialogOpen(open); }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Générer un rapport
            </DialogTitle>
            <DialogDescription>
              Générez un rapport à partir du modèle{" "}
              <span className="font-semibold">
                {selectedTemplate?.name || ""}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gen-period">Période *</Label>
              <Input
                id="gen-period"
                placeholder="2026-01 ou 2026-Q1"
                value={genPeriod}
                onChange={(e) => setGenPeriod(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Direction (optionnel)</Label>
              <Select
                value={genDirectionId || "__none__"}
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
                value={genStrategicAxisId || "__none__"}
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
                value={genAcbfDomainId || "__none__"}
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
              <Eye className="h-5 w-5 text-emerald-600" />
              Détails du rapport
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.title || ""}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
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
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {selectedReport.period}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
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
                    <Label className="text-xs text-muted-foreground">
                      Généré le
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDateTime(selectedReport.generatedAt)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Généré par
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {selectedReport.generatedBy?.name || "—"}
                    </p>
                  </div>
                  {selectedReport.validatedBy && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Validé par
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedReport.validatedBy.name}{" "}
                        <span className="text-muted-foreground">
                          ({formatDateTime(selectedReport.validatedAt)})
                        </span>
                      </p>
                    </div>
                  )}
                </div>
                {(selectedReport.direction || selectedReport.strategicAxis || selectedReport.acbfDomain) && (
                  <div className="grid grid-cols-3 gap-4">
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
        </DialogContent>
      </Dialog>

      {/* Archive/Restore Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={(open) => { if (!open) setSaving(false); setArchiveDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.isActive ? "Archiver" : "Restaurer"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.isActive
                ? `Êtes-vous sûr de vouloir archiver "${archiveTarget?.name}" ?`
                : `Êtes-vous sûr de vouloir restaurer "${archiveTarget?.name}" ?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={saveArchive}
              className={
                archiveTarget?.isActive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {archiveTarget?.isActive ? "Archiver" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
