"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Building2,
  Network,
  Users,
  UserCheck,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Hash,
  Mail,
  Phone,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ============================================================
// Types
// ============================================================

interface UserOption {
  id: string;
  name: string;
  email: string;
  position: string | null;
  department: string | null;
  phone: string | null;
  isActive: boolean;
}

interface UnitItem {
  id: string;
  code: string;
  name: string;
  headUser: UserOption | null;
}

interface DirectionItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  headUser: UserOption | null;
  units: UnitItem[];
  isActive: boolean;
  deletedAt: string | null;
}

// ============================================================
// Color Mapping for Directions
// ============================================================

const DIRECTION_COLORS: Record<
  string,
  {
    bg: string;
    bgLight: string;
    border: string;
    text: string;
    badge: string;
    icon: string;
    hover: string;
  }
> = {
  DEX: {
    bg: "bg-emerald-600",
    bgLight: "bg-emerald-50 dark:bg-emerald-900/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400",
    hover: "hover:border-emerald-400 dark:hover:border-emerald-600",
  },
  DSMP: {
    bg: "bg-amber-600",
    bgLight: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400",
    hover: "hover:border-amber-400 dark:hover:border-amber-600",
  },
  DAF: {
    bg: "bg-violet-600",
    bgLight: "bg-violet-50 dark:bg-violet-900/30",
    border: "border-violet-200 dark:border-violet-800",
    text: "text-violet-700 dark:text-violet-400",
    badge:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    icon: "bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-400 dark:hover:border-violet-600",
  },
};

const DEFAULT_COLOR = DIRECTION_COLORS.DEX;

function getDirectionColor(code: string) {
  return DIRECTION_COLORS[code] || DEFAULT_COLOR;
}

// ============================================================
// Main Component
// ============================================================

