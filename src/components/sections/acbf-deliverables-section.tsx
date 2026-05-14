"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileCheck,
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  BookOpen,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkPermission } from "@/lib/client-permissions";
import { StatusBadge, PaginationControls } from "@/components/shared/org-shared";

// ============================================================
// Types
// ============================================================

interface DomainOption {
  id: string;
  code: string;
  name: string;
}

interface AcbfDeliverable {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  domainId: string;
  domain: DomainOption;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Zod Schemas
// ============================================================

const deliverableFormSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .max(30, "Maximum 30 caractères")
    .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement"),
  name: z
    .string()
    .min(2, "Minimum 2 caractères")
    .max(200, "Maximum 200 caractères"),
  domainId: z.string().min(1, "Le domaine ACBF est requis"),
  description: z.string().max(2000, "Maximum 2000 caractères").optional(),
  priority: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

type DeliverableFormValues = z.infer<typeof deliverableFormSchema>;

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

const PRIORITY_OPTIONS = [
  { value: "Haute", label: "Haute" },
  { value: "Moyenne", label: "Moyenne" },
  { value: "Basse", label: "Basse" },
];

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

// ============================================================
// Main Component
// ============================================================

export function AcbfDeliverablesSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "acbf:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "acbf:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "acbf:update");
  const canArchive = checkPermission(session?.user?.roles ?? [], "acbf:archive");

  // ----- List state -----
  const [deliverables, setDeliverables] = useState<AcbfDeliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [domainFilter, setDomainFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Dialog states -----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ----- Selected deliverable -----
  const [selectedDeliverable, setSelectedDeliverable] =
    useState<AcbfDeliverable | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">(
    "archive"
  );

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Domain options for dropdown -----
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([]);

  const fetchDomainOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/acbf-domains?limit=100&status=active");
      if (res.ok) {
        const data = await res.json();
        setDomainOptions(
          data.data.map((d: DomainOption) => ({
            id: d.id,
            code: d.code,
            name: d.name,
          }))
        );
      }
    } catch {
      // Silently fail
    }
  }, []);

  // ----- Form state -----
  const [form, setForm] = useState<DeliverableFormValues>({
    code: "",
    name: "",
    domainId: "",
    description: "",
    priority: null,
    status: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Deliverables
  // ============================================================

  const fetchDeliverables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (domainFilter) params.set("domainId", domainFilter);

      const res = await fetch(`/api/acbf-deliverables?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setDeliverables(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, domainFilter]);

  useEffect(() => {
    if (canRead) {
      fetchDeliverables();
    }
  }, [canRead, fetchDeliverables, refreshKey]);

  // ============================================================
  // Fetch Domains for dropdown (refresh on data changes)
  // ============================================================

  useEffect(() => {
    fetchDomainOptions();
  }, [fetchDomainOptions, refreshKey]);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, domainFilter]);

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
      domainId: "",
      description: "",
      priority: null,
      status: null,
    });
    setFormErrors({});
  }

  function validateForm(): boolean {
    const result = deliverableFormSchema.safeParse(form);
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

  // ----- Create Deliverable -----

  async function handleCreate() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        domainId: form.domainId,
        description: form.description?.trim() || null,
        priority: form.priority || null,
        status: form.status?.trim() || null,
      };

      const res = await fetch("/api/acbf-deliverables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Livrable ACBF créé avec succès");
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

  // ----- View Deliverable -----

  async function handleView(deliverable: AcbfDeliverable) {
    setSelectedDeliverable(deliverable);
    setViewDialogOpen(true);

    // Fetch full detail
    try {
      const res = await fetch(`/api/acbf-deliverables/${deliverable.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedDeliverable((prev) =>
          prev ? { ...prev, ...data.data } : prev
        );
      }
    } catch {
      // Keep existing data
    }
  }

  // ----- Edit Deliverable -----

  function openEditDialog(deliverable: AcbfDeliverable) {
    setSelectedDeliverable(deliverable);
    setForm({
      code: deliverable.code,
      name: deliverable.name,
      domainId: deliverable.domainId,
      description: deliverable.description || "",
      priority: deliverable.priority,
      status: deliverable.status,
    });
    setFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedDeliverable) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        domainId: form.domainId,
        description: form.description?.trim() || null,
        priority: form.priority || null,
        status: form.status?.trim() || null,
      };

      const res = await fetch(`/api/acbf-deliverables/${selectedDeliverable.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Livrable ACBF modifié avec succès");
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
    deliverable: AcbfDeliverable,
    action: "archive" | "restore"
  ) {
    setSelectedDeliverable(deliverable);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedDeliverable) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/acbf-deliverables/${selectedDeliverable.id}`, {
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
          ? "Livrable ACBF archivé avec succès"
          : "Livrable ACBF restauré avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedDeliverable(null);
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
            Livrables ACBF
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer le référentiel des livrables ACBF
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
              Vous n&apos;avez pas la permission de consulter les livrables ACBF.
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
            Livrables ACBF
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer le référentiel des livrables ACBF
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
            Ajouter un livrable
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

            {/* Domain Filter */}
            <Select
              value={domainFilter || "__all__"}
              onValueChange={(v) => setDomainFilter(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-full lg:w-[220px] h-9">
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
            {(search || statusFilter !== "active" || domainFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("active");
                  setDomainFilter("");
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

      {/* Deliverables Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Liste des livrables ACBF
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} livrable{total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
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
          {!loading && !error && deliverables.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <FileCheck className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucun livrable ACBF trouvé
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || statusFilter !== "active" || domainFilter
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucun livrable ACBF n'a été créé pour le moment."}
              </p>
              {(search || statusFilter !== "active" || domainFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("active");
                    setDomainFilter("");
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
          {!loading && !error && deliverables.length > 0 && (
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
                        Domaine ACBF
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Priorité
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
                    {deliverables.map((deliverable) => (
                      <TableRow
                        key={deliverable.id}
                        className={
                          deliverable.deletedAt
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
                            {deliverable.code}
                          </Badge>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <FileCheck className="h-4 w-4" />
                            </div>
                            <span
                              className="truncate max-w-[200px]"
                              title={deliverable.name}
                            >
                              {deliverable.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Domain */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[180px]" title={deliverable.domain?.name || undefined}>
                              {deliverable.domain?.code} — {deliverable.domain?.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Priority */}
                        <TableCell className="hidden lg:table-cell">
                          {getPriorityBadge(deliverable.priority) ?? (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge deletedAt={deliverable.deletedAt} isActive={deliverable.isActive} gender="m" />
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
                                  onClick={() => handleView(deliverable)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Voir les détails
                              </TooltipContent>
                            </Tooltip>

                            {canUpdate && !deliverable.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(deliverable)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (deliverable.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() =>
                                        openArchiveDialog(deliverable, "restore")
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
                                        openArchiveDialog(deliverable, "archive")
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
              <PaginationControls
                page={page}
                totalPages={totalPages}
                total={total}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Create Deliverable Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Nouveau livrable ACBF
            </DialogTitle>
            <DialogDescription>
              Créez un nouveau livrable ACBF dans le référentiel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="ex: LIV1"
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
                placeholder="Nom du livrable ACBF"
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
              <Label htmlFor="create-domainId">
                Domaine ACBF <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.domainId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    domainId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className={formErrors.domainId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Sélectionner un domaine" />
                </SelectTrigger>
                <SelectContent>
                  {domainOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.domainId && (
                <p className="text-xs text-red-500">{formErrors.domainId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Description du livrable..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                maxLength={2000}
                className={formErrors.description ? "border-red-500" : ""}
              />
              <p className="text-xs text-slate-400 text-right">{(form.description || "").length}/2000</p>
              {formErrors.description && (
                <p className="text-xs text-red-500">
                  {formErrors.description}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-priority">Priorité</Label>
                <Select
                  value={form.priority || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: v === "__none__" ? null : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-status">Statut</Label>
                <Input
                  id="create-status"
                  placeholder="ex: En cours"
                  value={form.status || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value || null,
                    }))
                  }
                />
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
              Créer le livrable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Deliverable Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier le livrable ACBF
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du livrable ACBF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-code"
                placeholder="ex: LIV1"
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
                placeholder="Nom du livrable ACBF"
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
              <Label htmlFor="edit-domainId">
                Domaine ACBF <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.domainId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    domainId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger className={formErrors.domainId ? "border-red-500" : ""}>
                  <SelectValue placeholder="Sélectionner un domaine" />
                </SelectTrigger>
                <SelectContent>
                  {domainOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.domainId && (
                <p className="text-xs text-red-500">{formErrors.domainId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Description du livrable..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                maxLength={2000}
                className={formErrors.description ? "border-red-500" : ""}
              />
              <p className="text-xs text-slate-400 text-right">{(form.description || "").length}/2000</p>
              {formErrors.description && (
                <p className="text-xs text-red-500">
                  {formErrors.description}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priorité</Label>
                <Select
                  value={form.priority || "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: v === "__none__" ? null : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Statut</Label>
                <Input
                  id="edit-status"
                  placeholder="ex: En cours"
                  value={form.status || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value || null,
                    }))
                  }
                />
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
      {/* View Deliverable Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-600" />
              Détails du livrable ACBF
            </DialogTitle>
            <DialogDescription>
              Informations détaillées du livrable ACBF.
            </DialogDescription>
          </DialogHeader>
          {selectedDeliverable && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Basic info */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Code
                      </p>
                      <Badge
                        variant="outline"
                        className="mt-1 text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
                      >
                        {selectedDeliverable.code}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Domaine ACBF
                      </p>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedDeliverable.domain?.code} — {selectedDeliverable.domain?.name}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Nom
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                      {selectedDeliverable.name}
                    </p>
                  </div>
                  {selectedDeliverable.description && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-900 dark:text-white mt-1 whitespace-pre-wrap">
                        {selectedDeliverable.description}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Priorité
                      </p>
                      <div className="mt-1">
                        {getPriorityBadge(selectedDeliverable.priority) ?? (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Statut
                      </p>
                      <div className="mt-1">
                        {selectedDeliverable.status ? (
                          <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
                            {selectedDeliverable.status}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        État
                      </p>
                      <div className="mt-1">
                        {selectedDeliverable.deletedAt ? (
                          <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                            Archivé
                          </Badge>
                        ) : !selectedDeliverable.isActive ? (
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                            Inactif
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                            Actif
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Créé le
                      </p>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDate(selectedDeliverable.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Mis à jour le
                    </p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDate(selectedDeliverable.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Archive/Restore AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction === "archive"
                ? "Archiver le livrable ACBF"
                : "Restaurer le livrable ACBF"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? `Êtes-vous sûr de vouloir archiver le livrable "${selectedDeliverable?.name}" ?`
                : `Êtes-vous sûr de vouloir restaurer le livrable "${selectedDeliverable?.name}" ?`}
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
