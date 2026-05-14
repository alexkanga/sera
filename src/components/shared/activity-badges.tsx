"use client";

import { Badge } from "@/components/ui/badge";

// ============================================================
// Shared Activity Badge Components
// Used by: activities-section.tsx (Module 5), pta-consolide-section.tsx (Module 6)
// ============================================================

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  switch (priority) {
    case "Haute":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Haute
        </Badge>
      );
    case "Moyenne":
      return (
        <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
          Moyenne
        </Badge>
      );
    case "Basse":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Basse
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {priority}
        </Badge>
      );
  }
}

export function ActivityStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  switch (status) {
    case "Non démarré":
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
          Non démarré
        </Badge>
      );
    case "En cours":
      return (
        <Badge className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400 border-0">
          En cours
        </Badge>
      );
    case "Réalisé":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Réalisé
        </Badge>
      );
    case "En retard":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          En retard
        </Badge>
      );
    case "Suspendu":
      return (
        <Badge className="text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400 border-0">
          Suspendu
        </Badge>
      );
    case "À reprogrammer":
      return (
        <Badge className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-400 border-0">
          À reprogrammer
        </Badge>
      );
    case "Terminé":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Terminé
        </Badge>
      );
    case "Annulé":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Annulé
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {status}
        </Badge>
      );
  }
}

export function ValidationStatusBadge({ validationStatus }: { validationStatus: string | null }) {
  if (!validationStatus) return null;
  switch (validationStatus) {
    case "Brouillon":
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
          Brouillon
        </Badge>
      );
    case "Soumis":
      return (
        <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
          Soumis
        </Badge>
      );
    case "Validé":
      return (
        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
          Validé
        </Badge>
      );
    case "Rejeté":
      return (
        <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border-0">
          Rejeté
        </Badge>
      );
    default:
      return (
        <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-0">
          {validationStatus}
        </Badge>
      );
  }
}

// ============================================================
// Progress color helpers
// ============================================================

export function getProgressColor(rate: number): string {
  if (rate >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 50) return "text-blue-600 dark:text-blue-400";
  if (rate >= 25) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

export function getProgressBg(rate: number): string {
  if (rate >= 75) return "bg-emerald-500";
  if (rate >= 50) return "bg-blue-500";
  if (rate >= 25) return "bg-amber-500";
  return "bg-slate-400";
}
