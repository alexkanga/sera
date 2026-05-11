"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FolderOpen,
  BarChart3,
  Table2,
  GanttChart,
  Shield,
  Upload,
  FileOutput,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

interface ExportJob {
  id: string;
  type: string;
  format: string;
  title: string;
  status: string;
  fileName: string | null;
  fileSize: number;
  filePath: string | null;
  filters: string | null;
  recordCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  generatedById: string;
  createdAt: string;
  updatedAt: string;
  generatedBy: { id: string; name: string; email: string } | null;
}

interface ExportStats {
  totalExports: number;
  typeCounts: Record<string, number>;
  formatCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  successRate: number;
  totalFileSize: number;
  averageFileSize: number;
  totalRecords: number;
  recentExports: ExportJob[];
}

// ============================================================
// Constants
// ============================================================

const TYPE_LABELS: Record<string, string> = {
  pta: "PTA / Activités",
  dashboard: "Tableau de bord",
  report: "Rapports",
  gantt: "Gantt",
  raci: "Matrice RACI",
  evidence: "Preuves",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  pta: FileText,
  dashboard: BarChart3,
  report: FileOutput,
  gantt: GanttChart,
  raci: Table2,
  evidence: Upload,
};

const FORMAT_LABELS: Record<string, string> = { pdf: "PDF", xlsx: "Excel", docx: "Word" };
const FORMAT_ICONS: Record<string, React.ElementType> = { pdf: FileText, xlsx: FileSpreadsheet, docx: File };

const TYPE_COLORS: Record<string, string> = {
  pta: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400",
  dashboard: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-400",
  report: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400",
  gantt: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-400",
  raci: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-400",
  evidence: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400",
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400",
  xlsx: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400",
  docx: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400",
};

const STATUS_COLORS: Record<string, string> = {
  "Terminé": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400",
  "En cours": "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400",
  "Erreur": "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400",
  "En attente": "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  "Terminé": CheckCircle2,
  "En cours": Clock,
  "Erreur": XCircle,
  "En attente": Clock,
};

// ============================================================
// Helpers
// ============================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(d: string | null | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "dd/MM/yyyy HH:mm");
}

function hasPermission(session: unknown, perm: string): boolean {
  const s = session as { user?: { roles?: Array<{ permissions: string[] }> } } | null;
  if (!s?.user?.roles) return false;
  return s.user.roles.some((r) =>
    r.permissions.some((p) => {
      if (p === "admin:*") return true;
      if (p === perm) return true;
      if (p === `${perm.split(":")[0]}:*`) return true;
      return false;
    })
  );
}

// ============================================================
// Component
// ============================================================

