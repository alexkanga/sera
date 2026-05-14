"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Network,
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
  Building2,
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

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface DirectionOption {
  id: string;
  code: string;
  name: string;
}

interface Unit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  directionId: string;
  headUserId: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  direction: DirectionOption;
  headUser: UserOption | null;
}

// ============================================================
// Zod Schemas
// ============================================================

const unitFormSchema = z.object({
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
  directionId: z.string().min(1, "La direction est requise"),
  headUserId: z.string().optional(),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

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

export function UnitsSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "units:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "units:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "units:update");
  const canArchive = checkPermission(
    session?.user?.roles ?? [],
    "units:archive"
  );

  // ----- List state -----
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
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

  // ----- Selected unit -----
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">(
    "archive"
  );

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Dropdown options -----
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>(
    []
  );

  // ----- Form state -----
  const [form, setForm] = useState<UnitFormValues>({
    code: "",
    name: "",
    description: "",
    directionId: "",
    headUserId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Units
  // ============================================================

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (directionFilter && directionFilter !== "__all__")
        params.set("directionId", directionFilter);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);

      const res = await fetch(`/api/units?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setUnits(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, directionFilter, statusFilter]);

  useEffect(() => {
    if (canRead) {
      fetchUnits();
    }
  }, [canRead, fetchUnits, refreshKey]);

  // ============================================================
  // Fetch Users & Directions for dropdowns
  // ============================================================

  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const [usersRes, directionsRes] = await Promise.all([
          fetch("/api/users?limit=100"),
          fetch("/api/directions?limit=100"),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserOptions(
            data.data.map((u: UserOption) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }))
          );
        }

        if (directionsRes.ok) {
          const data = await directionsRes.json();
          setDirectionOptions(
            data.data.map((d: DirectionOption) => ({
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
    fetchDropdownData();
  }, []);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, directionFilter, statusFilter]);

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
      description: "",
      directionId: "",
      headUserId: "",
    });
    setFormErrors({});
  }

  function validateForm(): boolean {
    const result = unitFormSchema.safeParse(form);
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

  // ----- Create Unit -----

  async function handleCreate() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        directionId: form.directionId,
        headUserId: form.headUserId || null,
      };

      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Unité créée avec succès");
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

  // ----- View Unit -----

  function handleView(unit: Unit) {
    setSelectedUnit(unit);
    setViewDialogOpen(true);
  }

  // ----- Edit Unit -----

  function openEditDialog(unit: Unit) {
    setSelectedUnit(unit);
    setForm({
      code: unit.code,
      name: unit.name,
      description: unit.description || "",
      directionId: unit.directionId,
      headUserId: unit.headUserId || "",
    });
    setFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedUnit) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        directionId: form.directionId,
        headUserId: form.headUserId || null,
      };

      const res = await fetch(`/api/units/${selectedUnit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Unité modifiée avec succès");
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

  function openArchiveDialog(unit: Unit, action: "archive" | "restore") {
    setSelectedUnit(unit);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedUnit) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/units/${selectedUnit.id}`, {
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
          ? "Unité archivée avec succès"
          : "Unité restaurée avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedUnit(null);
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
            Gestion des unités
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les unités organisationnelles
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
              Vous n&apos;avez pas la permission de consulter les unités.
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
            Gestion des unités
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les unités organisationnelles
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
            Ajouter une unité
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

            {/* Direction Filter */}
            <Select
              value={directionFilter || "__all__"}
              onValueChange={(v) =>
                setDirectionFilter(v === "__all__" ? "" : v)
              }
            >
              <SelectTrigger className="w-full lg:w-[260px] h-9">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Toutes les directions" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les directions</SelectItem>
                {directionOptions.map((dir) => (
                  <SelectItem key={dir.id} value={dir.id}>
                    {dir.code} — {dir.name}
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
            {(search || directionFilter || statusFilter !== "active") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDirectionFilter("");
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

      {/* Units Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Network className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">Liste des unités</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} unité{total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-32" />
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
          {!loading && !error && units.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Network className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucune unité trouvée
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || directionFilter || statusFilter !== "active"
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucune unité n'a été créée pour le moment."}
              </p>
              {(search || directionFilter || statusFilter !== "active") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setDirectionFilter("");
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
          {!loading && !error && units.length > 0 && (
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
                        Direction
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Responsable
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
                    {units.map((unit) => (
                      <TableRow
                        key={unit.id}
                        className={
                          unit.deletedAt
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
                            {unit.code}
                          </Badge>
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <Network className="h-4 w-4" />
                            </div>
                            <span
                              className="truncate max-w-[200px]"
                              title={unit.name}
                            >
                              {unit.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Direction */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span
                              className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[160px]"
                              title={unit.direction.name}
                            >
                              {unit.direction.code} — {unit.direction.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Head User */}
                        <TableCell className="hidden lg:table-cell">
                          {unit.headUser ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                                {unit.headUser.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                              <span
                                className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[140px]"
                                title={unit.headUser.name}
                              >
                                {unit.headUser.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">
                              Non assigné
                            </span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {unit.deletedAt ? (
                            <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                              Archivée
                            </Badge>
                          ) : !unit.isActive ? (
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
                                  onClick={() => handleView(unit)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Voir les détails
                              </TooltipContent>
                            </Tooltip>

                            {canUpdate && !unit.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(unit)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (unit.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() =>
                                        openArchiveDialog(unit, "restore")
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
                                        openArchiveDialog(unit, "archive")
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
      {/* Create Unit Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-emerald-600" />
              Nouvelle unité
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle unité organisationnelle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="ex: DEX_RH"
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
                placeholder="Nom de l'unité"
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
                placeholder="Description de l'unité..."
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
              <Label htmlFor="create-direction">
                Direction <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.directionId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    directionId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger
                  className={formErrors.directionId ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Sélectionner une direction" />
                </SelectTrigger>
                <SelectContent>
                  {directionOptions.map((dir) => (
                    <SelectItem key={dir.id} value={dir.id}>
                      {dir.code} — {dir.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.directionId && (
                <p className="text-xs text-red-500">
                  {formErrors.directionId}
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
              Créer l&apos;unité
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Unit Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier l&apos;unité
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de l&apos;unité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-code"
                placeholder="ex: DEX_RH"
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
                placeholder="Nom de l'unité"
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
                placeholder="Description de l'unité..."
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
              <Label htmlFor="edit-direction">
                Direction <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.directionId || "__none__"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    directionId: v === "__none__" ? "" : v,
                  }))
                }
              >
                <SelectTrigger
                  className={formErrors.directionId ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Sélectionner une direction" />
                </SelectTrigger>
                <SelectContent>
                  {directionOptions.map((dir) => (
                    <SelectItem key={dir.id} value={dir.id}>
                      {dir.code} — {dir.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.directionId && (
                <p className="text-xs text-red-500">
                  {formErrors.directionId}
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
      {/* View Unit Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-emerald-600" />
              Détails de l&apos;unité
            </DialogTitle>
            <DialogDescription>
              Informations détaillées de l&apos;unité.
            </DialogDescription>
          </DialogHeader>
          {selectedUnit && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Code</p>
                  <Badge
                    variant="outline"
                    className="font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    {selectedUnit.code}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Statut</p>
                  {selectedUnit.deletedAt ? (
                    <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                      Archivée
                    </Badge>
                  ) : selectedUnit.isActive ? (
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
                  Nom de l&apos;unité
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {selectedUnit.name}
                </p>
              </div>

              {selectedUnit.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {selectedUnit.description}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Direction rattachée
                </p>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                    <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {selectedUnit.direction.code}
                      </Badge>
                      <span className="text-sm font-medium">
                        {selectedUnit.direction.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Responsable
                </p>
                {selectedUnit.headUser ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                      {selectedUnit.headUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {selectedUnit.headUser.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedUnit.headUser.email}
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

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Créée le {formatDate(selectedUnit.createdAt)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Modifiée le {formatDate(selectedUnit.updatedAt)}
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
                ? "Archiver l'unité"
                : "Restaurer l'unité"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? `Êtes-vous sûr de vouloir archiver l'unité "${selectedUnit?.name}" ?`
                : `Êtes-vous sûr de vouloir restaurer l'unité "${selectedUnit?.name}" ?`}
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
