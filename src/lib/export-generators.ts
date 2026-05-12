import { db } from "@/lib/db";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import PDFDocument from "pdfkit";
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
  filePath: string;
  recordCount: number;
}

const EXPORTS_DIR = "upload/exports";

async function ensureExportsDir() {
  const fullPath = path.join(process.cwd(), EXPORTS_DIR);
  await fs.mkdir(fullPath, { recursive: true });
  return fullPath;
}

function timestampStr(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
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

async function generatePtaPdf(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const dir = await ensureExportsDir();
  const fileName = `PTA_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(18).fillColor("#047857").text("AAEA Pilotage 360 — Export PTA", { align: "center" });
    doc.fontSize(10).fillColor("#64748b").text(`Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, { align: "center" });
    doc.moveDown(1);

    // Table headers
    const headers = ["Code", "Titre", "Responsable", "Direction", "Axe Strat.", "Domaine ACBF", "Priorité", "Statut", "Avancement", "Validation"];
    const colWidths = [70, 160, 100, 90, 90, 90, 55, 70, 60, 60];
    let y = doc.y;
    const startX = 40;

    // Header row
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill("#047857");
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.fontSize(7).fillColor("#ffffff").text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6, height: 16 });
      x += colWidths[i];
    }
    y += 22;

    // Data rows
    for (const act of activities) {
      if (y > 540) {
        doc.addPage({ layout: "landscape" });
        y = 40;
      }
      const row = [
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
      ];
      x = startX;
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 16).fill(y % 2 === 0 ? "#f0fdf4" : "#ffffff");
      for (let i = 0; i < row.length; i++) {
        doc.fontSize(6.5).fillColor("#1e293b").text(row[i].substring(0, 40), x + 3, y + 4, { width: colWidths[i] - 6, height: 14 });
        x += colWidths[i];
      }
      y += 18;
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#94a3b8").text(`Total: ${activities.length} activités`, startX, y);

    doc.end();
    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({
        fileName,
        fileSize: stats.size,
        filePath: `${EXPORTS_DIR}/${fileName}`,
        recordCount: activities.length,
      });
    });
    stream.on("error", reject);
  });
}

async function generatePtaXlsx(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const dir = await ensureExportsDir();
  const fileName = `PTA_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

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
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return {
    fileName,
    fileSize: stats.size,
    filePath: `${EXPORTS_DIR}/${fileName}`,
    recordCount: activities.length,
  };
}

async function generatePtaDocx(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const activities = await getActivitiesData(filters);
  const dir = await ensureExportsDir();
  const fileName = `PTA_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

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
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.activityCode, size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.title.substring(0, 50), size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.responsible?.name || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.direction?.name || "", size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.priority, size: 16 })] })] }),
        new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: act.status, size: 16 })] })] }),
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

  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));

  const stats = fsSync.statSync(filePath);
  return {
    fileName,
    fileSize: stats.size,
    filePath: `${EXPORTS_DIR}/${fileName}`,
    recordCount: activities.length,
  };
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

