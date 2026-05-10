"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Bell,
  Send,
  Settings,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  X,
  ShieldCheck,
  Clock,
  Info,
  AlertTriangle,
  CheckCircle2,
  Siren,
  Mail,
  ExternalLink,
  Trash2,
  MailOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
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

// ============================================================
// Types
// ============================================================

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  entityId: string | null;
  entityType: string | null;
  sentByEmail: boolean;
  sentAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
}

interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  activityAlerts: boolean;
  deadlineReminders: boolean;
  validationAlerts: boolean;
  reportAlerts: boolean;
  systemAlerts: boolean;
  deadlineReminderDays: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: { type: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  lastNotification: string | null;
}

// ============================================================
// Constants
// ============================================================

const NOTIFICATION_TYPES = ["info", "warning", "error", "success", "alert"];
const NOTIFICATION_CATEGORIES = ["activité", "échéance", "validation", "rapport", "système", "alerte"];
const NOTIFICATION_PRIORITIES = ["basse", "normale", "haute", "urgente"];

const TYPE_COLORS: Record<string, string> = {
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  alert: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  basse: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  normale: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  haute: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  urgente: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const CATEGORY_COLORS: Record<string, string> = {
  "activité": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  "échéance": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  "validation": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  "rapport": "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  "système": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "alerte": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const TYPE_BORDER_COLORS: Record<string, string> = {
  info: "border-l-sky-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
  success: "border-l-emerald-500",
  alert: "border-l-violet-500",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
  alert: Siren,
};

const ITEMS_PER_PAGE = 10;

// ============================================================
// Permission Helper
// ============================================================

function hasPermission(
  roles: Array<{ permissions: string[] }>,
  permission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === permission || p === "notifications:*" || p === "admin:*"
    )
  );
}

// ============================================================
// Date formatting
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

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const now = new Date();
    const date = new Date(iso);
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return "À l'instant";
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

// ============================================================
// Main Component
// ============================================================

