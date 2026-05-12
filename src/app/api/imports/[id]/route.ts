import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, userHasPermission } from "@/lib/permissions";
import { z } from "zod";
import { hash } from "bcryptjs";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Helpers (adapted from prisma/seed.ts)
// ============================================================

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function generateEmail(fullName: string): string {
  const cleaned = removeAccents(fullName).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return `${cleaned.toLowerCase()}@aaea.org`;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}@aaea.org`;
}

function mapRole(position: string): string {
  const pos = position.toLowerCase();
  if (
    pos.includes("directeur exécutif") ||
    pos.includes("directeur services") ||
    pos.includes("directeur administration")
  ) {
    return "DIRECTEUR";
  }
  if (
    pos.includes("données") ||
    pos.includes("meal") ||
    pos.includes("suivi-évaluation") ||
    pos.includes("suivi-éval")
  ) {
    return "MEAL";
  }
  if (pos.includes("chauffeur")) {
    return "LECTEUR";
  }
  return "RESPONSABLE";
}

function mapDirectionCode(department: string): string {
  const dept = department.toLowerCase();
  if (dept.includes("exécutiv") || dept.includes("executiv")) return "DEX";
  if (
    dept.includes("membres") ||
    dept.includes("programmes") ||
    dept.includes("program")
  )
    return "DSMP";
  if (
    dept.includes("administrative") ||
    dept.includes("financière") ||
    dept.includes("financiere")
  )
    return "DAF";
  return "DEX";
}

function mapAcbfDomainCode(excelId: string): string {
  return excelId
    .replace("ACBF-", "ACBF")
    .replace(/^ACBF0(\d)$/, "ACBF$1");
}

function mapAxeCode(excelCode: string): string {
  return excelCode.replace("AXE ", "AXE");
}

function parseProgressRate(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace("%", "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseExcelDate(val: unknown): Date | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
    return null;
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function findUserByValidatorName(
  validatorName: string,
  usersByPosition: Map<string, string>,
  usersByPtaCode: Map<string, string>
): string | null {
  const name = validatorName.trim().toLowerCase();
  if (!name || name === "à préciser") return null;

  const positionMap: Record<string, string> = {
    "directeur exécutif": "Directeur Exécutif",
    "directeur dsmp":
      "Directeur Services aux Membres et des Programmes",
    daf: "Directeur Administration et Finance",
    "directeur dsmp/ finance":
      "Directeur Services aux Membres et des Programmes",
    "directeur dsmp / finance":
      "Directeur Services aux Membres et des Programmes",
    "responsable rh": "Responsable des ressources humaines",
    "responsable comptable et finance":
      "Responsable comptable et finance",
    "comptable senior trésorerie":
      "Comptable Senior en charge de la Trésorerie",
    "responsable logistique et achats":
      "Responsable Logistique et Achats",
    "chargé logistique et achats": "Chargé Logistique et Achats",
    "responsable logistique": "Responsable Logistique et Achats",
    "coordonnateur assainissement":
      "Coordonnateur Senior Assainissement",
  };

  const targetPosition = positionMap[name];
  if (targetPosition) {
    const userId = usersByPosition.get(targetPosition.toLowerCase());
    if (userId) return userId;
  }

  const codeMap: Record<string, string> = {
    dex: "DEX",
    dsmp: "DSMP",
    daf: "DAF",
  };
  const code = codeMap[name];
  if (code) {
    const userId = usersByPtaCode.get(code);
    if (userId) return userId;
  }

  const positionEntries = Array.from(usersByPosition.entries());
  for (const [pos, id] of positionEntries) {
    if (pos.includes(name) || name.includes(pos.split(" ")[0])) {
      return id;
    }
  }

  return null;
}

// PTA code to direction mapping
function getDirectionIdFromPtaCode(
  ptaCode: string,
  directionsByCode: Record<string, string>
): string | null {
  const dexCodes = ["DEX", "CONF", "MEAL", "NUM", "COM", "ADX"];
  const dsmpCodes = [
    "DSMP",
    "ASS",
    "EAU",
    "GEN",
    "KNOW",
    "MEMB",
    "SPON",
    "PROJASS",
    "ASM",
    "ASPP",
  ];
  const dafCodes = [
    "DAF",
    "RH",
    "ARH",
    "FIN",
    "TRES",
    "ACF",
    "ATRES",
    "AGR",
    "LOG",
    "CLOG",
    "CHAUF1",
    "CHAUF2",
  ];

  if (dexCodes.includes(ptaCode)) return directionsByCode["DEX"] || null;
  if (dsmpCodes.includes(ptaCode)) return directionsByCode["DSMP"] || null;
  if (dafCodes.includes(ptaCode)) return directionsByCode["DAF"] || null;
  return null;
}

// ============================================================
// Schema for execute action
// ============================================================

const executeSchema = z.object({
  action: z.literal("execute"),
  selectedSheets: z.array(z.string()).min(1, "Au moins un feuille doit être sélectionnée"),
  mapping: z.record(z.string(), z.string()).optional(),
});

interface ImportError {
  row: number;
  sheet: string;
  column?: string;
  message: string;
}

// ============================================================
// GET /api/imports/[id] — Détail d'un import
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const importRecord = await db.importHistory.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!importRecord) {
      return NextResponse.json(
        { error: "Import non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: importRecord });
  } catch (error) {
    console.error("Erreur GET /api/imports/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/imports/[id] — Exécuter l'import
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const validated = executeSchema.parse(body);

    // Fetch import record
    const importRecord = await db.importHistory.findUnique({
      where: { id },
    });

    if (!importRecord) {
      return NextResponse.json(
        { error: "Import non trouvé" },
        { status: 404 }
      );
    }

    if (importRecord.status !== "En attente") {
      return NextResponse.json(
        { error: "Cet import a déjà été traité" },
        { status: 400 }
      );
    }

    // Mark as in progress
    await db.importHistory.update({
      where: { id },
      data: {
        status: "En cours",
        startedAt: new Date(),
        selectedSheets: JSON.stringify(validated.selectedSheets),
        mapping: validated.mapping
          ? JSON.stringify(validated.mapping)
          : null,
      },
    });

    // Read the Excel file
    const filePath = path.join(
      process.cwd(),
      "upload",
      "imports",
      `${importRecord.fileName}`
    );

    // Try to find the file — the saved filename may have Date.now() prefix
    const uploadDir = path.join(process.cwd(), "upload", "imports");
    let actualFilePath = filePath;
    if (!fs.existsSync(filePath)) {
      // Search for file with Date.now() prefix
      const files = fs.readdirSync(uploadDir);
      const matchingFile = files.find((f) => f.endsWith(`_${importRecord.fileName}`));
      if (matchingFile) {
        actualFilePath = path.join(uploadDir, matchingFile);
      } else if (files.length > 0) {
        // Fallback: use the most recent file
        actualFilePath = path.join(uploadDir, files[files.length - 1]);
      } else {
        await db.importHistory.update({
          where: { id },
          data: {
            status: "Erreur",
            completedAt: new Date(),
            errors: JSON.stringify([{ row: 0, sheet: "", message: "Fichier Excel introuvable" }]),
            errorRows: 1,
          },
        });
        return NextResponse.json(
          { error: "Fichier Excel introuvable" },
          { status: 400 }
        );
      }
    }

    const fileBuffer = fs.readFileSync(actualFilePath);
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    // Build lookup maps from existing database records
    const existingUsers = await db.user.findMany({
      select: { id: true, email: true, ptaCode: true, position: true, name: true },
    });
    const usersByPtaCode = new Map<string, string>();
    const usersByPosition = new Map<string, string>();
    const usersByEmail = new Map<string, string>();
    for (const u of existingUsers) {
      if (u.ptaCode) usersByPtaCode.set(u.ptaCode, u.id);
      if (u.position) usersByPosition.set(u.position.toLowerCase(), u.id);
      usersByEmail.set(u.email, u.id);
    }

    const existingDirections = await db.direction.findMany({
      select: { id: true, code: true },
    });
    const directionsByCode: Record<string, string> = {};
    for (const d of existingDirections) {
      directionsByCode[d.code] = d.id;
    }

    const existingAxes = await db.strategicAxis.findMany({
      select: { id: true, code: true },
    });
    const axesByCode: Record<string, string> = {};
    for (const a of existingAxes) {
      axesByCode[a.code] = a.id;
    }

    const existingDomains = await db.acbfDomain.findMany({
      select: { id: true, code: true, name: true },
    });
    const domainsByCode: Record<string, string> = {};
    const domainsByName: Record<string, string> = {};
    for (const d of existingDomains) {
      domainsByCode[d.code] = d.id;
      domainsByName[d.name] = d.id;
    }

    const existingDeliverables = await db.acbfDeliverable.findMany({
      select: { id: true, code: true, name: true },
    });
    const deliverablesByCode: Record<string, string> = {};
    const deliverablesByName: Record<string, string> = {};
    for (const d of existingDeliverables) {
      deliverablesByCode[d.code] = d.id;
      deliverablesByName[d.name] = d.id;
    }

    const existingRoles = await db.role.findMany({
      select: { id: true, code: true },
    });
    const rolesByCode: Record<string, string> = {};
    for (const r of existingRoles) {
      rolesByCode[r.code] = r.id;
    }

    const defaultPassword = await hash("AAEA2026!", 12);

    // Track results
    const errors: ImportError[] = [];
    let processedRows = 0;
    let createdRows = 0;
    let skippedRows = 0;
    let errorRows = 0;

    // Process each selected sheet
    for (const sheetName of validated.selectedSheets) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        errors.push({
          row: 0,
          sheet: sheetName,
          message: `Feuille "${sheetName}" non trouvée dans le fichier`,
        });
        continue;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (sheetName === "Equipe AAEA") {
        // ========================================
        // Import Users
        // ========================================
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          processedRows++;

          try {
            const ptaCode = String(row["Code PTA"] || "").trim();
            const name = String(row["Nom et prénoms"] || "").trim();
            const position = String(row["Poste"] || "").trim();
            const department = String(row["Direction / unité"] || "").trim();

            if (!ptaCode || !name) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: "Code PTA ou nom manquant",
              });
              errorRows++;
              continue;
            }

            // Check if user already exists (by email or ptaCode)
            const email = generateEmail(name);
            const existingByEmail = usersByEmail.get(email);
            const existingByPtaCode = usersByPtaCode.get(ptaCode);

            if (existingByEmail || existingByPtaCode) {
              skippedRows++;
              continue;
            }

            // Ensure direction exists
            const dirCode = mapDirectionCode(department);
            if (!directionsByCode[dirCode] && department) {
              const newDir = await db.direction.create({
                data: {
                  code: dirCode,
                  name: department,
                  description: department,
                },
              });
              directionsByCode[dirCode] = newDir.id;
            }

            // Create user
            const user = await db.user.create({
              data: {
                email,
                password: defaultPassword,
                name,
                ptaCode,
                position,
                department,
              },
            });

            // Update lookup maps
            usersByPtaCode.set(ptaCode, user.id);
            usersByEmail.set(email, user.id);
            if (position) usersByPosition.set(position.toLowerCase(), user.id);

            // Assign default role: RESPONSABLE
            const roleCode = mapRole(position);
            const roleId = rolesByCode[roleCode] || rolesByCode["RESPONSABLE"];
            if (roleId) {
              await db.userRole.create({
                data: { userId: user.id, roleId },
              });
            }

            // Set as head of direction if applicable
            if (["DEX", "DSMP", "DAF"].includes(ptaCode) && directionsByCode[ptaCode]) {
              await db.direction.update({
                where: { id: directionsByCode[ptaCode] },
                data: { headUserId: user.id },
              });
            }

            createdRows++;
          } catch (err) {
            errors.push({
              row: i + 2,
              sheet: sheetName,
              message: `Erreur lors de la création de l'utilisateur: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
          }
        }
      } else if (sheetName === "Axes strategiques") {
        // ========================================
        // Import Strategic Axes
        // ========================================
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          processedRows++;

          try {
            const excelCode = String(row["Code axe"] || "").trim();
            const name = String(row["Intitulé de l'axe"] || "").trim();
            const objective = String(row["Description synthétique"] || "").trim();
            const expectedResults = String(row["Résultats attendus"] || "").trim();
            const indicators = String(row["Indicateurs stratégiques possibles"] || "").trim();
            const concernedUnits = String(row["Directions principalement concernées"] || "").trim();

            if (!excelCode || !name) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: "Code axe ou intitulé manquant",
              });
              errorRows++;
              continue;
            }

            const code = mapAxeCode(excelCode);

            // Check if already exists
            if (axesByCode[code]) {
              skippedRows++;
              continue;
            }

            const order = parseInt(excelCode.replace("AXE ", ""), 10);
            const axis = await db.strategicAxis.create({
              data: {
                code,
                name,
                objective: objective || null,
                expectedResults: expectedResults || null,
                indicators: indicators || null,
                concernedUnits: concernedUnits || null,
                order: isNaN(order) ? 0 : order,
              },
            });

            axesByCode[code] = axis.id;
            createdRows++;
          } catch (err) {
            errors.push({
              row: i + 2,
              sheet: sheetName,
              message: `Erreur lors de la création de l'axe stratégique: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
          }
        }
      } else if (sheetName === "Referentiel ACBF") {
        // ========================================
        // Import ACBF Domains + Deliverables
        // ========================================
        // First pass: create unique domains
        const seenDomainIds = new Set<string>();
        const newDomains: Array<{
          code: string;
          name: string;
          order: number;
          excelId: string;
        }> = [];

        for (const row of rows) {
          const excelDomainId = String(row["ID domaine ACBF"] || "").trim();
          const domainName = String(row["Domaine ACBF"] || "").trim();
          if (!excelDomainId || seenDomainIds.has(excelDomainId)) continue;

          seenDomainIds.add(excelDomainId);
          const code = mapAcbfDomainCode(excelDomainId);

          // Check if already exists
          if (domainsByCode[code]) continue;

          const order = parseInt(excelDomainId.replace("ACBF-", ""), 10);
          newDomains.push({ code, name: domainName, order: isNaN(order) ? 0 : order, excelId: excelDomainId });
        }

        for (const d of newDomains) {
          try {
            const domain = await db.acbfDomain.create({
              data: { code: d.code, name: d.name, order: d.order },
            });
            domainsByCode[d.code] = domain.id;
            domainsByName[d.name] = domain.id;
            createdRows++;
            processedRows++;
          } catch (err) {
            errors.push({
              row: 0,
              sheet: sheetName,
              message: `Erreur lors de la création du domaine ACBF ${d.code}: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
            processedRows++;
          }
        }

        // Second pass: create deliverables
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          processedRows++;

          try {
            const deliverableCode = String(row["ID livrable ACBF"] || "").trim();
            const deliverableName = String(row["Livrable demandé"] || "").trim();
            const excelDomainId = String(row["ID domaine ACBF"] || "").trim();
            const description = String(row["Description courte"] || "").trim();
            const priority = String(row["Priorité"] || "").trim();
            const status = String(row["Statut de disponibilité"] || "").trim();

            if (!deliverableCode || !deliverableName) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: "ID livrable ACBF ou nom manquant",
              });
              errorRows++;
              continue;
            }

            // Check if already exists by code
            if (deliverablesByCode[deliverableCode]) {
              skippedRows++;
              continue;
            }

            const domainCode = mapAcbfDomainCode(excelDomainId);
            const domainId = domainsByCode[domainCode];
            if (!domainId) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: `Domaine ACBF "${excelDomainId}" non trouvé`,
              });
              errorRows++;
              continue;
            }

            const deliverable = await db.acbfDeliverable.create({
              data: {
                code: deliverableCode,
                name: deliverableName,
                domainId,
                description: description || null,
                priority: priority || null,
                status: status || null,
              },
            });

            deliverablesByCode[deliverableCode] = deliverable.id;
            deliverablesByName[deliverableName] = deliverable.id;
            createdRows++;
          } catch (err) {
            errors.push({
              row: i + 2,
              sheet: sheetName,
              message: `Erreur lors de la création du livrable ACBF: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
          }
        }
      } else if (sheetName === "PTA consolide AAEA") {
        // ========================================
        // Import Activities
        // ========================================
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          processedRows++;

          try {
            const activityCode = String(row["N°"] || "").trim();
            const ptaCode = String(row["Code PTA"] || "").trim();
            const title = String(row["Activité PTA concrète"] || "").trim();
            const bloc = String(row["Bloc / objectif fonctionnel"] || "").trim();
            const nature = String(row["Nature de l'activité"] || "").trim();
            const primaryAxisExcel = String(row["Axe stratégique principal"] || "").trim();
            const secondaryAxesExcel = String(row["Axe(s) secondaire(s)"] || "").trim();
            const domainAcbfName = String(row["Domaine ACBF"] || "").trim();
            const livrableAcbfName = String(row["Livrable ACBF associé"] || "").trim();
            const annualObjective = String(row["Objectif annuel"] || "").trim();
            const detailedTasks = String(row["Tâches détaillées"] || "").trim();
            const expectedDeliverable = String(row["Livrable attendu"] || "").trim();
            const contributeurs = String(row["Contributeur(s)"] || "").trim();
            const validateurName = String(row["Validateur"] || "").trim();
            const dateDebut = row["Date début"];
            const dateFin = row["Date fin"];
            const duree = String(row["Durée estimée"] || "").trim();
            const dependance = String(row["Dépendance / préalable"] || "").trim();
            const priorite = String(row["Priorité"] || "").trim();
            const indicateur = String(row["Indicateur de performance"] || "").trim();
            const sourceVerif = String(row["Source de vérification"] || "").trim();
            const statut = String(row["Statut"] || "").trim();
            const tauxAvancement = row["Taux d'avancement"];
            const risque = String(row["Risque / contrainte"] || "").trim();
            const commentaires = String(row["Commentaires"] || "").trim();
            const lienAcbf = String(row["Lien ACBF"] || "").trim();

            if (!activityCode || !ptaCode || !title) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: "N°, Code PTA ou titre d'activité manquant",
              });
              errorRows++;
              continue;
            }

            // Check if already exists by activityCode
            const existingActivity = await db.activity.findUnique({
              where: { activityCode },
            });
            if (existingActivity) {
              skippedRows++;
              continue;
            }

            // Look up responsibleId by ptaCode
            const responsibleId = usersByPtaCode.get(ptaCode);
            if (!responsibleId) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: `Utilisateur avec Code PTA "${ptaCode}" non trouvé`,
              });
              errorRows++;
              continue;
            }

            // Look up directionId
            const directionId = getDirectionIdFromPtaCode(ptaCode, directionsByCode);

            // Look up primaryAxisId
            let primaryAxisId: string | null = null;
            if (primaryAxisExcel) {
              const axisCode = mapAxeCode(primaryAxisExcel);
              primaryAxisId = axesByCode[axisCode] || null;
            }

            // Look up secondaryAxisId (first one if multiple)
            let secondaryAxisId: string | null = null;
            if (secondaryAxesExcel) {
              const firstAxis = secondaryAxesExcel.split(";")[0].trim();
              if (firstAxis) {
                const axisCode = mapAxeCode(firstAxis);
                secondaryAxisId = axesByCode[axisCode] || null;
              }
            }

            // Look up acbfDomainId by name
            let acbfDomainId: string | null = null;
            if (domainAcbfName) {
              acbfDomainId = domainsByName[domainAcbfName] || null;
              if (!acbfDomainId) {
                for (const [name, id] of Object.entries(domainsByName)) {
                  if (
                    name.toLowerCase().includes(domainAcbfName.toLowerCase()) ||
                    domainAcbfName.toLowerCase().includes(name.toLowerCase())
                  ) {
                    acbfDomainId = id;
                    break;
                  }
                }
              }
            }

            // Look up acbfDeliverableId by name
            let acbfDeliverableId: string | null = null;
            if (livrableAcbfName) {
              acbfDeliverableId = deliverablesByName[livrableAcbfName] || null;
              if (!acbfDeliverableId) {
                for (const [name, id] of Object.entries(deliverablesByName)) {
                  if (
                    name.toLowerCase().includes(livrableAcbfName.toLowerCase()) ||
                    livrableAcbfName.toLowerCase().includes(name.toLowerCase())
                  ) {
                    acbfDeliverableId = id;
                    break;
                  }
                }
              }
            }

            // Look up validatorId
            let validatorId: string | null = null;
            if (validateurName) {
              validatorId = findUserByValidatorName(
                validateurName,
                usersByPosition,
                usersByPtaCode
              );
            }

            // Build annualObjective with bloc prepended
            let finalAnnualObjective = annualObjective;
            if (bloc) {
              finalAnnualObjective = `[${bloc}] ${annualObjective}`;
            }

            // Build comments
            const commentParts: string[] = [];
            if (contributeurs)
              commentParts.push(`Contributeur(s): ${contributeurs}`);
            if (lienAcbf) commentParts.push(`Lien ACBF: ${lienAcbf}`);
            if (commentaires) commentParts.push(commentaires);
            const finalComments = commentParts.join(" | ");

            await db.activity.create({
              data: {
                activityCode,
                responsibleId,
                directionId,
                primaryAxisId,
                secondaryAxisId,
                acbfDomainId,
                acbfDeliverableId,
                annualObjective: finalAnnualObjective || null,
                title,
                detailedTasks: detailedTasks || null,
                expectedDeliverable: expectedDeliverable || null,
                validatorId,
                startDate: parseExcelDate(dateDebut),
                endDate: parseExcelDate(dateFin),
                priority: priorite || "Moyenne",
                performanceIndicator: indicateur || null,
                verificationSource: sourceVerif || null,
                status: statut || "Non démarré",
                progressRate: parseProgressRate(tauxAvancement),
                riskDescription: risque || null,
                comments: finalComments || null,
                validationStatus: "Brouillon",
                nature: nature || null,
                dependency: dependance || null,
                duration: duree || null,
              },
            });

            createdRows++;
          } catch (err) {
            errors.push({
              row: i + 2,
              sheet: sheetName,
              message: `Erreur lors de la création de l'activité: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
          }
        }
      } else if (sheetName === "RACI institutionnelle") {
        // ========================================
        // Import RACI entries
        // ========================================
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          processedRows++;

          try {
            const deliverableCode = String(row["ID livrable ACBF"] || "").trim();
            const axisExcel = String(row["Axe stratégique principal"] || "").trim();
            const responsible = String(row["Responsable principal — R"] || "").trim();
            const accountable = String(row["Autorité / validateur — A"] || "").trim();
            const contributors = String(row["Contributeur(s) — C"] || "").trim();
            const informed = String(row["Informé(s) — I"] || "").trim();
            const priority = String(row["Niveau de priorité"] || "").trim();
            const deadline = row["Échéance indicative"];
            const verificationSource = String(row["Source de vérification attendue"] || "").trim();
            const comments = String(row["Commentaires"] || "").trim();

            if (!deliverableCode) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: "ID livrable ACBF manquant",
              });
              errorRows++;
              continue;
            }

            // Look up acbfDeliverableId by code
            const acbfDeliverableId = deliverablesByCode[deliverableCode];
            if (!acbfDeliverableId) {
              errors.push({
                row: i + 2,
                sheet: sheetName,
                message: `Livrable ACBF "${deliverableCode}" non trouvé`,
              });
              errorRows++;
              continue;
            }

            // Check if RACI entry already exists for this deliverable
            const existingRaci = await db.raciMatrix.findFirst({
              where: { acbfDeliverableId },
            });
            if (existingRaci) {
              skippedRows++;
              continue;
            }

            // Look up strategicAxisId
            let strategicAxisId: string | null = null;
            if (axisExcel) {
              const axisCode = mapAxeCode(axisExcel);
              strategicAxisId = axesByCode[axisCode] || null;
            }

            // Try to map responsible text to a user
            let responsibleUserId: string | null = null;
            if (responsible) {
              responsibleUserId = findUserByValidatorName(
                responsible,
                usersByPosition,
                usersByPtaCode
              );
            }

            // Try to map accountable text to a user
            let accountableUserId: string | null = null;
            if (accountable) {
              accountableUserId = findUserByValidatorName(
                accountable,
                usersByPosition,
                usersByPtaCode
              );
            }

            await db.raciMatrix.create({
              data: {
                acbfDeliverableId,
                strategicAxisId,
                responsible: responsible || null,
                responsibleUserId,
                accountable: accountable || null,
                accountableUserId,
                contributors: contributors || null,
                informed: informed || null,
                priority: priority || null,
                indicativeDeadline: parseExcelDate(deadline),
                verificationSource: verificationSource || null,
                comments: comments || null,
              },
            });

            createdRows++;
          } catch (err) {
            errors.push({
              row: i + 2,
              sheet: sheetName,
              message: `Erreur lors de la création de l'entrée RACI: ${err instanceof Error ? err.message : "Erreur inconnue"}`,
            });
            errorRows++;
          }
        }
      } else {
        // Unknown sheet — skip with warning
        for (let i = 0; i < rows.length; i++) {
          processedRows++;
          skippedRows++;
        }
        errors.push({
          row: 0,
          sheet: sheetName,
          message: `Feuille "${sheetName}" non reconnue — ignorée`,
        });
      }
    }

    // Determine final status
    let finalStatus: string;
    if (errorRows === 0) {
      finalStatus = "Terminé";
    } else if (createdRows > 0) {
      finalStatus = "Partiel";
    } else {
      finalStatus = "Erreur";
    }

    // Update import record with results
    const updatedRecord = await db.importHistory.update({
      where: { id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        processedRows,
        createdRows,
        updatedRows: 0,
        skippedRows,
        errorRows,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "IMPORT",
        entity: "ImportHistory",
        entityId: id,
        details: `Import exécuté: ${finalStatus} — ${createdRows} créés, ${skippedRows} ignorés, ${errorRows} erreurs`,
      },
    });

    return NextResponse.json({ data: updatedRecord });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Erreur PATCH /api/imports/[id]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
