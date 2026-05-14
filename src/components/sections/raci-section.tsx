"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Table2,
  UserCheck,
  AlertTriangle,
  Target,
  Eye,
  Pencil,
  Plus,
  Search,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Users,
  Calendar,
  ClipboardCheck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkPermission } from "@/lib/client-permissions";

// ============================================================
// Types
// ============================================================

interface RaciMatrix {
  id: string;
  acbfDeliverableId?: string;
  activityId?: string;
  strategicAxisId?: string;
  responsible?: string;
  responsibleUserId?: string;
  accountable?: string;
  accountableUserId?: string;
  contributors?: string;
  informed?: string;
  priority?: string;
  indicativeDeadline?: string;
  verificationSource?: string;
  comments?: string;
  isActive: boolean;
  deletedAt?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  acbfDeliverable?: { id: string; code: string; name: string; domain?: { code: string; name: string } };
  activity?: { id: string; activityCode: string; title: string };
  strategicAxis?: { id: string; code: string; name: string };
  responsibleUser?: { id: string; name: string; email: string };
  accountableUser?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string };
}

interface RaciStats {
  total: number;
  withR: number;
  withA: number;
  withC: number;
  withI: number;
  byPriority: Record<string, number>;
  byStrategicAxis: Array<{ axisId: string; axisCode: string; axisName: string; count: number }>;
  withLinkedUsers: number;
  withLinkedDeliverables: number;
  withLinkedActivities: number;
  overdue: number;
}

interface DeliverableOption {
  id: string;
  code: string;
  name: string;
  domainId?: string;
  domain?: { code: string; name: string };
}

interface AxisOption {
  id: string;
  code: string;
  name: string;
}

interface ActivityOption {
  id: string;
  activityCode: string;
  title: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

// ============================================================
// Zod Schemas
// ============================================================

const raciFormSchema = z.object({
  acbfDeliverableId: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  responsible: z.string().max(500, "Maximum 500 caractères").optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  accountable: z.string().max(500, "Maximum 500 caractères").optional().nullable(),
  accountableUserId: z.string().optional().nullable(),
  contributors: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  informed: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  indicativeDeadline: z.string().optional().nullable(),
  verificationSource: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  comments: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
});

type RaciFormValues = z.infer<typeof raciFormSchema>;

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

const PRIORITY_OPTIONS = [
  { value: "Haute", label: "Haute" },
  { value: "Moyenne", label: "Moyenne" },
  { value: "Basse", label: "Basse" },
] as const;

// ============================================================
// Permission Helpers
// ============================================================
// ============================================================
// Format Helpers
// ============================================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy à HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  try {
    return new Date(dateStr) < new Date();
  } catch {
    return false;
  }
}

// ============================================================
// Badge Helpers
// ============================================================

function getRBadge(text: string | null | undefined, hasUser?: boolean) {
  if (!text) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold">
        R
      </Badge>
      <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={text}>
        {text}
      </span>
      {hasUser && (
        <Badge className="text-[9px] border-0 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 gap-0.5">
          <UserCheck className="h-2.5 w-2.5" />
          Lié
        </Badge>
      )}
    </div>
  );
}

function getABadge(text: string | null | undefined, hasUser?: boolean) {
  if (!text) return <span className="text-sm text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="text-[10px] border-0 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400 font-bold">
        A
      </Badge>
      <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={text}>
        {text}
      </span>
      {hasUser && (
        <Badge className="text-[9px] border-0 bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400 gap-0.5">
          <UserCheck className="h-2.5 w-2.5" />
          Lié
        </Badge>
      )}
    </div>
  );
}

