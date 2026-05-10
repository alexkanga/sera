"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  RotateCcw,
  Lock,
  Users,
  Key,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
}

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: PermissionItem[];
  userCount: number;
}

interface RoleDetail extends RoleItem {
  users: Array<{
    id: string;
    name: string;
    email: string;
    ptaCode: string | null;
  }>;
}

// ─── Helper: Check user permissions ──────────────────────────────────────────

function useUserPermissions() {
  const { data: session } = useSession();
  const allPermissions: string[] = [];
  if (session?.user?.roles) {
    session.user.roles.forEach((r) => {
      r.permissions.forEach((p) => allPermissions.push(p));
    });
  }
  const has = (perm: string) =>
    allPermissions.includes(perm) || allPermissions.includes("roles:*") || allPermissions.includes("*");
  return {
    canRead: has("roles:read"),
    canCreate: has("roles:create"),
    canUpdate: has("roles:update"),
    canArchive: has("roles:archive"),
    canReadPermissions: allPermissions.includes("permissions:read") || allPermissions.includes("permissions:*") || allPermissions.includes("*"),
  };
}

// ─── Module label mapping ────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  auth: "Authentification",
  org: "Organisation",
  strategic: "Stratégie",
  acbf: "ACBF",
  pta: "PTA",
  raci: "RACI",
  gantt: "Gantt",
  dashboard: "Tableau de bord",
  docs: "Documents",
  reports: "Rapports",
  notifications: "Notifications",
  audit: "Audit",
  import: "Import",
  export: "Export",
};

