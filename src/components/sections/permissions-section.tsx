"use client";

import { useState, useEffect, useCallback } from "react";
import { useHasPermission } from "@/lib/client-permissions";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Search,
  Pencil,
  Lock,
  X,
  Loader2,
  AlertCircle,
  FolderOpen,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RoleSummary {
  id: string;
  code: string;
  name: string;
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  roles: RoleSummary[];
}

// ─── Helper: Check user permissions ──────────────────────────────────────────

function useUserPermissions() {
  const { has } = useHasPermission();
  return {
    canRead: has("permissions:read"),
    canCreate: has("permissions:create"),
    canUpdate: has("permissions:update"),
  };
}

// ─── Module options for create form ──────────────────────────────────────────

const MODULE_OPTIONS = [
  { value: "auth", label: "Authentification" },
  { value: "org", label: "Organisation" },
  { value: "strategic", label: "Stratégie" },
  { value: "acbf", label: "ACBF" },
  { value: "pta", label: "PTA" },
  { value: "raci", label: "RACI" },
  { value: "gantt", label: "Gantt" },
  { value: "dashboard", label: "Tableau de bord" },
  { value: "docs", label: "Documents" },
  { value: "reports", label: "Rapports" },
  { value: "notifications", label: "Notifications" },
  { value: "audit", label: "Audit" },
  { value: "import", label: "Import" },
  { value: "export", label: "Export" },
];

const MODULE_LABELS: Record<string, string> = {};
MODULE_OPTIONS.forEach((m) => {
  MODULE_LABELS[m.value] = m.label;
});

function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] || module.charAt(0).toUpperCase() + module.slice(1);
}

// Module icon/color mapping
const MODULE_COLORS: Record<string, string> = {
  auth: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400",
  org: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-400",
  strategic: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-400",
  acbf: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400",
  pta: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-400",
  raci: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-400",
  gantt: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-400",
  dashboard: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-400",
  docs: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400",
  reports: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-400",
  notifications: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-400",
  audit: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  import: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400",
  export: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400",
};