function getCBadge(text: string | null | undefined) {
  if (!text) return <span className="text-sm text-slate-400">—</span>;
  const items = text.split(";").map((s) => s.trim()).filter(Boolean);
  const display = items.length > 2 ? `${items.slice(0, 2).join("; ")}…` : text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Badge className="text-[10px] border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 font-bold">
            C
          </Badge>
          <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
            {display}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold text-xs mb-1">Contributeurs</p>
        {items.map((c, i) => (
          <p key={i} className="text-xs">• {c}</p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function getIBadge(text: string | null | undefined) {
  if (!text) return <span className="text-sm text-slate-400">—</span>;
  const items = text.split(";").map((s) => s.trim()).filter(Boolean);
  const display = items.length > 2 ? `${items.slice(0, 2).join("; ")}…` : text;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Badge className="text-[10px] border-0 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 font-bold">
            I
          </Badge>
          <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
            {display}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold text-xs mb-1">Informés</p>
        {items.map((c, i) => (
          <p key={i} className="text-xs">• {c}</p>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function getPriorityBadge(priority: string | null | undefined) {
  if (!priority) return <span className="text-sm text-slate-400">—</span>;
  const config: Record<string, string> = {
    Haute: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
    Moyenne: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    Basse: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
  };
  return (
    <Badge className={`text-[10px] border-0 ${config[priority] || "bg-slate-100 text-slate-600"}`}>
      {priority}
    </Badge>
  );
}

// ============================================================
// Main Component
// ============================================================

export function RaciSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "raci:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "raci:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "raci:update");
  const canArchive = checkPermission(session?.user?.roles ?? [], "raci:archive");

  // ----- Stats state -----
  const [stats, setStats] = useState<RaciStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ----- List state -----
  const [raciEntries, setRaciEntries] = useState<RaciMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [axisFilter, setAxisFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [deliverableFilter, setDeliverableFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Dialog states -----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ----- Selected entry -----
  const [selectedRaci, setSelectedRaci] = useState<RaciMatrix | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">("archive");

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Dropdown options -----
  const [deliverableOptions, setDeliverableOptions] = useState<DeliverableOption[]>([]);
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // ----- Form state -----
  const [form, setForm] = useState<RaciFormValues>({
    acbfDeliverableId: null,
    activityId: null,
    strategicAxisId: null,
    responsible: null,
    responsibleUserId: null,
    accountable: null,
    accountableUserId: null,
    contributors: null,
    informed: null,
    priority: null,
    indicativeDeadline: null,
    verificationSource: null,
    comments: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ----- Search state for dropdowns -----
  const [deliverableSearch, setDeliverableSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/raci/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.data ?? data);
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
  // Fetch RACI Entries
  // ============================================================

  const fetchRaci = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (axisFilter) params.set("strategicAxisId", axisFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (deliverableFilter) params.set("acbfDeliverableId", deliverableFilter);
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "active") params.set("status", "active");
        else if (statusFilter === "archived") params.set("status", "archived");
      }

      const res = await fetch(`/api/raci?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setRaciEntries(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, axisFilter, priorityFilter, deliverableFilter, statusFilter]);

  useEffect(() => {
    if (canRead) {
      fetchRaci();
    }
  }, [canRead, fetchRaci, refreshKey]);

  // ============================================================
  // Fetch Dropdown Options
  // ============================================================

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [deliverablesRes, axesRes, activitiesRes, usersRes] = await Promise.all([
          fetch("/api/acbf-deliverables?limit=200&status=active"),
          fetch("/api/strategic-axes?limit=10&status=active"),
          fetch("/api/activities?limit=100&status=active"),
          fetch("/api/users?limit=50"),
        ]);

        if (deliverablesRes.ok) {
          const data = await deliverablesRes.json();
          setDeliverableOptions(
            data.data.map((d: DeliverableOption) => ({
              id: d.id,
              code: d.code,
              name: d.name,
              domainId: d.domainId,
              domain: d.domain,
            }))
          );
        }
        if (axesRes.ok) {
          const data = await axesRes.json();
          setAxisOptions(
            data.data.map((a: AxisOption) => ({
              id: a.id,
              code: a.code,
              name: a.name,
            }))
          );
        }
        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          setActivityOptions(
            data.data.map((a: ActivityOption) => ({
              id: a.id,
              activityCode: a.activityCode,
              title: a.title,
            }))
          );
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserOptions(
            (data.data ?? data.users ?? []).map((u: UserOption) => ({
              id: u.id,
              name: u.name,
              email: u.email,
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
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, axisFilter, priorityFilter, deliverableFilter, statusFilter]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function resetFilters() {
    setSearch("");
    setAxisFilter("");
    setPriorityFilter("");
    setDeliverableFilter("");
    setStatusFilter("active");
  }

  function resetForm() {
    setForm({
      acbfDeliverableId: null,
      activityId: null,
      strategicAxisId: null,
      responsible: null,
      responsibleUserId: null,
      accountable: null,
      accountableUserId: null,
      contributors: null,
      informed: null,
      priority: null,
      indicativeDeadline: null,
      verificationSource: null,
      comments: null,
    });
    setFormErrors({});
    setDeliverableSearch("");
    setActivitySearch("");
  }

  // ----- Create RACI -----

  async function handleCreate() {
    const result = raciFormSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      });
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        responsible: form.responsible?.trim() || null,
        accountable: form.accountable?.trim() || null,
        contributors: form.contributors?.trim() || null,
        informed: form.informed?.trim() || null,
        verificationSource: form.verificationSource?.trim() || null,
        comments: form.comments?.trim() || null,
      };

      const res = await fetch("/api/raci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Entrée RACI créée avec succès");
      setCreateDialogOpen(false);
      resetForm();
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- View RACI -----

  async function handleView(item: RaciMatrix) {
    setSelectedRaci(item);
    setViewDialogOpen(true);

    try {
      const res = await fetch(`/api/raci/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRaci((prev) => (prev ? { ...prev, ...data.data } : prev));
      }
    } catch {
      // Keep existing data
    }
  }

  // ----- Edit RACI -----

  function openEditDialog(item: RaciMatrix) {
    setSelectedRaci(item);
    setForm({
      acbfDeliverableId: item.acbfDeliverableId || null,
      activityId: item.activityId || null,
      strategicAxisId: item.strategicAxisId || null,
      responsible: item.responsible || null,
      responsibleUserId: item.responsibleUserId || null,
      accountable: item.accountable || null,
      accountableUserId: item.accountableUserId || null,
      contributors: item.contributors || null,
      informed: item.informed || null,
      priority: (item.priority as "Haute" | "Moyenne" | "Basse") || null,
      indicativeDeadline: item.indicativeDeadline
        ? format(new Date(item.indicativeDeadline), "yyyy-MM-dd")
        : null,
      verificationSource: item.verificationSource || null,
      comments: item.comments || null,
    });
    setFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedRaci) return;

    const result = raciFormSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      });
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        responsible: form.responsible?.trim() || null,
        accountable: form.accountable?.trim() || null,
        contributors: form.contributors?.trim() || null,
        informed: form.informed?.trim() || null,
        verificationSource: form.verificationSource?.trim() || null,
        comments: form.comments?.trim() || null,
      };

      const res = await fetch(`/api/raci/${selectedRaci.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Entrée RACI modifiée avec succès");
      setEditDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la modification");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Archive / Restore -----

  function openArchiveDialog(item: RaciMatrix, action: "archive" | "restore") {
    setSelectedRaci(item);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedRaci) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/raci/${selectedRaci.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: archiveAction }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'opération");
      }

      toast.success(
        archiveAction === "archive"
          ? "Entrée RACI archivée avec succès"
          : "Entrée RACI restaurée avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedRaci(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // Filtered dropdown options
  // ============================================================

  const filteredDeliverableOptions = deliverableOptions.filter((d) => {
    if (!deliverableSearch) return true;
    const q = deliverableSearch.toLowerCase();
    return (
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
    );
  });

  const filteredActivityOptions = activityOptions.filter((a) => {
    if (!activitySearch) return true;
    const q = activitySearch.toLowerCase();
    return (
      a.activityCode.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q)
    );
  });

  // Top strategic axis
  const topAxis = stats?.byStrategicAxis?.[0];

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Matrice RACI
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Module 8
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
              Vous n&apos;avez pas la permission de consulter la matrice RACI.
              Contactez votre administrateur si vous pensez qu&apos;il s&apos;agit
              d&apos;une erreur.
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
            Matrice RACI
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Responsabilités et imputations — Module 8
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetForm();
              setCreateDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une entrée RACI
          </Button>
        )}
      </div>

      {/* ============================================================ */}
      {/* Stats Cards */}
      {/* ============================================================ */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total entrées RACI */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Table2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total entrées RACI</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats?.total ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avec utilisateurs liés */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900">
                <Users className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Avec utilisateurs liés</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-sky-700 dark:text-sky-400">
                    {stats?.withLinkedUsers ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* En retard */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">En retard</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-red-700 dark:text-red-400">
                    {stats?.overdue ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Par axe stratégique */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900">
                <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Par axe stratégique</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-20 mt-0.5" />
                ) : topAxis ? (
                  <div>
                    <p className="text-xl font-bold text-violet-700 dark:text-violet-400">
                      {topAxis.count}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[100px]" title={topAxis.axisName}>
                      {topAxis.axisCode}
                    </p>
                  </div>
                ) : (
                  <p className="text-xl font-bold text-slate-400">0</p>
                )}
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher (R, A, C, I)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Strategic Axis Filter */}
              <Select
                value={axisFilter || "__all__"}
                onValueChange={(v) => setAxisFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full lg:w-[200px] h-9">
                  <SelectValue placeholder="Axe stratégique" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les axes</SelectItem>
                  {axisOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name.length > 30 ? a.name.substring(0, 30) + "…" : a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select
                value={priorityFilter || "__all__"}
                onValueChange={(v) => setPriorityFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full lg:w-[150px] h-9">
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes priorités</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* ACBF Deliverable Filter */}
              <Select
                value={deliverableFilter || "__all__"}
                onValueChange={(v) => setDeliverableFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full lg:w-[220px] h-9">
                  <SelectValue placeholder="Livrable ACBF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les livrables</SelectItem>
                  {deliverableOptions.slice(0, 50).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name.length > 35 ? d.name.substring(0, 35) + "…" : d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Status Tabs */}
              <Tabs
                value={statusFilter}
                onValueChange={setStatusFilter}
                className="w-auto"
              >
                <TabsList className="h-9">
                  <TabsTrigger value="active" className="text-xs px-3">
                    Actifs
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs px-3">
                    Archivés
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs px-3">
                    Tous
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Reset Filters */}
              {(search || axisFilter || priorityFilter || deliverableFilter || statusFilter !== "active") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Data Table */}
      {/* ============================================================ */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Table2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Matrice RACI
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} entrée{total !== 1 ? "s" : ""} au total
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Loading State */}
          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
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
          {!loading && !error && raciEntries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Table2 className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucune entrée RACI trouvée
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || axisFilter || priorityFilter || deliverableFilter || statusFilter !== "active"
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucune entrée RACI n'a été ajoutée pour le moment."}
              </p>
              {(search || axisFilter || priorityFilter || deliverableFilter || statusFilter !== "active") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Effacer les filtres
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {!loading && !error && raciEntries.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Livrable ACBF
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Activité
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        R
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                        A
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        C
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        I
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Priorité
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Échéance
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {raciEntries.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 ${
                          item.deletedAt
                            ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20"
                            : ""
                        }`}
                        onClick={() => handleView(item)}
                      >
                        {/* Livrable ACBF */}
                        <TableCell>
                          {item.acbfDeliverable ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium text-slate-900 dark:text-white block truncate max-w-[160px]">
                                    {item.acbfDeliverable.code}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[160px]">
                                    {item.acbfDeliverable.name}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.acbfDeliverable.domain && (
                                  <p className="text-[10px] text-slate-400 mb-1">
                                    Domaine: {item.acbfDeliverable.domain.code} — {item.acbfDeliverable.domain.name}
                                  </p>
                                )}
                                <p className="text-xs">{item.acbfDeliverable.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Activité */}
                        <TableCell className="hidden md:table-cell">
                          {item.activity ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[120px] block cursor-default">
                                  {item.activity.activityCode}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.activity.title}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* R - Responsable */}
                        <TableCell>
                          {getRBadge(item.responsible, !!item.responsibleUserId)}
                        </TableCell>

                        {/* A - Autorité */}
                        <TableCell className="hidden sm:table-cell">
                          {getABadge(item.accountable, !!item.accountableUserId)}
                        </TableCell>

                        {/* C - Contributeurs */}
                        <TableCell className="hidden lg:table-cell">
                          {getCBadge(item.contributors)}
                        </TableCell>

                        {/* I - Informés */}
                        <TableCell className="hidden xl:table-cell">
                          {getIBadge(item.informed)}
                        </TableCell>

                        {/* Priorité */}
                        <TableCell className="hidden lg:table-cell">
                          {getPriorityBadge(item.priority)}
                        </TableCell>

                        {/* Échéance */}
                        <TableCell className="hidden md:table-cell">
                          {item.indicativeDeadline ? (
                            <span className={`text-sm ${
                              isOverdue(item.indicativeDeadline) && item.isActive
                                ? "text-red-600 dark:text-red-400 font-medium"
                                : "text-slate-500 dark:text-slate-400"
                            }`}>
                              {formatDate(item.indicativeDeadline)}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                  onClick={() => handleView(item)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir les détails</TooltipContent>
                            </Tooltip>

                            {canUpdate && !item.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (item.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() => openArchiveDialog(item, "restore")}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Restaurer</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                                      onClick={() => openArchiveDialog(item, "archive")}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Archiver</TooltipContent>
                                </Tooltip>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {total > 0
                    ? `Affichage de ${(page - 1) * ITEMS_PER_PAGE + 1} à ${Math.min(page * ITEMS_PER_PAGE, total)} sur ${total}`
                    : "Aucun résultat"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-8"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(totalPages, 5) },
                      (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pageNum)}
                            className={`h-8 w-8 p-0 ${
                              page === pageNum
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : ""
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      }
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
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

      {/* ============================================================ */}
      {/* Create Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-emerald-600" />
              Ajouter une entrée RACI
            </DialogTitle>
            <DialogDescription>
              Définissez les responsabilités RACI pour un livrable ou une activité.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Section 1: Liaison */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Liaison
              </h4>
              <div className="space-y-3 pl-6">
                {/* ACBF Deliverable */}
                <div className="space-y-2">
                  <Label>Livrable ACBF</Label>
                  <Input
                    placeholder="Rechercher un livrable..."
                    value={deliverableSearch}
                    onChange={(e) => setDeliverableSearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Select
                    value={form.acbfDeliverableId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, acbfDeliverableId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un livrable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {filteredDeliverableOptions.slice(0, 50).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name.length > 45 ? d.name.substring(0, 45) + "…" : d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Activity */}
                <div className="space-y-2">
                  <Label>Activité (optionnel)</Label>
                  <Input
                    placeholder="Rechercher une activité..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Select
                    value={form.activityId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, activityId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner une activité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {filteredActivityOptions.slice(0, 50).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.activityCode} — {a.title.length > 40 ? a.title.substring(0, 40) + "…" : a.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategic Axis */}
                <div className="space-y-2">
                  <Label>Axe stratégique</Label>
                  <Select
                    value={form.strategicAxisId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, strategicAxisId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un axe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name.length > 40 ? a.name.substring(0, 40) + "…" : a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 2: RACI */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                RACI
              </h4>
              <div className="space-y-3 pl-6">
                {/* R - Responsible */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Badge className="text-[9px] border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold px-1.5 py-0">R</Badge>
                      Responsable
                    </Label>
                    <Input
                      placeholder="ex: Directeur Exécutif"
                      value={form.responsible || ""}
                      onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value || null }))}
                      className={`h-9 ${formErrors.responsible ? "border-red-500" : ""}`}
                    />
                    {formErrors.responsible && <p className="text-xs text-red-500">{formErrors.responsible}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur responsable</Label>
                    <Select
                      value={form.responsibleUserId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, responsibleUserId: v === "__none__" ? null : v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {userOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* A - Accountable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Badge className="text-[9px] border-0 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400 font-bold px-1.5 py-0">A</Badge>
                      Autorité
                    </Label>
                    <Input
                      placeholder="ex: Conseil / Direction Exécutive"
                      value={form.accountable || ""}
                      onChange={(e) => setForm((f) => ({ ...f, accountable: e.target.value || null }))}
                      className={`h-9 ${formErrors.accountable ? "border-red-500" : ""}`}
                    />
                    {formErrors.accountable && <p className="text-xs text-red-500">{formErrors.accountable}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur autorité</Label>
                    <Select
                      value={form.accountableUserId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, accountableUserId: v === "__none__" ? null : v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {userOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* C - Contributors */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Badge className="text-[9px] border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 font-bold px-1.5 py-0">C</Badge>
                    Contributeurs
                  </Label>
                  <Textarea
                    placeholder="Séparés par des points-virgules (ex: Conformité; DAF; DSMP)"
                    value={form.contributors || ""}
                    onChange={(e) => setForm((f) => ({ ...f, contributors: e.target.value || null }))}
                    className={formErrors.contributors ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.contributors && <p className="text-xs text-red-500">{formErrors.contributors}</p>}
                </div>

                {/* I - Informed */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Badge className="text-[9px] border-0 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 font-bold px-1.5 py-0">I</Badge>
                    Informés
                  </Label>
                  <Textarea
                    placeholder="Séparés par des points-virgules (ex: Direction Exécutive; équipes concernées)"
                    value={form.informed || ""}
                    onChange={(e) => setForm((f) => ({ ...f, informed: e.target.value || null }))}
                    className={formErrors.informed ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.informed && <p className="text-xs text-red-500">{formErrors.informed}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3: Détails */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Détails
              </h4>
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Priority */}
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select
                      value={form.priority || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, priority: v === "__none__" ? null : v as "Haute" | "Moyenne" | "Basse" }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Deadline */}
                  <div className="space-y-2">
                    <Label>Échéance indicative</Label>
                    <Input
                      type="date"
                      value={form.indicativeDeadline || ""}
                      onChange={(e) => setForm((f) => ({ ...f, indicativeDeadline: e.target.value || null }))}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Verification Source */}
                <div className="space-y-2">
                  <Label>Source de vérification</Label>
                  <Textarea
                    placeholder="Source de vérification attendue..."
                    value={form.verificationSource || ""}
                    onChange={(e) => setForm((f) => ({ ...f, verificationSource: e.target.value || null }))}
                    className={formErrors.verificationSource ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.verificationSource && <p className="text-xs text-red-500">{formErrors.verificationSource}</p>}
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    placeholder="Commentaires additionnels..."
                    value={form.comments || ""}
                    onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value || null }))}
                    className={formErrors.comments ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.comments && <p className="text-xs text-red-500">{formErrors.comments}</p>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer l&apos;entrée RACI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* View Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Détails de l&apos;entrée RACI
            </DialogTitle>
            <DialogDescription>
              Informations complètes sur les responsabilités RACI.
            </DialogDescription>
          </DialogHeader>

          {selectedRaci && (
            <div className="space-y-6 py-2">
              {/* Liaison */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  Liaison
                </h4>
                <div className="space-y-2 pl-6">
                  {selectedRaci.acbfDeliverable && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Livrable ACBF</span>
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {selectedRaci.acbfDeliverable.code}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300 ml-2">
                          {selectedRaci.acbfDeliverable.name}
                        </span>
                        {selectedRaci.acbfDeliverable.domain && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Domaine: {selectedRaci.acbfDeliverable.domain.code} — {selectedRaci.acbfDeliverable.domain.name}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedRaci.activity && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Activité</span>
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {selectedRaci.activity.activityCode}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300 ml-2">
                          {selectedRaci.activity.title}
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedRaci.strategicAxis && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Axe stratégique</span>
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {selectedRaci.strategicAxis.code}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-300 ml-2">
                          {selectedRaci.strategicAxis.name}
                        </span>
                      </div>
                    </div>
                  )}
                  {!selectedRaci.acbfDeliverable && !selectedRaci.activity && !selectedRaci.strategicAxis && (
                    <p className="text-sm text-slate-400 italic">Aucune liaison définie</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* RACI */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  RACI
                </h4>
                <div className="space-y-3 pl-6">
                  {/* R */}
                  <div className="flex items-start gap-3">
                    <Badge className="text-xs border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold mt-0.5">
                      R
                    </Badge>
                    <div>
                      <span className="text-sm text-slate-900 dark:text-white">
                        {selectedRaci.responsible || "—"}
                      </span>
                      {selectedRaci.responsibleUser && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          <UserCheck className="h-3 w-3 inline mr-1" />
                          {selectedRaci.responsibleUser.name} ({selectedRaci.responsibleUser.email})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* A */}
                  <div className="flex items-start gap-3">
                    <Badge className="text-xs border-0 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400 font-bold mt-0.5">
                      A
                    </Badge>
                    <div>
                      <span className="text-sm text-slate-900 dark:text-white">
                        {selectedRaci.accountable || "—"}
                      </span>
                      {selectedRaci.accountableUser && (
                        <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5">
                          <UserCheck className="h-3 w-3 inline mr-1" />
                          {selectedRaci.accountableUser.name} ({selectedRaci.accountableUser.email})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* C */}
                  <div className="flex items-start gap-3">
                    <Badge className="text-xs border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 font-bold mt-0.5">
                      C
                    </Badge>
                    <div>
                      {selectedRaci.contributors ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRaci.contributors.split(";").map((s) => s.trim()).filter(Boolean).map((c, i) => (
                            <Badge key={i} className="text-[10px] border-0 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  {/* I */}
                  <div className="flex items-start gap-3">
                    <Badge className="text-xs border-0 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 font-bold mt-0.5">
                      I
                    </Badge>
                    <div>
                      {selectedRaci.informed ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRaci.informed.split(";").map((s) => s.trim()).filter(Boolean).map((c, i) => (
                            <Badge key={i} className="text-[10px] border-0 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Détails */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  Détails
                </h4>
                <div className="space-y-2 pl-6">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Priorité</span>
                    {getPriorityBadge(selectedRaci.priority)}
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Échéance</span>
                    <span className={`text-sm ${
                      isOverdue(selectedRaci.indicativeDeadline) && selectedRaci.isActive
                        ? "text-red-600 dark:text-red-400 font-medium"
                        : "text-slate-700 dark:text-slate-300"
                    }`}>
                      {formatDate(selectedRaci.indicativeDeadline)}
                    </span>
                  </div>
                  {selectedRaci.verificationSource && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Vérification</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {selectedRaci.verificationSource}
                      </span>
                    </div>
                  )}
                  {selectedRaci.comments && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Commentaires</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {selectedRaci.comments}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Métadonnées */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  Métadonnées
                </h4>
                <div className="space-y-2 pl-6">
                  {selectedRaci.createdBy && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Créé par</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {selectedRaci.createdBy.name} ({selectedRaci.createdBy.email})
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Créé le</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {formatDateFull(selectedRaci.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Modifié le</span>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {formatDateFull(selectedRaci.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[100px]">Statut</span>
                    {selectedRaci.isActive ? (
                      <Badge className="text-[10px] border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Actif
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] border-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Archivé
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
            >
              Fermer
            </Button>
            {canUpdate && selectedRaci && !selectedRaci.deletedAt && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  openEditDialog(selectedRaci);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier l&apos;entrée RACI
            </DialogTitle>
            <DialogDescription>
              Modifiez les responsabilités RACI.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Section 1: Liaison */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600" />
                Liaison
              </h4>
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label>Livrable ACBF</Label>
                  <Input
                    placeholder="Rechercher un livrable..."
                    value={deliverableSearch}
                    onChange={(e) => setDeliverableSearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Select
                    value={form.acbfDeliverableId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, acbfDeliverableId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un livrable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {filteredDeliverableOptions.slice(0, 50).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name.length > 45 ? d.name.substring(0, 45) + "…" : d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Activité (optionnel)</Label>
                  <Input
                    placeholder="Rechercher une activité..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Select
                    value={form.activityId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, activityId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner une activité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucune</SelectItem>
                      {filteredActivityOptions.slice(0, 50).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.activityCode} — {a.title.length > 40 ? a.title.substring(0, 40) + "…" : a.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Axe stratégique</Label>
                  <Select
                    value={form.strategicAxisId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, strategicAxisId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un axe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name.length > 40 ? a.name.substring(0, 40) + "…" : a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 2: RACI */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                RACI
              </h4>
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Badge className="text-[9px] border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold px-1.5 py-0">R</Badge>
                      Responsable
                    </Label>
                    <Input
                      placeholder="ex: Directeur Exécutif"
                      value={form.responsible || ""}
                      onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value || null }))}
                      className={`h-9 ${formErrors.responsible ? "border-red-500" : ""}`}
                    />
                    {formErrors.responsible && <p className="text-xs text-red-500">{formErrors.responsible}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur responsable</Label>
                    <Select
                      value={form.responsibleUserId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, responsibleUserId: v === "__none__" ? null : v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {userOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Badge className="text-[9px] border-0 bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400 font-bold px-1.5 py-0">A</Badge>
                      Autorité
                    </Label>
                    <Input
                      placeholder="ex: Conseil / Direction Exécutive"
                      value={form.accountable || ""}
                      onChange={(e) => setForm((f) => ({ ...f, accountable: e.target.value || null }))}
                      className={`h-9 ${formErrors.accountable ? "border-red-500" : ""}`}
                    />
                    {formErrors.accountable && <p className="text-xs text-red-500">{formErrors.accountable}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur autorité</Label>
                    <Select
                      value={form.accountableUserId || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, accountableUserId: v === "__none__" ? null : v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {userOptions.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Badge className="text-[9px] border-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 font-bold px-1.5 py-0">C</Badge>
                    Contributeurs
                  </Label>
                  <Textarea
                    placeholder="Séparés par des points-virgules"
                    value={form.contributors || ""}
                    onChange={(e) => setForm((f) => ({ ...f, contributors: e.target.value || null }))}
                    className={formErrors.contributors ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.contributors && <p className="text-xs text-red-500">{formErrors.contributors}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Badge className="text-[9px] border-0 bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400 font-bold px-1.5 py-0">I</Badge>
                    Informés
                  </Label>
                  <Textarea
                    placeholder="Séparés par des points-virgules"
                    value={form.informed || ""}
                    onChange={(e) => setForm((f) => ({ ...f, informed: e.target.value || null }))}
                    className={formErrors.informed ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.informed && <p className="text-xs text-red-500">{formErrors.informed}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Section 3: Détails */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                Détails
              </h4>
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select
                      value={form.priority || "__none__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, priority: v === "__none__" ? null : v as "Haute" | "Moyenne" | "Basse" }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucune</SelectItem>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Échéance indicative</Label>
                    <Input
                      type="date"
                      value={form.indicativeDeadline || ""}
                      onChange={(e) => setForm((f) => ({ ...f, indicativeDeadline: e.target.value || null }))}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Source de vérification</Label>
                  <Textarea
                    placeholder="Source de vérification attendue..."
                    value={form.verificationSource || ""}
                    onChange={(e) => setForm((f) => ({ ...f, verificationSource: e.target.value || null }))}
                    className={formErrors.verificationSource ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.verificationSource && <p className="text-xs text-red-500">{formErrors.verificationSource}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    placeholder="Commentaires additionnels..."
                    value={form.comments || ""}
                    onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value || null }))}
                    className={formErrors.comments ? "border-red-500" : ""}
                    rows={2}
                  />
                  {formErrors.comments && <p className="text-xs text-red-500">{formErrors.comments}</p>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Archive/Restore AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {archiveAction === "archive" ? (
                <>
                  <Trash2 className="h-5 w-5 text-red-600" />
                  Archiver l&apos;entrée RACI
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 text-emerald-600" />
                  Restaurer l&apos;entrée RACI
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? "Êtes-vous sûr de vouloir archiver cette entrée RACI ? Elle ne sera plus visible dans la liste active."
                : "Êtes-vous sûr de vouloir restaurer cette entrée RACI ? Elle réapparaîtra dans la liste active."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveRestore}
              disabled={submitting}
              className={
                archiveAction === "archive"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {archiveAction === "archive" ? "Archiver" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
