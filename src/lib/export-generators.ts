import { db } from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType as DocxWidthType,
  HeadingLevel as DocxHeadingLevel,
  AlignmentType as DocxAlignmentType,
  Packer as DocxPacker,
} from "docx";

interface ExportResult {
  fileName: string;
  fileSize: number;
  fileData: Buffer;
  recordCount: number;
}

function timestampStr(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// Helper: hex color string to pdf-lib rgb
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

// A4 dimensions in points
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };

// Helper: draw a text table on a pdf-lib page, handles pagination
async function drawPdfTable(
  pdfDoc: PDFDocument,
  title: string,
  subtitle: string,
  headers: string[],
  colWidths: number[],
  rows: string[][],
  pageLayout: "portrait" | "landscape"
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dims = pageLayout === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
  const margin = 40;
  const headerHeight = 20;
  const rowHeight = 16;
  const titleSize = 16;
  const subtitleSize = 9;
  const headerFontSize = 7;
  const cellFontSize = 6.5;
  const bottomMargin = 40;

  const greenHex = hexToRgb("#047857");
  const darkSlateHex = hexToRgb("#1e293b");
  const lightGreenHex = hexToRgb("#f0fdf4");
  const grayTextHex = hexToRgb("#64748b");

  // First page
  let page = pdfDoc.addPage([dims.width, dims.height]);
  let y = dims.height - margin;

  // Title
  page.drawText(title, {
    x: margin,
    y: y - titleSize,
    size: titleSize,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= titleSize + 4;

  // Subtitle
  page.drawText(subtitle, {
    x: margin,
    y: y - subtitleSize,
    size: subtitleSize,
    font,
    color: rgb(grayTextHex.r, grayTextHex.g, grayTextHex.b),
  });
  y -= subtitleSize + 16;

  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = margin;

  const drawTableHeader = (currentPage: typeof page, currentY: number) => {
    currentPage.drawRectangle({
      x: startX,
      y: currentY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(greenHex.r, greenHex.g, greenHex.b),
    });
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      currentPage.drawText(headers[i], {
        x: x + 3,
        y: currentY - headerHeight + 6,
        size: headerFontSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      x += colWidths[i];
    }
    return currentY - headerHeight - 2;
  };

  y = drawTableHeader(page, y);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    if (y - rowHeight < bottomMargin) {
      page = pdfDoc.addPage([dims.width, dims.height]);
      y = dims.height - margin;
      y = drawTableHeader(page, y);
    }

    const row = rows[rowIdx];
    const bgColor = rowIdx % 2 === 0 ? rgb(lightGreenHex.r, lightGreenHex.g, lightGreenHex.b) : rgb(1, 1, 1);
    page.drawRectangle({
      x: startX,
      y: y - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: bgColor,
    });

    let x = startX;
    for (let i = 0; i < row.length; i++) {
      const text = (row[i] || "").substring(0, 40);
      page.drawText(text, {
        x: x + 3,
        y: y - rowHeight + 4,
        size: cellFontSize,
        font,
        color: rgb(darkSlateHex.r, darkSlateHex.g, darkSlateHex.b),
      });
      x += colWidths[i];
    }
    y -= rowHeight + 2;
  }

  return y;
}

// Helper: draw a simple list document (for Reports, Evidence, Dashboard KPIs)
async function drawPdfListDocument(
  pdfDoc: PDFDocument,
  title: string,
  subtitle: string,
  items: Array<{ heading: string; details: string[] }>,
  pageLayout: "portrait" | "landscape"
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dims = pageLayout === "landscape" ? A4_LANDSCAPE : A4_PORTRAIT;
  const margin = 50;
  const bottomMargin = 50;
  const greenHex = hexToRgb("#047857");
  const grayTextHex = hexToRgb("#64748b");
  const darkTextHex = hexToRgb("#1e293b");

  let page = pdfDoc.addPage([dims.width, dims.height]);
  let y = dims.height - margin;

  // Title
  page.drawText(title, {
    x: margin,
    y: y - 18,
    size: 18,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= 26;

  // Subtitle
  if (subtitle) {
    page.drawText(subtitle, {
      x: margin,
      y: y - 10,
      size: 10,
      font,
      color: rgb(grayTextHex.r, grayTextHex.g, grayTextHex.b),
    });
    y -= 18;
  }

  for (const item of items) {
    if (y - 60 < bottomMargin) {
      page = pdfDoc.addPage([dims.width, dims.height]);
      y = dims.height - margin;
    }

    // Heading
    page.drawText(item.heading, {
      x: margin,
      y: y - 11,
      size: 11,
      font: fontBold,
      color: rgb(greenHex.r, greenHex.g, greenHex.b),
    });
    y -= 16;

    // Detail lines
    for (const detail of item.details) {
      if (y - 12 < bottomMargin) {
        page = pdfDoc.addPage([dims.width, dims.height]);
        y = dims.height - margin;
      }
      page.drawText(detail.substring(0, 120), {
        x: margin + 10,
        y: y - 9,
        size: 9,
        font,
        color: rgb(darkTextHex.r, darkTextHex.g, darkTextHex.b),
      });
      y -= 13;
    }
    y -= 6;
  }
}

// ============================================================
// PTA (Activities) Export
// ============================================================

async function getActivitiesData(filters?: Record<string, unknown>) {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.directionId) where.directionId = filters.directionId as string;
  if (filters?.primaryAxisId) where.primaryAxisId = filters.primaryAxisId as string;
  if (filters?.acbfDomainId) where.acbfDomainId = filters.acbfDomainId as string;
  if (filters?.status) where.status = filters.status as string;
  if (filters?.priority) where.priority = filters.priority as string;

  return db.activity.findMany({
    where,
    include: {
      responsible: { select: { name: true, email: true } },
      direction: { select: { code: true, name: true } },
      primaryAxis: { select: { code: true, name: true } },
      acbfDomain: { select: { code: true, name: true } },
      validator: { select: { name: true } },
    },
    orderBy: { activityCode: "asc" },
  });
}

async function generatePtaPdf(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const fileName = `PTA_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  const headers = ["Code", "Titre", "Responsable", "Direction", "Axe Strat.", "Domaine ACBF", "Priorité", "Statut", "Avancement", "Validation"];
  const colWidths = [70, 160, 100, 90, 90, 90, 55, 70, 60, 60];

  const rows = activities.map((act) => [
    act.activityCode || "",
    act.title || "",
    act.responsible?.name || "",
    act.direction?.name || "",
    act.primaryAxis?.name || "",
    act.acbfDomain?.name || "",
    act.priority || "",
    act.status || "",
    `${Math.round(act.progressRate)}%`,
    act.validationStatus || "",
  ]);

  await drawPdfTable(
    pdfDoc,
    "AAEA Pilotage 360 — Export PTA",
    `Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`,
    headers,
    colWidths,
    rows,
    "landscape"
  );

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

async function generatePtaXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const fileName = `PTA_Export_${timestampStr()}.xlsx`;

  const data = activities.map((act) => ({
    "Code Activité": act.activityCode,
    "Titre": act.title,
    "Responsable": act.responsible?.name || "",
    "Direction": act.direction?.name || "",
    "Axe Stratégique": act.primaryAxis?.name || "",
    "Domaine ACBF": act.acbfDomain?.name || "",
    "Objectif Annuel": act.annualObjective || "",
    "Priorité": act.priority,
    "Statut": act.status,
    "Avancement (%)": act.progressRate,
    "Statut Validation": act.validationStatus,
    "Date Début": act.startDate ? new Date(act.startDate).toLocaleDateString("fr-FR") : "",
    "Date Fin": act.endDate ? new Date(act.endDate).toLocaleDateString("fr-FR") : "",
    "Validateur": act.validator?.name || "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, "PTA Export");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

async function generatePtaDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const fileName = `PTA_Export_${timestampStr()}.docx`;

  const headerCells = ["Code", "Titre", "Responsable", "Direction", "Priorité", "Statut", "Avancement"].map(
    (h) =>
      new DocxTableCell({
        children: [new DocxParagraph({ children: [new DocxTextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })],
        shading: { fill: "047857" },
        width: { size: 14, type: DocxWidthType.PERCENTAGE },
      })
  );

  const dataRows = activities.map((act) =>
    new DocxTableRow({
      children: [
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.activityCode || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: (act.title || "").substring(0, 50), size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.responsible?.name || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.direction?.name || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.priority || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.status || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: `${Math.round(act.progressRate)}%`, size: 16 })] })] }),
      ],
    })
  );

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: [
          new DocxParagraph({
            text: "AAEA Pilotage 360 — Export PTA",
            heading: DocxHeadingLevel.HEADING_1,
            alignment: DocxAlignmentType.CENTER,
          }),
          new DocxParagraph({
            children: [new DocxTextRun({ text: `Généré le ${new Date().toLocaleDateString("fr-FR")} — ${activities.length} activités`, size: 18, color: "64748b" })],
            alignment: DocxAlignmentType.CENTER,
          }),
          new DocxParagraph({ text: "" }),
          new DocxTable({
            rows: [new DocxTableRow({ children: headerCells }), ...dataRows],
            width: { size: 100, type: DocxWidthType.PERCENTAGE },
          }),
        ],
      },
    ],
  });

  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

// ============================================================
// RACI Export
// ============================================================

async function getRaciData(filters?: Record<string, unknown>) {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.acbfDomainId) where.acbfDeliverable = { domainId: filters.acbfDomainId as string };

  return db.raciMatrix.findMany({
    where,
    include: {
      acbfDeliverable: { select: { code: true, name: true, domain: { select: { code: true, name: true } } } },
      activity: { select: { activityCode: true, title: true } },
      strategicAxis: { select: { code: true, name: true } },
      responsibleUser: { select: { name: true } },
      accountableUser: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

async function generateRaciPdf(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const fileName = `RACI_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  const headers = ["Livrable", "Domaine", "R (Responsable)", "A (Approbateur)", "C (Contributeurs)", "I (Informés)", "Priorité", "Échéance"];
  const colWidths = [140, 100, 100, 100, 120, 120, 60, 80];

  const rows = items.map((item) => [
    item.acbfDeliverable?.name || item.activity?.title || "",
    item.acbfDeliverable?.domain?.name || "",
    item.responsible || item.responsibleUser?.name || "",
    item.accountable || item.accountableUser?.name || "",
    item.contributors || "",
    item.informed || "",
    item.priority || "",
    item.indicativeDeadline ? new Date(item.indicativeDeadline).toLocaleDateString("fr-FR") : "",
  ]);

  await drawPdfTable(
    pdfDoc,
    "AAEA Pilotage 360 — Export RACI",
    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    headers,
    colWidths,
    rows,
    "landscape"
  );

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: items.length };
}

async function generateRaciXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const fileName = `RACI_Export_${timestampStr()}.xlsx`;

  const data = items.map((item) => ({
    "Livrable": item.acbfDeliverable?.name || item.activity?.title || "",
    "Domaine ACBF": item.acbfDeliverable?.domain?.name || "",
    "R (Responsable)": item.responsible || item.responsibleUser?.name || "",
    "A (Approbateur)": item.accountable || item.accountableUser?.name || "",
    "C (Contributeurs)": item.contributors || "",
    "I (Informés)": item.informed || "",
    "Priorité": item.priority || "",
    "Échéance": item.indicativeDeadline ? new Date(item.indicativeDeadline).toLocaleDateString("fr-FR") : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "RACI");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: items.length };
}

async function generateRaciDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const fileName = `RACI_Export_${timestampStr()}.docx`;

  const headerLabels = ["Livrable", "R", "A", "C", "I", "Priorité"];
  const headerCells = headerLabels.map(
    (h) => new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })], shading: { fill: "047857" } })
  );

  const rows = items.map(
    (item) =>
      new DocxTableRow({
        children: [
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: (item.acbfDeliverable?.name || item.activity?.title || "").substring(0, 50), size: 16 })] })] }),
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: item.responsible || item.responsibleUser?.name || "", size: 16 })] })] }),
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: item.accountable || item.accountableUser?.name || "", size: 16 })] })] }),
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: (item.contributors || "").substring(0, 50), size: 16 })] })] }),
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: (item.informed || "").substring(0, 50), size: 16 })] })] }),
          new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: item.priority || "", size: 16 })] })] }),
        ],
      })
  );

  const doc = new DocxDocument({
    sections: [{
      children: [
        new DocxParagraph({ text: "AAEA Pilotage 360 — Export RACI", heading: DocxHeadingLevel.HEADING_1, alignment: DocxAlignmentType.CENTER }),
        new DocxParagraph({ children: [new DocxTextRun({ text: `Généré le ${new Date().toLocaleDateString("fr-FR")} — ${items.length} entrées`, size: 18, color: "64748b" })], alignment: DocxAlignmentType.CENTER }),
        new DocxParagraph({ text: "" }),
        new DocxTable({ rows: [new DocxTableRow({ children: headerCells }), ...rows], width: { size: 100, type: DocxWidthType.PERCENTAGE } }),
      ],
    }],
  });

  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: items.length };
}

