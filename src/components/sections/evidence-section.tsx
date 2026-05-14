"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  FileText,
  Link,
  CheckCircle,
  Clock,
  Upload,
  Download,
  Paperclip,
  ExternalLink,
  Trash2,
  Eye,
  Pencil,
  Shield,
  Plus,
  Search,
  Filter,
  X,
  File,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";

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

interface EvidenceFile {
  id: string;
  name: string;
  originalName: string;
  fileType: "file" | "link";
  mimeType?: string;
  fileSize?: number;
  url: string;
  description?: string;
  category:
    | "Rapport"
    | "PV"
    | "Photo"
    | "Lien"
    | "Source de vérification"
    | "Autre";
  version?: string;
  isVerified: boolean;
  verifiedById?: string;
  verifiedAt?: string;
  activityId?: string;
  acbfDeliverableId?: string;
  isActive: boolean;
  deletedAt?: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  activity?: { id: string; activityCode: string; title: string };
  acbfDeliverable?: { id: string; code: string; name: string };
  uploadedBy?: { id: string; name: string; email: string };
  verifiedBy?: { id: string; name: string; email: string };
}

interface ActivityOption {
  id: string;
  activityCode: string;
  title: string;
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

interface EvidenceStats {
  total: number;
  files: number;
  links: number;
  verified: number;
  pending: number;
}

// ============================================================
// Zod Schemas
// ============================================================

const evidenceLinkSchema = z.object({
  url: z.string().url("URL invalide").min(1, "L'URL est requise"),
  name: z.string().min(2, "Minimum 2 caractères").max(200, "Maximum 200 caractères"),
  description: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  category: z.enum(["Rapport", "PV", "Photo", "Lien", "Source de vérification", "Autre"]).default("Lien"),
  version: z.string().max(50, "Maximum 50 caractères").optional().nullable(),
  activityId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
});

const evidenceEditSchema = z.object({
  name: z.string().min(2, "Minimum 2 caractères").max(200, "Maximum 200 caractères"),
  description: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  category: z.enum(["Rapport", "PV", "Photo", "Lien", "Source de vérification", "Autre"]),
  version: z.string().max(50, "Maximum 50 caractères").optional().nullable(),
  activityId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
});

type EvidenceLinkFormValues = z.infer<typeof evidenceLinkSchema>;
type EvidenceEditFormValues = z.infer<typeof evidenceEditSchema>;

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;

const CATEGORY_OPTIONS = [
  { value: "Rapport", label: "Rapport" },
  { value: "PV", label: "PV" },
  { value: "Photo", label: "Photo" },
  { value: "Lien", label: "Lien" },
  { value: "Source de vérification", label: "Source de vérification" },
  { value: "Autre", label: "Autre" },
] as const;

// ============================================================
// Permission Helpers
// ============================================================
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

function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getCategoryBadge(category: string | null) {
  if (!category) return null;
  const config: Record<string, string> = {
    Rapport: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
    PV: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
    Photo: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    Lien: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400",
    "Source de vérification": "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
    Autre: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  };
  return (
    <Badge className={`text-[10px] border-0 ${config[category] || config.Autre}`}>
      {category}
    </Badge>
  );
}

function getFileTypeBadge(fileType: "file" | "link" | null) {
  if (!fileType) return null;
  if (fileType === "file") {
    return (
      <Badge className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0 gap-1">
        <Paperclip className="h-3 w-3" />
        Fichier
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border-0 gap-1">
      <ExternalLink className="h-3 w-3" />
      Lien
    </Badge>
  );
}

function getVerificationBadge(isVerified: boolean | null) {
  if (isVerified) {
    return (
      <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 gap-1">
        <CheckCircle className="h-3 w-3" />
        Vérifié
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0 gap-1">
      <Clock className="h-3 w-3" />
      Non vérifié
    </Badge>
  );
}

// ============================================================
// Main Component
// ============================================================

export function EvidenceSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canRead = checkPermission(session?.user?.roles ?? [], "evidence:read");
  const canCreate = checkPermission(session?.user?.roles ?? [], "evidence:create");
  const canUpdate = checkPermission(session?.user?.roles ?? [], "evidence:update");
  const canArchive = checkPermission(session?.user?.roles ?? [], "evidence:archive");
  const canVerify = checkPermission(session?.user?.roles ?? [], "evidence:verify");

  // ----- Stats state -----
  const [stats, setStats] = useState<EvidenceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ----- List state -----
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Dialog states -----
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"file" | "link">("file");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  // ----- Selected evidence -----
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceFile | null>(null);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">("archive");
  const [verifyAction, setVerifyAction] = useState<"verify" | "unverify">("verify");

  // ----- Submit state -----
  const [submitting, setSubmitting] = useState(false);

  // ----- File upload state -----
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- Dropdown options -----
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([]);
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([]);
  const [deliverableOptions, setDeliverableOptions] = useState<DeliverableOption[]>([]);

  // ----- Link form state -----
  const [linkForm, setLinkForm] = useState<EvidenceLinkFormValues>({
    url: "",
    name: "",
    description: null,
    category: "Lien",
    version: null,
    activityId: null,
    acbfDeliverableId: null,
  });
  const [linkFormErrors, setLinkFormErrors] = useState<Record<string, string>>({});

  // ----- Edit form state -----
  const [editForm, setEditForm] = useState<EvidenceEditFormValues>({
    name: "",
    description: null,
    category: "Autre",
    version: null,
    activityId: null,
    acbfDeliverableId: null,
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/evidence/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.data ?? data);
      }
    } catch {
      // Silently fail
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) fetchStats();
  }, [canRead, fetchStats, refreshKey]);

  // ============================================================
  // Fetch Evidence
  // ============================================================

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (fileTypeFilter && fileTypeFilter !== "all") params.set("fileType", fileTypeFilter);
      if (verificationFilter && verificationFilter !== "all") params.set("isVerified", verificationFilter === "verified" ? "true" : "false");
      if (activityFilter) params.set("activityId", activityFilter);

      const res = await fetch(`/api/evidence?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setEvidence(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, fileTypeFilter, verificationFilter, activityFilter]);

  useEffect(() => {
    if (canRead) {
      fetchEvidence();
    }
  }, [canRead, fetchEvidence, refreshKey]);

  // ============================================================
  // Fetch Dropdown Options
  // ============================================================

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [activitiesRes, domainsRes, deliverablesRes] = await Promise.all([
          fetch("/api/activities?limit=100&status=active"),
          fetch("/api/acbf-domains?limit=100&status=active"),
          fetch("/api/acbf-deliverables?limit=100&status=active"),
        ]);

        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          setActivityOptions(
            data.data.map((a: ActivityOption) => ({
              id: a.id,
              activityCode: a.activityCode,
              title: a.title,
            }))
          );
        }
        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setDomainOptions(
            data.data.map((d: DomainOption) => ({
              id: d.id,
              code: d.code,
              name: d.name,
            }))
          );
        }
        if (deliverablesRes.ok) {
          const data = await deliverablesRes.json();
          setDeliverableOptions(
            data.data.map((d: DeliverableOption) => ({
              id: d.id,
              code: d.code,
              name: d.name,
              domainId: d.domainId,
            }))
          );
        }
      } catch {
        // Silently fail
      }
    }
    fetchOptions();
  }, []);

  // ============================================================
  // Reset page when filters change
  // ============================================================

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, fileTypeFilter, verificationFilter, activityFilter]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  function resetFilters() {
    setSearch("");
    setCategoryFilter("");
    setFileTypeFilter("all");
    setVerificationFilter("all");
    setActivityFilter("");
  }

  function resetLinkForm() {
    setLinkForm({
      url: "",
      name: "",
      description: null,
      category: "Lien",
      activityId: null,
      acbfDeliverableId: null,
    });
    setLinkFormErrors({});
  }

  function resetEditForm() {
    setEditForm({
      name: "",
      description: null,
      category: "Autre",
      version: null,
      activityId: null,
      acbfDeliverableId: null,
    });
    setEditFormErrors({});
  }

  // ----- Drag & Drop -----

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadFile(files[0]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadFile(files[0]);
    }
  }

  // ----- Upload File -----

  async function handleUploadFile() {
    if (!uploadFile) {
      toast.error("Veuillez sélectionner un fichier");
      return;
    }

    const name = uploadFile.name;
    if (name.length < 2) {
      toast.error("Le nom du fichier doit contenir au moins 2 caractères");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", name);
      if (linkForm.description?.trim()) formData.append("description", linkForm.description.trim());
      formData.append("category", linkForm.category);
      if (linkForm.version?.trim()) formData.append("version", linkForm.version.trim());
      if (linkForm.activityId) formData.append("activityId", linkForm.activityId);
      if (linkForm.acbfDeliverableId) formData.append("acbfDeliverableId", linkForm.acbfDeliverableId);

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du téléversement");
      }

      toast.success("Fichier téléversé avec succès");
      setCreateDialogOpen(false);
      setUploadFile(null);
      resetLinkForm();
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du téléversement");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Create Link -----

  async function handleCreateLink() {
    const result = evidenceLinkSchema.safeParse(linkForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      });
      setLinkFormErrors(errors);
      return;
    }
    setLinkFormErrors({});

    setSubmitting(true);
    try {
      const payload = {
        url: linkForm.url.trim(),
        name: linkForm.name.trim(),
        originalName: linkForm.name.trim(),
        fileType: "link" as const,
        description: linkForm.description?.trim() || null,
        category: linkForm.category,
        version: linkForm.version?.trim() || null,
        activityId: linkForm.activityId || null,
        acbfDeliverableId: linkForm.acbfDeliverableId || null,
      };

      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast.success("Lien ajouté avec succès");
      setCreateDialogOpen(false);
      resetLinkForm();
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- View Evidence -----

  async function handleView(item: EvidenceFile) {
    setSelectedEvidence(item);
    setViewDialogOpen(true);

    try {
      const res = await fetch(`/api/evidence/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEvidence((prev) => (prev ? { ...prev, ...data.data } : prev));
      }
    } catch {
      // Keep existing data
    }
  }

  // ----- Edit Evidence -----

  function openEditDialog(item: EvidenceFile) {
    setSelectedEvidence(item);
    setEditForm({
      name: item.name,
      description: item.description || null,
      category: item.category,
      version: item.version || null,
      activityId: item.activityId || null,
      acbfDeliverableId: item.acbfDeliverableId || null,
    });
    setEditFormErrors({});
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedEvidence) return;

    const result = evidenceEditSchema.safeParse(editForm);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key) errors[key] = issue.message;
      });
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});

    setSubmitting(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        description: editForm.description?.trim() || null,
        category: editForm.category,
        version: editForm.version?.trim() || null,
        activityId: editForm.activityId || null,
        acbfDeliverableId: editForm.acbfDeliverableId || null,
      };

      const res = await fetch(`/api/evidence/${selectedEvidence.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la modification");
      }

      toast.success("Preuve modifiée avec succès");
      setEditDialogOpen(false);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la modification");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Archive / Restore -----

  function openArchiveDialog(item: EvidenceFile, action: "archive" | "restore") {
    setSelectedEvidence(item);
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  }

  async function handleArchiveRestore() {
    if (!selectedEvidence) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/evidence/${selectedEvidence.id}`, {
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
          ? "Preuve archivée avec succès"
          : "Preuve restaurée avec succès"
      );
      setArchiveDialogOpen(false);
      setSelectedEvidence(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- Verify / Unverify -----

  function openVerifyDialog(item: EvidenceFile, action: "verify" | "unverify") {
    setSelectedEvidence(item);
    setVerifyAction(action);
    setVerifyDialogOpen(true);
  }

  async function handleVerifyUnverify() {
    if (!selectedEvidence) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/evidence/${selectedEvidence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: verifyAction }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'opération");
      }

      toast.success(
        verifyAction === "verify"
          ? "Preuve vérifiée avec succès"
          : "Vérification retirée"
      );
      setVerifyDialogOpen(false);
      setSelectedEvidence(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'opération");
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
            Preuves et documents
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestion documentaire et preuves
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
              Vous n&apos;avez pas la permission de consulter les preuves et documents.
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
            Preuves et documents
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestion documentaire et preuves — Module 7
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetLinkForm();
              setUploadFile(null);
              setCreateMode("file");
              setCreateDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une preuve
          </Button>
        )}
      </div>

      {/* ============================================================ */}
      {/* Stats Cards */}
      {/* ============================================================ */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total preuves */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total preuves</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats?.total ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fichiers vs Liens */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900">
                <Link className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fichiers / Liens</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-20 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats?.files ?? 0} / {stats?.links ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vérifiées */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Vérifiées</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {stats?.verified ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* En attente */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">En attente</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {stats?.pending ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Filter Bar */}
      {/* ============================================================ */}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par nom..."
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

              {/* Category Filter */}
              <Select
                value={categoryFilter || "__all__"}
                onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full lg:w-[200px] h-9">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes catégories</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Activity Filter */}
              <Select
                value={activityFilter || "__all__"}
                onValueChange={(v) => setActivityFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-full lg:w-[220px] h-9">
                  <SelectValue placeholder="Activité liée" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes activités</SelectItem>
                  {activityOptions.slice(0, 50).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.activityCode} — {a.title.length > 40 ? a.title.substring(0, 40) + "…" : a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* File Type Tabs */}
              <Tabs
                value={fileTypeFilter}
                onValueChange={setFileTypeFilter}
                className="w-auto"
              >
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs px-3">
                    Tous
                  </TabsTrigger>
                  <TabsTrigger value="file" className="text-xs px-3">
                    Fichiers
                  </TabsTrigger>
                  <TabsTrigger value="link" className="text-xs px-3">
                    Liens
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Verification Status Tabs */}
              <Tabs
                value={verificationFilter}
                onValueChange={setVerificationFilter}
                className="w-auto"
              >
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs px-3">
                    Tous
                  </TabsTrigger>
                  <TabsTrigger value="verified" className="text-xs px-3">
                    Vérifiés
                  </TabsTrigger>
                  <TabsTrigger value="unverified" className="text-xs px-3">
                    Non vérifiés
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Reset Filters */}
              {(search || categoryFilter || fileTypeFilter !== "all" || verificationFilter !== "all" || activityFilter) && (
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
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Data Table */}
      {/* ============================================================ */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Liste des preuves et documents
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} preuve{total !== 1 ? "s" : ""} au total
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
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
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
          {!loading && !error && evidence.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <FileText className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucune preuve trouvée
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {search || categoryFilter || fileTypeFilter !== "all" || verificationFilter !== "all" || activityFilter
                  ? "Aucun résultat ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
                  : "Aucune preuve n'a été ajoutée pour le moment."}
              </p>
              {(search || categoryFilter || fileTypeFilter !== "all" || verificationFilter !== "all" || activityFilter) && (
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
          {!loading && !error && evidence.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Nom
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Catégorie
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Type
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">
                        Activité liée
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Livrable ACBF
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Vérifié
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">
                        Téléversé par
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 ${
                          item.deletedAt
                            ? "opacity-60 bg-slate-50/50 dark:bg-slate-800/20"
                            : ""
                        }`}
                        onClick={() => handleView(item)}
                      >
                        {/* Nom */}
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shrink-0">
                              {item.fileType === "file" ? (
                                <File className="h-4 w-4" />
                              ) : (
                                <Link className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="truncate max-w-[200px] block font-medium text-sm" title={item.name}>
                                {item.name}
                              </span>
                              {item.fileType === "file" && item.fileSize && (
                                <span className="text-[10px] text-slate-400">
                                  {formatFileSize(item.fileSize)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Catégorie */}
                        <TableCell>
                          {getCategoryBadge(item.category)}
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          {getFileTypeBadge(item.fileType)}
                        </TableCell>

                        {/* Activité liée */}
                        <TableCell className="hidden md:table-cell">
                          {item.activity ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[160px] block cursor-default">
                                  {item.activity.activityCode}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {item.activity.title}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Livrable ACBF */}
                        <TableCell className="hidden lg:table-cell">
                          {item.acbfDeliverable ? (
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[140px] block" title={item.acbfDeliverable.name}>
                              {item.acbfDeliverable.code}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Vérifié */}
                        <TableCell>
                          {getVerificationBadge(item.isVerified)}
                        </TableCell>

                        {/* Téléversé par */}
                        <TableCell className="hidden xl:table-cell">
                          <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[120px] block" title={item.uploadedBy?.email}>
                            {item.uploadedBy?.name || "—"}
                          </span>
                        </TableCell>

                        {/* Date */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(item.createdAt)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                  onClick={() => handleView(item)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Voir les détails</TooltipContent>
                            </Tooltip>

                            {canUpdate && !item.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                    onClick={() => openEditDialog(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Modifier</TooltipContent>
                              </Tooltip>
                            )}

                            {canVerify && !item.deletedAt && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${
                                      item.isVerified
                                        ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                                        : "text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                                    }`}
                                    onClick={() => openVerifyDialog(item, item.isVerified ? "unverify" : "verify")}
                                  >
                                    <Shield className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {item.isVerified ? "Retirer la vérification" : "Vérifier"}
                                </TooltipContent>
                              </Tooltip>
                            )}

                            {canArchive &&
                              (item.deletedAt ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                      onClick={() => openArchiveDialog(item, "restore")}
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
                                      onClick={() => openArchiveDialog(item, "archive")}
                                    >
                                      <Trash2 className="h-4 w-4" />
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
      {/* Create Dialog */}
      {/* ============================================================ */}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Ajouter une preuve
            </DialogTitle>
            <DialogDescription>
              Téléversez un fichier ou ajoutez un lien comme preuve.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 py-2">
            <Button
              variant={createMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setCreateMode("file")}
              className={createMode === "file" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              <Upload className="h-4 w-4 mr-2" />
              Téléverser un fichier
            </Button>
            <Button
              variant={createMode === "link" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setCreateMode("link");
                setLinkForm((f) => ({ ...f, category: "Lien" }));
              }}
              className={createMode === "link" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              <Link className="h-4 w-4 mr-2" />
              Ajouter un lien
            </Button>
          </div>

          <div className="space-y-4 py-2">
            {/* ---- File Upload Mode ---- */}
            {createMode === "file" && (
              <>
                {/* Drag & Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                      : uploadFile
                        ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30"
                        : "border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-500"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {uploadFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                        <File className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {uploadFile.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatFileSize(uploadFile.size)} — {uploadFile.type || "Type inconnu"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadFile(null)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-slate-400" />
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Glissez-déposez un fichier ici
                      </p>
                      <p className="text-xs text-slate-400">ou</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Parcourir les fichiers
                      </Button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="create-desc-file">Description</Label>
                  <Textarea
                    id="create-desc-file"
                    placeholder="Description de la preuve..."
                    value={linkForm.description || ""}
                    onChange={(e) => setLinkForm((f) => ({ ...f, description: e.target.value || null }))}
                    rows={2}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={linkForm.category}
                    onValueChange={(v) => setLinkForm((f) => ({ ...f, category: v as EvidenceLinkFormValues["category"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Version */}
                <div className="space-y-2">
                  <Label htmlFor="create-version-file">Version</Label>
                  <Input
                    id="create-version-file"
                    placeholder="ex: v1.0"
                    value={linkForm.version || ""}
                    onChange={(e) => setLinkForm((f) => ({ ...f, version: e.target.value || undefined }))}
                  />
                </div>
              </>
            )}

            {/* ---- Link Mode ---- */}
            {createMode === "link" && (
              <>
                {/* URL */}
                <div className="space-y-2">
                  <Label htmlFor="create-url">
                    URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-url"
                    placeholder="https://exemple.com/document"
                    value={linkForm.url}
                    onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
                    className={linkFormErrors.url ? "border-red-500" : ""}
                  />
                  {linkFormErrors.url && <p className="text-xs text-red-500">{linkFormErrors.url}</p>}
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="create-name-link">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-name-link"
                    placeholder="Nom du lien"
                    value={linkForm.name}
                    onChange={(e) => setLinkForm((f) => ({ ...f, name: e.target.value }))}
                    className={linkFormErrors.name ? "border-red-500" : ""}
                  />
                  {linkFormErrors.name && <p className="text-xs text-red-500">{linkFormErrors.name}</p>}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="create-desc-link">Description</Label>
                  <Textarea
                    id="create-desc-link"
                    placeholder="Description du lien..."
                    value={linkForm.description || ""}
                    onChange={(e) => setLinkForm((f) => ({ ...f, description: e.target.value || null }))}
                    rows={2}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select
                    value={linkForm.category}
                    onValueChange={(v) => setLinkForm((f) => ({ ...f, category: v as EvidenceLinkFormValues["category"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ---- Shared fields ---- */}
            <Separator />

            {/* Activity */}
            <div className="space-y-2">
              <Label>Activité liée</Label>
              <Select
                value={linkForm.activityId || "__none__"}
                onValueChange={(v) => setLinkForm((f) => ({ ...f, activityId: v === "__none__" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {activityOptions.slice(0, 50).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.activityCode} — {a.title.length > 50 ? a.title.substring(0, 50) + "…" : a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ACBF Deliverable */}
            <div className="space-y-2">
              <Label>Livrable ACBF</Label>
              <Select
                value={linkForm.acbfDeliverableId || "__none__"}
                onValueChange={(v) => setLinkForm((f) => ({ ...f, acbfDeliverableId: v === "__none__" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un livrable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {deliverableOptions.slice(0, 50).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name.length > 50 ? d.name.substring(0, 50) + "…" : d.name}
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
              onClick={createMode === "file" ? handleUploadFile : handleCreateLink}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  En cours...
                </>
              ) : createMode === "file" ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Téléverser
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter le lien
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* View Dialog */}
      {/* ============================================================ */}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Détails de la preuve
            </DialogTitle>
            <DialogDescription>
              Informations complètes sur la preuve sélectionnée.
            </DialogDescription>
          </DialogHeader>

          {selectedEvidence && (
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-6 py-2">
                {/* Nom et type */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                      {selectedEvidence.fileType === "file" ? (
                        <File className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Link className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {selectedEvidence.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {getFileTypeBadge(selectedEvidence.fileType)}
                        {getCategoryBadge(selectedEvidence.category)}
                        {selectedEvidence.version && (
                          <Badge variant="outline" className="text-[10px]">
                            {selectedEvidence.version}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                {selectedEvidence.description && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Description
                    </Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                      {selectedEvidence.description}
                    </p>
                  </div>
                )}

                {/* Fichier info */}
                {selectedEvidence.fileType === "file" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Taille du fichier
                      </Label>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                        {formatFileSize(selectedEvidence.fileSize)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Type MIME
                      </Label>
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                        {selectedEvidence.mimeType || "—"}
                      </p>
                    </div>
                  </div>
                )}

                {/* URL info */}
                {selectedEvidence.fileType === "link" && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      URL
                    </Label>
                    <a
                      href={selectedEvidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline break-all mt-1 block"
                    >
                      {selectedEvidence.url}
                    </a>
                  </div>
                )}

                <Separator />

                {/* Verification */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vérification
                  </Label>
                  <div className="flex items-center gap-3 mt-2">
                    {getVerificationBadge(selectedEvidence.isVerified)}
                    {selectedEvidence.isVerified && selectedEvidence.verifiedBy && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        par {selectedEvidence.verifiedBy.name}
                        {selectedEvidence.verifiedAt && (
                          <> le {formatDateFull(selectedEvidence.verifiedAt)}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Activity & Deliverable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Activité liée
                    </Label>
                    {selectedEvidence.activity ? (
                      <div className="flex items-center gap-2 mt-1">
                        <ClipboardList className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {selectedEvidence.activity.activityCode} — {selectedEvidence.activity.title}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">—</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Livrable ACBF
                    </Label>
                    {selectedEvidence.acbfDeliverable ? (
                      <div className="flex items-center gap-2 mt-1">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {selectedEvidence.acbfDeliverable.code} — {selectedEvidence.acbfDeliverable.name}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">—</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Upload info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Téléversé par
                    </Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {selectedEvidence.uploadedBy?.name || "—"}
                    </p>
                    {selectedEvidence.uploadedBy?.email && (
                      <p className="text-xs text-slate-400">{selectedEvidence.uploadedBy.email}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Date de téléversement
                    </Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {formatDateFull(selectedEvidence.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Version note */}
                {selectedEvidence.version && (
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Version
                    </Label>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {selectedEvidence.version}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="flex gap-2">
            {selectedEvidence && selectedEvidence.fileType === "file" && (
              <Button
                variant="outline"
                onClick={() => window.open(selectedEvidence.url, "_blank")}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            )}
            {selectedEvidence && selectedEvidence.fileType === "link" && (
              <Button
                variant="outline"
                onClick={() => window.open(selectedEvidence.url, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visiter le lien
              </Button>
            )}
            <Button
              onClick={() => setViewDialogOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Edit Dialog */}
      {/* ============================================================ */}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-emerald-600" />
              Modifier la preuve
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de la preuve. Le fichier ou l&apos;URL ne peut pas être modifié.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* File/Link info (read-only) */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {selectedEvidence?.fileType === "file" ? "Fichier" : "Lien"} (non modifiable)
              </Label>
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 truncate" title={selectedEvidence?.url}>
                {selectedEvidence?.fileType === "file"
                  ? selectedEvidence?.originalName || selectedEvidence?.name
                  : selectedEvidence?.url}
              </p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Nom <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className={editFormErrors.name ? "border-red-500" : ""}
              />
              {editFormErrors.name && <p className="text-xs text-red-500">{editFormErrors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value || null }))}
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select
                value={editForm.category}
                onValueChange={(v) => setEditForm((f) => ({ ...f, category: v as EvidenceEditFormValues["category"] }))}
              >
                <SelectTrigger className={editFormErrors.category ? "border-red-500" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editFormErrors.category && <p className="text-xs text-red-500">{editFormErrors.category}</p>}
            </div>

            {/* Version */}
            <div className="space-y-2">
              <Label htmlFor="edit-version">Version</Label>
              <Input
                id="edit-version"
                value={editForm.version || ""}
                onChange={(e) => setEditForm((f) => ({ ...f, version: e.target.value || null }))}
                placeholder="ex: v1.0"
              />
            </div>

            <Separator />

            {/* Activity */}
            <div className="space-y-2">
              <Label>Activité liée</Label>
              <Select
                value={editForm.activityId || "__none__"}
                onValueChange={(v) => setEditForm((f) => ({ ...f, activityId: v === "__none__" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une activité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {activityOptions.slice(0, 50).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.activityCode} — {a.title.length > 50 ? a.title.substring(0, 50) + "…" : a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ACBF Deliverable */}
            <div className="space-y-2">
              <Label>Livrable ACBF</Label>
              <Select
                value={editForm.acbfDeliverableId || "__none__"}
                onValueChange={(v) => setEditForm((f) => ({ ...f, acbfDeliverableId: v === "__none__" ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un livrable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {deliverableOptions.slice(0, 50).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code} — {d.name.length > 50 ? d.name.substring(0, 50) + "…" : d.name}
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  En cours...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Verify/Unverify AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              {verifyAction === "verify" ? "Vérifier la preuve" : "Retirer la vérification"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {verifyAction === "verify"
                ? `Êtes-vous sûr de vouloir marquer cette preuve comme vérifiée ? Cette action sera enregistrée avec votre nom.`
                : `Êtes-vous sûr de vouloir retirer la vérification de cette preuve ?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVerifyUnverify}
              disabled={submitting}
              className={
                verifyAction === "verify"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  En cours...
                </>
              ) : verifyAction === "verify" ? (
                "Confirmer la vérification"
              ) : (
                "Retirer la vérification"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============================================================ */}
      {/* Archive/Restore AlertDialog */}
      {/* ============================================================ */}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {archiveAction === "archive" ? (
                <Trash2 className="h-5 w-5 text-red-600" />
              ) : (
                <RefreshCw className="h-5 w-5 text-emerald-600" />
              )}
              {archiveAction === "archive" ? "Archiver la preuve" : "Restaurer la preuve"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveAction === "archive"
                ? "Êtes-vous sûr de vouloir archiver cette preuve ? Elle ne sera plus visible dans la liste active."
                : "Êtes-vous sûr de vouloir restaurer cette preuve ? Elle sera à nouveau visible dans la liste active."}
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
                  En cours...
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
    </div>
  );
}
