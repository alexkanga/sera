"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Eye,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Sheet,
  Play,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ============================================================
// Types
// ============================================================

interface ImportHistory {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: string;
  sheets: string | null;
  selectedSheets: string | null;
  mapping: string | null;
  totalRows: number;
  processedRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  errors: string | null;
  previewData: string | null;
  startedAt: string | null;
  completedAt: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string; email: string };
}

interface ImportStats {
  totalImports: number;
  completedImports: number;
  partialImports: number;
  errorImports: number;
  totalRowsImported: number;
  totalRowsSkipped: number;
  totalRowsErrors: number;
  recentImports: ImportHistory[];
  importsByMonth: Array<{ month: string; count: number }>;
}

interface ImportError {
  row: number;
  column: string;
  message: string;
}

interface SheetPreview {
  name: string;
  rows: Record<string, unknown>[];
}

// ============================================================
// Constants
// ============================================================

const ITEMS_PER_PAGE = 20;
const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  ".xlsx",
  ".xls",
  ".csv",
];

// ============================================================
// Permission Helpers
// ============================================================

function hasPermission(
  roles: Array<{ permissions: string[] }>,
  permission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some(
      (p) => p === permission || p === "import:*" || p === "admin:*"
    )
  );
}

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

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd MMM yyyy à HH:mm", { locale: fr });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getStatusBadge(status: string) {
  const config: Record<string, { className: string; icon?: React.ReactNode }> = {
    "En attente": {
      className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
      icon: <Clock className="h-3 w-3" />,
    },
    "En cours": {
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    "Terminé": {
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400",
      icon: <CheckCircle className="h-3 w-3" />,
    },
    "Partiel": {
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    "Erreur": {
      className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const c = config[status] ?? config["En attente"];
  return (
    <Badge className={`text-[10px] border-0 gap-1 ${c.className}`}>
      {c.icon}
      {status}
    </Badge>
  );
}

function parseJsonSafe<T>(jsonStr: string | null | undefined): T | null {
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

// ============================================================
// Main Component
// ============================================================

export function ImportSection() {
  const { data: session } = useSession();

  // ----- Permission checks -----
  const canExecute = hasPermission(session?.user?.roles ?? [], "import:execute");

  // ----- Stats state -----
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ----- Import history state -----
  const [imports, setImports] = useState<ImportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // ----- Upload state -----
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentImport, setCurrentImport] = useState<ImportHistory | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- Preview state -----
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [activePreviewSheet, setActivePreviewSheet] = useState<string>("");
  const [executing, setExecuting] = useState(false);

  // ----- Detail dialog -----
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState<ImportHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // ============================================================
  // Computed values
  // ============================================================

  const parsedSheets = useMemo<string[]>(() => {
    if (!currentImport?.sheets) return [];
    return parseJsonSafe<string[]>(currentImport.sheets) ?? [];
  }, [currentImport]);

  const parsedPreviewData = useMemo<SheetPreview[]>(() => {
    if (!currentImport?.previewData) return [];
    return parseJsonSafe<SheetPreview[]>(currentImport.previewData) ?? [];
  }, [currentImport]);

  const activePreview = useMemo(() => {
    if (!activePreviewSheet || parsedPreviewData.length === 0) return null;
    return parsedPreviewData.find((s) => s.name === activePreviewSheet) ?? null;
  }, [activePreviewSheet, parsedPreviewData]);

  const previewHeaders = useMemo(() => {
    if (!activePreview?.rows || activePreview.rows.length === 0) return [];
    return Object.keys(activePreview.rows[0]);
  }, [activePreview]);

  // ============================================================
  // Fetch Stats
  // ============================================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/imports/stats");
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
    if (canExecute) fetchStats();
  }, [canExecute, fetchStats, refreshKey]);

  // ============================================================
  // Fetch Import History
  // ============================================================

  const fetchImports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/imports?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const data = await res.json();
      setImports(data.data ?? data);
      const pagination = data.pagination ?? { totalPages: 1, total: 0 };
      setTotalPages(pagination.totalPages);
      setTotal(pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (canExecute) {
      fetchImports();
    }
  }, [canExecute, fetchImports, refreshKey]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ============================================================
  // Handlers
  // ============================================================

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
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
      const file = files[0];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && ["xlsx", "xls", "csv"].includes(ext)) {
        handleUpload(file);
      } else {
        toast.error("Format de fichier non supporté. Utilisez .xlsx, .xls ou .csv");
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // ----- Upload -----

  async function handleUpload(file: File) {
    setUploading(true);
    setCurrentImport(null);
    setSelectedSheets([]);
    setActivePreviewSheet("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/imports", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du téléversement");
      }

      const data = await res.json();
      const importRecord: ImportHistory = data.data ?? data;
      setCurrentImport(importRecord);

      // Auto-select all sheets
      const sheets = parseJsonSafe<string[]>(importRecord.sheets) ?? [];
      if (sheets.length > 0) {
        setSelectedSheets(sheets);
        setActivePreviewSheet(sheets[0]);
      }

      toast.success(`Fichier "${file.name}" analysé avec succès`);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du téléversement");
    } finally {
      setUploading(false);
    }
  }

  // ----- Execute Import -----

  async function handleExecuteImport() {
    if (!currentImport || selectedSheets.length === 0) {
      toast.error("Veuillez sélectionner au moins une feuille");
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch(`/api/imports/${currentImport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          selectedSheets,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'import");
      }

      const data = await res.json();
      const updatedImport: ImportHistory = data.data ?? data;
      setCurrentImport(updatedImport);

      toast.success("Import exécuté avec succès");
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setExecuting(false);
    }
  }

  // ----- Download Template -----

  async function handleDownloadTemplate() {
    try {
      const res = await fetch("/api/imports/template");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du téléchargement");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_import_AAEA.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Modèle téléchargé avec succès");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du téléchargement");
    }
  }

  // ----- View Detail -----

  async function handleViewDetail(item: ImportHistory) {
    setSelectedImport(item);
    setDetailDialogOpen(true);
    setErrorsExpanded(false);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/imports/${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedImport((prev) => (prev ? { ...prev, ...data.data } : prev));
      }
    } catch {
      // Keep existing data
    } finally {
      setDetailLoading(false);
    }
  }

  // ----- Sheet Selection -----

  function toggleSheet(sheetName: string) {
    setSelectedSheets((prev) => {
      const next = prev.includes(sheetName)
        ? prev.filter((s) => s !== sheetName)
        : [...prev, sheetName];
      // Update active preview if removing current
      if (!next.includes(activePreviewSheet) && next.length > 0) {
        setActivePreviewSheet(next[0]);
      }
      return next;
    });
  }

  function toggleAllSheets() {
    if (selectedSheets.length === parsedSheets.length) {
      setSelectedSheets([]);
      setActivePreviewSheet("");
    } else {
      setSelectedSheets([...parsedSheets]);
      if (parsedSheets.length > 0) {
        setActivePreviewSheet(parsedSheets[0]);
      }
    }
  }

  // ============================================================
  // Render: Permission Denied
  // ============================================================

  if (!canExecute) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Import Excel
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Importation de données depuis des fichiers Excel
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
              Vous n&apos;avez pas la permission d&apos;exécuter des imports Excel.
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
            Import Excel
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Importation de données depuis des fichiers Excel — Module 14
          </p>
        </div>
        <Button
          onClick={handleDownloadTemplate}
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950 shrink-0"
        >
          <FileDown className="h-4 w-4 mr-2" />
          Télécharger le modèle
        </Button>
      </div>

      {/* ============================================================ */}
      {/* KPI Stats Cards */}
      {/* ============================================================ */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total imports */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total imports</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats?.totalImports ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Imports réussis */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Imports réussis</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {(stats?.completedImports ?? 0) + (stats?.partialImports ?? 0)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lignes créées */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900">
                <Sheet className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lignes créées</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-16 mt-0.5" />
                ) : (
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats?.totalRowsImported ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Erreurs d'import */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${(stats?.totalRowsErrors ?? 0) > 0 ? "bg-red-100 dark:bg-red-900" : "bg-slate-100 dark:bg-slate-800"}`}>
                <AlertCircle className={`h-5 w-5 ${(stats?.totalRowsErrors ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Erreurs d&apos;import</p>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mt-0.5" />
                ) : (
                  <p className={`text-xl font-bold ${(stats?.totalRowsErrors ?? 0) > 0 ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                    {stats?.totalRowsErrors ?? 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Upload Zone */}
      {/* ============================================================ */}

      {!currentImport && (
        <Card>
          <CardContent className="p-6">
            <div
              className={`relative flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                isDragging
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-slate-300 dark:border-slate-600 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Analyse du fichier en cours...
                  </p>
                  <Progress className="w-48 h-2" />
                </div>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 mb-4">
                    <Upload className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    Glissez-déposez votre fichier Excel ici
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    ou cliquez pour sélectionner un fichier
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                    Formats acceptés : .xlsx, .xls, .csv
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Preview & Sheet Selection Panel */}
      {/* ============================================================ */}

      {currentImport && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {currentImport.fileName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(currentImport.fileSize)} • {currentImport.fileType.toUpperCase()} • {parsedSheets.length} feuille{parsedSheets.length !== 1 ? "s" : ""} • {currentImport.totalRows} ligne{currentImport.totalRows !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Status Badge */}
                {getStatusBadge(currentImport.status)}

                {/* Reset upload */}
                {!executing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCurrentImport(null);
                      setSelectedSheets([]);
                      setActivePreviewSheet("");
                    }}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {/* Sheet Selection */}
            {parsedSheets.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Sélection des feuilles
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAllSheets}
                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    {selectedSheets.length === parsedSheets.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parsedSheets.map((sheetName) => (
                    <label
                      key={sheetName}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedSheets.includes(sheetName)
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      <Checkbox
                        checked={selectedSheets.includes(sheetName)}
                        onCheckedChange={() => toggleSheet(sheetName)}
                      />
                      <Sheet className={`h-4 w-4 ${selectedSheets.includes(sheetName) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`} />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {sheetName}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Table */}
            {parsedPreviewData.length > 0 && selectedSheets.length > 0 && (
              <div className="space-y-3">
                {/* Sheet tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {selectedSheets.map((sheetName) => (
                    <Button
                      key={sheetName}
                      variant={activePreviewSheet === sheetName ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActivePreviewSheet(sheetName)}
                      className={`shrink-0 text-xs ${
                        activePreviewSheet === sheetName
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                    >
                      {sheetName}
                    </Button>
                  ))}
                </div>

                {/* Preview Table */}
                {activePreview && activePreview.rows && activePreview.rows.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <ScrollArea className="max-h-80">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-slate-800">
                            <TableHead className="text-xs font-semibold w-12">#</TableHead>
                            {previewHeaders.map((header) => (
                              <TableHead key={header} className="text-xs font-semibold whitespace-nowrap">
                                {header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activePreview.rows.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                              {previewHeaders.map((header) => (
                                <TableCell key={header} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                                  {String(row[header] ?? "—")}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Aperçu des {activePreview.rows.length} premières lignes de la feuille &ldquo;{activePreviewSheet}&rdquo;
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border rounded-lg border-dashed border-slate-300 dark:border-slate-600">
                    <FolderOpen className="h-8 w-8 text-slate-400 dark:text-slate-500 mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Aucune donnée d&apos;aperçu disponible pour cette feuille
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Import Results (after execution) */}
            {(currentImport.status === "Terminé" ||
              currentImport.status === "Partiel" ||
              currentImport.status === "Erreur") && (
              <div className="space-y-3">
                <Separator />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Résultats de l&apos;import
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {currentImport.createdRows}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Créées</p>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-sky-50 dark:bg-sky-950">
                    <Sheet className="h-5 w-5 text-sky-600 dark:text-sky-400 mb-1" />
                    <p className="text-xl font-bold text-sky-700 dark:text-sky-400">
                      {currentImport.updatedRows}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mises à jour</p>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mb-1" />
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                      {currentImport.skippedRows}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ignorées</p>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mb-1" />
                    <p className="text-xl font-bold text-red-700 dark:text-red-400">
                      {currentImport.errorRows}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Erreurs</p>
                  </div>
                </div>

                {/* Error log */}
                {currentImport.errorRows > 0 && currentImport.errors && (
                  <Collapsible open={errorsExpanded} onOpenChange={setErrorsExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {errorsExpanded ? "Masquer" : "Afficher"} le journal des erreurs ({currentImport.errorRows})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                        <ScrollArea className="max-h-60">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-red-50 dark:bg-red-950">
                                <TableHead className="text-xs font-semibold">Ligne</TableHead>
                                <TableHead className="text-xs font-semibold">Colonne</TableHead>
                                <TableHead className="text-xs font-semibold">Message</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(parseJsonSafe<ImportError[]>(currentImport.errors) ?? []).map((err, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs font-mono">{err.row}</TableCell>
                                  <TableCell className="text-xs">{err.column}</TableCell>
                                  <TableCell className="text-xs text-red-700 dark:text-red-400">{err.message}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Timing info */}
                <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                  {currentImport.startedAt && (
                    <span>Début : {formatDateTime(currentImport.startedAt)}</span>
                  )}
                  {currentImport.completedAt && (
                    <span>Fin : {formatDateTime(currentImport.completedAt)}</span>
                  )}
                  {currentImport.startedAt && currentImport.completedAt && (
                    <span>
                      Durée : {Math.round((new Date(currentImport.completedAt).getTime() - new Date(currentImport.startedAt).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Execute Import Button */}
            {(currentImport.status === "En attente") && (
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentImport(null);
                    setSelectedSheets([]);
                    setActivePreviewSheet("");
                  }}
                  disabled={executing}
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={selectedSheets.length === 0 || executing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {executing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Import en cours...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Exécuter l&apos;import ({selectedSheets.length} feuille{selectedSheets.length !== 1 ? "s" : ""})
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Import History Table */}
      {/* ============================================================ */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <FolderOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Historique des imports
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {total} import{total !== 1 ? "s" : ""} au total
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <Select
                value={statusFilter || "__all__"}
                onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les statuts</SelectItem>
                  <SelectItem value="En attente">En attente</SelectItem>
                  <SelectItem value="En cours">En cours</SelectItem>
                  <SelectItem value="Terminé">Terminé</SelectItem>
                  <SelectItem value="Partiel">Partiel</SelectItem>
                  <SelectItem value="Erreur">Erreur</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Loading State */}
          {loading && (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
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
          {!loading && !error && imports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <FolderOpen className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Aucun import trouvé
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
                {statusFilter
                  ? "Aucun résultat ne correspond à ce filtre. Essayez un autre statut."
                  : "Aucun fichier n'a encore été importé. Utilisez la zone ci-dessus pour commencer."}
              </p>
              {statusFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusFilter("")}
                  className="mt-4"
                >
                  <X className="h-4 w-4 mr-2" />
                  Réinitialiser le filtre
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {!loading && !error && imports.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800">
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                      <TableHead className="text-xs font-semibold">Fichier</TableHead>
                      <TableHead className="text-xs font-semibold">Taille</TableHead>
                      <TableHead className="text-xs font-semibold">Feuilles</TableHead>
                      <TableHead className="text-xs font-semibold">Statut</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Créées</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Ignorées</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Erreurs</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imports.map((imp) => {
                      const sheets = parseJsonSafe<string[]>(imp.sheets) ?? [];
                      return (
                        <TableRow key={imp.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDate(imp.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="font-medium truncate max-w-[180px]" title={imp.fileName}>
                                {imp.fileName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(imp.fileSize)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-wrap gap-1">
                              {sheets.length > 0 ? (
                                sheets.slice(0, 2).map((s) => (
                                  <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {s}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                              {sheets.length > 2 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  +{sheets.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(imp.status)}</TableCell>
                          <TableCell className="text-xs text-right font-medium text-emerald-700 dark:text-emerald-400">
                            {imp.createdRows}
                          </TableCell>
                          <TableCell className="text-xs text-right text-amber-700 dark:text-amber-400">
                            {imp.skippedRows}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            <span className={imp.errorRows > 0 ? "text-red-700 dark:text-red-400 font-medium" : "text-slate-500 dark:text-slate-400"}>
                              {imp.errorRows}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetail(imp)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Page {page} sur {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      <ChevronLeft className="h-3 w-3 -ml-1" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page buttons */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                      const pageNum = start + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className={`h-8 w-8 p-0 text-xs ${
                            page === pageNum
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : ""
                          }`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-3 w-3" />
                      <ChevronRight className="h-3 w-3 -ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Import Detail Dialog */}
      {/* ============================================================ */}

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Détails de l&apos;import
            </DialogTitle>
            <DialogDescription>
              Informations détaillées sur l&apos;import sélectionné
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : selectedImport ? (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 py-2">
                {/* File Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Informations du fichier
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nom du fichier</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedImport.fileName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Taille</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{formatFileSize(selectedImport.fileSize)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Type</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedImport.fileType.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Statut</p>
                      <div className="mt-0.5">{getStatusBadge(selectedImport.status)}</div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Importé par</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedImport.uploadedBy?.name ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Date d&apos;import</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{formatDateTime(selectedImport.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sheets */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sheet className="h-4 w-4 text-emerald-600" />
                    Feuilles
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(parseJsonSafe<string[]>(selectedImport.sheets) ?? []).map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className={`text-xs ${
                          (parseJsonSafe<string[]>(selectedImport.selectedSheets) ?? []).includes(s)
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Timing */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Chronologie
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Début</p>
                      <p className="text-sm text-slate-900 dark:text-white">{formatDateTime(selectedImport.startedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fin</p>
                      <p className="text-sm text-slate-900 dark:text-white">{formatDateTime(selectedImport.completedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Durée</p>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {selectedImport.startedAt && selectedImport.completedAt
                          ? `${Math.round((new Date(selectedImport.completedAt).getTime() - new Date(selectedImport.startedAt).getTime()) / 1000)}s`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Row Counts */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Résultats du traitement
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedImport.totalRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Total</p>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedImport.processedRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Traitées</p>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{selectedImport.createdRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Créées</p>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-sky-50 dark:bg-sky-950">
                      <p className="text-lg font-bold text-sky-700 dark:text-sky-400">{selectedImport.updatedRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Mises à jour</p>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{selectedImport.skippedRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Ignorées</p>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-lg bg-red-50 dark:bg-red-950">
                      <p className="text-lg font-bold text-red-700 dark:text-red-400">{selectedImport.errorRows}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Erreurs</p>
                    </div>
                  </div>
                  {selectedImport.totalRows > 0 && (
                    <Progress
                      value={
                        selectedImport.totalRows > 0
                          ? Math.round((selectedImport.processedRows / selectedImport.totalRows) * 100)
                          : 0
                      }
                      className="h-2"
                    />
                  )}
                </div>

                {/* Error Table */}
                {selectedImport.errorRows > 0 && selectedImport.errors && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Journal des erreurs ({selectedImport.errorRows})
                      </h4>
                      <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                        <ScrollArea className="max-h-48">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-red-50 dark:bg-red-950">
                                <TableHead className="text-xs font-semibold">Ligne</TableHead>
                                <TableHead className="text-xs font-semibold">Colonne</TableHead>
                                <TableHead className="text-xs font-semibold">Message</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(parseJsonSafe<ImportError[]>(selectedImport.errors) ?? []).map((err, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs font-mono">{err.row}</TableCell>
                                  <TableCell className="text-xs">{err.column}</TableCell>
                                  <TableCell className="text-xs text-red-700 dark:text-red-400">{err.message}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </div>
                  </>
                )}

                {/* Preview Data */}
                {selectedImport.previewData && (() => {
                  const preview = parseJsonSafe<SheetPreview[]>(selectedImport.previewData);
                  if (!preview || preview.length === 0) return null;
                  return (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <Eye className="h-4 w-4 text-emerald-600" />
                          Aperçu des données
                        </h4>
                        {preview.map((sheet) => {
                          if (!sheet.rows || sheet.rows.length === 0) return null;
                          const headers = Object.keys(sheet.rows[0]);
                          return (
                            <div key={sheet.name} className="space-y-1">
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                Feuille : {sheet.name}
                              </p>
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <ScrollArea className="max-h-40">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-slate-50 dark:bg-slate-800">
                                        {headers.map((h) => (
                                          <TableHead key={h} className="text-xs font-semibold whitespace-nowrap">
                                            {h}
                                          </TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sheet.rows.map((row, idx) => (
                                        <TableRow key={idx}>
                                          {headers.map((h) => (
                                            <TableCell key={h} className="text-xs whitespace-nowrap max-w-[150px] truncate">
                                              {String(row[h] ?? "—")}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </ScrollArea>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