export function ExportsSection() {
  const { data: session } = useSession();
  const canRead = hasPermission(session, "export:read");
  const canExecute = hasPermission(session, "export:execute");

  // State
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Generator state
  const [showGenerator, setShowGenerator] = useState(false);
  const [genType, setGenType] = useState<string>("pta");
  const [genFormat, setGenFormat] = useState<string>("pdf");
  const [genTitle, setGenTitle] = useState("");
  const [generating, setGenerating] = useState(false);

  // Detail dialog
  const [selectedExport, setSelectedExport] = useState<ExportJob | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<ExportJob | null>(null);

  // Fetch data
  const fetchExports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType !== "all") params.set("type", filterType);
      if (filterFormat !== "all") params.set("format", filterFormat);
      if (filterStatus !== "all") params.set("status", filterStatus);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/exports?${params}`);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setExports(data.exports);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setError("Impossible de charger les exports");
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterFormat, filterStatus, page]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/exports/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-generate title
  useEffect(() => {
    if (!genTitle) {
      const typeLabel = TYPE_LABELS[genType] || genType;
      const formatLabel = FORMAT_LABELS[genFormat] || genFormat;
      setGenTitle(`Export ${typeLabel} - ${formatLabel} - ${format(new Date(), "dd/MM/yyyy")}`);
    }
  }, [genType, genFormat, genTitle]);

  // Generate export
  const handleGenerate = async () => {
    if (!canExecute) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: genType,
          format: genFormat,
          title: genTitle,
          filters: {},
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la génération");
      }
      toast.success("Export généré avec succès");
      setShowGenerator(false);
      setGenTitle("");
      fetchExports();
      fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  // Download export
  const handleDownload = async (exp: ExportJob) => {
    try {
      const res = await fetch(`/api/exports/${exp.id}/download`);
      if (!res.ok) throw new Error("Erreur de téléchargement");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exp.fileName || `export.${exp.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Téléchargement commencé");
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  // Delete export
  const handleDelete = async () => {
    if (!deleteTarget || !canExecute) return;
    try {
      const res = await fetch(`/api/exports/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      toast.success("Export supprimé");
      setDeleteTarget(null);
      fetchExports();
      fetchStats();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // View detail
  const handleViewDetail = (exp: ExportJob) => {
    setSelectedExport(exp);
    setShowDetail(true);
  };

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Accès refusé — permission export:read requise</p>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Total Exports</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.totalExports}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">PDF</p>
              <p className="text-2xl font-bold text-red-600">{stats.formatCounts.pdf || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Excel</p>
              <p className="text-2xl font-bold text-green-600">{stats.formatCounts.xlsx || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Word</p>
              <p className="text-2xl font-bold text-blue-600">{stats.formatCounts.docx || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Taux succès</p>
              <p className="text-2xl font-bold text-amber-600">{stats.successRate}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-1">Enregistrements</p>
              <p className="text-2xl font-bold text-violet-600">{stats.totalRecords}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher un export..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 w-full sm:w-64"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFormat} onValueChange={(v) => { setFilterFormat(v); setPage(1); }}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
              <SelectItem value="docx">Word</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchExports(); fetchStats(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualiser
          </Button>
          {canExecute && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowGenerator(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nouvel export
            </Button>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">Tous ({total})</TabsTrigger>
          <TabsTrigger value="Terminé">Terminés</TabsTrigger>
          <TabsTrigger value="En cours">En cours</TabsTrigger>
          <TabsTrigger value="Erreur">Erreurs</TabsTrigger>
          <TabsTrigger value="En attente">En attente</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Export History */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-slate-500">Chargement...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-slate-500">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchExports}>
            <RefreshCw className="h-4 w-4 mr-1" /> Réessayer
          </Button>
        </div>
      ) : exports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <FolderOpen className="h-10 w-10 text-slate-300" />
          <p className="text-slate-500">Aucun export trouvé</p>
          {canExecute && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowGenerator(true)}>
              <Plus className="h-4 w-4 mr-1" /> Créer un export
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800">
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Titre</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Type</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Format</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Statut</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Enregistrements</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Taille</th>
                  <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Date</th>
                  <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => {
                  const StatusIcon = STATUS_ICONS[exp.status] || Clock;
                  return (
                    <tr key={exp.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3">
                        <p className="font-medium text-slate-900 dark:text-white truncate max-w-48">{exp.title}</p>
                        <p className="text-xs text-slate-500">{exp.generatedBy?.name || "—"}</p>
                      </td>
                      <td className="p-3">
                        <Badge className={TYPE_COLORS[exp.type] || ""}>{TYPE_LABELS[exp.type] || exp.type}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={FORMAT_COLORS[exp.format] || ""}>{FORMAT_LABELS[exp.format] || exp.format}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={STATUS_COLORS[exp.status] || ""}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {exp.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{exp.recordCount}</td>
                      <td className="p-3 text-slate-500">{formatFileSize(exp.fileSize)}</td>
                      <td className="p-3 text-slate-500 text-xs">{formatDate(exp.createdAt)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetail(exp)} title="Détails">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {exp.status === "Terminé" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => handleDownload(exp)} title="Télécharger">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {canExecute && exp.status !== "En cours" && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteTarget(exp)} title="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-xs text-slate-500">
                {total} export(s) — Page {page}/{totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Précédent
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  if (p > totalPages) return null;
                  return (
                    <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className={p === page ? "bg-emerald-600" : ""} onClick={() => setPage(p)}>
                      {p}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileOutput className="h-5 w-5 text-emerald-600" />
              Générer un export
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Type d&apos;export</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_LABELS).map(([key, label]) => {
                  const Icon = TYPE_ICONS[key];
                  return (
                    <Button
                      key={key}
                      variant={genType === key ? "default" : "outline"}
                      className={`justify-start h-auto py-3 ${genType === key ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      onClick={() => setGenType(key)}
                    >
                      <Icon className="h-4 w-4 mr-2 shrink-0" />
                      <span className="text-sm">{label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(FORMAT_LABELS).map(([key, label]) => {
                  const Icon = FORMAT_ICONS[key];
                  return (
                    <Button
                      key={key}
                      variant={genFormat === key ? "default" : "outline"}
                      className={`justify-center ${genFormat === key ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      onClick={() => setGenFormat(key)}
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Titre</label>
              <Input
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                placeholder="Titre de l'export..."
              />
            </div>

            {/* Generate Button */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGenerator(false)}>
                Annuler
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <FileOutput className="h-4 w-4 mr-2" />
                    Générer l&apos;export
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Détails de l&apos;export
            </DialogTitle>
          </DialogHeader>
          {selectedExport && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Titre</p>
                    <p className="text-sm font-medium">{selectedExport.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Type</p>
                    <Badge className={TYPE_COLORS[selectedExport.type] || ""}>{TYPE_LABELS[selectedExport.type] || selectedExport.type}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Format</p>
                    <Badge className={FORMAT_COLORS[selectedExport.format] || ""}>{FORMAT_LABELS[selectedExport.format] || selectedExport.format}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Statut</p>
                    <Badge variant="outline" className={STATUS_COLORS[selectedExport.status] || ""}>{selectedExport.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Enregistrements</p>
                    <p className="text-sm">{selectedExport.recordCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Taille</p>
                    <p className="text-sm">{formatFileSize(selectedExport.fileSize)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Généré par</p>
                    <p className="text-sm">{selectedExport.generatedBy?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Date de création</p>
                    <p className="text-sm">{formatDate(selectedExport.createdAt)}</p>
                  </div>
                  {selectedExport.startedAt && (
                    <div>
                      <p className="text-xs text-slate-500">Début</p>
                      <p className="text-sm">{formatDate(selectedExport.startedAt)}</p>
                    </div>
                  )}
                  {selectedExport.completedAt && (
                    <div>
                      <p className="text-xs text-slate-500">Fin</p>
                      <p className="text-sm">{formatDate(selectedExport.completedAt)}</p>
                    </div>
                  )}
                </div>

                {selectedExport.fileName && (
                  <div>
                    <p className="text-xs text-slate-500">Fichier</p>
                    <p className="text-sm font-mono">{selectedExport.fileName}</p>
                  </div>
                )}

                {selectedExport.filters && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Filtres utilisés</p>
                    <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded-md overflow-auto max-h-32">
                      {JSON.stringify(JSON.parse(selectedExport.filters), null, 2)}
                    </pre>
                  </div>
                )}

                {selectedExport.errorMessage && (
                  <div>
                    <p className="text-xs text-red-500 mb-1">Message d&apos;erreur</p>
                    <pre className="text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-2 rounded-md overflow-auto max-h-32">
                      {selectedExport.errorMessage}
                    </pre>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  {selectedExport.status === "Terminé" && (
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDownload(selectedExport)}>
                      <Download className="h-4 w-4 mr-2" /> Télécharger
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowDetail(false)}>Fermer</Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet export ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;export &quot;{deleteTarget?.title}&quot; sera supprimé définitivement avec le fichier associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