async function generateRaciPdf(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const dir = await ensureExportsDir();
  const fileName = `RACI_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#047857").text("AAEA Pilotage 360 — Export RACI", { align: "center" });
    doc.fontSize(10).fillColor("#64748b").text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, { align: "center" });
    doc.moveDown(1);

    const headers = ["Livrable", "Domaine", "R (Responsable)", "A (Approbateur)", "C (Contributeurs)", "I (Informés)", "Priorité", "Échéance"];
    const colWidths = [140, 100, 100, 100, 120, 120, 60, 80];
    let y = doc.y;
    const startX = 30;

    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill("#047857");
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.fontSize(7).fillColor("#ffffff").text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6 });
      x += colWidths[i];
    }
    y += 22;

    for (const item of items) {
      if (y > 540) { doc.addPage({ layout: "landscape" }); y = 40; }
      const row = [
        item.acbfDeliverable?.name || item.activity?.title || "",
        item.acbfDeliverable?.domain?.name || "",
        item.responsible || item.responsibleUser?.name || "",
        item.accountable || item.accountableUser?.name || "",
        item.contributors || "",
        item.informed || "",
        item.priority || "",
        item.indicativeDeadline ? new Date(item.indicativeDeadline).toLocaleDateString("fr-FR") : "",
      ];
      x = startX;
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 16).fill(y % 2 === 0 ? "#f0fdf4" : "#ffffff");
      for (let i = 0; i < row.length; i++) {
        doc.fontSize(6.5).fillColor("#1e293b").text(row[i].substring(0, 50), x + 3, y + 4, { width: colWidths[i] - 6, height: 14 });
        x += colWidths[i];
      }
      y += 18;
    }

    doc.fontSize(8).fillColor("#94a3b8").text(`Total: ${items.length} entrées RACI`, startX, y + 10);
    doc.end();

    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({ fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: items.length });
    });
    stream.on("error", reject);
  });
}

async function generateRaciXlsx(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const dir = await ensureExportsDir();
  const fileName = `RACI_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

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
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: items.length };
}

async function generateRaciDocx(exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const items = await getRaciData(filters);
  const dir = await ensureExportsDir();
  const fileName = `RACI_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

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

  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));
  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: items.length };
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

  const dir = await ensureExportsDir();
  const fileName = `Dashboard_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).fillColor("#047857").text("AAEA Pilotage 360 — Tableau de Bord", { align: "center" });
    doc.fontSize(10).fillColor("#64748b").text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, { align: "center" });
    doc.moveDown(2);

    // KPI Cards
    const kpis = [
      { label: "Total Activités", value: String(totalActivities) },
      { label: "Avancement Moyen", value: `${Math.round(avgProgress._avg.progressRate || 0)}%` },
      { label: "En Retard", value: String(overdue) },
    ];

    let xOff = 50;
    for (const kpi of kpis) {
      doc.rect(xOff, doc.y, 150, 60).fill("#f0fdf4").stroke("#047857");
      doc.fontSize(9).fillColor("#64748b").text(kpi.label, xOff + 10, doc.y + 8, { width: 130 });
      doc.fontSize(22).fillColor("#047857").text(kpi.value, xOff + 10, doc.y + 2, { width: 130 });
      xOff += 170;
    }
    doc.y += 80;
    doc.moveDown(1);

    // By Status
    doc.fontSize(12).fillColor("#047857").text("Répartition par Statut");
    doc.moveDown(0.5);
    for (const s of byStatus) {
      doc.fontSize(10).fillColor("#1e293b").text(`  • ${s.status}: ${s._count.status}`);
    }
    doc.moveDown(1);

    // By Priority
    doc.fontSize(12).fillColor("#047857").text("Répartition par Priorité");
    doc.moveDown(0.5);
    for (const p of byPriority) {
      doc.fontSize(10).fillColor("#1e293b").text(`  • ${p.priority}: ${p._count.priority}`);
    }

    doc.end();
    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({ fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: totalActivities });
    });
    stream.on("error", reject);
  });
}