// ============================================================
// Dashboard (KPIs) Export
// ============================================================

async function generateDashboardPdf(_exportId: string, _filters?: Record<string, unknown>): Promise<ExportResult> {
  const [totalActivities, avgProgress, overdue, byStatus, byPriority] = await Promise.all([
    db.activity.count({ where: { isActive: true, deletedAt: null } }),
    db.activity.aggregate({ where: { isActive: true, deletedAt: null }, _avg: { progressRate: true } }),
    db.activity.count({ where: { isActive: true, deletedAt: null, endDate: { lt: new Date() }, status: { notIn: ["Réalisé", "Terminé", "Annulé"] } } }),
    db.activity.groupBy({ by: ["status"], where: { isActive: true, deletedAt: null }, _count: { status: true } }),
    db.activity.groupBy({ by: ["priority"], where: { isActive: true, deletedAt: null }, _count: { priority: true } }),
  ]);

  const fileName = `Dashboard_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const greenHex = hexToRgb("#047857");
  const grayTextHex = hexToRgb("#64748b");
  const darkTextHex = hexToRgb("#1e293b");

  const page = pdfDoc.addPage([A4_PORTRAIT.width, A4_PORTRAIT.height]);
  const margin = 50;
  let y = A4_PORTRAIT.height - margin;

  // Title
  page.drawText("AAEA Pilotage 360 — Tableau de Bord", {
    x: margin,
    y: y - 20,
    size: 20,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= 32;

  page.drawText(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, {
    x: margin,
    y: y - 10,
    size: 10,
    font,
    color: rgb(grayTextHex.r, grayTextHex.g, grayTextHex.b),
  });
  y -= 28;

  // KPIs
  page.drawText("Indicateurs Clés", {
    x: margin,
    y: y - 12,
    size: 14,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= 22;

  const kpis = [
    { label: "Total Activités", value: String(totalActivities) },
    { label: "Avancement Moyen", value: `${Math.round(avgProgress._avg.progressRate || 0)}%` },
    { label: "En Retard", value: String(overdue) },
  ];
  for (const kpi of kpis) {
    page.drawText(`${kpi.label}: `, {
      x: margin + 10,
      y: y - 11,
      size: 11,
      font: fontBold,
      color: rgb(greenHex.r, greenHex.g, greenHex.b),
    });
    const labelWidth = fontBold.widthOfTextAtSize(`${kpi.label}: `, 11);
    page.drawText(kpi.value, {
      x: margin + 10 + labelWidth,
      y: y - 11,
      size: 14,
      font: fontBold,
      color: rgb(darkTextHex.r, darkTextHex.g, darkTextHex.b),
    });
    y -= 22;
  }
  y -= 10;

  // By Status
  page.drawText("Répartition par Statut", {
    x: margin,
    y: y - 12,
    size: 12,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= 20;

  for (const s of byStatus) {
    page.drawText(`• ${s.status}: ${s._count.status}`, {
      x: margin + 10,
      y: y - 10,
      size: 10,
      font,
      color: rgb(darkTextHex.r, darkTextHex.g, darkTextHex.b),
    });
    y -= 16;
  }
  y -= 10;

  // By Priority
  page.drawText("Répartition par Priorité", {
    x: margin,
    y: y - 12,
    size: 12,
    font: fontBold,
    color: rgb(greenHex.r, greenHex.g, greenHex.b),
  });
  y -= 20;

  for (const p of byPriority) {
    page.drawText(`• ${p.priority}: ${p._count.priority}`, {
      x: margin + 10,
      y: y - 10,
      size: 10,
      font,
      color: rgb(darkTextHex.r, darkTextHex.g, darkTextHex.b),
    });
    y -= 16;
  }

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: totalActivities };
}

async function generateDashboardXlsx(_exportId: string, _filters?: Record<string, unknown>): Promise<ExportResult> {
  const [totalActivities, avgProgress, overdue, byStatus, byPriority] = await Promise.all([
    db.activity.count({ where: { isActive: true, deletedAt: null } }),
    db.activity.aggregate({ where: { isActive: true, deletedAt: null }, _avg: { progressRate: true } }),
    db.activity.count({ where: { isActive: true, deletedAt: null, endDate: { lt: new Date() }, status: { notIn: ["Réalisé", "Terminé", "Annulé"] } } }),
    db.activity.groupBy({ by: ["status"], where: { isActive: true, deletedAt: null }, _count: { status: true } }),
    db.activity.groupBy({ by: ["priority"], where: { isActive: true, deletedAt: null }, _count: { priority: true } }),
  ]);

  const fileName = `Dashboard_Export_${timestampStr()}.xlsx`;

  const kpiData = [
    { "Indicateur": "Total Activités", "Valeur": totalActivities },
    { "Indicateur": "Avancement Moyen (%)", "Valeur": Math.round(avgProgress._avg.progressRate || 0) },
    { "Indicateur": "En Retard", "Valeur": overdue },
  ];

  const statusData = byStatus.map((s) => ({ "Statut": s.status, "Nombre": s._count.status }));
  const priorityData = byPriority.map((p) => ({ "Priorité": p.priority, "Nombre": p._count.priority }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiData), "KPIs");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusData), "Par Statut");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(priorityData), "Par Priorité");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: totalActivities };
}

async function generateDashboardDocx(_exportId: string, _filters?: Record<string, unknown>): Promise<ExportResult> {
  const [totalActivities, avgProgress, overdue] = await Promise.all([
    db.activity.count({ where: { isActive: true, deletedAt: null } }),
    db.activity.aggregate({ where: { isActive: true, deletedAt: null }, _avg: { progressRate: true } }),
    db.activity.count({ where: { isActive: true, deletedAt: null, endDate: { lt: new Date() }, status: { notIn: ["Réalisé", "Terminé", "Annulé"] } } }),
  ]);

  const fileName = `Dashboard_Export_${timestampStr()}.docx`;

  const doc = new DocxDocument({
    sections: [{
      children: [
        new DocxParagraph({ text: "AAEA Pilotage 360 — Tableau de Bord", heading: DocxHeadingLevel.HEADING_1, alignment: DocxAlignmentType.CENTER }),
        new DocxParagraph({ children: [new DocxTextRun({ text: `Généré le ${new Date().toLocaleDateString("fr-FR")}`, size: 18, color: "64748b" })], alignment: DocxAlignmentType.CENTER }),
        new DocxParagraph({ text: "" }),
        new DocxParagraph({ text: "Indicateurs Clés", heading: DocxHeadingLevel.HEADING_2 }),
        new DocxParagraph({ children: [new DocxTextRun({ text: `Total Activités: ${totalActivities}`, size: 20 })] }),
        new DocxParagraph({ children: [new DocxTextRun({ text: `Avancement Moyen: ${Math.round(avgProgress._avg.progressRate || 0)}%`, size: 20 })] }),
        new DocxParagraph({ children: [new DocxTextRun({ text: `En Retard: ${overdue}`, size: 20 })] }),
      ],
    }],
  });

  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: totalActivities };
}

// ============================================================
// Report Export
// ============================================================

async function generateReportPdf(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.templateId) where.templateId = filters.templateId as string;
  if (filters?.status) where.status = filters.status as string;

  const reports = await db.report.findMany({
    where,
    include: {
      template: { select: { name: true, type: true } },
      generatedBy: { select: { name: true } },
      validatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const fileName = `Rapports_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  await drawPdfListDocument(
    pdfDoc,
    "AAEA Pilotage 360 — Export Rapports",
    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    reports.map((r) => ({
      heading: r.title,
      details: [
        `Modèle: ${r.template.name} | Période: ${r.period} | Statut: ${r.status}`,
        r.summary ? r.summary.substring(0, 200) : "",
      ].filter(Boolean),
    })),
    "portrait"
  );

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: reports.length };
}