export function NotificationsSection() {
  const { data: session } = useSession();
  const canRead = hasPermission(session?.user?.roles ?? [], "notifications:read");
  const canUpdate = hasPermission(session?.user?.roles ?? [], "notifications:update");
  const canDelete = hasPermission(session?.user?.roles ?? [], "notifications:delete");

  // Main tab state
  const [mainTab, setMainTab] = useState("notifications");

  // Refresh key
  const [refreshKey, setRefreshKey] = useState(0);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifSearch, setNotifSearch] = useState("");
  const [notifCategoryFilter, setNotifCategoryFilter] = useState("");
  const [notifTypeFilter, setNotifTypeFilter] = useState("");
  const [notifPriorityFilter, setNotifPriorityFilter] = useState("");
  const [notifPage, setNotifPage] = useState(1);

  // Sent notifications state
  const [sentNotifications, setSentNotifications] = useState<Notification[]>([]);
  const [sentLoading, setSentLoading] = useState(true);
  const [sentError, setSentError] = useState<string | null>(null);
  const [sentSearch, setSentSearch] = useState("");
  const [sentPage, setSentPage] = useState(1);

  // Stats state
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Prefs form
  const [prefsForm, setPrefsForm] = useState<NotificationPreference | null>(null);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ============================================================
  // Fetch Notifications (received)
  // ============================================================

  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "all");
      params.set("limit", "50");
      if (notifSearch) params.set("search", notifSearch);
      if (notifCategoryFilter) params.set("category", notifCategoryFilter);
      if (notifTypeFilter) params.set("type", notifTypeFilter);
      if (notifPriorityFilter) params.set("priority", notifPriorityFilter);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des notifications");
      }
      const data = await res.json();
      setNotifications(data.data || []);
    } catch (err) {
      setNotificationsError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setNotificationsLoading(false);
    }
  }, [notifSearch, notifCategoryFilter, notifTypeFilter, notifPriorityFilter]);

  // ============================================================
  // Fetch Sent Notifications
  // ============================================================

  const fetchSent = useCallback(async () => {
    setSentLoading(true);
    setSentError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "sent");
      params.set("limit", "50");
      if (sentSearch) params.set("search", sentSearch);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }
      const data = await res.json();
      setSentNotifications(data.data || []);
    } catch (err) {
      setSentError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setSentLoading(false);
    }
  }, [sentSearch]);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/notifications/stats");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des statistiques");
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
  // Fetch Preferences
  // ============================================================

  const fetchPreferences = useCallback(async () => {
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement des préférences");
      }
      const data = await res.json();
      const prefs = data.data || data;
      setPreferences(prefs);
      setPrefsForm(prefs);
    } catch (err) {
      setPrefsError(
        err instanceof Error ? err.message : "Erreur inconnue"
      );
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  // ============================================================
  // Effects
  // ============================================================

  useEffect(() => {
    if (canRead) fetchNotifications();
  }, [canRead, fetchNotifications, refreshKey]);

  useEffect(() => {
    if (canRead) fetchSent();
  }, [canRead, fetchSent, refreshKey]);

  useEffect(() => {
    if (canRead) fetchStats();
  }, [canRead, fetchStats, refreshKey]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences, refreshKey]);

  // Reset page when filters change
  useEffect(() => {
    setNotifPage(1);
  }, [notifSearch, notifCategoryFilter, notifTypeFilter, notifPriorityFilter]);

  useEffect(() => {
    setSentPage(1);
  }, [sentSearch]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleMarkRead(notif: Notification) {
    if (!canUpdate) return;
    setMarkingRead(true);
    try {
      const action = notif.isRead ? "mark-unread" : "mark-read";
      const res = await fetch(`/api/notifications/${notif.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      toast.success(notif.isRead ? "Marquée comme non lue" : "Marquée comme lue");
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMarkingRead(false);
    }
  }

  async function handleMarkAllRead() {
    if (!canUpdate) return;
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) {
      toast.info("Aucune notification non lue");
      return;
    }
    setMarkingRead(true);
    try {
      await Promise.all(
        unread.map((n) =>
          fetch(`/api/notifications/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "mark-read" }),
          })
        )
      );
      toast.success(`${unread.length} notification(s) marquée(s) comme lue(s)`);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMarkingRead(false);
    }
  }

  async function handleDelete(notif: Notification) {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/notifications/${notif.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      toast.success("Notification supprimée");
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  function handleViewNotification(notif: Notification) {
    setSelectedNotification(notif);
    setViewDialogOpen(true);
    // Mark as read if unread
    if (!notif.isRead && canUpdate) {
      fetch(`/api/notifications/${notif.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read" }),
      }).then(() => {
        handleRefresh();
      }).catch(() => {
        // silently fail
      });
    }
  }

  async function handleSavePreferences() {
    if (!prefsForm) return;
    setPrefsSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefsForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }
      toast.success("Préférences sauvegardées");
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setPrefsSaving(false);
    }
  }

  // ============================================================
  // Filtered & paginated data
  // ============================================================

  const filteredNotifications = useMemo(() => {
    let result = notifications;

    if (notifSearch) {
      const q = notifSearch.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q)
      );
    }
    if (notifCategoryFilter) {
      result = result.filter((n) => n.category === notifCategoryFilter);
    }
    if (notifTypeFilter) {
      result = result.filter((n) => n.type === notifTypeFilter);
    }
    if (notifPriorityFilter) {
      result = result.filter((n) => n.priority === notifPriorityFilter);
    }

    return result;
  }, [notifications, notifSearch, notifCategoryFilter, notifTypeFilter, notifPriorityFilter]);

  const filteredSent = useMemo(() => {
    if (!sentSearch) return sentNotifications;
    const q = sentSearch.toLowerCase();
    return sentNotifications.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.user?.name || "").toLowerCase().includes(q)
    );
  }, [sentNotifications, sentSearch]);

  const notifTotalPages = Math.max(1, Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE));
  const notifPaginated = useMemo(() => {
    const start = (notifPage - 1) * ITEMS_PER_PAGE;
    return filteredNotifications.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNotifications, notifPage]);

  const sentTotalPages = Math.max(1, Math.ceil(filteredSent.length / ITEMS_PER_PAGE));
  const sentPaginated = useMemo(() => {
    const start = (sentPage - 1) * ITEMS_PER_PAGE;
    return filteredSent.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSent, sentPage]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // ============================================================
  // Render: Loading
  // ============================================================

  if (notificationsLoading && !notifications.length) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Notifications et alertes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer vos notifications et préférences d&apos;alerte
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
            <Skeleton key={i} className="h-20 w-full" />
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
            Notifications et alertes
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
              Vous n&apos;avez pas la permission &quot;notifications:read&quot;
              nécessaire pour consulter les notifications.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Notification Card Component
  // ============================================================

  function NotificationCard({
    notif,
    isSent = false,
  }: {
    notif: Notification;
    isSent?: boolean;
  }) {
    const TypeIcon = TYPE_ICONS[notif.type] || Info;
    const borderColor = notif.isRead ? "border-l-slate-300 dark:border-l-slate-600" : (TYPE_BORDER_COLORS[notif.type] || "border-l-emerald-500");

    return (
      <Card
        className={`border-l-4 ${borderColor} cursor-pointer hover:shadow-md transition-shadow ${
          notif.isRead ? "bg-white dark:bg-slate-900" : "bg-emerald-50/50 dark:bg-emerald-950/20"
        }`}
        onClick={() => handleViewNotification(notif)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Type Icon */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                TYPE_COLORS[notif.type] || TYPE_COLORS.info
              }`}
            >
              <TypeIcon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4
                    className={`text-sm truncate ${
                      notif.isRead
                        ? "font-medium text-slate-700 dark:text-slate-300"
                        : "font-bold text-slate-900 dark:text-white"
                    }`}
                  >
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                </div>

                {/* Time & Badges */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {timeAgo(notif.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1.5 py-0 ${
                        CATEGORY_COLORS[notif.category] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {notif.category}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] px-1.5 py-0 ${
                        PRIORITY_COLORS[notif.priority] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {notif.priority}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Sent tab: show recipient */}
              {isSent && notif.user && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Destinataire : {notif.user.name}
                </p>
              )}

              {/* Unread indicator + Actions */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  {!notif.isRead && !isSent && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                  {notif.sentByEmail && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Mail className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Envoyé par email</TooltipContent>
                    </Tooltip>
                  )}
                  {notif.actionUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ExternalLink className="h-3 w-3 text-emerald-600" />
                      </TooltipTrigger>
                      <TooltipContent>Lien d&apos;action disponible</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {!isSent && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canUpdate && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleMarkRead(notif)}
                            disabled={markingRead}
                          >
                            {notif.isRead ? (
                              <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 text-emerald-600" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {notif.isRead ? "Marquer non lue" : "Marquer comme lue"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => handleDelete(notif)}
                            disabled={deleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================
  // Pagination Component
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

    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-1 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {startPage > 1 && (
          <>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPage(1)}>
              1
            </Button>
            {startPage > 2 && <span className="text-xs text-muted-foreground px-1">...</span>}
          </>
        )}
        {pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="sm"
            className={`h-8 w-8 p-0 ${
              p === page
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : ""
            }`}
            onClick={() => setPage(p)}
          >
            {p}
          </Button>
        ))}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="text-xs text-muted-foreground px-1">...</span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
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
            Notifications et alertes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer vos notifications et préférences d&apos;alerte
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">
            <Bell className="h-4 w-4 mr-1.5" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-red-500 text-white text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="text-xs sm:text-sm">
            <Send className="h-4 w-4 mr-1.5" />
            Envoyées
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs sm:text-sm">
            <Settings className="h-4 w-4 mr-1.5" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* TAB 1: NOTIFICATIONS (Received) */}
        {/* ============================================================ */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-12" />
                      ) : (
                        stats?.total ?? 0
                      )}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Non lues
                    </p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-12" />
                      ) : (
                        <>
                          {stats?.unread ?? 0}
                          {(stats?.unread ?? 0) > 0 && (
                            <Badge className="ml-2 h-5 bg-red-500 text-white text-[10px]">
                              !
                            </Badge>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-sky-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Lues
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-7 w-12" />
                      ) : (
                        stats?.read ?? 0
                      )}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                    <MailOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Dernière notification
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {statsLoading ? (
                        <Skeleton className="h-5 w-24" />
                      ) : stats?.lastNotification ? (
                        timeAgo(stats.lastNotification)
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une notification..."
                value={notifSearch}
                onChange={(e) => setNotifSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={notifCategoryFilter} onValueChange={(v) => setNotifCategoryFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-40 h-9">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes catégories</SelectItem>
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={notifTypeFilter} onValueChange={(v) => setNotifTypeFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-36 h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Tous types</SelectItem>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={notifPriorityFilter} onValueChange={(v) => setNotifPriorityFilter(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-36 h-9">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Toutes priorités</SelectItem>
                {NOTIFICATION_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canUpdate && unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 whitespace-nowrap"
                onClick={handleMarkAllRead}
                disabled={markingRead}
              >
                {markingRead ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <MailOpen className="h-4 w-4 mr-1.5" />
                )}
                Tout marquer lu
              </Button>
            )}
          </div>

          {/* Error State */}
          {notificationsError && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Erreur de chargement
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {notificationsError}
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notification Cards List */}
          {!notificationsError && (
            <>
              {notifPaginated.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                      <Bell className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Aucune notification
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
                      Vous n&apos;avez aucune notification pour le moment.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {notifPaginated.map((notif) => (
                    <NotificationCard key={notif.id} notif={notif} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              <PaginationControls
                page={notifPage}
                totalPages={notifTotalPages}
                setPage={setNotifPage}
              />
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 2: SENT NOTIFICATIONS */}
        {/* ============================================================ */}
        <TabsContent value="sent" className="space-y-6 mt-6">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les notifications envoyées..."
                value={sentSearch}
                onChange={(e) => setSentSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Error State */}
          {sentError && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Erreur de chargement
                </p>
                <p className="text-xs text-muted-foreground mt-1">{sentError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Sent Cards List */}
          {!sentError && (
            <>
              {sentPaginated.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                      <Send className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Aucune notification envoyée
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
                      Vous n&apos;avez envoyé aucune notification.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sentPaginated.map((notif) => (
                    <NotificationCard key={notif.id} notif={notif} isSent />
                  ))}
                </div>
              )}

              {/* Pagination */}
              <PaginationControls
                page={sentPage}
                totalPages={sentTotalPages}
                setPage={setSentPage}
              />
            </>
          )}
        </TabsContent>

        {/* ============================================================ */}
        {/* TAB 3: PREFERENCES */}
        {/* ============================================================ */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          {prefsLoading && !preferences ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
          ) : prefsError ? (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Erreur de chargement
                </p>
                <p className="text-xs text-muted-foreground mt-1">{prefsError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Réessayer
                </Button>
              </CardContent>
            </Card>
          ) : prefsForm ? (
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Canaux de notification */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-600" />
                    Canaux de notification
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Notifications par email</Label>
                        <p className="text-xs text-muted-foreground">
                          Recevoir les notifications par courrier électronique
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.emailEnabled}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, emailEnabled: checked })
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Notifications push</Label>
                        <p className="text-xs text-muted-foreground">
                          Recevoir les notifications push dans l&apos;application
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.pushEnabled}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, pushEnabled: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Types d'alertes */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-emerald-600" />
                    Types d&apos;alertes
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Alertes d&apos;activité</Label>
                        <p className="text-xs text-muted-foreground">
                          Changements et mises à jour des activités PTA
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.activityAlerts}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, activityAlerts: checked })
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Rappels d&apos;échéance</Label>
                        <p className="text-xs text-muted-foreground">
                          Rappels avant les dates limites des activités
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.deadlineReminders}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, deadlineReminders: checked })
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Alertes de validation</Label>
                        <p className="text-xs text-muted-foreground">
                          Notifications de validation et rejet des activités
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.validationAlerts}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, validationAlerts: checked })
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Alertes de rapport</Label>
                        <p className="text-xs text-muted-foreground">
                          Notifications de génération et validation des rapports
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.reportAlerts}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, reportAlerts: checked })
                        }
                      />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Alertes système</Label>
                        <p className="text-xs text-muted-foreground">
                          Notifications de maintenance et mises à jour système
                        </p>
                      </div>
                      <Switch
                        checked={prefsForm.systemAlerts}
                        onCheckedChange={(checked) =>
                          setPrefsForm({ ...prefsForm, systemAlerts: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Rappels d'échéance */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Paramètres de rappel
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">
                          Jours avant échéance
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Nombre de jours avant la date limite pour recevoir un rappel
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={prefsForm.deadlineReminderDays}
                        onChange={(e) =>
                          setPrefsForm({
                            ...prefsForm,
                            deadlineReminderDays: parseInt(e.target.value) || 3,
                          })
                        }
                        className="w-20 h-9 text-center"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Heures calmes */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-emerald-600" />
                    Heures calmes
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Pas de notifications pendant ces heures
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Début</Label>
                      <Input
                        type="time"
                        value={prefsForm.quietHoursStart || ""}
                        onChange={(e) =>
                          setPrefsForm({
                            ...prefsForm,
                            quietHoursStart: e.target.value || null,
                          })
                        }
                        className="h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Fin</Label>
                      <Input
                        type="time"
                        value={prefsForm.quietHoursEnd || ""}
                        onChange={(e) =>
                          setPrefsForm({
                            ...prefsForm,
                            quietHoursEnd: e.target.value || null,
                          })
                        }
                        className="h-9 mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Save Button */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (preferences) setPrefsForm({ ...preferences });
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleSavePreferences}
                    disabled={prefsSaving}
                  >
                    {prefsSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Sauvegarder
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* VIEW NOTIFICATION DIALOG */}
      {/* ============================================================ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && (() => {
                const Icon = TYPE_ICONS[selectedNotification.type] || Info;
                return <Icon className={`h-5 w-5 ${TYPE_COLORS[selectedNotification.type]?.includes("emerald") ? "text-emerald-600" : TYPE_COLORS[selectedNotification.type]?.includes("sky") ? "text-sky-600" : TYPE_COLORS[selectedNotification.type]?.includes("amber") ? "text-amber-600" : TYPE_COLORS[selectedNotification.type]?.includes("red") ? "text-red-600" : "text-violet-600"}`} />;
              })()}
              Détails de la notification
            </DialogTitle>
            <DialogDescription>
              Informations complètes sur la notification
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 pr-3">
                {/* Title */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Titre
                  </Label>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                    {selectedNotification.title}
                  </p>
                </div>

                {/* Message */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Message
                  </Label>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                    {selectedNotification.message}
                  </p>
                </div>

                <Separator />

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={TYPE_COLORS[selectedNotification.type] || TYPE_COLORS.info}
                      >
                        {selectedNotification.type}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Catégorie
                    </Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={CATEGORY_COLORS[selectedNotification.category] || ""}
                      >
                        {selectedNotification.category}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Priorité
                    </Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={PRIORITY_COLORS[selectedNotification.priority] || ""}
                      >
                        {selectedNotification.priority}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Statut
                    </Label>
                    <div className="mt-1">
                      <Badge
                        variant="secondary"
                        className={
                          selectedNotification.isRead
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                        }
                      >
                        {selectedNotification.isRead ? "Lue" : "Non lue"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Créée le
                    </Label>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {formatDateTime(selectedNotification.createdAt)}
                    </p>
                  </div>
                  {selectedNotification.readAt && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Lue le
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDateTime(selectedNotification.readAt)}
                      </p>
                    </div>
                  )}
                  {selectedNotification.sentAt && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Envoyée le
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDateTime(selectedNotification.sentAt)}
                      </p>
                    </div>
                  )}
                  {selectedNotification.expiresAt && (
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Expire le
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {formatDateTime(selectedNotification.expiresAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Entity reference */}
                {(selectedNotification.entityId || selectedNotification.entityType) && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Entité liée
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedNotification.entityType} — {selectedNotification.entityId}
                      </p>
                    </div>
                  </>
                )}

                {/* Action URL */}
                {selectedNotification.actionUrl && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Lien d&apos;action
                      </Label>
                      <a
                        href={selectedNotification.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline mt-1 flex items-center gap-1"
                      >
                        {selectedNotification.actionUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </>
                )}

                {/* Created By */}
                {selectedNotification.createdBy && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Créée par
                      </Label>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">
                        {selectedNotification.createdBy.name}
                        <span className="text-muted-foreground ml-1">
                          ({selectedNotification.createdBy.email})
                        </span>
                      </p>
                    </div>
                  </>
                )}

                {/* Email sent */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedNotification.sentByEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Envoyé par email
                    </span>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2">
            {selectedNotification && canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedNotification) {
                    handleMarkRead(selectedNotification);
                    setViewDialogOpen(false);
                  }
                }}
                disabled={markingRead}
              >
                {selectedNotification?.isRead ? (
                  <>
                    <Mail className="h-4 w-4 mr-1.5" />
                    Marquer non lue
                  </>
                ) : (
                  <>
                    <MailOpen className="h-4 w-4 mr-1.5" />
                    Marquer comme lue
                  </>
                )}
              </Button>
            )}
            {selectedNotification && canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (selectedNotification) {
                    handleDelete(selectedNotification);
                    setViewDialogOpen(false);
                  }
                }}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Supprimer
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewDialogOpen(false)}>
              <X className="h-4 w-4 mr-1.5" />
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
