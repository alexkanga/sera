"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Building2,
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
  Network,
  Users,
  Hash,
  UserCheck,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkPermission } from "@/lib/client-permissions";

// ============================================================
// Types
// ============================================================

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface UnitItem {
  id: string;
  code: string;
  name: string;
  headUser: UserOption | null;
}

interface Direction {
  id: string;
  code: string;
  name: string;
  description: string | null;
  headUserId: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  headUser: UserOption | null;
  units: UnitItem[];
  _count?: { units: number };
}

// ============================================================
// Zod Schemas
// ============================================================

const directionFormSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .max(20, "Maximum 20 caractères")
    .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement"),
  name: z
    .string()
    .min(2, "Minimum 2 caractères")
    .max(200, "Maximum 200 caractères"),
  description: z.string().max(1000, "Maximum 1000 caractères").optional(),
  headUserId: z.string().optional(),
});

type DirectionFormValues = z.infer<typeof directionFormSchema>;

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

// ============================================================
// Permission Helpers
// ============================================================
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

// ============================================================
// Main Component
// ============================================================

export function DirectionsSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "directions:read");
  const canCreate = checkPermission(
    session?.user?.roles ?? [],
    "directions:create"
  );
  const canUpdate = checkPermission(
    session?.user?.roles ?? [],
    "directions:update"
  );
  const canArchive = checkPermission(
    session?.user?.roles ?? [],
    "directions:archive"
  );

  // ----- List state -----
  const [directions, setDirections] = useState<Direction[]>([]);
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

  // ----- Selected direction -----
  const [selectedDirection, setSelectedDirection] =
    useState<Direction | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">(
    "archive"
  );

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Users for head dropdown -----
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);

  // ----- Form state -----
  const [form, setForm] = useState<DirectionFormValues>({
    code: "",
    name: "",
    description: "",
    headUserId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Directions
  // ============================================================

  const fetchDirections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("includeUnits", "true");

      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);

      const res = await fetch(`/api/directions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setDirections(data.data);
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
      fetchDirections();
    }
  }, [canRead, fetchDirections, refreshKey]);

  // ============================================================
  // Fetch Users for dropdown
  // ============================================================

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users?limit=100");
        if (res.ok) {
          const data = await res.json();
          setUserOptions(
            data.data.map((u: UserOption) => ({
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
    fetchUsers();
  }, []);

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
    setForm({ code: "", name: "", description: "", headUserId: "" });
    setFormErrors({});
  }

  function validateForm(): boolean {
    const result = directionFormSchema.safeParse(form);
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

  // ----- Create Direction -----

  async function handleCreate() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        headUserId: form.headUserId || null,
      };

      const res = await fetch("/api/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Direction créée avec succès");
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

  // ----- View Direction -----

  function handleView(direction: Direction) {
    setSelectedDirection(direction);
    setViewDialogOpen(true);
  }

  // ----- Edit Direction -----

  function openEditDialog(direction: Direction) {
    setSelectedDirection(direction);
    setForm({
      code: direction.code,
      name: direction.name,
      description: direction.description || "",
      headUserId: direction.headUserId || "",
    });
    setFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedDirection) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        headUserId: form.headUserId || null,
      };

      const res = await fetch(`/api/directions/${selectedDirection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Direction modifiée avec succès");
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
    direction: Direction,
    action: "archive" | "restore"
  ) {
    setSelectedDirection(direction);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedDirection) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/directions/${selectedDirection.id}`, {
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
          ? "Direction archivée avec succès"
          : "Direction restaurée avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedDirection(null);
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
            Gestion des directions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les directions de l&apos;organisation
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
              Vous n&apos;avez pas la permission de consulter les directions.
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
            Gestion des directions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les directions de l&apos;organisation
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
            Ajouter une direction
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
                  Actives
                </TabsTrigger>
                <TabsTrigger value="archived" className="text-xs px-3">
                  Archivées
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs px-3">
                  Toutes
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

      {/* Directions Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Liste des directions
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} direction{total !== 1 ? "s" : ""} au total
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
          {!loading && !error && directions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Building2 className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucune direction trouvée
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || statusFilter !== "active"
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucune direction n'a été créée pour le moment."}
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
          {!loading && !error && directions.length > 0 && (
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
                        Responsable
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Unités
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
                    {directions.map((direction) => (
                      <TableRow
                        key={direction.id}
                        className={
                          direction.deletedAt
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
                            {direction.code}
                          </Badge>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <span
                              className="truncate max-w-[200px]"
                              title={direction.name}
                            >
                              {direction.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Head User */}
                        <TableCell className="hidden md:table-cell">
                          {direction.headUser ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                {direction.headUser.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <span
                                className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[140px]"
                                title={direction.headUser.name}
                              >
                                {direction.headUser.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Non assigné
                            </span>
                          )}
                        </TableCell>

                        {/* Units Count */}
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Network className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {direction._count?.units ?? direction.units?.length ?? 0}{" "}
                              unité
                              {(direction._count?.units ?? direction.units?.length ?? 0) !== 1
                                ? "s"
                                : ""}
                            </span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {direction.deletedAt ? (
                            <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                              Archivée
                            </Badge>
                          ) : !direction.isActive ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                              Inactive
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                              Active
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
                                  onClick={() => handleView(direction)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Voir les détails
                              </TooltipContent>
                            </Tooltip>

                            {canUpdate && !direction.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(direction)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (direction.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() =>
                                        openArchiveDialog(
                                          direction,
                                          "restore"
                                        )
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
                                        openArchiveDialog(
                                          direction,
                                          "archive"
                                        )
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
      {/* Create Direction Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Nouvelle direction
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle direction organisationnelle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="ex: DEX"
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
                placeholder="Nom de la direction"
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
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Description de la direction..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                className={formErrors.description ? "border-red-500" : ""}
              />
              {formErrors.description && (
                <p className="text-xs text-red-500">
                  {formErrors.description}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-head">Responsable</Label>
              <Select
                value={form.headUserId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    headUserId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    Aucun responsable
                  </SelectItem>
                  {userOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              Créer la direction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Direction Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier la direction
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de la direction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-code"
                placeholder="ex: DEX"
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
                placeholder="Nom de la direction"
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
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Description de la direction..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                className={formErrors.description ? "border-red-500" : ""}
              />
              {formErrors.description && (
                <p className="text-xs text-red-500">
                  {formErrors.description}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-head">Responsable</Label>
              <Select
                value={form.headUserId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    headUserId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    Aucun responsable
                  </SelectItem>
                  {userOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      {/* View Direction Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              Détails de la direction
            </DialogTitle>
            <DialogDescription>
              Informations détaillées de la direction.
            </DialogDescription>
          </DialogHeader>
          {selectedDirection && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Code</p>
                  <Badge
                    variant="outline"
                    className="font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    {selectedDirection.code}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Statut</p>
                  {selectedDirection.deletedAt ? (
                    <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                      Archivée
                    </Badge>
                  ) : selectedDirection.isActive ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Nom de la direction
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {selectedDirection.name}
                </p>
              </div>

              {selectedDirection.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedDirection.description}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Responsable
                </p>
                {selectedDirection.headUser ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                      {selectedDirection.headUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {selectedDirection.headUser.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedDirection.headUser.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Aucun responsable assigné
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Unités ({selectedDirection.units?.length ?? 0})
                  </p>
                </div>
                {selectedDirection.units && selectedDirection.units.length > 0 ? (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {selectedDirection.units.map((unit) => (
                        <div
                          key={unit.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900">
                            <Network className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono"
                              >
                                {unit.code}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {unit.name}
                              </span>
                            </div>
                            {unit.headUser && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Resp. {unit.headUser.name}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-slate-400">
                    Aucune unité dans cette direction
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Créée le {formatDate(selectedDirection.createdAt)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Modifiée le {formatDate(selectedDirection.updatedAt)}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Archive / Restore Confirmation Dialog */}
      {/* ============================================================ */}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction === "archive"
                ? "Archiver la direction"
                : "Restaurer la direction"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? `Êtes-vous sûr de vouloir archiver la direction "${selectedDirection?.name}" ? Les unités associées ne seront pas supprimées.`
                : `Êtes-vous sûr de vouloir restaurer la direction "${selectedDirection?.name}" ?`}
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
