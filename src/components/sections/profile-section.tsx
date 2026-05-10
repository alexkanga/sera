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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserCircle,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Hash,
  Shield,
  Key,
  Pencil,
  X,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// Types
interface ProfileData {
  id: string;
  email: string;
  name: string;
  ptaCode: string | null;
  position: string | null;
  department: string | null;
  phone: string | null;
  avatar: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: {
    id: string;
    code: string;
    name: string;
    permissions: { code: string; name: string }[];
  }[];
  allPermissions: string[];
}

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Format date
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProfileSection() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du chargement du profil");
      }
      const data = await res.json();
      setProfile(data.data);
    } catch (err) {
      console.error("Erreur profil:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleEditStart = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone || "");
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditName("");
    setEditPhone("");
  };

  const handleEditSave = async () => {
    if (!profile) return;

    if (editName.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      toast.success("Profil mis à jour avec succès");
      setIsEditing(false);
      await fetchProfile(); // Refresh profile data
    } catch (err) {
      console.error("Erreur mise à jour profil:", err);
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Mon profil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consulter et modifier vos informations personnelles
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Mon profil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consulter et modifier vos informations personnelles
          </p>
        </div>

        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Impossible de charger le profil
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={fetchProfile}
              className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium underline underline-offset-4"
            >
              Réessayer
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) return null;

  // Gather unique permissions from all roles
  const uniquePermissions = profile.roles.flatMap((r) => r.permissions);
  const permMap = new Map<string, { code: string; name: string }>();
  uniquePermissions.forEach((p) => {
    if (!permMap.has(p.code)) {
      permMap.set(p.code, p);
    }
  });
  const allUniquePermissions = Array.from(permMap.values());

  // Group permissions by module (derived from code prefix)
  const permGroupMap = new Map<string, { code: string; name: string }[]>();
  allUniquePermissions.forEach((p) => {
    const modKey = p.code.split(":")[0] || "autre";
    if (!permGroupMap.has(modKey)) {
      permGroupMap.set(modKey, []);
    }
    permGroupMap.get(modKey)!.push(p);
  });

  const moduleLabels: Record<string, string> = {
    users: "Utilisateurs",
    roles: "Rôles",
    permissions: "Permissions",
    audit: "Audit",
    admin: "Administration",
    activities: "Activités",
    directions: "Directions",
    units: "Unités",
    axes: "Axes stratégiques",
    acbf: "ACBF",
    settings: "Paramètres",
    dashboard: "Tableau de bord",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Mon profil
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Consulter et modifier vos informations personnelles
        </p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar ?? undefined} alt={profile.name} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400 text-lg font-bold">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-xl text-slate-900 dark:text-white">
                {profile.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {profile.position || "Aucun poste défini"} · {profile.department || "Aucune direction"}
              </CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  className={
                    profile.isActive
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-400"
                  }
                >
                  {profile.isActive ? "Actif" : "Inactif"}
                </Badge>
                {profile.roles.map((role) => (
                  <Badge
                    key={role.id}
                    variant="outline"
                    className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                  >
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditStart}
                className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Edit Form Card */}
      {isEditing && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-base">Modifier mes informations</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEditCancel}
                className="h-8 w-8"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nom complet
                </Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="border-slate-300 dark:border-slate-600"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Téléphone
                </Label>
                <Input
                  id="edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Numéro de téléphone"
                  className="border-slate-300 dark:border-slate-600"
                  disabled={saving}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={handleEditSave}
                disabled={saving || editName.trim().length < 2}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" />
                    Enregistrer
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleEditCancel}
                disabled={saving}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-base">Informations personnelles</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Nom */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <UserCircle className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Nom complet
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.name}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Mail className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Adresse email
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.email}
                </p>
              </div>
            </div>

            {/* Code PTA */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Hash className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Code PTA
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.ptaCode || "Non assigné"}
                </p>
              </div>
            </div>

            {/* Téléphone */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Phone className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Téléphone
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.phone || "Non renseigné"}
                </p>
              </div>
            </div>

            {/* Poste */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Briefcase className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Poste
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.position || "Non défini"}
                </p>
              </div>
            </div>

            {/* Direction */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <Building2 className="h-4 w-4 mt-0.5 text-slate-400" />
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Direction
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile.department || "Non assignée"}
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Dernière connexion */}
            <div className="flex items-start gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Dernière connexion
                </p>
                <p className="text-sm text-slate-900 dark:text-white">
                  {formatDate(profile.lastLoginAt)}
                </p>
              </div>
            </div>
            {/* Créé le */}
            <div className="flex items-start gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Compte créé le
                </p>
                <p className="text-sm text-slate-900 dark:text-white">
                  {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles & Permissions Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-base">Rôles et permissions</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Vos rôles et droits d&apos;accès sur la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Roles */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Rôles assignés ({profile.roles.length})
            </h4>
            {profile.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Aucun rôle assigné
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800"
                  >
                    <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {role.name}
                    </span>
                    <span className="text-xs text-emerald-500 dark:text-emerald-500">
                      ({role.code})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Permissions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Key className="h-3.5 w-3.5" />
              Permissions ({allUniquePermissions.length})
            </h4>
            {allUniquePermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Aucune permission configurée
              </p>
            ) : (
              <div className="space-y-3">
                {Array.from(permGroupMap.entries()).map(([modKey, perms]) => (
                  <div key={modKey}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      {moduleLabels[modKey] || modKey}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (
                        <Badge
                          key={p.code}
                          variant="secondary"
                          className="text-[11px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
        </CardContent>
      </Card>
    </div>
  );
}
