"use client";

import { useState, useEffect, useCallback } from "react";
import { activityFormSchema, type ActivityFormValues } from "@/lib/validations";
import { PaginationControls } from "@/components/shared/org-shared";
import { PriorityBadge, ActivityStatusBadge, ValidationStatusBadge } from "@/components/shared/activity-badges";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Search,
  Eye,
  Pencil,
  Archive,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Send,
  CheckCircle2,
  XCircle,
  Building2,
  UserCircle,
  CalendarDays,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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

// ============================================================
// Types
// ============================================================

interface UserOption {
  id: string;
  name: string;
  email: string;
  ptaCode?: string;
}

interface DirectionOption {
  id: string;
  code: string;
  name: string;
}

interface AxisOption {
  id: string;
  code: string;
  name: string;
}

interface DomainOption {
  id: string;
  code: string;
  name: string;
}

interface DeliverableOption {
  id: string;
  code: string;
  name: string;
  domainId: string;
}

interface Activity {
  id: string;
  activityCode: string;
  title: string;
  responsibleId: string;
  directionId: string | null;
  primaryAxisId: string | null;
  secondaryAxisId: string | null;
  acbfDomainId: string | null;
  acbfDeliverableId: string | null;
  annualObjective: string | null;
  detailedTasks: string | null;
  expectedDeliverable: string | null;
  validatorId: string | null;
  startDate: string | null;
  endDate: string | null;
  priority: string;
  performanceIndicator: string | null;
  verificationSource: string | null;
  status: string;
  progressRate: number;
  riskDescription: string | null;
  comments: string | null;
  validationStatus: string;
  nature: string | null;
  dependency: string | null;
  duration: string | null;
  isLocked: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: UserOption;
  direction?: DirectionOption;
  primaryAxis?: AxisOption;
  secondaryAxis?: AxisOption;
  acbfDomain?: DomainOption;
  acbfDeliverable?: DeliverableOption;
  validator?: UserOption;
  createdBy?: UserOption;
  updatedBy?: UserOption;
}

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

const PRIORITY_OPTIONS = [
  { value: "Haute", label: "Haute" },
  { value: "Moyenne", label: "Moyenne" },
  { value: "Basse", label: "Basse" },
];

const STATUS_OPTIONS = [
  { value: "Non démarré", label: "Non démarré" },
  { value: "En cours", label: "En cours" },
  { value: "Terminé", label: "Terminé" },
  { value: "Annulé", label: "Annulé" },
];

const NATURE_OPTIONS = [
  { value: "Opérationnelle", label: "Opérationnelle" },
  { value: "Structurelle", label: "Structurelle" },
  { value: "Stratégique", label: "Stratégique" },
  { value: "Appui", label: "Appui" },
];

// ============================================================
// Format Helpers
// ============================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatDateFull(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy à HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

// Badge components imported from @/components/shared/activity-badges

// ============================================================
// Main Component
// ============================================================