async function generateDashboardXlsx(_exportId: string, _filters?: Record<string, unknown>): Promise<ExportResult> {
  const [totalActivities, avgProgress, overdue, byStatus, byPriority] = await Promise.all([
    db.activity.count({ where: { isActive: true, deletedAt: null } }),
    db.activity.aggregate({ where: { isActive: true, deletedAt: null }, _avg: { progressRate: true } }),
    db.activity.count({ where: { isActive: true, deletedAt: null, endDate: { lt: new Date() }, status: { notIn: ["Réalisé", "Terminé", "Annulé"] } } }),
    db.activity.groupBy({ by: ["status"], where: { isActive: true, deletedAt: null }, _count: { status: true } }),
    db.activity.groupBy({ by: ["priority"], where: { isActive: true, deletedAt: null }, _count: { priority: true } }),
  ]);

  const dir = await ensureExportsDir();
  const fileName = `Dashboard_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

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
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: totalActivities };
}

async function generateDashboardDocx(_exportId: string, _filters?: Record<string, unknown>): Promise<ExportResult> {
  const [totalActivities, avgProgress, overdue] = await Promise.all([
    db.activity.count({ where: { isActive: true, deletedAt: null } }),
    db.activity.aggregate({ where: { isActive: true, deletedAt: null }, _avg: { progressRate: true } }),
    db.activity.count({ where: { isActive: true, deletedAt: null, endDate: { lt: new Date() }, status: { notIn: ["Réalisé", "Terminé", "Annulé"] } } }),
  ]);

  const dir = await ensureExportsDir();
  const fileName = `Dashboard_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

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

  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));
  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: totalActivities };
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

  const dir = await ensureExportsDir();
  const fileName = `Rapports_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#047857").text("AAEA Pilotage 360 — Export Rapports", { align: "center" });
    doc.moveDown(1);

    for (const r of reports) {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(12).fillColor("#047857").text(r.title);
      doc.fontSize(9).fillColor("#64748b").text(`Modèle: ${r.template.name} | Période: ${r.period} | Statut: ${r.status}`);
      if (r.summary) doc.fontSize(9).fillColor("#1e293b").text(r.summary.substring(0, 200));
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({ fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: reports.length });
    });
    stream.on("error", reject);
  });
}

async function generateReportXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.templateId) where.templateId = filters.templateId as string;

  const reports = await db.report.findMany({ where, include: { template: { select: { name: true } }, generatedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const dir = await ensureExportsDir();
  const fileName = `Rapports_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

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
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: reports.length };
}

async function generateReportDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.templateId) where.templateId = filters.templateId as string;

  const reports = await db.report.findMany({ where, include: { template: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const dir = await ensureExportsDir();
  const fileName = `Rapports_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

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
  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));
  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: reports.length };
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

  const dir = await ensureExportsDir();
  const fileName = `Gantt_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#047857").text("AAEA Pilotage 360 — Export Gantt", { align: "center" });
    doc.moveDown(1);

    const headers = ["Code", "Titre", "Responsable", "Début", "Fin", "Statut", "Avancement"];
    const colWidths = [70, 180, 110, 70, 70, 80, 70];
    let y = doc.y;
    const startX = 40;

    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill("#047857");
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.fontSize(8).fillColor("#ffffff").text(headers[i], x + 3, y + 5, { width: colWidths[i] - 6 });
      x += colWidths[i];
    }
    y += 22;

    for (const act of activities) {
      if (y > 540) { doc.addPage({ layout: "landscape" }); y = 40; }
      const row = [act.activityCode, act.title, act.responsible?.name || "", act.startDate ? new Date(act.startDate).toLocaleDateString("fr-FR") : "", act.endDate ? new Date(act.endDate).toLocaleDateString("fr-FR") : "", act.status, `${Math.round(act.progressRate)}%`];
      x = startX;
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 16).fill(y % 2 === 0 ? "#f0fdf4" : "#ffffff");
      for (let i = 0; i < row.length; i++) {
        doc.fontSize(7).fillColor("#1e293b").text(row[i].substring(0, 40), x + 3, y + 4, { width: colWidths[i] - 6, height: 14 });
        x += colWidths[i];
      }
      y += 18;
    }

    doc.end();
    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({ fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: activities.length });
    });
    stream.on("error", reject);
  });
}

