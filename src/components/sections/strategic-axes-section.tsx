"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Target,
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Hash,
  Activity,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ============================================================
// Types
// ============================================================

interface StrategicAxis {
  id: string;
  code: string;
  name: string;
  objective: string | null;
  expectedResults: string | null;
  indicators: string | null;
  concernedUnits: string | null;
  order: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    activitiesPrimary: number;
    activitiesSecondary: number;
  };
}

// ============================================================
// Zod Schemas
// ============================================================

const axisFormSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .max(20, "Maximum 20 caractères")
    .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement"),
  name: z
    .string()
    .min(2, "Minimum 2 caractères")
    .max(200, "Maximum 200 caractères"),
  objective: z.string().max(2000, "Maximum 2000 caractères").optional(),
  expectedResults: z.string().max(2000, "Maximum 2000 caractères").optional(),
  indicators: z.string().max(2000, "Maximum 2000 caractères").optional(),
  concernedUnits: z.string().max(1000, "Maximum 1000 caractères").optional(),
  order: z.number().int().min(0).default(0),
});

type AxisFormValues = z.infer<typeof axisFormSchema>;

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

// ============================================================
// Permission Helpers
// ============================================================

function hasPermission(
  roles: Array<{ permissions: string[] }>,
  permission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === permission || p === "strategic:*" || p === "admin:*"
    )
  );
}

// ============================================================
// Format Helpers
// ============================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy à HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