export function ActivitiesSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "pta:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "pta:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "pta:update");
  const canArchive = checkPermission(session?.user?.roles ?? [], "pta:archive");
  const canSubmit = checkPermission(session?.user?.roles ?? [], "pta:submit");
  const canValidate = checkPermission(session?.user?.roles ?? [], "pta:validate");
  const isAdmin = checkPermission(session?.user?.roles ?? [], "admin:*");

  // ----- List state -----
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [directionFilter, setDirectionFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [validationFilter, setValidationFilter] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Dialog states -----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [validateDialogOpen, setValidateDialogOpen] = useState(false);

  // ----- Selected activity -----
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">("archive");
  const [validateAction, setValidateAction] = useState<"validate" | "reject">("validate");

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- View detail loading -----
  const [viewLoading, setViewLoading] = useState(false);

  // ----- Dropdown options -----
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [directionOptions, setDirectionOptions] = useState<DirectionOption[]>([]);
  const [axisOptions, setAxisOptions] = useState<AxisOption[]>([]);
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([]);
  const [deliverableOptions, setDeliverableOptions] = useState<DeliverableOption[]>([]);

  // ----- Form state -----
  const [form, setForm] = useState<ActivityFormValues>({
    title: "",
    responsibleId: "",
    directionId: null,
    primaryAxisId: null,
    secondaryAxisId: null,
    acbfDomainId: null,
    acbfDeliverableId: null,
    annualObjective: null,
    detailedTasks: null,
    expectedDeliverable: null,
    validatorId: null,
    startDate: null,
    endDate: null,
    priority: "Moyenne",
    performanceIndicator: null,
    verificationSource: null,
    status: "Non démarré",
    progressRate: 0,
    riskDescription: null,
    comments: null,
    nature: null,
    dependency: null,
    duration: null,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Activities
  // ============================================================

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (directionFilter) params.set("directionId", directionFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (validationFilter) params.set("validationStatus", validationFilter);
      if (activityStatusFilter) params.set("activityStatus", activityStatusFilter);

      const res = await fetch(`/api/activities?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setActivities(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, directionFilter, priorityFilter, validationFilter, activityStatusFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (canRead) {
      fetchActivities();
    }
  }, [canRead, fetchActivities, refreshKey]);

  // ============================================================
  // Fetch Dropdown Options
  // ============================================================

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [usersRes, directionsRes, axesRes, domainsRes] = await Promise.all([
          fetch("/api/users?limit=100&status=active"),
          fetch("/api/directions?limit=100&status=active"),
          fetch("/api/strategic-axes?limit=100&status=active"),
          fetch("/api/acbf-domains?limit=100&status=active"),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUserOptions(data.data.map((u: UserOption) => ({ id: u.id, name: u.name, email: u.email })));
        }
        if (directionsRes.ok) {
          const data = await directionsRes.json();
          setDirectionOptions(data.data.map((d: DirectionOption) => ({ id: d.id, code: d.code, name: d.name })));
        }
        if (axesRes.ok) {
          const data = await axesRes.json();
          setAxisOptions(data.data.map((a: AxisOption) => ({ id: a.id, code: a.code, name: a.name })));
        }
        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setDomainOptions(data.data.map((d: DomainOption) => ({ id: d.id, code: d.code, name: d.name })));
        }
      } catch {
        // Silently fail
      }
    }
    fetchOptions();
  }, []);

  // ============================================================
  // Fetch Deliverables when acbfDomainId changes
  // ============================================================

  const fetchDeliverablesForDomain = useCallback(async (domainId: string | null) => {
    if (!domainId) {
      setDeliverableOptions([]);
      return;
    }
    try {
      const res = await fetch(`/api/acbf-deliverables?limit=200&status=active&domainId=${domainId}`);
      if (res.ok) {
        const data = await res.json();
        setDeliverableOptions(
          data.data.map((d: DeliverableOption) => ({ id: d.id, code: d.code, name: d.name, domainId: d.domainId }))
        );
      }
    } catch {
      // Silently fail
    }
  }, []);

  // When form domain changes, re-fetch deliverables
  useEffect(() => {
    if (form.acbfDomainId) {
      fetchDeliverablesForDomain(form.acbfDomainId);
    } else {
      setDeliverableOptions([]);
    }
  }, [form.acbfDomainId, fetchDeliverablesForDomain]);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, directionFilter, priorityFilter, validationFilter, activityStatusFilter]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("active");
    setDirectionFilter("");
    setPriorityFilter("");
    setValidationFilter("");
    setActivityStatusFilter("");
  }

  function resetForm() {
    setForm({
      title: "",
      responsibleId: "",
      directionId: null,
      primaryAxisId: null,
      secondaryAxisId: null,
      acbfDomainId: null,
      acbfDeliverableId: null,
      annualObjective: null,
      detailedTasks: null,
      expectedDeliverable: null,
      validatorId: null,
      startDate: null,
      endDate: null,
      priority: "Moyenne",
      performanceIndicator: null,
      verificationSource: null,
      status: "Non démarré",
      progressRate: 0,
      riskDescription: null,
      comments: null,
      nature: null,
      dependency: null,
      duration: null,
    });
    setFormErrors({});
  }

  function validateForm(): boolean {
    const result = activityFormSchema.safeParse(form);
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

  // ----- Create Activity -----

  async function handleCreate() {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        responsibleId: form.responsibleId,
        directionId: form.directionId || null,
        primaryAxisId: form.primaryAxisId || null,
        secondaryAxisId: form.secondaryAxisId || null,
        acbfDomainId: form.acbfDomainId || null,
        acbfDeliverableId: form.acbfDeliverableId || null,
        annualObjective: form.annualObjective?.trim() || null,
        detailedTasks: form.detailedTasks?.trim() || null,
        expectedDeliverable: form.expectedDeliverable?.trim() || null,
        validatorId: form.validatorId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        priority: form.priority,
        performanceIndicator: form.performanceIndicator?.trim() || null,
        verificationSource: form.verificationSource?.trim() || null,
        status: form.status,
        progressRate: form.progressRate,
        riskDescription: form.riskDescription?.trim() || null,
        comments: form.comments?.trim() || null,
        nature: form.nature?.trim() || null,
        dependency: form.dependency?.trim() || null,
        duration: form.duration?.trim() || null,
      };

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Activité PTA créée avec succès");
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

  // ----- View Activity -----

  async function handleView(activity: Activity) {
    setSelectedActivity(activity);
    setViewDialogOpen(true);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedActivity((prev) =>
          prev ? { ...prev, ...data.data } : prev
        );
      }
    } catch {
      // Keep existing data
    } finally {
      setViewLoading(false);
    }
  }

  // ----- Edit Activity -----

  function openEditDialog(activity: Activity) {
    setSelectedActivity(activity);
    setForm({
      title: activity.title,
      responsibleId: activity.responsibleId,
      directionId: activity.directionId || null,
      primaryAxisId: activity.primaryAxisId || null,
      secondaryAxisId: activity.secondaryAxisId || null,
      acbfDomainId: activity.acbfDomainId || null,
      acbfDeliverableId: activity.acbfDeliverableId || null,
      annualObjective: activity.annualObjective || null,
      detailedTasks: activity.detailedTasks || null,
      expectedDeliverable: activity.expectedDeliverable || null,
      validatorId: activity.validatorId || null,
      startDate: activity.startDate ? activity.startDate.split("T")[0] : null,
      endDate: activity.endDate ? activity.endDate.split("T")[0] : null,
      priority: (activity.priority as "Haute" | "Moyenne" | "Basse") || "Moyenne",
      performanceIndicator: activity.performanceIndicator || null,
      verificationSource: activity.verificationSource || null,
      status: (activity.status as "Non démarré" | "En cours" | "Terminé" | "Annulé") || "Non démarré",
      progressRate: activity.progressRate,
      riskDescription: activity.riskDescription || null,
      comments: activity.comments || null,
      nature: activity.nature || null,
      dependency: activity.dependency || null,
      duration: activity.duration || null,
    });
    setFormErrors({});
    // Pre-fetch deliverables for the domain
    if (activity.acbfDomainId) {
      fetchDeliverablesForDomain(activity.acbfDomainId);
    }
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedActivity) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        responsibleId: form.responsibleId,
        directionId: form.directionId || null,
        primaryAxisId: form.primaryAxisId || null,
        secondaryAxisId: form.secondaryAxisId || null,
        acbfDomainId: form.acbfDomainId || null,
        acbfDeliverableId: form.acbfDeliverableId || null,
        annualObjective: form.annualObjective?.trim() || null,
        detailedTasks: form.detailedTasks?.trim() || null,
        expectedDeliverable: form.expectedDeliverable?.trim() || null,
        validatorId: form.validatorId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        priority: form.priority,
        performanceIndicator: form.performanceIndicator?.trim() || null,
        verificationSource: form.verificationSource?.trim() || null,
        status: form.status,
        progressRate: form.progressRate,
        riskDescription: form.riskDescription?.trim() || null,
        comments: form.comments?.trim() || null,
        nature: form.nature?.trim() || null,
        dependency: form.dependency?.trim() || null,
        duration: form.duration?.trim() || null,
      };

      const res = await fetch(`/api/activities/${selectedActivity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Activité PTA modifiée avec succès");
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

  function openArchiveDialog(activity: Activity, action: "archive" | "restore") {
    setSelectedActivity(activity);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedActivity) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${selectedActivity.id}`, {
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
          ? "Activité PTA archivée avec succès"
          : "Activité PTA restaurée avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedActivity(null);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'opération"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Submit for validation -----

  function openSubmitDialog(activity: Activity) {
    setSelectedActivity(activity);
    setSubmitDialogOpen(true);
  }

  async function handleSubmit() {
    if (!selectedActivity) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${selectedActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la soumission");
      }

      toast.success("Activité PTA soumise pour validation");
      setSubmitDialogOpen(false);
      setSelectedActivity(null);
      handleRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la soumission"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Validate / Reject -----

  function openValidateDialog(activity: Activity, action: "validate" | "reject") {
    setSelectedActivity(activity);
    setValidateAction(action);
    setValidateDialogOpen(true);
  }

  async function handleValidateReject() {
    if (!selectedActivity) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${selectedActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: validateAction }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'opération");
      }

      toast.success(
        validateAction === "validate"
          ? "Activité PTA validée avec succès"
          : "Activité PTA rejetée"
      );
      setValidateDialogOpen(false);
      setSelectedActivity(null);
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
  // Shared Form Fields Component
  // ============================================================

  function renderFormFields() {
    return (
      <ScrollArea className="max-h-[65vh] pr-2">
        <div className="space-y-6 py-2">
          {/* Section: Identification */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Identification</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="form-title">
                  Titre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="form-title"
                  placeholder="Titre de l'activité"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={formErrors.title ? "border-red-500" : ""}
                />
                {formErrors.title && <p className="text-xs text-red-500">{formErrors.title}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="form-responsibleId">
                    Responsable <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={form.responsibleId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, responsibleId: v === "__none__" ? "" : v }))}
                  >
                    <SelectTrigger className={formErrors.responsibleId ? "border-red-500" : ""}>
                      <SelectValue placeholder="Sélectionner un responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {userOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.responsibleId && <p className="text-xs text-red-500">{formErrors.responsibleId}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-nature">Nature</Label>
                  <Select
                    value={form.nature || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, nature: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner la nature" />
                    </SelectTrigger>
                    <SelectContent>
                      {NATURE_OPTIONS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Organisation */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Organisation</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select
                    value={form.directionId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, directionId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une direction" />
                    </SelectTrigger>
                    <SelectContent>
                      {directionOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Axe stratégique principal</Label>
                  <Select
                    value={form.primaryAxisId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, primaryAxisId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un axe" />
                    </SelectTrigger>
                    <SelectContent>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Axe stratégique secondaire</Label>
                  <Select
                    value={form.secondaryAxisId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, secondaryAxisId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un axe" />
                    </SelectTrigger>
                    <SelectContent>
                      {axisOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Domaine ACBF</Label>
                  <Select
                    value={form.acbfDomainId || "__none__"}
                    onValueChange={(v) => {
                      const newDomainId = v === "__none__" ? null : v;
                      setForm((f) => ({
                        ...f,
                        acbfDomainId: newDomainId,
                        acbfDeliverableId: null, // Reset deliverable when domain changes
                      }));
                    }}
                  >
                    <SelectTrigger>
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
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Livrable ACBF</Label>
                  <Select
                    value={form.acbfDeliverableId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, acbfDeliverableId: v === "__none__" ? null : v }))}
                    disabled={!form.acbfDomainId || deliverableOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.acbfDomainId ? "Sélectionner un livrable" : "Sélectionnez d'abord un domaine"} />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverableOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Planification */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Planification</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="form-annualObjective">Objectif annuel</Label>
                <Textarea
                  id="form-annualObjective"
                  placeholder="Objectif annuel de l'activité..."
                  value={form.annualObjective || ""}
                  onChange={(e) => setForm((f) => ({ ...f, annualObjective: e.target.value || null }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-detailedTasks">Tâches détaillées</Label>
                <Textarea
                  id="form-detailedTasks"
                  placeholder="Détail des tâches..."
                  value={form.detailedTasks || ""}
                  onChange={(e) => setForm((f) => ({ ...f, detailedTasks: e.target.value || null }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-expectedDeliverable">Livrable attendu</Label>
                <Textarea
                  id="form-expectedDeliverable"
                  placeholder="Livrable attendu..."
                  value={form.expectedDeliverable || ""}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDeliverable: e.target.value || null }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={form.startDate || ""}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value || null }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input
                    type="date"
                    value={form.endDate || ""}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value || null }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Durée</Label>
                  <Input
                    placeholder="ex: 3 mois"
                    value={form.duration || ""}
                    onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value || null }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorité</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v as "Haute" | "Moyenne" | "Basse" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Suivi */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Suivi</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="form-performanceIndicator">Indicateur de performance</Label>
                <Textarea
                  id="form-performanceIndicator"
                  placeholder="Indicateur de performance..."
                  value={form.performanceIndicator || ""}
                  onChange={(e) => setForm((f) => ({ ...f, performanceIndicator: e.target.value || null }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-verificationSource">Source de vérification</Label>
                <Input
                  id="form-verificationSource"
                  placeholder="Source de vérification..."
                  value={form.verificationSource || ""}
                  onChange={(e) => setForm((f) => ({ ...f, verificationSource: e.target.value || null }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Statut d'activité</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as "Non démarré" | "En cours" | "Terminé" | "Annulé" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validateur</Label>
                  <Select
                    value={form.validatorId || "__none__"}
                    onValueChange={(v) => setForm((f) => ({ ...f, validatorId: v === "__none__" ? null : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un validateur" />
                    </SelectTrigger>
                    <SelectContent>
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
                <Label>Taux d&apos;avancement ({form.progressRate}%)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progressRate}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 0 && val <= 100) {
                        setForm((f) => ({ ...f, progressRate: val }));
                      }
                    }}
                    className="w-20"
                  />
                  <div className="flex-1">
                    <Progress value={form.progressRate} className="h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section: Risques et commentaires */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Risques et commentaires</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label htmlFor="form-riskDescription">Description du risque</Label>
                <Textarea
                  id="form-riskDescription"
                  placeholder="Description des risques..."
                  value={form.riskDescription || ""}
                  onChange={(e) => setForm((f) => ({ ...f, riskDescription: e.target.value || null }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form-comments">Commentaires</Label>
                <Textarea
                  id="form-comments"
                  placeholder="Commentaires..."
                  value={form.comments || ""}
                  onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value || null }))}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="form-dependency">Dépendance</Label>
                  <Input
                    id="form-dependency"
                    placeholder="Dépendance..."
                    value={form.dependency || ""}
                    onChange={(e) => setForm((f) => ({ ...f, dependency: e.target.value || null }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // ============================================================
  // View Dialog Content
  // ============================================================

  function renderViewContent() {
    if (!selectedActivity) return null;

    return (
      <ScrollArea className="max-h-[65vh] pr-2">
        <div className="space-y-6 py-2">
          {/* Identification */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Identification</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Code</p>
                <Badge variant="outline" className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800 mt-0.5">
                  {selectedActivity.activityCode}
                </Badge>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Titre</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">{selectedActivity.title}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Responsable</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.responsible?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nature</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.nature || "—"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Organisation */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Organisation</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Direction</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                  {selectedActivity.direction ? `${selectedActivity.direction.code} — ${selectedActivity.direction.name}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Axe stratégique principal</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                  {selectedActivity.primaryAxis ? `${selectedActivity.primaryAxis.code} — ${selectedActivity.primaryAxis.name}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Axe stratégique secondaire</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                  {selectedActivity.secondaryAxis ? `${selectedActivity.secondaryAxis.code} — ${selectedActivity.secondaryAxis.name}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Domaine ACBF</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                  {selectedActivity.acbfDomain ? `${selectedActivity.acbfDomain.code} — ${selectedActivity.acbfDomain.name}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Livrable ACBF</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                  {selectedActivity.acbfDeliverable ? `${selectedActivity.acbfDeliverable.code} — ${selectedActivity.acbfDeliverable.name}` : "—"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Planification */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Planification</h4>
            </div>
            <div className="space-y-3 pl-6">
              {selectedActivity.annualObjective && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Objectif annuel</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedActivity.annualObjective}</p>
                </div>
              )}
              {selectedActivity.detailedTasks && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tâches détaillées</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedActivity.detailedTasks}</p>
                </div>
              )}
              {selectedActivity.expectedDeliverable && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Livrable attendu</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedActivity.expectedDeliverable}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Date de début</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{formatDate(selectedActivity.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Date de fin</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{formatDate(selectedActivity.endDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Durée</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.duration || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Priorité</p>
                <div className="mt-0.5"><PriorityBadge priority={selectedActivity.priority} /></div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Suivi */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Suivi</h4>
            </div>
            <div className="space-y-3 pl-6">
              {selectedActivity.performanceIndicator && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Indicateur de performance</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.performanceIndicator}</p>
                </div>
              )}
              {selectedActivity.verificationSource && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Source de vérification</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.verificationSource}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Statut d&apos;activité</p>
                  <div className="mt-0.5"><ActivityStatusBadge status={selectedActivity.status} /></div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Validateur</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.validator?.name || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Taux d&apos;avancement ({selectedActivity.progressRate}%)</p>
                <Progress value={selectedActivity.progressRate} className="h-3 mt-1" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Statut de validation</p>
                <div className="mt-0.5"><ValidationStatusBadge validationStatus={selectedActivity.validationStatus} /></div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Risques et commentaires */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Risques et commentaires</h4>
            </div>
            <div className="space-y-3 pl-6">
              {selectedActivity.riskDescription && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Description du risque</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedActivity.riskDescription}</p>
                </div>
              )}
              {selectedActivity.comments && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Commentaires</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedActivity.comments}</p>
                </div>
              )}
              {selectedActivity.dependency && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dépendance</p>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.dependency}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Metadata */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserCircle className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Métadonnées</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Créé par</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{(selectedActivity as unknown as Record<string, unknown>).createdBy && typeof (selectedActivity as unknown as Record<string, unknown>).createdBy === "object" ? ((selectedActivity as unknown as Record<string, { name?: string }>).createdBy?.name || "—") : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Créé le</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{formatDateFull(selectedActivity.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Modifié par</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{(selectedActivity as unknown as Record<string, unknown>).updatedBy && typeof (selectedActivity as unknown as Record<string, unknown>).updatedBy === "object" ? ((selectedActivity as unknown as Record<string, { name?: string }>).updatedBy?.name || "—") : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Modifié le</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{formatDateFull(selectedActivity.updatedAt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Verrouillé</p>
                <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedActivity.isLocked ? "Oui" : "Non"}</p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canRead) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Activités PTA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer les activités du Plan de Travail Annuel
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
              Vous n&apos;avez pas la permission de consulter les activités PTA.
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

  const hasActiveFilters = search || statusFilter !== "active" || directionFilter || priorityFilter || validationFilter || activityStatusFilter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Activités PTA
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérer les activités du Plan de Travail Annuel
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
            Ajouter une activité
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
                placeholder="Rechercher par titre ou code..."
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
              onValueChange={(v) => setDirectionFilter(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-full lg:w-[200px] h-9">
                <SelectValue placeholder="Toutes les directions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les directions</SelectItem>
                {directionOptions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.code} — {d.name}
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
                <SelectValue placeholder="Toutes priorités" />
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

            {/* Clear Filters */}
            {hasActiveFilters && (
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

          {/* Validation Status Tabs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Validation</p>
              <Tabs
                value={validationFilter || "all"}
                onValueChange={(v) => setValidationFilter(v === "all" ? "" : v)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5">Tous</TabsTrigger>
                  <TabsTrigger value="Brouillon" className="text-xs px-2.5">Brouillon</TabsTrigger>
                  <TabsTrigger value="Soumis" className="text-xs px-2.5">Soumis</TabsTrigger>
                  <TabsTrigger value="Validé" className="text-xs px-2.5">Validé</TabsTrigger>
                  <TabsTrigger value="Rejeté" className="text-xs px-2.5">Rejeté</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Statut d&apos;activité</p>
              <Tabs
                value={activityStatusFilter || "all"}
                onValueChange={(v) => setActivityStatusFilter(v === "all" ? "" : v)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5">Tous</TabsTrigger>
                  <TabsTrigger value="Non démarré" className="text-xs px-2.5">Non démarré</TabsTrigger>
                  <TabsTrigger value="En cours" className="text-xs px-2.5">En cours</TabsTrigger>
                  <TabsTrigger value="Terminé" className="text-xs px-2.5">Terminé</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Statut</p>
              <Tabs
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="active" className="text-xs px-2.5">Actifs</TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs px-2.5">Archivés</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs px-2.5">Tous</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Liste des activités PTA
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} activité{total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
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
          {!loading && !error && activities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <ClipboardList className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucune activité PTA trouvée
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {hasActiveFilters
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucune activité PTA n'a été créée pour le moment."}
              </p>
              {hasActiveFilters && (
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
          {!loading && !error && activities.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Code
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Titre
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Responsable
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        Direction
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Priorité
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Statut
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Avancement
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Validation
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((activity) => (
                      <TableRow
                        key={activity.id}
                        className={
                          activity.deletedAt
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
                            {activity.activityCode}
                          </Badge>
                        </TableCell>

                        {/* Title */}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              <ClipboardList className="h-4 w-4" />
                            </div>
                            <span
                              className="truncate max-w-[200px]"
                              title={activity.title}
                            >
                              {activity.title}
                            </span>
                          </div>
                        </TableCell>

                        {/* Responsible */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[150px]" title={activity.responsible?.name}>
                            {activity.responsible?.name || "—"}
                          </span>
                        </TableCell>

                        {/* Direction */}
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={activity.direction?.name || undefined}>
                              {activity.direction ? `${activity.direction.code} — ${activity.direction.name}` : "—"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Priority */}
                        <TableCell className="hidden md:table-cell">
                          <PriorityBadge priority={activity.priority} /> || <span className="text-sm text-slate-400">—</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="hidden md:table-cell">
                          <ActivityStatusBadge status={activity.status} /> || <span className="text-sm text-slate-400">—</span>
                        </TableCell>

                        {/* Progress */}
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Progress value={activity.progressRate} className="h-2 flex-1" />
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{activity.progressRate}%</span>
                          </div>
                        </TableCell>

                        {/* Validation Status */}
                        <TableCell className="hidden lg:table-cell">
                          <ValidationStatusBadge validationStatus={activity.validationStatus} /> || <span className="text-sm text-slate-400">—</span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                  onClick={() => handleView(activity)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir les détails</TooltipContent>
                            </Tooltip>

                            {canUpdate && !activity.deletedAt && (!activity.isLocked || isAdmin) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(activity)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Submit for validation */}
                            {canSubmit && !activity.deletedAt && (activity.validationStatus === "Brouillon" || activity.validationStatus === "Rejeté") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
                                    onClick={() => openSubmitDialog(activity)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Soumettre pour validation</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Validate */}
                            {canValidate && activity.validationStatus === "Soumis" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openValidateDialog(activity, "validate")}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Valider</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Reject */}
                            {canValidate && activity.validationStatus === "Soumis" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                                    onClick={() => openValidateDialog(activity, "reject")}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rejeter</TooltipContent>
                              </Tooltip>
                            )}

                            {/* Archive / Restore */}
                            {canArchive && (
                              activity.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() => openArchiveDialog(activity, "restore")}
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
                                      onClick={() => openArchiveDialog(activity, "archive")}
                                    >
                                      <Archive className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Archiver</TooltipContent>
                                </Tooltip>
                              )
                            )}
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
      {/* Create Activity Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Nouvelle activité PTA
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle activité dans le Plan de Travail Annuel.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter className="gap-2 pt-4 border-t">
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer l'activité"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* View Activity Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Détails de l&apos;activité
            </DialogTitle>
            <DialogDescription>
              Informations complètes de l&apos;activité PTA
            </DialogDescription>
          </DialogHeader>
          {viewLoading && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              <span className="ml-2 text-sm text-slate-500">Chargement des détails...</span>
            </div>
          )}
          {renderViewContent()}
          <DialogFooter className="gap-2 pt-4 border-t">
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
      {/* Edit Activity Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier l&apos;activité
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de l&apos;activité PTA
            </DialogDescription>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter className="gap-2 pt-4 border-t">
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
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
                  <Archive className="h-5 w-5 text-red-600" />
                  Archiver l&apos;activité
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 text-emerald-600" />
                  Restaurer l&apos;activité
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? `Êtes-vous sûr de vouloir archiver l'activité "${selectedActivity?.title}" ? Elle ne sera plus visible dans la liste des activités actives.`
                : `Êtes-vous sûr de vouloir restaurer l'activité "${selectedActivity?.title}" ? Elle réapparaîtra dans la liste des activités actives.`}
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
                  Traitement...
                </>
              ) : archiveAction === "archive" ? (
                "Archiver"
              ) : (
                "Restaurer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* Submit for Validation AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-600" />
              Soumettre pour validation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir soumettre l&apos;activité &quot;{selectedActivity?.title}&quot; pour validation ?
              Une fois soumise, elle ne pourra plus être modifiée tant qu&apos;elle n&apos;aura pas été validée ou rejetée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Soumission...
                </>
              ) : (
                "Soumettre"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* Validate/Reject AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {validateAction === "validate" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Valider l&apos;activité
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Rejeter l&apos;activité
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {validateAction === "validate"
                ? `Êtes-vous sûr de vouloir valider l'activité "${selectedActivity?.title}" ? Cette action confirmera que l'activité est conforme.`
                : `Êtes-vous sûr de vouloir rejeter l'activité "${selectedActivity?.title}" ? Le responsable pourra la modifier et la soumettre à nouveau.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleValidateReject}
              disabled={submitting}
              className={
                validateAction === "validate"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : validateAction === "validate" ? (
                "Valider"
              ) : (
                "Rejeter"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