export function OrgOverviewSection() {
  // ----- Data state -----
  const [directions, setDirections] = useState<DirectionItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----- UI state -----
  const [expandedDirection, setExpandedDirection] = useState<string | null>(
    null
  );
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedDirectionForMembers, setSelectedDirectionForMembers] =
    useState<DirectionItem | null>(null);

  // ============================================================
  // Fetch Data
  // ============================================================

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [directionsRes, usersRes] = await Promise.all([
          fetch(
            "/api/directions?includeUnits=true&status=active&limit=50"
          ),
          fetch("/api/users?limit=100"),
        ]);

        if (!directionsRes.ok) {
          const data = await directionsRes.json();
          throw new Error(
            data.error || "Erreur lors du chargement des directions"
          );
        }
        if (!usersRes.ok) {
          const data = await usersRes.json();
          throw new Error(
            data.error || "Erreur lors du chargement des utilisateurs"
          );
        }

        const directionsData = await directionsRes.json();
        const usersData = await usersRes.json();

        setDirections(directionsData.data);
        setUsers(usersData.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ============================================================
  // Computed Stats
  // ============================================================

  const totalDirections = directions.filter((d) => !d.deletedAt).length;
  const totalUnits = directions.reduce(
    (sum, d) => sum + (d.units?.length ?? 0),
    0
  );
  const totalMembers = users.filter((u) => u.isActive).length;
  const activeMembers = users.filter((u) => u.isActive).length;

  // Get members for a direction by matching user department to direction name/code
  function getDirectionMembers(direction: DirectionItem): UserOption[] {
    return users.filter(
      (u) =>
        u.department &&
        (u.department === direction.name ||
          u.department === direction.code ||
          u.department.includes(direction.code))
    );
  }

  // ============================================================
  // Handlers
  // ============================================================

  function toggleDirection(directionId: string) {
    setExpandedDirection((prev) =>
      prev === directionId ? null : directionId
    );
  }

  function openMembersDialog(direction: DirectionItem) {
    setSelectedDirectionForMembers(direction);
    setMembersDialogOpen(true);
  }

  // ============================================================
  // Render: Loading
  // ============================================================

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Vue d&apos;ensemble organisationnelle
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Structure et statistiques de l&apos;organisation AAEA
          </p>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Org chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Vue d&apos;ensemble organisationnelle
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Structure et statistiques de l&apos;organisation AAEA
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Erreur de chargement
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-md">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Vue d&apos;ensemble organisationnelle
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Structure et statistiques de l&apos;organisation AAEA
        </p>
      </div>

      {/* ============================================================ */}
      {/* Summary Stats Cards */}
      {/* ============================================================ */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Directions */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Directions
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {totalDirections}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Units */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Unités
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {totalUnits}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900">
                <Network className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Members */}
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Membres
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {totalMembers}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900">
                <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Members */}
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Membres actifs
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {activeMembers}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900">
                <UserCheck className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* Org Chart - Direction Cards */}
      {/* ============================================================ */}

      {directions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Building2 className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Aucune direction configurée
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center max-w-sm">
              Commencez par créer des directions dans la section &quot;Gestion
              des directions&quot; pour voir l&apos;organigramme.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {directions.map((direction) => {
            const color = getDirectionColor(direction.code);
            const isExpanded = expandedDirection === direction.id;
            const members = getDirectionMembers(direction);

            return (
              <Card
                key={direction.id}
                className={`border-2 ${color.border} ${color.hover} transition-all duration-200`}
              >
                {/* Direction Header */}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.icon}`}
                      >
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {direction.name}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono mt-1 ${color.badge}`}
                        >
                          {direction.code}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Head User */}
                  {direction.headUser && (
                    <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${color.icon} text-xs font-semibold`}
                      >
                        {direction.headUser.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">
                          {direction.headUser.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Responsable
                        </p>
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Network className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {direction.units?.length ?? 0} unité
                        {(direction.units?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {members.length} membre{members.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Units list - collapsible */}
                  {direction.units && direction.units.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleDirection(direction.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 mb-2 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        {isExpanded
                          ? "Masquer les unités"
                          : "Voir les unités"}
                      </button>

                      {isExpanded && (
                        <ScrollArea className="max-h-64">
                          <div className="space-y-1.5">
                            {direction.units.map((unit) => (
                              <div
                                key={unit.id}
                                className={`flex items-center gap-2 p-2 rounded-lg ${color.bgLight}`}
                              >
                                <Network className={`h-3.5 w-3.5 ${color.text} shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-mono py-0 px-1"
                                    >
                                      {unit.code}
                                    </Badge>
                                    <span className="text-xs font-medium truncate">
                                      {unit.name}
                                    </span>
                                  </div>
                                  {unit.headUser && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                      Resp. {unit.headUser.name}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </>
                  )}

                  {/* Members button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openMembersDialog(direction)}
                    className="w-full mt-3 text-xs text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
                  >
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Voir les membres ({members.length})
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* Members Dialog */}
      {/* ============================================================ */}

      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Membres de la direction
            </DialogTitle>
            <DialogDescription>
              {selectedDirectionForMembers && (
                <>
                  Membres rattachés à{" "}
                  <span className="font-medium">
                    {selectedDirectionForMembers.name}
                  </span>{" "}
                  ({selectedDirectionForMembers.code})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedDirectionForMembers && (
            <div className="py-4">
              {(() => {
                const members = getDirectionMembers(
                  selectedDirectionForMembers
                );
                if (members.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                        Aucun membre trouvé pour cette direction.
                        <br />
                        <span className="text-xs">
                          Les membres sont identifiés par leur département.
                        </span>
                      </p>
                    </div>
                  );
                }

                return (
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shrink-0">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {member.name}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {member.email}
                              </span>
                            </div>
                            {(member.position || member.phone) && (
                              <div className="flex items-center gap-3 mt-0.5">
                                {member.position && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    {member.position}
                                  </span>
                                )}
                                {member.phone && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {member.phone}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            {member.isActive ? (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                                Actif
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
                                Inactif
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMembersDialogOpen(false)}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