function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] || module.charAt(0).toUpperCase() + module.slice(1);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function RolesSection() {
  const perms = useUserPermissions();

  // Data state
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Selected role
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RoleItem | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">("archive");

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    permissionIds: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch roles ─────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = showArchived ? "/api/roles?archived=true" : "/api/roles";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des rôles");
      }
      const data = await res.json();
      setRoles(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  // ─── Fetch permissions (for role form) ───────────────────────────────────

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/permissions");
      if (!res.ok) return;
      const data = await res.json();
      setPermissions(data.data || []);
    } catch {
      // Silent fail for permissions fetch
    }
  }, []);

  useEffect(() => {
    if (perms.canRead) {
      fetchRoles();
    }
  }, [perms.canRead, fetchRoles]);

  useEffect(() => {
    if (createDialogOpen || editDialogOpen) {
      fetchPermissions();
    }
  }, [createDialogOpen, editDialogOpen, fetchPermissions]);

  // ─── Filter roles ────────────────────────────────────────────────────────

  const filteredRoles = roles.filter((role) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      role.code.toLowerCase().includes(q) ||
      role.name.toLowerCase().includes(q) ||
      (role.description?.toLowerCase().includes(q) ?? false)
    );
  });

  // Group permissions by module
  const permissionsByModule = permissions.reduce(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {} as Record<string, PermissionItem[]>
  );

  // ─── Form validation ─────────────────────────────────────────────────────

  function validateForm(isEdit = false): boolean {
    const errors: Record<string, string> = {};

    if (!isEdit) {
      if (!formData.code || formData.code.length < 2) {
        errors.code = "Le code doit contenir au moins 2 caractères";
      }
      if (formData.code && formData.code !== formData.code.toUpperCase()) {
        errors.code = "Le code doit être en majuscules";
      }
    }

    if (!formData.name || formData.name.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caractères";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ─── Create role ─────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!validateForm()) return;
    try {
      setSubmitting(true);
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          permissionIds: formData.permissionIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }
      toast.success("Rôle créé avec succès");
      setCreateDialogOpen(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Update role ─────────────────────────────────────────────────────────

  async function handleUpdate() {
    if (!selectedRole) return;
    if (!validateForm(true)) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          permissionIds: formData.permissionIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }
      toast.success("Rôle mis à jour avec succès");
      setEditDialogOpen(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── View role detail ────────────────────────────────────────────────────

  async function handleViewRole(role: RoleItem) {
    try {
      const res = await fetch(`/api/roles/${role.id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }
      const data = await res.json();
      setSelectedRole(data.data);
      setViewDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du chargement du rôle");
    }
  }

  // ─── Edit role ───────────────────────────────────────────────────────────

  function handleEditRole(role: RoleItem) {
    if (role.isSystem) {
      toast.error("Les rôles système ne peuvent pas être modifiés");
      return;
    }
    setFormData({
      code: role.code,
      name: role.name,
      description: role.description || "",
      permissionIds: role.permissions.map((p) => p.id),
    });
    setFormErrors({});
    setSelectedRole(role as unknown as RoleDetail);
    setEditDialogOpen(true);
  }

  // ─── Archive / Restore ──────────────────────────────────────────────────

  async function handleArchiveRestore() {
    if (!archiveTarget) return;
    try {
      const res = await fetch(`/api/roles/${archiveTarget.id}`, {
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
          ? "Rôle archivé avec succès"
          : "Rôle restauré avec succès"
      );
      setArchiveDialogOpen(false);
      setArchiveTarget(null);
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    }
  }

  // ─── Reset form ──────────────────────────────────────────────────────────

  function resetForm() {
    setFormData({ code: "", name: "", description: "", permissionIds: [] });
    setFormErrors({});
    setSelectedRole(null);
  }

  // ─── Toggle permission ──────────────────────────────────────────────────

  function togglePermission(permissionId: string) {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  }

  function toggleModulePermissions(modulePerms: PermissionItem[]) {
    const moduleIds = modulePerms.map((p) => p.id);
    const allSelected = moduleIds.every((id) => formData.permissionIds.includes(id));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissionIds: prev.permissionIds.filter((id) => !moduleIds.includes(id)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissionIds: [...new Set([...prev.permissionIds, ...moduleIds])],
      }));
    }
  }

  // ─── Permission Assignment Component ─────────────────────────────────────

  function PermissionAssignment() {
    const sortedModules = Object.keys(permissionsByModule).sort();
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Permissions</Label>
        <ScrollArea className="h-64 rounded-md border p-3">
          {sortedModules.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Chargement des permissions...
            </div>
          ) : (
            <div className="space-y-4">
              {sortedModules.map((module) => {
                const modulePerms = permissionsByModule[module];
                const allSelected = modulePerms.every((p) =>
                  formData.permissionIds.includes(p.id)
                );
                const someSelected = modulePerms.some((p) =>
                  formData.permissionIds.includes(p.id)
                );
                return (
                  <div key={module} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected}
                        ref={(el) => {
                          if (el) {
                            (el as unknown as HTMLInputElement).dataset.state = someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked";
                          }
                        }}
                        onCheckedChange={() => toggleModulePermissions(modulePerms)}
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {getModuleLabel(module)}
                      </span>
                      {someSelected && !allSelected && (
                        <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">
                          Partiel
                        </Badge>
                      )}
                    </div>
                    <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {modulePerms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                        >
                          <Checkbox
                            checked={formData.permissionIds.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                          />
                          <span className="truncate">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        {formData.permissionIds.length > 0 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {formData.permissionIds.length} permission(s) sélectionnée(s)
          </p>
        )}
      </div>
    );
  }

  // ─── Access Denied ───────────────────────────────────────────────────────

  if (!perms.canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des rôles
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Définir et configurer les rôles d&apos;accès à la plateforme
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lock className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm text-muted-foreground">Accès refusé</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vous n&apos;avez pas la permission de consulter les rôles
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des rôles
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Définir et configurer les rôles d&apos;accès à la plateforme
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des rôles
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchRoles}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Gestion des rôles
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Définir et configurer les rôles d&apos;accès à la plateforme
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher un rôle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            <Archive className="h-4 w-4 mr-1" />
            {showArchived ? "Masquer archivés" : "Voir archivés"}
          </Button>
          {perms.canCreate && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                resetForm();
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nouveau rôle
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{roles.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Système</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {roles.filter((r) => r.isSystem).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Actifs</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {roles.filter((r) => r.isActive && !r.deletedAt).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Archivés</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {roles.filter((r) => r.deletedAt).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {filteredRoles.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery
                ? "Aucun rôle ne correspond à votre recherche"
                : "Aucun rôle trouvé"}
            </p>
            {searchQuery && (
              <Button
                variant="link"
                size="sm"
                className="mt-2 text-emerald-600"
                onClick={() => setSearchQuery("")}
              >
                Effacer la recherche
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRoles.map((role) => (
          <Card
            key={role.id}
            className={`group transition-all hover:shadow-md ${
              role.deletedAt
                ? "opacity-60 border-slate-300 dark:border-slate-700"
                : "border-slate-200 dark:border-slate-700"
            } ${role.isSystem ? "ring-1 ring-emerald-200 dark:ring-emerald-800" : ""}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                      role.isSystem
                        ? "bg-emerald-100 dark:bg-emerald-900"
                        : "bg-slate-100 dark:bg-slate-800"
                    }`}
                  >
                    {role.isSystem ? (
                      <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Shield className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{role.name}</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {role.code}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {role.isSystem && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                      Système
                    </Badge>
                  )}
                  {role.deletedAt && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400 text-[10px] px-1.5 py-0">
                      Archivé
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {role.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {role.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  <span>{role.userCount} utilisateur(s)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Key className="h-3.5 w-3.5" />
                  <span>{role.permissions.length} permission(s)</span>
                </div>
              </div>
              {/* Permission badges */}
              {role.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 3).map((p) => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    >
                      {p.code}
                    </Badge>
                  ))}
                  {role.permissions.length > 3 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
                    >
                      +{role.permissions.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              <Separator />
              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-600 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
                  onClick={() => handleViewRole(role)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Voir
                </Button>
                {!role.isSystem && perms.canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-slate-600 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400"
                    onClick={() => handleEditRole(role)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Modifier
                  </Button>
                )}
                {!role.isSystem && perms.canArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 text-xs ${
                      role.deletedAt
                        ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        : "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    }`}
                    onClick={() => {
                      setArchiveTarget(role);
                      setArchiveAction(role.deletedAt ? "restore" : "archive");
                      setArchiveDialogOpen(true);
                    }}
                  >
                    {role.deletedAt ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restaurer
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        Archiver
                      </>
                    )}
                  </Button>
                )}
                {role.isSystem && (
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Lecture seule
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE ROLE DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setCreateDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Nouveau rôle
            </DialogTitle>
            <DialogDescription>
              Créer un nouveau rôle et lui attribuer des permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="Ex: SUPERVISOR"
                value={formData.code}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
                className={formErrors.code ? "border-red-500" : ""}
              />
              {formErrors.code && (
                <p className="text-xs text-red-500">{formErrors.code}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Code unique en majuscules (min. 2 caractères)
              </p>
            </div>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="create-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="Ex: Superviseur"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Description du rôle..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            {/* Permission Assignment */}
            <PermissionAssignment />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateDialogOpen(false); resetForm(); }}
            >
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreate}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le rôle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW ROLE DETAIL DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRole && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                    <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  {selectedRole.name}
                </DialogTitle>
                <DialogDescription>
                  Détails du rôle <span className="font-mono">{selectedRole.code}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-2">
                {/* Info Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Code</p>
                    <p className="text-sm font-mono font-medium">{selectedRole.code}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Nom</p>
                    <p className="text-sm font-medium">{selectedRole.name}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">
                      {selectedRole.description || "Aucune description"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <div>
                      {selectedRole.isSystem ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">
                          <Lock className="h-3 w-3 mr-1" />
                          Système
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Personnalisé</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Statut</p>
                    <div>
                      {selectedRole.deletedAt ? (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400">
                          Archivé
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400">
                          Actif
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Permissions */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Permissions ({selectedRole.permissions.length})
                  </h4>
                  {selectedRole.permissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucune permission attribuée
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(
                        selectedRole.permissions.reduce(
                          (acc, p) => {
                            if (!acc[p.module]) acc[p.module] = [];
                            acc[p.module].push(p);
                            return acc;
                          },
                          {} as Record<string, PermissionItem[]>
                        )
                      )
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([module, perms]) => (
                          <div key={module}>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                              {getModuleLabel(module)}
                            </p>
                            <div className="flex flex-wrap gap-1 ml-2">
                              {perms.map((p) => (
                                <Badge
                                  key={p.id}
                                  variant="secondary"
                                  className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                >
                                  {p.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Users */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Utilisateurs ({selectedRole.users?.length ?? 0})
                  </h4>
                  {!selectedRole.users || selectedRole.users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun utilisateur avec ce rôle
                    </p>
                  ) : (
                    <ScrollArea className="max-h-40">
                      <div className="space-y-1">
                        {selectedRole.users.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                              {user.name.charAt(0)}
                            </div>
                            <span className="truncate">{user.name}</span>
                            <span className="text-xs text-muted-foreground ml-auto shrink-0">
                              {user.email}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Fermer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT ROLE DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setEditDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Modifier le rôle
            </DialogTitle>
            <DialogDescription>
              Modifier les informations et permissions du rôle
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Code (read-only) */}
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={formData.code} disabled className="bg-slate-50 dark:bg-slate-800" />
              <p className="text-xs text-muted-foreground">
                Le code ne peut pas être modifié après la création
              </p>
            </div>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            {/* Permission Assignment */}
            <PermissionAssignment />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditDialogOpen(false); resetForm(); }}
            >
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          ARCHIVE / RESTORE CONFIRMATION
          ═══════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveAction === "archive"
                ? "Archiver le rôle"
                : "Restaurer le rôle"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive" ? (
                <>
                  Êtes-vous sûr de vouloir archiver le rôle{" "}
                  <span className="font-semibold">{archiveTarget?.name}</span> ?
                  Les utilisateurs ayant ce rôle perdront leurs accès associés.
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir restaurer le rôle{" "}
                  <span className="font-semibold">{archiveTarget?.name}</span> ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveRestore}
              className={
                archiveAction === "archive"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {archiveAction === "archive" ? "Archiver" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
