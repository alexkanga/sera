"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserCheck,
  Shield,
  Key,
  LogIn,
  Activity,
  Clock,
  Building2,
  AlertCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Types
interface UserData {
  id: string;
  name: string;
  email: string;
  department: string | null;
  isActive: boolean;
  roles: { id: string; code: string; name: string }[];
}

interface RoleData {
  id: string;
  code: string;
  name: string;
  userCount: number;
}

interface AuditLogData {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; ptaCode: string | null } | null;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalPermissions: number;
}

interface DepartmentStat {
  name: string;
  count: number;
}

interface RoleStat {
  name: string;
  count: number;
}

// Chart config for recharts
const directionChartConfig: ChartConfig = {
  count: {
    label: "Utilisateurs",
    color: "hsl(160, 60%, 45%)",
  },
};

const roleChartConfig: ChartConfig = {
  count: {
    label: "Utilisateurs",
    color: "hsl(160, 50%, 55%)",
  },
};

// Format date helper
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Action badge helper
function getActionBadge(action: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    CREATE: { label: "Création", variant: "default", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-400" },
    UPDATE: { label: "Modification", variant: "secondary", className: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-400" },
    DELETE: { label: "Suppression", variant: "destructive", className: "" },
    LOGIN: { label: "Connexion", variant: "outline", className: "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-900 dark:text-sky-400" },
    PASSWORD_CHANGE: { label: "Mdp changé", variant: "secondary", className: "bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900 dark:text-violet-400" },
    ARCHIVE: { label: "Archive", variant: "outline", className: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400" },
    RESTORE: { label: "Restauration", variant: "default", className: "bg-teal-100 text-teal-700 hover:bg-teal-100 dark:bg-teal-900 dark:text-teal-400" },
  };
  const config = map[action] || { label: action, variant: "outline" as const, className: "" };
  return <Badge variant={config.variant} className={`text-[10px] px-1.5 py-0 ${config.className}`}>{config.label}</Badge>;
}

export function DashboardSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStat[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStat[]>([]);
  const [recentLogins, setRecentLogins] = useState<AuditLogData[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all data in parallel
      const [usersRes, rolesRes, permissionsRes, loginsRes, activityRes] = await Promise.all([
        fetch("/api/users?limit=100"),
        fetch("/api/roles"),
        fetch("/api/permissions"),
        fetch("/api/audit-logs?action=LOGIN&limit=5"),
        fetch("/api/audit-logs?limit=10"),
      ]);

      if (!usersRes.ok || !rolesRes.ok || !permissionsRes.ok || !loginsRes.ok || !activityRes.ok) {
        throw new Error("Erreur lors du chargement des données du tableau de bord");
      }

      const [usersData, rolesData, permissionsData, loginsData, activityData] = await Promise.all([
        usersRes.json(),
        rolesRes.json(),
        permissionsRes.json(),
        loginsRes.json(),
        activityRes.json(),
      ]);

      const users: UserData[] = usersData.data || [];
      const roles: RoleData[] = rolesData.data || [];
      const permissions = permissionsData.data || [];
      const logins: AuditLogData[] = loginsData.data || [];
      const activity: AuditLogData[] = activityData.data || [];

      // Stats
      const totalUsers = usersData.pagination?.total || users.length;
      const activeUsers = users.filter((u: UserData) => u.isActive).length;
      setStats({
        totalUsers,
        activeUsers,
        totalRoles: roles.length,
        totalPermissions: permissions.length,
      });

      // Department breakdown
      const deptMap: Record<string, number> = {};
      users.forEach((u: UserData) => {
        const dept = u.department || "Non assigné";
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
      const deptStats = Object.entries(deptMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      setDepartmentStats(deptStats);

      // Role breakdown
      const roleBreakdown = roles.map((r: RoleData) => ({
        name: r.name,
        count: r.userCount,
      })).sort((a, b) => b.count - a.count);
      setRoleStats(roleBreakdown);

      // Recent logins
      setRecentLogins(logins);

      // Recent activity
      setRecentActivity(activity);
    } catch (err) {
      console.error("Erreur dashboard:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tableau de bord
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue d&apos;ensemble de la plateforme AAEA Pilotage 360
          </p>
        </div>

        {/* Skeleton stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skeleton chart cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skeleton activity cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <Skeleton key={j} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Tableau de bord
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Vue d&apos;ensemble de la plateforme AAEA Pilotage 360
          </p>
        </div>

        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Impossible de charger le tableau de bord
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={fetchDashboardData}
              className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium underline underline-offset-4"
            >
              Réessayer
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Tableau de bord
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Vue d&apos;ensemble de la plateforme AAEA Pilotage 360 — Module 1 : Authentification et gestion des rôles
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Utilisateurs */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Total utilisateurs
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalUsers ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Comptes enregistrés
            </p>
          </CardContent>
        </Card>

        {/* Utilisateurs actifs */}
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Utilisateurs actifs
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900">
              <UserCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.activeUsers ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalUsers
                ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}% du total`
                : "Aucune donnée"}
            </p>
          </CardContent>
        </Card>

        {/* Rôles définis */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Rôles définis
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalRoles ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Rôles configurés
            </p>
          </CardContent>
        </Card>

        {/* Permissions configurées */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Permissions configurées
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900">
              <Key className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalPermissions ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Droits d&apos;accès
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Répartition par direction */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base">Répartition par direction</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Nombre d&apos;utilisateurs par département
            </CardDescription>
          </CardHeader>
          <CardContent>
            {departmentStats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ChartContainer config={directionChartConfig} className="h-48 w-full">
                <BarChart
                  data={departmentStats}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) =>
                      value.length > 25 ? value.slice(0, 25) + "…" : value
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Répartition par rôle */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base">Répartition par rôle</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Nombre d&apos;utilisateurs par rôle
            </CardDescription>
          </CardHeader>
          <CardContent>
            {roleStats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ChartContainer config={roleChartConfig} className="h-48 w-full">
                <BarChart
                  data={roleStats}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) =>
                      value.length > 20 ? value.slice(0, 20) + "…" : value
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Connexions récentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base">Connexions récentes</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Les 5 dernières connexions sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogins.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">Aucune connexion enregistrée</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {recentLogins.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                        <LogIn className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {log.user?.name || "Utilisateur inconnu"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {log.user?.email || ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base">Activité récente</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Les 10 dernières actions sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">Aucune activité enregistrée</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="mt-0.5 shrink-0">
                        {getActionBadge(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">
                          {log.details || `${log.action} sur ${log.entity}`}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {log.user?.name || "Système"}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
