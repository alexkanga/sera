"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Clock,
  Shield,
  Calendar,
  Hash,
  UserCheck,
  UserX,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkPermission } from "@/lib/client-permissions";

// ============================================================
// Types
// ============================================================

interface UserRole {
  id: string;
  code: string;
  name: string;
  permissions: string[];
}

interface User {
  id: string;
  email: string;
  name: string;
  ptaCode: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: UserRole[];
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

// ============================================================
// Constants
// ============================================================

const DIRECTION_OPTIONS = [
  { value: "Cabinet Direction Exécutive", label: "Cabinet Direction Exécutive" },
  {
    value: "Direction des Services aux Membres et des Programmes",
    label: "DSMP — Services aux Membres et Programmes",
  },
  {
    value: "Direction Administrative et Financière",
    label: "DAF — Administrative et Financière",
  },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "archived", label: "Archivé" },
  { value: "all", label: "Tous" },
];

const ITEMS_PER_PAGE = 10;

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

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

// ============================================================
// Main Component
// ============================================================

export function UsersSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "users:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "users:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "users:update");
  const canArchive = checkPermission(session?.user?.roles ?? [], "users:archive");

  // ----- List state -----
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Dialog states -----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // ----- Selected user -----
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">("archive");

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- Roles for multi-select -----
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);

  // ----- Create form state -----
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    ptaCode: "",
    position: "",
    department: "",
    phone: "",
    roleIds: [] as string[],
  });
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({});

  // ----- Edit form state -----
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    ptaCode: "",
    position: "",
    department: "",
    phone: "",
    roleIds: [] as string[],
    isActive: true,
    isLocked: false,
    password: "",
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Users
  // ============================================================

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (filterDirection && filterDirection !== "__all__") params.set("department", filterDirection);
      if (filterRole && filterRole !== "__all__") params.set("role", filterRole);
      if (filterStatus && filterStatus !== "active") params.set("status", filterStatus);

      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setUsers(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterDirection, filterRole, filterStatus]);

  useEffect(() => {
    if (canRead) {
      fetchUsers();
    }
  }, [canRead, fetchUsers, refreshKey]);

  // ============================================================
  // Fetch Roles
  // ============================================================

  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/roles");
        if (res.ok) {
          const data = await res.json();
          setRoleOptions(
            data.data.map((r: RoleOption) => ({
              id: r.id,
              code: r.code,
              name: r.name,
            }))
          );
        }
      } catch {
        // Silently fail - roles will be empty
      }
    }
    fetchRoles();
  }, []);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, filterDirection, filterRole, filterStatus]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  // ----- Create User -----

  function validateCreateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!createForm.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) {
      errors.email = "Email invalide";
    }

    if (!createForm.password.trim()) {
      errors.password = "Le mot de passe est requis";
    } else if (createForm.password.length < 6) {
      errors.password = "Minimum 6 caractères";
    }

    if (!createForm.name.trim()) {
      errors.name = "Le nom complet est requis";
    } else if (createForm.name.trim().length < 2) {
      errors.name = "Minimum 2 caractères";
    }

    setCreateFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreateUser() {
    if (!validateCreateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        email: createForm.email.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        ptaCode: createForm.ptaCode.trim() || null,
        position: createForm.position.trim() || null,
        department: createForm.department || null,
        phone: createForm.phone.trim() || null,
        roleIds: createForm.roleIds,
      };

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Utilisateur créé avec succès");
      setCreateDialogOpen(false);
      resetCreateForm();
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setCreateForm({
      email: "",
      password: "",
      name: "",
      ptaCode: "",
      position: "",
      department: "",
      phone: "",
      roleIds: [],
    });
    setCreateFormErrors({});
  }

  // ----- View User -----

  async function handleViewUser(user: User) {
    setSelectedUser(user);
    setViewDialogOpen(true);
  }

  // ----- Edit User -----

  function openEditDialog(user: User) {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      ptaCode: user.ptaCode || "",
      position: user.position || "",
      department: user.department || "",
      phone: user.phone || "",
      roleIds: user.roles.map((r) => r.id),
      isActive: user.isActive,
      isLocked: user.isLocked,
      password: "",
    });
    setEditFormErrors({});
    setEditDialogOpen(true);
  }

  function validateEditForm(): boolean {
    const errors: Record<string, string> = {};

    if (!editForm.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      errors.email = "Email invalide";
    }

    if (!editForm.name.trim()) {
      errors.name = "Le nom complet est requis";
    } else if (editForm.name.trim().length < 2) {
      errors.name = "Minimum 2 caractères";
    }

    if (editForm.password && editForm.password.length < 6) {
      errors.password = "Minimum 6 caractères";
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEditUser() {
    if (!selectedUser) return;
    if (!validateEditForm()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        ptaCode: editForm.ptaCode.trim() || null,
        position: editForm.position.trim() || null,
        department: editForm.department || null,
        phone: editForm.phone.trim() || null,
        roleIds: editForm.roleIds,
        isActive: editForm.isActive,
        isLocked: editForm.isLocked,
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Utilisateur modifié avec succès");
      setEditDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la modification");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Archive / Restore -----

  function openArchiveDialog(user: User, action: "archive" | "restore") {
    setSelectedUser(user);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
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
          ? "Utilisateur archivé avec succès"
          : "Utilisateur restauré avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedUser(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    } finally {
      setSubmitting(false);
    }
  }

  // ============================================================
  // Role Multi-Select Helpers
  // ============================================================

  function toggleRoleSelection(formType: "create" | "edit", roleId: string) {
    if (formType === "create") {
      setCreateForm((prev) => ({
        ...prev,
        roleIds: prev.roleIds.includes(roleId)
          ? prev.roleIds.filter((id) => id !== roleId)
          : [...prev.roleIds, roleId],
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        roleIds: prev.roleIds.includes(roleId)
          ? prev.roleIds.filter((id) => id !== roleId)
          : [...prev.roleIds, roleId],
      }));
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
            Gestion des utilisateurs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les comptes utilisateurs de la plateforme
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
              Vous n&apos;avez pas la permission de consulter la liste des
              utilisateurs. Contactez votre administrateur si vous pensez qu&apos;il
              s&apos;agit d&apos;une erreur.
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
            Gestion des utilisateurs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Créer, modifier et gérer les comptes utilisateurs de la plateforme
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetCreateForm();
              setCreateDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel utilisateur
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
                placeholder="Rechercher par nom, email, code PTA..."
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
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="w-full lg:w-[260px] h-9">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Toutes les directions" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les directions</SelectItem>
                {DIRECTION_OPTIONS.map((dir) => (
                  <SelectItem key={dir.value} value={dir.value}>
                    {dir.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role Filter */}
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full lg:w-[200px] h-9">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Tous les rôles" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les rôles</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role.code} value={role.code}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-[150px] h-9">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Statut" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(search || filterDirection || filterRole || filterStatus !== "active") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilterDirection("");
                  setFilterRole("");
                  setFilterStatus("active");
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

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">Liste des utilisateurs</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} utilisateur{total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
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
          {!loading && !error && users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <Users className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucun utilisateur trouvé
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || filterDirection || filterRole || filterStatus !== "active"
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucun utilisateur n'a été créé pour le moment."}
              </p>
              {(search || filterDirection || filterRole || filterStatus !== "active") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setFilterDirection("");
                    setFilterRole("");
                    setFilterStatus("active");
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
          {!loading && !error && users.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Nom
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Email
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Code PTA
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Poste
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        Direction
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Rôles
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
                    {users.map((user) => (
                      <TableRow
                        key={user.id}
                        className={
                          user.deletedAt
                            ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20"
                            : ""
                        }
                      >
                        {/* Name */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shrink-0">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <span className="truncate max-w-[140px]" title={user.name}>
                              {user.name}
                            </span>
                          </div>
                        </TableCell>

                        {/* Email */}
                        <TableCell>
                          <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[180px] block" title={user.email}>
                            {user.email}
                          </span>
                        </TableCell>

                        {/* PTA Code */}
                        <TableCell className="hidden md:table-cell">
                          {user.ptaCode ? (
                            <Badge variant="outline" className="text-xs font-mono">
                              {user.ptaCode}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Position */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[160px] block" title={user.position || ""}>
                            {user.position || "—"}
                          </span>
                        </TableCell>

                        {/* Department */}
                        <TableCell className="hidden xl:table-cell">
                          <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[180px] block" title={user.department || ""}>
                            {user.department || "—"}
                          </span>
                        </TableCell>

                        {/* Roles */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length > 0 ? (
                              user.roles.slice(0, 2).map((role) => (
                                <Badge
                                  key={role.id}
                                  variant="secondary"
                                  className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                                >
                                  {role.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">Aucun</span>
                            )}
                            {user.roles.length > 2 && (
                              <Badge variant="secondary" className="text-[10px]">
                                +{user.roles.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.deletedAt ? (
                              <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                                Archivé
                              </Badge>
                            ) : !user.isActive ? (
                              <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                                Inactif
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                                Actif
                              </Badge>
                            )}
                            {user.isLocked && (
                              <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
                                <Lock className="h-2.5 w-2.5 mr-0.5" />
                                Verrouillé
                              </Badge>
                            )}
                          </div>
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
                                  onClick={() => handleViewUser(user)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir les détails</TooltipContent>
                            </Tooltip>

                            {canUpdate && !user.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(user)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (user.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() => openArchiveDialog(user, "restore")}
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
                                      onClick={() => openArchiveDialog(user, "archive")}
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
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                    })}
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
      {/* CREATE USER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Nouvel utilisateur
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouveau compte utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="create-name">
                Nom complet <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="Ex: Jean Dupont"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className={createFormErrors.name ? "border-red-500" : ""}
              />
              {createFormErrors.name && (
                <p className="text-xs text-red-500">{createFormErrors.name}</p>
              )}
            </div>

            {/* Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="email@aaea.org"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className={createFormErrors.email ? "border-red-500" : ""}
                />
                {createFormErrors.email && (
                  <p className="text-xs text-red-500">{createFormErrors.email}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-password">
                  Mot de passe <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className={createFormErrors.password ? "border-red-500" : ""}
                />
                {createFormErrors.password && (
                  <p className="text-xs text-red-500">{createFormErrors.password}</p>
                )}
              </div>
            </div>

            {/* PTA Code & Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-ptaCode">Code PTA</Label>
                <Input
                  id="create-ptaCode"
                  placeholder="Ex: DEX"
                  value={createForm.ptaCode}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, ptaCode: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-position">Poste</Label>
                <Input
                  id="create-position"
                  placeholder="Ex: Directeur Exécutif"
                  value={createForm.position}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, position: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Department & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-department">Direction</Label>
                <Select
                  value={createForm.department}
                  onValueChange={(val) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      department: val === "__none__" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger id="create-department">
                    <SelectValue placeholder="Sélectionner une direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {DIRECTION_OPTIONS.map((dir) => (
                      <SelectItem key={dir.value} value={dir.value}>
                        {dir.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-phone">Téléphone</Label>
                <Input
                  id="create-phone"
                  placeholder="Ex: +225 07 00 00 00"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Roles Multi-Select */}
            <div className="grid gap-2">
              <Label>Rôles</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="justify-start h-auto min-h-[36px] py-2 font-normal"
                  >
                    {createForm.roleIds.length === 0 ? (
                      <span className="text-muted-foreground">Sélectionner des rôles...</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {createForm.roleIds.map((roleId) => {
                          const role = roleOptions.find((r) => r.id === roleId);
                          return role ? (
                            <Badge
                              key={roleId}
                              className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            >
                              {role.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <ScrollArea className="max-h-[200px]">
                    <div className="p-2 space-y-1">
                      {roleOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">
                          Chargement des rôles...
                        </p>
                      ) : (
                        roleOptions.map((role) => (
                          <label
                            key={role.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Checkbox
                              checked={createForm.roleIds.includes(role.id)}
                              onCheckedChange={() =>
                                toggleRoleSelection("create", role.id)
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{role.name}</p>
                              <p className="text-xs text-muted-foreground">{role.code}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
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
              onClick={handleCreateUser}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Créer l&apos;utilisateur
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* VIEW USER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Détails de l&apos;utilisateur
            </DialogTitle>
            <DialogDescription>
              Informations complètes du compte utilisateur.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6 py-4">
              {/* User Header */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-xl font-bold shrink-0">
                  {selectedUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                    {selectedUser.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {selectedUser.email}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {selectedUser.deletedAt ? (
                      <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                        Archivé
                      </Badge>
                    ) : selectedUser.isActive ? (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                        <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
                        <UserX className="h-2.5 w-2.5 mr-0.5" />
                        Inactif
                      </Badge>
                    )}
                    {selectedUser.isLocked && (
                      <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
                        <Lock className="h-2.5 w-2.5 mr-0.5" />
                        Verrouillé
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem
                  icon={<Hash className="h-4 w-4" />}
                  label="Code PTA"
                  value={selectedUser.ptaCode}
                />
                <DetailItem
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Poste"
                  value={selectedUser.position}
                />
                <DetailItem
                  icon={<Building2 className="h-4 w-4" />}
                  label="Direction"
                  value={selectedUser.department}
                />
                <DetailItem
                  icon={<Phone className="h-4 w-4" />}
                  label="Téléphone"
                  value={selectedUser.phone}
                />
                <DetailItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Dernière connexion"
                  value={formatDate(selectedUser.lastLoginAt)}
                />
                <DetailItem
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date de création"
                  value={formatDate(selectedUser.createdAt)}
                />
              </div>

              <Separator />

              {/* Roles & Permissions */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Rôles et permissions
                </h4>
                {selectedUser.roles.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Aucun rôle assigné
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedUser.roles.map((role) => (
                      <div
                        key={role.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            {role.name}
                          </Badge>
                          <span className="text-xs text-slate-400 font-mono">
                            {role.code}
                          </span>
                        </div>
                        {role.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {role.permissions.map((perm) => (
                              <Badge
                                key={perm}
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
            {selectedUser && canUpdate && !selectedUser.deletedAt && (
              <Button
                onClick={() => {
                  setViewDialogOpen(false);
                  openEditDialog(selectedUser);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
            {selectedUser && canArchive && (
              selectedUser.deletedAt ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    openArchiveDialog(selectedUser, "restore");
                  }}
                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restaurer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    openArchiveDialog(selectedUser, "archive");
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* EDIT USER DIALOG */}
      {/* ============================================================ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Modifier l&apos;utilisateur
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations du compte utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">
                  Nom complet <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={editFormErrors.name ? "border-red-500" : ""}
                />
                {editFormErrors.name && (
                  <p className="text-xs text-red-500">{editFormErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className={editFormErrors.email ? "border-red-500" : ""}
                />
                {editFormErrors.email && (
                  <p className="text-xs text-red-500">{editFormErrors.email}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Nouveau mot de passe</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Laisser vide pour ne pas changer"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className={editFormErrors.password ? "border-red-500" : ""}
              />
              {editFormErrors.password && (
                <p className="text-xs text-red-500">{editFormErrors.password}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Laissez ce champ vide pour conserver le mot de passe actuel.
              </p>
            </div>

            {/* PTA Code & Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-ptaCode">Code PTA</Label>
                <Input
                  id="edit-ptaCode"
                  value={editForm.ptaCode}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, ptaCode: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-position">Poste</Label>
                <Input
                  id="edit-position"
                  value={editForm.position}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, position: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Department & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-department">Direction</Label>
                <Select
                  value={editForm.department}
                  onValueChange={(val) =>
                    setEditForm((prev) => ({
                      ...prev,
                      department: val === "__none__" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder="Sélectionner une direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune</SelectItem>
                    {DIRECTION_OPTIONS.map((dir) => (
                      <SelectItem key={dir.value} value={dir.value}>
                        {dir.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Active & Locked switches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Compte actif</Label>
                  <p className="text-xs text-muted-foreground">
                    Désactive le compte sans l&apos;archiver
                  </p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Verrouillé</Label>
                  <p className="text-xs text-muted-foreground">
                    Empêche la connexion au compte
                  </p>
                </div>
                <Switch
                  checked={editForm.isLocked}
                  onCheckedChange={(checked) =>
                    setEditForm((prev) => ({ ...prev, isLocked: checked }))
                  }
                />
              </div>
            </div>

            {/* Roles Multi-Select */}
            <div className="grid gap-2">
              <Label>Rôles</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="justify-start h-auto min-h-[36px] py-2 font-normal"
                  >
                    {editForm.roleIds.length === 0 ? (
                      <span className="text-muted-foreground">Sélectionner des rôles...</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {editForm.roleIds.map((roleId) => {
                          const role = roleOptions.find((r) => r.id === roleId);
                          return role ? (
                            <Badge
                              key={roleId}
                              className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                            >
                              {role.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <ScrollArea className="max-h-[200px]">
                    <div className="p-2 space-y-1">
                      {roleOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-2">
                          Chargement des rôles...
                        </p>
                      ) : (
                        roleOptions.map((role) => (
                          <label
                            key={role.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Checkbox
                              checked={editForm.roleIds.includes(role.id)}
                              onCheckedChange={() =>
                                toggleRoleSelection("edit", role.id)
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{role.name}</p>
                              <p className="text-xs text-muted-foreground">{role.code}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
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
              onClick={handleEditUser}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* ARCHIVE/RESTORE CONFIRMATION DIALOG */}
      {/* ============================================================ */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {archiveAction === "archive" ? (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Archive className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  Archiver l&apos;utilisateur
                </>
              ) : (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                    <RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Restaurer l&apos;utilisateur
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive" ? (
                <>
                  Êtes-vous sûr de vouloir archiver le compte de{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedUser?.name}
                  </span>{" "}
                  ? L&apos;utilisateur ne pourra plus se connecter et son compte sera
                  marqué comme archivé.
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir restaurer le compte de{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedUser?.name}
                  </span>{" "}
                  ? L&apos;utilisateur pourra à nouveau se connecter à la plateforme.
                </>
              )}
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {archiveAction === "archive" ? "Archivage..." : "Restauration..."}
                </>
              ) : archiveAction === "archive" ? (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archiver
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restaurer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Detail Item Sub-Component
// ============================================================

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}