async function generateGanttXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.directionId) where.directionId = filters.directionId as string;

  const activities = await db.activity.findMany({ where, include: { responsible: { select: { name: true } }, direction: { select: { name: true } } }, orderBy: { startDate: "asc" } });
  const dir = await ensureExportsDir();
  const fileName = `Gantt_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

  const data = activities.map((a) => ({
    "Code": a.activityCode, "Titre": a.title, "Responsable": a.responsible?.name || "",
    "Direction": a.direction?.name || "", "Début": a.startDate ? new Date(a.startDate).toLocaleDateString("fr-FR") : "",
    "Fin": a.endDate ? new Date(a.endDate).toLocaleDateString("fr-FR") : "", "Statut": a.status, "Avancement (%)": a.progressRate,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Gantt");
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: activities.length };
}

async function generateGanttDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.directionId) where.directionId = filters.directionId as string;

  const activities = await db.activity.findMany({ where, include: { responsible: { select: { name: true } } }, orderBy: { startDate: "asc" } });
  const dir = await ensureExportsDir();
  const fileName = `Gantt_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

  const headerLabels = ["Code", "Titre", "Responsable", "Début", "Fin", "Avancement"];
  const headerCells = headerLabels.map((h) => new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })], shading: { fill: "047857" } }));

  const rows = activities.map((a) => new DocxTableRow({
    children: [
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.activityCode, size: 16 })] })] }),
      new DocxTableCell({ children: [new DocxParagraph({ children: [new DocxTextRun({ text: a.title.substring(0, 50), size: 16 })] })] }),
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

  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));
  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: activities.length };
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

  const dir = await ensureExportsDir();
  const fileName = `Preuves_Export_${timestampStr()}.pdf`;
  const filePath = path.join(dir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fsSync.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor("#047857").text("AAEA Pilotage 360 — Export Preuves", { align: "center" });
    doc.moveDown(1);

    for (const e of evidence) {
      if (doc.y > 700) doc.addPage();
      doc.fontSize(11).fillColor("#047857").text(e.name);
      doc.fontSize(9).fillColor("#64748b").text(`Type: ${e.fileType} | Catégorie: ${e.category} | Vérifié: ${e.isVerified ? "Oui" : "Non"}`);
      if (e.activity) doc.fontSize(9).fillColor("#64748b").text(`Activité: ${e.activity.activityCode} - ${e.activity.title}`);
      doc.fontSize(9).fillColor("#64748b").text(`Téléversé par: ${e.uploadedBy.name} le ${new Date(e.createdAt).toLocaleDateString("fr-FR")}`);
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on("finish", () => {
      const stats = fsSync.statSync(filePath);
      resolve({ fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: evidence.length });
    });
    stream.on("error", reject);
  });
}

async function generateEvidenceXlsx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.category) where.category = filters.category as string;

  const evidence = await db.evidenceFile.findMany({ where, include: { uploadedBy: { select: { name: true } }, activity: { select: { activityCode: true } } }, orderBy: { createdAt: "desc" } });
  const dir = await ensureExportsDir();
  const fileName = `Preuves_Export_${timestampStr()}.xlsx`;
  const filePath = path.join(dir, fileName);

  const data = evidence.map((e) => ({
    "Nom": e.name, "Type": e.fileType, "Catégorie": e.category, "Vérifié": e.isVerified ? "Oui" : "Non",
    "Activité": e.activity?.activityCode || "", "Téléversé par": e.uploadedBy.name,
    "Date": new Date(e.createdAt).toLocaleDateString("fr-FR"),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Preuves");
  XLSX.writeFile(wb, filePath);

  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: evidence.length };
}

async function generateEvidenceDocx(_exportId: string, filters?: Record<string, unknown>): Promise<ExportResult> {
  const where: Record<string, unknown> = { isActive: true, deletedAt: null };
  if (filters?.category) where.category = filters.category as string;

  const evidence = await db.evidenceFile.findMany({ where, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  const dir = await ensureExportsDir();
  const fileName = `Preuves_Export_${timestampStr()}.docx`;
  const filePath = path.join(dir, fileName);

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
  const buffer = await DocxPacker.toBuffer(doc);
  fsSync.writeFileSync(filePath, Buffer.from(buffer));
  const stats = fsSync.statSync(filePath);
  return { fileName, fileSize: stats.size, filePath: `${EXPORTS_DIR}/${fileName}`, recordCount: evidence.length };
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
  if (!typeGenerators) throw new Error(`Type d'export non supporté: ${type}`);

  const generator = typeGenerators[format];
  if (!generator) throw new Error(`Format non supporté: ${format}`);

  return generator(_exportId, filters);
}
