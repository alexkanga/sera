import { NextResponse } from "next/server";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import * as XLSX from "xlsx";

// GET /api/imports/template — Télécharger le modèle d'import Excel
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const hasAccess =
      userHasPermission(currentUser, "import:execute") ||
      userHasPermission(currentUser, "admin:*");
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Define sheet structures with column headers
    const sheets: Record<string, string[]> = {
      "Equipe AAEA": [
        "Code PTA",
        "Nom et prénoms",
        "Poste",
        "Direction / unité",
      ],
      "Axes strategiques": [
        "Code axe",
        "Intitulé de l'axe",
        "Description synthétique",
        "Résultats attendus",
        "Indicateurs stratégiques possibles",
        "Directions principalement concernées",
      ],
      "Referentiel ACBF": [
        "ID domaine ACBF",
        "Domaine ACBF",
        "ID livrable ACBF",
        "Livrable demandé",
        "Description courte",
        "Priorité",
        "Statut de disponibilité",
      ],
      "PTA consolide AAEA": [
        "N°",
        "Code PTA",
        "Activité PTA concrète",
        "Bloc / objectif fonctionnel",
        "Nature de l'activité",
        "Axe stratégique principal",
        "Axe(s) secondaire(s)",
        "Domaine ACBF",
        "Livrable ACBF associé",
        "Objectif annuel",
        "Tâches détaillées",
        "Livrable attendu",
        "Contributeur(s)",
        "Validateur",
        "Date début",
        "Date fin",
        "Durée estimée",
        "Dépendance / préalable",
        "Priorité",
        "Indicateur de performance",
        "Source de vérification",
        "Statut",
        "Taux d'avancement",
        "Risque / contrainte",
        "Commentaires",
      ],
      "RACI institutionnelle": [
        "ID livrable ACBF",
        "Axe stratégique principal",
        "Responsable principal — R",
        "Autorité / validateur — A",
        "Contributeur(s) — C",
        "Informé(s) — I",
        "Niveau de priorité",
        "Échéance indicative",
        "Source de vérification attendue",
        "Commentaires",
      ],
    };

    // Create workbook
    const workbook = XLSX.utils.book_new();

    for (const [sheetName, columns] of Object.entries(sheets)) {
      // Create a sheet with just the header row
      const wsData = [columns];
      const worksheet = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths based on header length
      worksheet["!cols"] = columns.map((col) => ({
        wch: Math.max(col.length + 5, 15),
      }));

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Return as downloadable file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="template_import_AAEA.xlsx"',
      },
    });
  } catch (error) {
    console.error("Erreur GET /api/imports/template:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
