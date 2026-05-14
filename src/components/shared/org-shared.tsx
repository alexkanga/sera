"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ============================================================
// Pagination Controls
// ============================================================

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  totalPages,
  total,
  itemsPerPage,
  onPageChange,
}: PaginationControlsProps) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {total > 0
          ? `Affichage de ${(page - 1) * itemsPerPage + 1} à ${Math.min(page * itemsPerPage, total)} sur ${total}`
          : "Aucun résultat"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
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
                  onClick={() => onPageChange(pageNum)}
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
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-8"
        >
          Suivant
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Status Badge
// ============================================================

interface StatusBadgeProps {
  deletedAt: string | null;
  isActive: boolean;
  /** French grammatical gender: "m" for masculine (Axe), "f" for feminine (Direction, Unité). Default: "f" */
  gender?: "m" | "f";
}

export function StatusBadge({ deletedAt, isActive, gender = "f" }: StatusBadgeProps) {
  if (deletedAt) {
    return (
      <Badge className="text-[10px] bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">
        {gender === "m" ? "Archivé" : "Archivée"}
      </Badge>
    );
  }
  if (!isActive) {
    return (
      <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 border-0">
        {gender === "m" ? "Inactif" : "Inactive"}
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
      {gender === "m" ? "Actif" : "Active"}
    </Badge>
  );
}