function getModuleBadgeClass(module: string): string {
  return MODULE_COLORS[module] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PermissionsSection() {
  const perms = useUserPermissions();

  // Data state
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPermission, setExpandedPermission] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    module: "",
    description: "",
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PermissionItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  // ─── Fetch permissions ─────────────────────────────────────────────────────

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/permissions");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des permissions");
      }
      const data = await res.json();
      setPermissions(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (perms.canRead) {
      fetchPermissions();
    }
  }, [perms.canRead, fetchPermissions]);

  // ─── Group permissions by module ──────────────────────────────────────────

  const groupedPermissions = permissions.reduce(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {} as Record<string, PermissionItem[]>
  );

  const sortedModules = Object.keys(groupedPermissions).sort();

  // Filter by search
  const filteredGrouped = searchQuery
    ? Object.entries(groupedPermissions).reduce(
        (acc, [module, permsList]) => {
          const q = searchQuery.toLowerCase();
          const filtered = permsList.filter(
            (p) =>
              p.code.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.module.toLowerCase().includes(q) ||
              (p.description?.toLowerCase().includes(q) ?? false)
          );
          if (filtered.length > 0) acc[module] = filtered;
          return acc;
        },
        {} as Record<string, PermissionItem[]>
      )
    : groupedPermissions;

  const filteredModules = Object.keys(filteredGrouped).sort();

  // ─── Create permission ────────────────────────────────────────────────────

  function validateCreate(): boolean {
    const errors: Record<string, string> = {};
    if (!createForm.code || createForm.code.length < 3) {
      errors.code = "Le code doit contenir au moins 3 caractères";
    }
    if (createForm.code && !createForm.code.includes(":")) {
      errors.code = "Le code doit respecter le format module:action (ex: users:create)";
    }
    if (!createForm.name || createForm.name.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caractères";
    }
    if (!createForm.module) {
      errors.module = "Le module est requis";
    }
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreate() {
    if (!validateCreate()) return;
    try {
      setCreating(true);
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createForm.code,
          name: createForm.name,
          module: createForm.module,
          description: createForm.description || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }
      toast.success("Permission créée avec succès");
      setCreateDialogOpen(false);
      resetCreateForm();
      fetchPermissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  function resetCreateForm() {
    setCreateForm({ code: "", name: "", module: "", description: "" });
    setCreateErrors({});
  }

  // ─── Edit permission ──────────────────────────────────────────────────────

  function openEditDialog(permission: PermissionItem) {
    setEditTarget(permission);
    setEditForm({
      name: permission.name,
      description: permission.description || "",
    });
    setEditErrors({});
    setEditDialogOpen(true);
  }

  function validateEdit(): boolean {
    const errors: Record<string, string> = {};
    if (!editForm.name || editForm.name.length < 2) {
      errors.name = "Le nom doit contenir au moins 2 caractères";
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!validateEdit()) return;
    try {
      setEditing(true);
      const res = await fetch(`/api/permissions/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }
      toast.success("Permission mise à jour avec succès");
      setEditDialogOpen(false);
      setEditTarget(null);
      fetchPermissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setEditing(false);
    }
  }

  // ─── Auto-generate code from module ───────────────────────────────────────

  function handleModuleSelect(module: string) {
    setCreateForm((prev) => {
      const base = module + ":";
      // If code doesn't start with module: or is empty, suggest the prefix
      if (!prev.code || !prev.code.startsWith(module + ":")) {
        return { ...prev, module, code: base };
      }
      return { ...prev, module };
    });
  }

  // ─── Access Denied ────────────────────────────────────────────────────────

  if (!perms.canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des permissions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configurer les permissions d&apos;accès par module et par fonctionnalité
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lock className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm text-muted-foreground">Accès refusé</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vous n&apos;avez pas la permission de consulter les permissions
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des permissions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configurer les permissions d&apos;accès par module et par fonctionnalité
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Gestion des permissions
          </h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchPermissions}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Gestion des permissions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configurer les permissions d&apos;accès par module et par fonctionnalité
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{permissions.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Modules</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{sortedModules.length}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Actives</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {permissions.filter((p) => p.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Rôles avec permissions</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {new Set(permissions.flatMap((p) => p.roles.map((r) => r.id))).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Rechercher une permission..."
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
        {perms.canCreate && (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              resetCreateForm();
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouvelle permission
          </Button>
        )}
      </div>

      {/* Empty State */}
      {filteredModules.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery
                ? "Aucune permission ne correspond à votre recherche"
                : "Aucune permission trouvée"}
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

      {/* Permissions Tabs by Module */}
      {filteredModules.length > 0 && (
        <Tabs defaultValue={filteredModules[0]} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
            {filteredModules.map((module) => (
              <TabsTrigger
                key={module}
                value={module}
                className="data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900 dark:data-[state=active]:text-emerald-400 rounded-lg px-3 py-1.5 text-sm border border-transparent data-[state=active]:border-emerald-200 dark:data-[state=active]:border-emerald-800"
              >
                {getModuleLabel(module)}
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[10px] px-1 py-0 bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  {filteredGrouped[module].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {filteredModules.map((module) => (
            <TabsContent key={module} value={module} className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                      <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{getModuleLabel(module)}</CardTitle>
                      <CardDescription>
                        {filteredGrouped[module].length} permission(s) dans ce module
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Code</TableHead>
                          <TableHead className="w-[180px]">Nom</TableHead>
                          <TableHead className="hidden md:table-cell">Description</TableHead>
                          <TableHead>Rôles associés</TableHead>
                          <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredGrouped[module].map((permission) => {
                          const isExpanded = expandedPermission === permission.id;
                          return (
                            <>
                              <TableRow
                                key={permission.id}
                                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                onClick={() =>
                                  setExpandedPermission(isExpanded ? null : permission.id)
                                }
                              >
                                <TableCell>
                                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                    {permission.code}
                                  </code>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {permission.name}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                                  {permission.description || "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {permission.roles.length === 0 ? (
                                      <span className="text-xs text-muted-foreground">Aucun</span>
                                    ) : (
                                      permission.roles.slice(0, 2).map((role) => (
                                        <Badge
                                          key={role.id}
                                          variant="secondary"
                                          className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400"
                                        >
                                          {role.name}
                                        </Badge>
                                      )),
                                      permission.roles.length > 2 && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                        >
                                          +{permission.roles.length - 2}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {perms.canUpdate && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditDialog(permission);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                      </Button>
                                    )}
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4 text-slate-400" />
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                              {/* Expanded Detail Row */}
                              {isExpanded && (
                                <TableRow key={`${permission.id}-detail`} className="bg-slate-50 dark:bg-slate-800/30">
                                  <TableCell colSpan={5} className="p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {/* Details */}
                                      <div className="space-y-3">
                                        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                          Détails de la permission
                                        </h5>
                                        <div className="space-y-2">
                                          <div>
                                            <p className="text-xs text-muted-foreground">Code</p>
                                            <code className="text-sm font-mono">{permission.code}</code>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Nom</p>
                                            <p className="text-sm">{permission.name}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Module</p>
                                            <Badge className={`text-xs ${getModuleBadgeClass(permission.module)}`}>
                                              {getModuleLabel(permission.module)}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="text-xs text-muted-foreground">Description</p>
                                            <p className="text-sm">
                                              {permission.description || "Aucune description"}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                      {/* Associated Roles */}
                                      <div className="space-y-3">
                                        <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                          Rôles associés ({permission.roles.length})
                                        </h5>
                                        {permission.roles.length === 0 ? (
                                          <p className="text-sm text-muted-foreground">
                                            Aucun rôle n&apos;a cette permission
                                          </p>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5">
                                            {permission.roles.map((role) => (
                                              <Badge
                                                key={role.id}
                                                variant="secondary"
                                                className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400"
                                              >
                                                {role.name}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                        {perms.canUpdate && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditDialog(permission);
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5 mr-1" />
                                            Modifier la description
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE PERMISSION DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Nouvelle permission
            </DialogTitle>
            <DialogDescription>
              Ajouter une nouvelle permission au système
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Module */}
            <div className="space-y-2">
              <Label>
                Module <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.module}
                onValueChange={handleModuleSelect}
              >
                <SelectTrigger className={createErrors.module ? "border-red-500" : ""}>
                  <SelectValue placeholder="Sélectionner un module" />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.module && (
                <p className="text-xs text-red-500">{createErrors.module}</p>
              )}
            </div>
            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="create-code">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-code"
                placeholder="Ex: users:create"
                value={createForm.code}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    code: e.target.value.toLowerCase().replace(/\s/g, ""),
                  }))
                }
                className={createErrors.code ? "border-red-500" : ""}
              />
              {createErrors.code && (
                <p className="text-xs text-red-500">{createErrors.code}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Format : module:action (ex: users:create, reports:read)
              </p>
            </div>
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="create-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="Ex: Créer des utilisateurs"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className={createErrors.name ? "border-red-500" : ""}
              />
              {createErrors.name && (
                <p className="text-xs text-red-500">{createErrors.name}</p>
              )}
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="create-desc">Description</Label>
              <Textarea
                id="create-desc"
                placeholder="Description de la permission..."
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}
            >
              Annuler
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer la permission"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT PERMISSION DIALOG
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) setEditTarget(null); setEditDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          {editTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                    <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Modifier la permission
                </DialogTitle>
                <DialogDescription>
                  Modifier les informations de la permission{" "}
                  <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">
                    {editTarget.code}
                  </code>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Code & Module (read-only) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Input value={editTarget.code} disabled className="bg-slate-50 dark:bg-slate-800 font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Module</Label>
                    <Input
                      value={getModuleLabel(editTarget.module)}
                      disabled
                      className="bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le code et le module ne peuvent pas être modifiés après la création
                </p>
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-name">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className={editErrors.name ? "border-red-500" : ""}
                  />
                  {editErrors.name && (
                    <p className="text-xs text-red-500">{editErrors.name}</p>
                  )}
                </div>
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                {/* Associated roles (info only) */}
                <div className="space-y-2">
                  <Label>Rôles associés</Label>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-md border bg-slate-50 dark:bg-slate-800/50">
                    {editTarget.roles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun rôle</p>
                    ) : (
                      editTarget.roles.map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400"
                        >
                          {role.name}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Les rôles sont gérés depuis la section Rôles
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => { setEditDialogOpen(false); setEditTarget(null); }}
                >
                  Annuler
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleEdit}
                  disabled={editing}
                >
                  {editing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Mise à jour...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