function truncate(str: string | null, maxLen: number): string {
  if (!str) return "—";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

// ============================================================
// Main Component
// ============================================================

export function StrategicAxesSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = hasPermission(session?.user?.roles ?? [], "strategic:read");
  const canCreate = hasPermission(
    session?.user?.roles ?? [],
    "strategic:create"
  );
  const canUpdate = hasPermission(
    session?.user?.roles ?? [],
    "strategic:update"
  );
  const canArchive = hasPermission(
    session?.user?.roles ?? [],
    "strategic:archive"
  );

  // ----- List state -----
  const [axes, setAxes] = useState<StrategicAxis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  // ----- Selected axis -----
  const [selectedAxis, setSelectedAxis] = useState<StrategicAxis | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">(
    "archive"
  );

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Form state -----
  const [form, setForm] = useState<AxisFormValues>({
    code: "",
    name: "",
    objective: "",
    expectedResults: "",
    indicators: "",
    concernedUnits: "",
    order: 0,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Strategic Axes
  // ============================================================

  const fetchAxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);

      const res = await fetch(`/api/strategic-axes?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setAxes(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (canRead) {
      fetchAxes();
    }
  }, [canRead, fetchAxes, refreshKey]);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  // ----- Form helpers -----

  function resetForm() {
    setForm({
      code: "",
      name: "",
      objective: "",
      expectedResults: "",
      indicators: "",
      concernedUnits: "",
      order: 0,
    });
    setFormErrors({});
  }

  function validateForm(): boolean {
    const result = axisFormSchema.safeParse(form);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  }

  // ----- Create Axis -----

  async function handleCreate() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        objective: form.objective?.trim() || null,
        expectedResults: form.expectedResults?.trim() || null,
        indicators: form.indicators?.trim() || null,
        concernedUnits: form.concernedUnits?.trim() || null,
        order: form.order,
      };

      const res = await fetch("/api/strategic-axes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Axe stratégique créé avec succès");
      setCreateDialogOpen(false);
      resetForm();
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la création"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----- View Axis -----

  async function handleView(axis: StrategicAxis) {
    setSelectedAxis(axis);
    setViewDialogOpen(true);

    // Fetch full detail with activity counts
    try {
      const res = await fetch(`/api/strategic-axes/${axis.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAxis((prev) =>
          prev ? { ...prev, ...data.data } : prev
        );
      }
    } catch {
      // Keep existing data
    }
  }

  // ----- Edit Axis -----

  function openEditDialog(axis: StrategicAxis) {
    setSelectedAxis(axis);
    setForm({
      code: axis.code,
      name: axis.name,
      objective: axis.objective || "",
      expectedResults: axis.expectedResults || "",
      indicators: axis.indicators || "",
      concernedUnits: axis.concernedUnits || "",
      order: axis.order,
    });
    setFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedAxis) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        objective: form.objective?.trim() || null,
        expectedResults: form.expectedResults?.trim() || null,
        indicators: form.indicators?.trim() || null,
        concernedUnits: form.concernedUnits?.trim() || null,
        order: form.order,
      };

      const res = await fetch(`/api/strategic-axes/${selectedAxis.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Axe stratégique modifié avec succès");
      setEditDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la modification"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Archive / Restore -----

  function openArchiveDialog(
    axis: StrategicAxis,
    action: "archive" | "restore"
  ) {
    setSelectedAxis(axis);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedAxis) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/strategic-axes/${selectedAxis.id}`, {
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
          ? "Axe stratégique archivé avec succès"
          : "Axe stratégique restauré avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedAxis(null);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'opération"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Axes stratégiques
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer le référentiel stratégique de l&apos;organisation
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
              Vous n&apos;avez pas la permission de consulter les axes
              stratégiques. Contactez votre administrateur si vous pensez
              qu&apos;il s&apos;agit d&apos;une erreur.
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
            Axes stratégiques
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer le référentiel stratégique de l&apos;organisation
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
            Ajouter un axe
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher par nom ou code..."
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

            {/* Status Tabs */}
            <Tabs
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="w-full lg:w-auto"
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

            {/* Clear Filters */}
            {(search || statusFilter !== "active") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("active");
                }}
                className="h-9 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 shrink-0"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Axes Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Liste des axes stratégiques
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} axe{total !== 1 ? "s" : ""} stratégique
                  {total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
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
          {!loading && !error && axes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Target className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucun axe stratégique trouvé
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || statusFilter !== "active"
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucun axe stratégique n'a été créé pour le moment."}
              </p>
              {(search || statusFilter !== "active") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("active");
                  }}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Effacer les filtres
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {!loading && !error && axes.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Code
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Nom
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Objectif
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Résultats attendus
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        Indicateurs
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Ordre
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Statut
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {axes.map((axis) => (
                      <TableRow
                        key={axis.id}
                        className={
                          axis.deletedAt
                            ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20"
                            : ""
                        }
                      >
                        {/* Code */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
                          >
                            {axis.code}
                          </Badge>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <Target className="h-4 w-4" />
                            </div>
                            <span
                              className="truncate max-w-[200px]"
                              title={axis.name}
                            >
                              {axis.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Objective */}
                        <TableCell className="hidden md:table-cell">
                          <span
                            className="text-sm text-slate-600 dark:text-slate-300"
                            title={axis.objective || undefined}
                          >
                            {truncate(axis.objective, 50)}
                          </span>
                        </TableCell>

                        {/* Expected Results */}
                        <TableCell className="hidden lg:table-cell">
                          <span
                            className="text-sm text-slate-600 dark:text-slate-300"
                            title={axis.expectedResults || undefined}
                          >
                            {truncate(axis.expectedResults, 40)}
                          </span>
                        </TableCell>

                        {/* Indicators */}
                        <TableCell className="hidden xl:table-cell">
                          <span
                            className="text-sm text-slate-600 dark:text-slate-300"
                            title={axis.indicators || undefined}
                          >
                            {truncate(axis.indicators, 40)}
                          </span>
                        </TableCell>

                        {/* Order */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {axis.order}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {axis.deletedAt ? (
                            <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                              Archivé
                            </Badge>
                          ) : !axis.isActive ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                              Inactif
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                              Actif
                            </Badge>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                  onClick={() => handleView(axis)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Voir les détails
                              </TooltipContent>
                            </Tooltip>

                            {canUpdate && !axis.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(axis)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (axis.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() =>
                                        openArchiveDialog(axis, "restore")
                                      }
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
                                      onClick={() =>
                                        openArchiveDialog(axis, "archive")
                                      }
                                    >
                                      <Archive className="h-4 w-4" />
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
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
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
      {/* Create Axis Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              Nouvel axe stratégique
            </DialogTitle>
            <DialogDescription>
              Créez un nouvel axe stratégique pour le référentiel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="ex: AXE1"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                className={formErrors.code ? "border-red-500" : ""}
              />
              {formErrors.code && (
                <p className="text-xs text-red-500">{formErrors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="Nom de l'axe stratégique"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-objective">Objectif</Label>
              <Textarea
                id="create-objective"
                placeholder="Objectif de l'axe stratégique..."
                value={form.objective}
                onChange={(e) =>
                  setForm((f) => ({ ...f, objective: e.target.value }))
                }
                rows={3}
                className={formErrors.objective ? "border-red-500" : ""}
              />
              {formErrors.objective && (
                <p className="text-xs text-red-500">{formErrors.objective}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-expectedResults">
                Résultats attendus
              </Label>
              <Textarea
                id="create-expectedResults"
                placeholder="Résultats attendus..."
                value={form.expectedResults}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expectedResults: e.target.value,
                  }))
                }
                rows={3}
                className={
                  formErrors.expectedResults ? "border-red-500" : ""
                }
              />
              {formErrors.expectedResults && (
                <p className="text-xs text-red-500">
                  {formErrors.expectedResults}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-indicators">Indicateurs</Label>
              <Textarea
                id="create-indicators"
                placeholder="Indicateurs de suivi..."
                value={form.indicators}
                onChange={(e) =>
                  setForm((f) => ({ ...f, indicators: e.target.value }))
                }
                rows={3}
                className={formErrors.indicators ? "border-red-500" : ""}
              />
              {formErrors.indicators && (
                <p className="text-xs text-red-500">
                  {formErrors.indicators}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-concernedUnits">Unités concernées</Label>
              <Textarea
                id="create-concernedUnits"
                placeholder="Unités concernées par cet axe..."
                value={form.concernedUnits}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    concernedUnits: e.target.value,
                  }))
                }
                rows={2}
                className={
                  formErrors.concernedUnits ? "border-red-500" : ""
                }
              />
              {formErrors.concernedUnits && (
                <p className="text-xs text-red-500">
                  {formErrors.concernedUnits}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-order">Ordre d&apos;affichage</Label>
              <Input
                id="create-order"
                type="number"
                min={0}
                value={form.order}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    order: parseInt(e.target.value) || 0,
                  }))
                }
                className={formErrors.order ? "border-red-500" : ""}
              />
              {formErrors.order && (
                <p className="text-xs text-red-500">{formErrors.order}</p>
              )}
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
              Créer l&apos;axe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Axis Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier l&apos;axe stratégique
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de l&apos;axe stratégique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-code"
                placeholder="ex: AXE1"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                className={formErrors.code ? "border-red-500" : ""}
              />
              {formErrors.code && (
                <p className="text-xs text-red-500">{formErrors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Nom de l'axe stratégique"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-objective">Objectif</Label>
              <Textarea
                id="edit-objective"
                placeholder="Objectif de l'axe stratégique..."
                value={form.objective}
                onChange={(e) =>
                  setForm((f) => ({ ...f, objective: e.target.value }))
                }
                rows={3}
                className={formErrors.objective ? "border-red-500" : ""}
              />
              {formErrors.objective && (
                <p className="text-xs text-red-500">{formErrors.objective}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-expectedResults">
                Résultats attendus
              </Label>
              <Textarea
                id="edit-expectedResults"
                placeholder="Résultats attendus..."
                value={form.expectedResults}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expectedResults: e.target.value,
                  }))
                }
                rows={3}
                className={
                  formErrors.expectedResults ? "border-red-500" : ""
                }
              />
              {formErrors.expectedResults && (
                <p className="text-xs text-red-500">
                  {formErrors.expectedResults}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-indicators">Indicateurs</Label>
              <Textarea
                id="edit-indicators"
                placeholder="Indicateurs de suivi..."
                value={form.indicators}
                onChange={(e) =>
                  setForm((f) => ({ ...f, indicators: e.target.value }))
                }
                rows={3}
                className={formErrors.indicators ? "border-red-500" : ""}
              />
              {formErrors.indicators && (
                <p className="text-xs text-red-500">
                  {formErrors.indicators}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-concernedUnits">Unités concernées</Label>
              <Textarea
                id="edit-concernedUnits"
                placeholder="Unités concernées par cet axe..."
                value={form.concernedUnits}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    concernedUnits: e.target.value,
                  }))
                }
                rows={2}
                className={
                  formErrors.concernedUnits ? "border-red-500" : ""
                }
              />
              {formErrors.concernedUnits && (
                <p className="text-xs text-red-500">
                  {formErrors.concernedUnits}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-order">Ordre d&apos;affichage</Label>
              <Input
                id="edit-order"
                type="number"
                min={0}
                value={form.order}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    order: parseInt(e.target.value) || 0,
                  }))
                }
                className={formErrors.order ? "border-red-500" : ""}
              />
              {formErrors.order && (
                <p className="text-xs text-red-500">{formErrors.order}</p>
              )}
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
      {/* View Axis Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              Détails de l&apos;axe stratégique
            </DialogTitle>
            <DialogDescription>
              Informations détaillées de l&apos;axe stratégique.
            </DialogDescription>
          </DialogHeader>
          {selectedAxis && (
            <div className="space-y-5 py-4">
              {/* Code & Name */}
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-sm font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 px-3 py-1"
                >
                  {selectedAxis.code}
                </Badge>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedAxis.name}
                </h3>
              </div>

              {/* Status & Order */}
              <div className="flex items-center gap-3">
                {selectedAxis.deletedAt ? (
                  <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                    Archivé
                  </Badge>
                ) : !selectedAxis.isActive ? (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                    Inactif
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                    Actif
                  </Badge>
                )}
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Ordre : {selectedAxis.order}
                </span>
              </div>

              <Separator />

              {/* Objective */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Objectif
                </Label>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedAxis.objective || "Non défini"}
                </p>
              </div>

              {/* Expected Results */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Résultats attendus
                </Label>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedAxis.expectedResults || "Non défini"}
                </p>
              </div>

              {/* Indicators */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Indicateurs
                </Label>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedAxis.indicators || "Non défini"}
                </p>
              </div>

              {/* Concerned Units */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Unités concernées
                </Label>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {selectedAxis.concernedUnits || "Non défini"}
                </p>
              </div>

              <Separator />

              {/* Activity Counts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800">
                    <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {selectedAxis._count?.activitiesPrimary ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Activités principales
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                    <Activity className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                      {selectedAxis._count?.activitiesSecondary ?? 0}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Activités secondaires
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  <span className="font-semibold">Créé le :</span>{" "}
                  {formatDate(selectedAxis.createdAt)}
                </div>
                <div>
                  <span className="font-semibold">Modifié le :</span>{" "}
                  {formatDate(selectedAxis.updatedAt)}
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
            {canUpdate && selectedAxis && !selectedAxis.deletedAt && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  openEditDialog(selectedAxis);
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
      {/* Archive/Restore AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {archiveAction === "archive" ? (
                <>
                  <Archive className="h-5 w-5 text-red-500" />
                  Archiver l&apos;axe stratégique
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 text-emerald-600" />
                  Restaurer l&apos;axe stratégique
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? `Êtes-vous sûr de vouloir archiver l'axe stratégique "${selectedAxis?.name}" ? Il sera marqué comme inactif mais ne sera pas supprimé.`
                : `Êtes-vous sûr de vouloir restaurer l'axe stratégique "${selectedAxis?.name}" ? Il sera à nouveau marqué comme actif.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Annuler
            </AlertDialogCancel>
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