async function generateReportXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.templateId) where.templateId = filters.templateId as string;

  const reports = await db.report.findMany({ where, include: { template: { select: { name: true } }, generatedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const fileName = `Rapports_Export_${timestampStr()}.xlsx`;

  const data = reports.map((r) => ({
    "Titre": r.title,
    "Modèle": r.template.name,
    "Période": r.period,
    "Statut": r.status,
    "Généré par": r.generatedBy?.name || "",
    "Date Génération": r.generatedAt ? new Date(r.generatedAt).toLocaleDateString("fr-FR") : "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Rapports");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: reports.length };
}

async function generateReportDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.templateId) where.templateId = filters.templateId as string;

  const reports = await db.report.findMany({ where, include: { template: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const fileName = `Rapports_Export_${timestampStr()}.docx`;

  const children: (DocxParagraph | DocxTable)[] = [
    new DocxParagraph({ text: "AAEA Pilotage 360 — Export Rapports", heading: DocxHeadingLevel.HEADING_1, alignment: DocxAlignmentType.CENTER }),
    new DocxParagraph({ text: "" }),
  ];

  for (const r of reports) {
    children.push(new DocxParagraph({ text: r.title, heading: DocxHeadingLevel.HEADING_2 }));
    children.push(new DocxParagraph({ children: [new DocxTextRun({ text: `Modèle: ${r.template.name} | Période: ${r.period} | Statut: ${r.status}`, size: 18, color: "64748b" })] }));
    if (r.summary) children.push(new DocxParagraph({ children: [new DocxTextRun({ text: r.summary.substring(0, 500), size: 18 })] }));
    children.push(new DocxParagraph({ text: "" }));
  }

  const doc = new DocxDocument({ sections: [{ children }] });
  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: reports.length };
}

// ============================================================
// Gantt Export
// ============================================================

async function generateGanttPdf(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null, startDate: { not: null }, endDate: { not: null } };
  if (filters?.directionId) where.directionId = filters.directionId as string;

  const activities = await db.activity.findMany({
    where,
    include: { responsible: { select: { name: true } }, direction: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  const fileName = `Gantt_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  const headers = ["Code", "Titre", "Responsable", "Début", "Fin", "Statut", "Avancement"];
  const colWidths = [70, 180, 110, 70, 70, 80, 70];

  const rows = activities.map((act) => [
    act.activityCode || "",
    act.title || "",
    act.responsible?.name || "",
    act.startDate ? new Date(act.startDate).toLocaleDateString("fr-FR") : "",
    act.endDate ? new Date(act.endDate).toLocaleDateString("fr-FR") : "",
    act.status || "",
    `${Math.round(act.progressRate)}%`,
  ]);

  await drawPdfTable(
    pdfDoc,
    "AAEA Pilotage 360 — Export Gantt",
    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    headers,
    colWidths,
    rows,
    "landscape"
  );

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

async function generateGanttXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.directionId) where.directionId = filters.directionId as string;

  const activities = await db.activity.findMany({ where, include: { responsible: { select: { name: true } }, direction: { select: { name: true } } }, orderBy: { startDate: "asc" } });
  const fileName = `Gantt_Export_${timestampStr()}.xlsx`;

  const data = activities.map((a) => ({
    "Code": a.activityCode, "Titre": a.title, "Responsable": a.responsible?.name || "",
    "Direction": a.direction?.name || "", "Début": a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "",
    "Fin": a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "", "Statut": a.status, "Avancement (%)": a.progressRate,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Gantt");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

async function generateGanttDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.directionId) where.directionId = filters.directionId as string;

  const activities = await db.activity.findMany({ where, include: { responsible: { select: { name: true } } }, orderBy: { startDate: "asc" } });
  const fileName = `Gantt_Export_${timestampStr()}.docx`;

  const headerLabels = ["Code", "Titre", "Responsable", "Début", "Fin", "Avancement"];
  const headerCells = headerLabels.map((h) => new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })], shading: { fill: "047857" } }));

  const rows = activities.map((a) => new DocxTableRow({
    children: [
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.activityCode || "", size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: (a.title || "").substring(0, 50), size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.responsible?.name || "", size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "", size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "", size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: `${Math.round(a.progressRate)}%`, size: 16 })] })] }),
    ],
  }));

  const doc = new DocxDocument({ sections: [{ children: [
    new DocxParagraph({ text: "AAEA Pilotage 360 — Export Gantt", heading: DocxHeadingLevel.HEADING_1, alignment: DocxAlignmentType.CENTER }),
    new DocxParagraph({ children: [new DocxTextRun({ text: `Généré le ${new Date().toLocaleDateString("fr-FR")} — ${activities.length} activités`, size: 18, color: "64748b" })], alignment: DocxAlignmentType.CENTER }),
    new DocxParagraph({ text: "" }),
    new DocxTable({ rows: [new DocxTableRow({ children: headerCells }), ...rows], width: { size: 100, type: DocxWidthType.PERCENTAGE } }),
  ] }] });

  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: activities.length };
}

// ============================================================
// Evidence Export
// ============================================================

async function generateEvidencePdf(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.category) where.category = filters.category as string;
  if (filters?.isVerified === true || filters?.isVerified === "true") where.isVerified = true;
  if (filters?.isVerified === false || filters?.isVerified === "false") where.isVerified = false;

  const evidence = await db.evidenceFile.findMany({
    where,
    include: { uploadedBy: { select: { name: true } }, activity: { select: { activityCode: true, title: true } }, verifiedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const fileName = `Preuves_Export_${timestampStr()}.pdf`;

  const pdfDoc = await PDFDocument.create();
  await drawPdfListDocument(
    pdfDoc,
    "AAEA Pilotage 360 — Export Preuves",
    `Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    evidence.map((e) => ({
      heading: e.name,
      details: [
        `Type: ${e.fileType} | Catégorie: ${e.category} | Vérifié: ${e.isVerified ? "Oui" : "Non"}`,
        e.activity ? `Activité: ${e.activity.activityCode} - ${e.activity.title}` : "",
        `Téléversé par: ${e.uploadedBy.name} le ${new Date(e.createdAt).toLocaleDateString("fr-FR")}`,
      ].filter(Boolean),
    })),
    "portrait"
  );

  const pdfBytes = await pdfDoc.save();
  const fileData = Buffer.from(pdfBytes);
  return { fileName, fileSize: fileData.length, fileData, recordCount: evidence.length };
}

async function generateEvidenceXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.category) where.category = filters.category as string;

  const evidence = await db.evidenceFile.findMany({ where, include: { uploadedBy: { select: { name: true } }, activity: { select: { activityCode: true } } }, orderBy: { createdAt: "desc" } });
  const fileName = `Preuves_Export_${timestampStr()}.xlsx`;

  const data = evidence.map((e) => ({
    "Nom": e.name, "Type": e.fileType, "Catégorie": e.category, "Vérifié": e.isVerified ? "Oui" : "Non",
    "Activité": e.activity?.activityCode || "", "Téléversé par": e.uploadedBy.name,
    "Date": new Date(e.createdAt).toLocaleDateString("fr-FR"),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Preuves");
  const fileData = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

  return { fileName, fileSize: fileData.length, fileData, recordCount: evidence.length };
}

async function generateEvidenceDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.category) where.category = filters.category as string;

  const evidence = await db.evidenceFile.findMany({ where, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const fileName = `Preuves_Export_${timestampStr()}.docx`;

  const children: (DocxParagraph | DocxTable)[] = [
    new DocxParagraph({ text: "AAEA Pilotage 360 — Export Preuves", heading: DocxHeadingLevel.HEADING_1, alignment: DocxAlignmentType.CENTER }),
    new DocxParagraph({ text: "" }),
  ];

  for (const e of evidence) {
    children.push(new DocxParagraph({ children: [new DocxTextRun({ text: e.name, bold: true, size: 20 })] }));
    children.push(new DocxParagraph({ children: [new DocxTextRun({ text: `Type: ${e.fileType} | Catégorie: ${e.category} | Vérifié: ${e.isVerified ? "Oui" : "Non"}`, size: 18, color: "64748b" })] }));
    children.push(new DocxParagraph({ text: "" }));
  }

  const doc = new DocxDocument({ sections: [{ children }] });
  const fileData = Buffer.from(await DocxPacker.toBuffer(doc));
  return { fileName, fileSize: fileData.length, fileData, recordCount: evidence.length };
}

// ============================================================
// Main dispatcher
// ============================================================

export async function generateExportFile(
  type: string,
  format: string,
  filters: Record<string, unknown> | undefined,
  _exportId: string
): Promise<ExportResult> {
  const generators: Record<string, Record<string, (eid: string, f?: Record<string, unknown>) => Promise<ExportResult>>> = {
    pta: { pdf: generatePtaPdf, xlsx: generatePtaXlsx, docx: generatePtaDocx },
    dashboard: { pdf: generateDashboardPdf, xlsx: generateDashboardXlsx, docx: generateDashboardDocx },
    report: { pdf: generateReportPdf, xlsx: generateReportXlsx, docx: generateReportDocx },
    gantt: { pdf: generateGanttPdf, xlsx: generateGanttXlsx, docx: generateGanttDocx },
    raci: { pdf: generateRaciPdf, xlsx: generateRaciXlsx, docx: generateRaciDocx },
    evidence: { pdf: generateEvidencePdf, xlsx: generateEvidenceXlsx, docx: generateEvidenceDocx },
  };

  const typeGenerators = generators[type];
  if (!typeGenerators) {
    throw new Error(`Type d'export non supporté: ${type}`);
  }

  const generator = typeGenerators[format];
  if (!generator) {
    throw new Error(`Format d'export non supporté: ${format}`);
  }

  return generator(_exportId, filters);
}
