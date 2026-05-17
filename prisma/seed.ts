import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import path from "path";

const prisma = new PrismaClient();

// ============================================================
// Helper: remove accents from a string
// ============================================================
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ============================================================
// Helper: generate email from name
// e.g. "François Olivier Gosso" → "f.gosso@aaea.org"
// ============================================================
function generateEmail(fullName: string): string {
  const cleaned = removeAccents(fullName).trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return `${cleaned.toLowerCase()}@aaea.org`;
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  return `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}@aaea.org`;
}

// ============================================================
// Helper: map position to role code
// ============================================================
function mapRole(position: string): string {
  const pos = position.toLowerCase();
  if (
    pos.includes("directeur exécutif") ||
    pos.includes("directeur services") ||
    pos.includes("directeur administration")
  ) {
    return "DIRECTEUR";
  }
  if (pos.includes("données") || pos.includes("meal") || pos.includes("suivi-évaluation") || pos.includes("suivi-éval")) {
    return "MEAL";
  }
  if (pos.includes("chauffeur")) {
    return "LECTEUR";
  }
  return "RESPONSABLE";
}

// ============================================================
// Helper: map department to direction code
// ============================================================
function mapDirectionCode(department: string): string {
  const dept = department.toLowerCase();
  if (dept.includes("exécutiv") || dept.includes("executiv")) return "DEX";
  if (dept.includes("membres") || dept.includes("programmes") || dept.includes("program")) return "DSMP";
  if (dept.includes("administrative") || dept.includes("financière") || dept.includes("financiere")) return "DAF";
  return "DEX"; // default
}

// ============================================================
// Helper: map ACBF domain ID to Prisma code
// e.g. "ACBF-01" → "ACBF1"
// ============================================================
function mapAcbfDomainCode(excelId: string): string {
  return excelId.replace("ACBF-", "ACBF").replace(/^ACBF0(\d)$/, "ACBF$1");
}

// ============================================================
// Helper: map axe code
// e.g. "AXE 1" → "AXE1"
// ============================================================
function mapAxeCode(excelCode: string): string {
  return excelCode.replace("AXE ", "AXE");
}

// ============================================================
// Helper: parse progress rate
// ============================================================
function parseProgressRate(val: unknown): number {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace("%", "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// ============================================================
// Helper: parse date from Excel (could be string or number)
// ============================================================
function parseExcelDate(val: unknown): Date | null {
  if (val === undefined || val === null || val === "") return null;
  if (typeof val === "number") {
    // Excel serial date number
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

// ============================================================
// Helper: find user by position for validator matching
// ============================================================
function findUserByValidatorName(
  validatorName: string,
  usersByPosition: Map<string, string>,
  usersByPtaCode: Map<string, string>
): string | null {
  const name = validatorName.trim().toLowerCase();
  if (!name || name === "à préciser") return null;

  // Try exact position match
  const positionMap: Record<string, string> = {
    "directeur exécutif": "Directeur Exécutif",
    "directeur dsmp": "Directeur Services aux Membres et des Programmes",
    "daf": "Directeur Administration et Finance",
    "directeur dsmp/ finance": "Directeur Services aux Membres et des Programmes",
    "directeur dsmp / finance": "Directeur Services aux Membres et des Programmes",
    "responsable rh": "Responsable des ressources humaines",
    "responsable comptable et finance": "Responsable comptable et finance",
    "comptable senior trésorerie": "Comptable Senior en charge de la Trésorerie",
    "responsable logistique et achats": "Responsable Logistique et Achats",
    "chargé logistique et achats": "Chargé Logistique et Achats",
    "responsable logistique": "Responsable Logistique et Achats",
    "coordonnateur assainissement": "Coordonnateur Senior Assainissement",
  };

  const targetPosition = positionMap[name];
  if (targetPosition) {
    const userId = usersByPosition.get(targetPosition.toLowerCase());
    if (userId) return userId;
  }

  // Fallback: try pta code match
  const codeMap: Record<string, string> = {
    "dex": "DEX",
    "dsmp": "DSMP",
    "daf": "DAF",
  };
  const code = codeMap[name];
  if (code) {
    const userId = usersByPtaCode.get(code);
    if (userId) return userId;
  }

  // Fallback: try partial position match
  const positionEntries = Array.from(usersByPosition.entries());
  for (const [pos, id] of positionEntries) {
    if (pos.includes(name) || name.includes(pos.split(" ")[0])) {
      return id;
    }
  }

  return null;
}

async function main() {
  console.log("🌱 Début du seed AAEA Pilotage 360 (depuis Excel)...\n");

  // ============================================================
  // 0. Lire le fichier Excel
  // ============================================================
  console.log("📖 Lecture du fichier Excel...");
  const excelPath = path.join(process.cwd(), "upload", "20260506 PTA_Master_AAEA_2026.xlsx");
  const workbook = XLSX.readFile(excelPath);

  const equipeSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Equipe AAEA"], { defval: "" });
  const axesSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Axes strategiques"], { defval: "" });
  const acbfSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Referentiel ACBF"], { defval: "" });
  const ptaSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["PTA consolide AAEA"], { defval: "" });
  const raciSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["RACI institutionnelle"], { defval: "" });

  console.log(`  ✅ Excel lu: ${equipeSheet.length} membres, ${axesSheet.length} axes, ${acbfSheet.length} livrables ACBF, ${ptaSheet.length} activités, ${raciSheet.length} RACI\n`);

  // ============================================================
  // 1. Créer les permissions (hardcoded — pas dans l'Excel)
  // ============================================================
  console.log("📋 Création des permissions...");

  const permissionsData = [
    // Module Auth
    { code: "users:read", name: "Lire les utilisateurs", module: "auth" },
    { code: "users:create", name: "Créer des utilisateurs", module: "auth" },
    { code: "users:update", name: "Modifier des utilisateurs", module: "auth" },
    { code: "users:archive", name: "Archiver des utilisateurs", module: "auth" },
    { code: "users:*", name: "Gestion complète des utilisateurs", module: "auth" },
    { code: "roles:read", name: "Lire les rôles", module: "auth" },
    { code: "roles:create", name: "Créer des rôles", module: "auth" },
    { code: "roles:update", name: "Modifier des rôles", module: "auth" },
    { code: "roles:archive", name: "Archiver des rôles", module: "auth" },
    { code: "roles:*", name: "Gestion complète des rôles", module: "auth" },
    { code: "permissions:read", name: "Lire les permissions", module: "auth" },
    { code: "permissions:create", name: "Créer des permissions", module: "auth" },
    { code: "permissions:update", name: "Modifier des permissions", module: "auth" },
    { code: "permissions:*", name: "Gestion complète des permissions", module: "auth" },
    { code: "audit:read", name: "Lire le journal d'audit", module: "auth" },
    { code: "audit:*", name: "Gestion complète de l'audit", module: "auth" },
    { code: "admin:*", name: "Accès super administrateur", module: "auth" },

    // Module Organisation
    { code: "org:read", name: "Lire l'organisation", module: "org" },
    { code: "org:create", name: "Créer des éléments organisationnels", module: "org" },
    { code: "org:update", name: "Modifier l'organisation", module: "org" },
    { code: "org:archive", name: "Archiver des éléments organisationnels", module: "org" },
    { code: "org:*", name: "Gestion complète de l'organisation", module: "org" },

    // Module Stratégique
    { code: "strategic:read", name: "Lire le référentiel stratégique", module: "strategic" },
    { code: "strategic:create", name: "Créer des axes stratégiques", module: "strategic" },
    { code: "strategic:update", name: "Modifier le référentiel stratégique", module: "strategic" },
    { code: "strategic:archive", name: "Archiver des éléments stratégiques", module: "strategic" },
    { code: "strategic:*", name: "Gestion complète du référentiel stratégique", module: "strategic" },

    // Module ACBF
    { code: "acbf:read", name: "Lire le référentiel ACBF", module: "acbf" },
    { code: "acbf:create", name: "Créer des éléments ACBF", module: "acbf" },
    { code: "acbf:update", name: "Modifier le référentiel ACBF", module: "acbf" },
    { code: "acbf:archive", name: "Archiver des éléments ACBF", module: "acbf" },
    { code: "acbf:*", name: "Gestion complète ACBF", module: "acbf" },

    // Module PTA
    { code: "pta:read", name: "Lire les PTA", module: "pta" },
    { code: "pta:create", name: "Créer des activités PTA", module: "pta" },
    { code: "pta:update", name: "Modifier des activités PTA", module: "pta" },
    { code: "pta:archive", name: "Archiver des activités PTA", module: "pta" },
    { code: "pta:validate", name: "Valider des activités PTA", module: "pta" },
    { code: "pta:submit", name: "Soumettre des activités PTA", module: "pta" },
    { code: "pta:*", name: "Gestion complète des PTA", module: "pta" },

    // Module RACI
    { code: "raci:read", name: "Lire la matrice RACI", module: "raci" },
    { code: "raci:create", name: "Créer des entrées RACI", module: "raci" },
    { code: "raci:update", name: "Modifier la matrice RACI", module: "raci" },
    { code: "raci:*", name: "Gestion complète RACI", module: "raci" },

    // Module Gantt
    { code: "gantt:read", name: "Lire le Gantt", module: "gantt" },
    { code: "gantt:*", name: "Gestion complète du Gantt", module: "gantt" },

    // Module Dashboard
    { code: "dashboard:read", name: "Lire le tableau de bord", module: "dashboard" },
    { code: "dashboard:*", name: "Gestion complète du dashboard", module: "dashboard" },

    // Module Documents
    { code: "docs:read", name: "Lire les documents", module: "docs" },
    { code: "docs:create", name: "Ajouter des documents", module: "docs" },
    { code: "docs:update", name: "Modifier des documents", module: "docs" },
    { code: "docs:archive", name: "Archiver des documents", module: "docs" },
    { code: "docs:*", name: "Gestion complète des documents", module: "docs" },

    // Module Reports
    { code: "reports:read", name: "Lire les rapports", module: "reports" },
    { code: "reports:create", name: "Créer des rapports", module: "reports" },
    { code: "reports:update", name: "Modifier des rapports", module: "reports" },
    { code: "reports:archive", name: "Archiver des rapports", module: "reports" },
    { code: "reports:validate", name: "Valider des rapports", module: "reports" },
    { code: "reports:*", name: "Gestion complète des rapports", module: "reports" },

    // Module Notifications
    { code: "notifications:read", name: "Lire les notifications", module: "notifications" },
    { code: "notifications:*", name: "Gestion complète des notifications", module: "notifications" },

    // Module Import
    { code: "import:execute", name: "Exécuter des imports", module: "import" },
    { code: "import:*", name: "Gestion complète des imports", module: "import" },

    // Module Export
    { code: "export:read", name: "Lire les exports", module: "export" },
    { code: "export:execute", name: "Exécuter des exports", module: "export" },
    { code: "export:*", name: "Gestion complète des exports", module: "export" },
  ];

  const permissions: Record<string, string> = {};
  for (const p of permissionsData) {
    const existing = await prisma.permission.findUnique({ where: { code: p.code } });
    if (existing) {
      permissions[p.code] = existing.id;
    } else {
      const created = await prisma.permission.create({ data: p });
      permissions[p.code] = created.id;
    }
  }
  console.log(`  ✅ ${permissionsData.length} permissions créées\n`);

  // ============================================================
  // 2. Créer les rôles (hardcoded — pas dans l'Excel)
  // ============================================================
  console.log("👥 Création des rôles...");

  const rolesData = [
    {
      code: "ADMIN",
      name: "Administrateur",
      description: "Accès complet à toutes les fonctionnalités du système",
      isSystem: true,
      permissionCodes: ["admin:*"],
    },
    {
      code: "DIRECTEUR",
      name: "Directeur",
      description: "Directeur de direction — vue globale, validation, rapports",
      isSystem: true,
      permissionCodes: [
        "users:read", "roles:read", "permissions:read",
        "org:read", "strategic:read", "acbf:read",
        "pta:read", "pta:validate", "pta:create", "pta:update",
        "raci:read", "gantt:read", "dashboard:read",
        "docs:read", "reports:read", "reports:create", "reports:update", "reports:archive", "reports:validate",
        "notifications:read", "export:read", "export:execute", "import:execute",
        "audit:read",
      ],
    },
    {
      code: "MEAL",
      name: "Responsable MEAL",
      description: "Responsable Données et Suivi-évaluation",
      isSystem: true,
      permissionCodes: [
        "users:read", "roles:read",
        "org:read", "strategic:read", "acbf:read",
        "pta:read", "pta:validate", "pta:create", "pta:update",
        "raci:read", "raci:create", "raci:update",
        "gantt:read", "dashboard:read",
        "docs:read", "docs:create",
        "reports:read", "reports:create", "reports:update", "reports:archive", "reports:validate",
        "notifications:read", "export:read", "export:execute", "import:execute",
        "audit:read",
      ],
    },
    {
      code: "VALIDATEUR",
      name: "Validateur",
      description: "Peut valider ou rejeter les activités PTA de son périmètre",
      isSystem: true,
      permissionCodes: [
        "users:read", "pta:read", "pta:validate",
        "docs:read", "reports:read",
        "notifications:read", "dashboard:read",
        "export:read",
      ],
    },
    {
      code: "RESPONSABLE",
      name: "Responsable",
      description: "Responsable d'activités PTA",
      isSystem: true,
      permissionCodes: [
        "pta:read", "pta:create", "pta:update", "pta:submit",
        "docs:read", "docs:create",
        "reports:read", "notifications:read",
        "dashboard:read", "gantt:read",
        "raci:read", "export:read", "export:execute",
      ],
    },
    {
      code: "LECTEUR",
      name: "Lecteur",
      description: "Accès en lecture seule",
      isSystem: true,
      permissionCodes: [
        "pta:read", "docs:read", "reports:read",
        "notifications:read", "dashboard:read", "gantt:read",
        "raci:read", "strategic:read", "acbf:read",
        "export:read",
      ],
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesData) {
    let role = await prisma.role.findUnique({ where: { code: r.code } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          code: r.code,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
        },
      });
    }
    roles[r.code] = role.id;

    // Assigner les permissions au rôle
    for (const permCode of r.permissionCodes) {
      const permId = permissions[permCode];
      if (permId) {
        const existing = await prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        });
        if (!existing) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: permId },
          });
        }
      }
    }
  }
  console.log(`  ✅ ${rolesData.length} rôles créés\n`);

  // ============================================================
  // 3. Créer les directions (dérivées de l'Excel)
  // ============================================================
  console.log("🏛️ Création des directions...");

  // Derive directions from the Equipe AAEA sheet — 3 unique directions
  const directionMap: Record<string, { code: string; name: string; description: string }> = {};
  for (const row of equipeSheet) {
    const dept = String(row["Direction / unité"] || "").trim();
    if (!dept) continue;
    const dirCode = mapDirectionCode(dept);
    if (!directionMap[dirCode]) {
      directionMap[dirCode] = {
        code: dirCode,
        name: dept,
        description: dept,
      };
    }
  }
  // Ensure all 3 directions exist even if not in the sheet
  if (!directionMap["DEX"]) directionMap["DEX"] = { code: "DEX", name: "Cabinet Direction Exécutive", description: "Direction exécutive de l'AAEA" };
  if (!directionMap["DSMP"]) directionMap["DSMP"] = { code: "DSMP", name: "Direction des Services aux Membres et des Programmes", description: "Services aux membres et programmes" };
  if (!directionMap["DAF"]) directionMap["DAF"] = { code: "DAF", name: "Direction Administrative et Financière", description: "Administration et finances" };

  const directions: Record<string, string> = {};
  for (const d of Object.values(directionMap)) {
    let dir = await prisma.direction.findUnique({ where: { code: d.code } });
    if (!dir) {
      dir = await prisma.direction.create({ data: { code: d.code, name: d.name, description: d.description } });
    }
    directions[d.code] = dir.id;
  }
  const directionCount = Object.keys(directionMap).length;
  console.log(`  ✅ ${directionCount} directions créées\n`);

  // ============================================================
  // 4. Créer les axes stratégiques (depuis l'Excel)
  // ============================================================
  console.log("🎯 Création des axes stratégiques...");

  const axesLookup: Record<string, string> = {}; // AXE1 → id
  for (const row of axesSheet) {
    const excelCode = String(row["Code axe"] || "").trim();
    const name = String(row["Intitulé de l'axe"] || "").trim();
    const objective = String(row["Description synthétique"] || "").trim();
    const expectedResults = String(row["Résultats attendus"] || "").trim();
    const indicators = String(row["Indicateurs stratégiques possibles"] || "").trim();
    const concernedUnits = String(row["Directions principalement concernées"] || "").trim();

    const code = mapAxeCode(excelCode); // "AXE 1" → "AXE1"
    const order = parseInt(excelCode.replace("AXE ", ""), 10);

    const existing = await prisma.strategicAxis.findUnique({ where: { code } });
    if (!existing) {
      const created = await prisma.strategicAxis.create({
        data: { code, name, objective, expectedResults, indicators, concernedUnits, order },
      });
      axesLookup[code] = created.id;
    } else {
      axesLookup[code] = existing.id;
    }
  }
  console.log(`  ✅ ${axesSheet.length} axes stratégiques créés\n`);

  // ============================================================
  // 5. Créer les domaines ACBF et livrables (depuis l'Excel)
  // ============================================================
  console.log("📊 Création des domaines ACBF et livrables...");

  // First, create unique domains
  const domainLookup: Record<string, string> = {}; // ACBF1 → id
  const domainByName: Record<string, string> = {}; // domain name → id
  const seenDomains = new Map<string, { code: string; name: string; order: number }>();
  for (const row of acbfSheet) {
    const excelDomainId = String(row["ID domaine ACBF"] || "").trim();
    const domainName = String(row["Domaine ACBF"] || "").trim();
    if (!excelDomainId || seenDomains.has(excelDomainId)) continue;

    const code = mapAcbfDomainCode(excelDomainId); // "ACBF-01" → "ACBF1"
    const order = parseInt(excelDomainId.replace("ACBF-", ""), 10);
    seenDomains.set(excelDomainId, { code, name: domainName, order });
  }

  for (const { code, name, order } of Array.from(seenDomains.values())) {
    const existing = await prisma.acbfDomain.findUnique({ where: { code } });
    if (!existing) {
      const created = await prisma.acbfDomain.create({ data: { code, name, order } });
      domainLookup[code] = created.id;
      domainByName[name] = created.id;
    } else {
      domainLookup[code] = existing.id;
      domainByName[name] = existing.id;
    }
  }
  console.log(`  ✅ ${seenDomains.size} domaines ACBF créés`);

  // Now create deliverables
  const deliverableLookup: Record<string, string> = {}; // ACBF-01-01 → id
  const deliverableByName: Record<string, string> = {}; // deliverable name → id
  let deliverableCount = 0;
  for (const row of acbfSheet) {
    const deliverableCode = String(row["ID livrable ACBF"] || "").trim();
    const deliverableName = String(row["Livrable demandé"] || "").trim();
    const excelDomainId = String(row["ID domaine ACBF"] || "").trim();
    const description = String(row["Description courte"] || "").trim();
    const priority = String(row["Priorité"] || "").trim();
    const status = String(row["Statut de disponibilité"] || "").trim();

    const domainCode = mapAcbfDomainCode(excelDomainId);
    const domainId = domainLookup[domainCode];
    if (!domainId || !deliverableCode) continue;

    const existing = await prisma.acbfDeliverable.findUnique({ where: { code: deliverableCode } });
    if (!existing) {
      const created = await prisma.acbfDeliverable.create({
        data: {
          code: deliverableCode,
          name: deliverableName,
          domainId,
          description: description || null,
          priority: priority || null,
          status: status || null,
        },
      });
      deliverableLookup[deliverableCode] = created.id;
      deliverableByName[deliverableName] = created.id;
      deliverableCount++;
    } else {
      deliverableLookup[deliverableCode] = existing.id;
      deliverableByName[deliverableName] = existing.id;
    }
  }
  console.log(`  ✅ ${deliverableCount} livrables ACBF créés\n`);

  // ============================================================
  // 6. Créer les utilisateurs (depuis l'Excel)
  // ============================================================
  console.log("👤 Création des utilisateurs AAEA...");

  const defaultPassword = await hash("AAEA2026!", 12);

  const usersByPtaCode = new Map<string, string>(); // ptaCode → userId
  const usersByPosition = new Map<string, string>(); // position.toLowerCase() → userId
  const usersByName = new Map<string, string>(); // name → userId

  for (const row of equipeSheet) {
    const ptaCode = String(row["Code PTA"] || "").trim();
    const name = String(row["Nom et prénoms"] || "").trim();
    const position = String(row["Poste"] || "").trim();
    const department = String(row["Direction / unité"] || "").trim();

    if (!ptaCode || !name) continue;

    const email = generateEmail(name);
    const roleCode = mapRole(position);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Also check by ptaCode
      user = await prisma.user.findUnique({ where: { ptaCode } });
    }
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password: defaultPassword,
          name,
          ptaCode,
          position,
          department,
        },
      });
    }

    usersByPtaCode.set(ptaCode, user.id);
    usersByPosition.set(position.toLowerCase(), user.id);
    usersByName.set(name, user.id);

    const roleId = roles[roleCode];
    if (roleId) {
      const existing = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId } },
      });
      if (!existing) {
        await prisma.userRole.create({ data: { userId: user.id, roleId } });
      }
    }

    // Set as head of direction if applicable
    if (["DEX", "DSMP", "DAF"].includes(ptaCode)) {
      await prisma.direction.update({
        where: { code: ptaCode },
        data: { headUserId: user.id },
      });
    }
  }
  console.log(`  ✅ ${equipeSheet.length} utilisateurs créés\n`);

  // ============================================================
  // 7. Créer le super admin
  // ============================================================
  console.log("🔑 Création du super administrateur...");

  const adminPassword = await hash("Admin2026!", 12);
  let admin = await prisma.user.findUnique({ where: { email: "admin@aaea.org" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "admin@aaea.org",
        password: adminPassword,
        name: "Super Administrateur",
        ptaCode: "ADMIN",
        position: "Administrateur Système",
        department: "Cabinet Direction Exécutive",
      },
    });
  }

  const adminRole = roles["ADMIN"];
  if (adminRole) {
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole } },
    });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole } });
    }
  }
  console.log("  ✅ Super administrateur créé (admin@aaea.org / Admin2026!)\n");

  // ============================================================
  // 8. Créer le compte fantôme "Fantomas"
  // ============================================================
  console.log("👻 Création du compte fantôme Fantomas...");

  const fantomasPassword = await hash("fantomas", 12);
  let fantomas = await prisma.user.findUnique({ where: { email: "fantomas@aaea.org" } });
  if (!fantomas) {
    fantomas = await prisma.user.create({
      data: {
        email: "fantomas@aaea.org",
        password: fantomasPassword,
        name: "Fantomas",
        ptaCode: "fantomas",
        position: "Compte Fantôme",
        department: "Cabinet Direction Exécutive",
      },
    });
  }

  const adminRoleForFantomas = roles["ADMIN"];
  if (adminRoleForFantomas) {
    const existing = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: fantomas.id, roleId: adminRoleForFantomas } },
    });
    if (!existing) {
      await prisma.userRole.create({ data: { userId: fantomas.id, roleId: adminRoleForFantomas } });
    }
  }
  console.log("  ✅ Compte fantôme créé (fantomas / fantomas)\n");

  // ============================================================
  // 9. Créer les activités PTA (depuis l'Excel — 275 activités)
  // ============================================================
  console.log("📝 Création des activités PTA...");

  let activityCreated = 0;
  let activitySkipped = 0;
  let activityErrors = 0;

  // Create activities in batches for performance
  const activityBatch: Array<{
    activityCode: string;
    responsibleId: string;
    directionId: string | null;
    primaryAxisId: string | null;
    secondaryAxisId: string | null;
    acbfDomainId: string | null;
    acbfDeliverableId: string | null;
    annualObjective: string | null;
    title: string;
    detailedTasks: string | null;
    expectedDeliverable: string | null;
    validatorId: string | null;
    startDate: Date | null;
    endDate: Date | null;
    priority: string;
    performanceIndicator: string | null;
    verificationSource: string | null;
    status: string;
    progressRate: number;
    riskDescription: string | null;
    comments: string | null;
    validationStatus: string;
    nature: string | null;
    dependency: string | null;
    duration: string | null;
  }> = [];

  for (const row of ptaSheet) {
    const activityCode = String(row["N°"] || "").trim();
    const ptaCode = String(row["Code PTA"] || "").trim();
    const title = String(row["Activité PTA concrète"] || "").trim();
    const bloc = String(row["Bloc / objectif fonctionnel"] || "").trim();
    const nature = String(row["Nature de l'activité"] || "").trim();
    const primaryAxisExcel = String(row["Axe stratégique principal"] || "").trim();
    const secondaryAxesExcel = String(row["Axe(s) secondaire(s)"] || "").trim();
    const domainAcbfName = String(row["Domaine ACBF"] || "").trim();
    const lienAcbf = String(row["Lien ACBF"] || "").trim();
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

    if (!activityCode || !ptaCode || !title) {
      activitySkipped++;
      continue;
    }

    // Look up responsibleId by ptaCode
    const responsibleId = usersByPtaCode.get(ptaCode);
    if (!responsibleId) {
      activitySkipped++;
      continue;
    }

    // Look up directionId based on ptaCode
    let directionId: string | null = null;
    if (["DEX"].includes(ptaCode) || ["CONF", "MEAL", "NUM", "COM", "ADX"].includes(ptaCode)) {
      directionId = directions["DEX"] || null;
    } else if (["DSMP"].includes(ptaCode) || ["ASS", "EAU", "GEN", "KNOW", "MEMB", "SPON", "PROJASS", "ASM", "ASPP"].includes(ptaCode)) {
      directionId = directions["DSMP"] || null;
    } else if (["DAF"].includes(ptaCode) || ["RH", "ARH", "FIN", "TRES", "ACF", "ATRES", "AGR", "LOG", "CLOG", "CHAUF1", "CHAUF2"].includes(ptaCode)) {
      directionId = directions["DAF"] || null;
    }

    // Look up primaryAxisId
    let primaryAxisId: string | null = null;
    if (primaryAxisExcel) {
      const axisCode = mapAxeCode(primaryAxisExcel);
      primaryAxisId = axesLookup[axisCode] || null;
    }

    // Look up secondaryAxisId (use first one if multiple)
    let secondaryAxisId: string | null = null;
    if (secondaryAxesExcel) {
      const firstAxis = secondaryAxesExcel.split(";")[0].trim();
      if (firstAxis) {
        const axisCode = mapAxeCode(firstAxis);
        secondaryAxisId = axesLookup[axisCode] || null;
      }
    }

    // Look up acbfDomainId by name match
    let acbfDomainId: string | null = null;
    if (domainAcbfName) {
      acbfDomainId = domainByName[domainAcbfName] || null;
      if (!acbfDomainId) {
        for (const [name, id] of Object.entries(domainByName)) {
          if (name.toLowerCase().includes(domainAcbfName.toLowerCase()) || domainAcbfName.toLowerCase().includes(name.toLowerCase())) {
            acbfDomainId = id;
            break;
          }
        }
      }
    }

    // Look up acbfDeliverableId by name match
    let acbfDeliverableId: string | null = null;
    if (livrableAcbfName) {
      acbfDeliverableId = deliverableByName[livrableAcbfName] || null;
      if (!acbfDeliverableId) {
        for (const [name, id] of Object.entries(deliverableByName)) {
          if (name.toLowerCase().includes(livrableAcbfName.toLowerCase()) || livrableAcbfName.toLowerCase().includes(name.toLowerCase())) {
            acbfDeliverableId = id;
            break;
          }
        }
      }
    }

    // Look up validatorId
    let validatorId: string | null = null;
    if (validateurName) {
      validatorId = findUserByValidatorName(validateurName, usersByPosition, usersByPtaCode);
    }

    // Build annualObjective with bloc appended
    let finalAnnualObjective = annualObjective;
    if (bloc) {
      finalAnnualObjective = `[${bloc}] ${annualObjective}`;
    }

    // Build comments
    const commentParts: string[] = [];
    if (contributeurs) commentParts.push(`Contributeur(s): ${contributeurs}`);
    if (lienAcbf) commentParts.push(`Lien ACBF: ${lienAcbf}`);
    if (commentaires) commentParts.push(commentaires);
    const finalComments = commentParts.join(" | ");

    activityBatch.push({
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
    });
  }

  // Insert in batches of 50 using createMany with skipDuplicates
  const BATCH_SIZE = 50;
  for (let i = 0; i < activityBatch.length; i += BATCH_SIZE) {
    const batch = activityBatch.slice(i, i + BATCH_SIZE);
    try {
      const result = await prisma.activity.createMany({
        data: batch,
        skipDuplicates: true,
      });
      activityCreated += result.count;
    } catch (err) {
      console.log(`  ❌ Erreur batch activités ${i}-${i + batch.length}: ${err}`);
      activityErrors += batch.length;
    }
  }
  console.log(`  ✅ ${activityCreated} activités créées, ${activitySkipped} ignorées, ${activityErrors} erreurs\n`);

  // ============================================================
  // 10. Créer les entrées RACI (depuis l'Excel — 72 entrées)
  // ============================================================
  console.log("📋 Création des entrées RACI...");

  let raciCreated = 0;
  let raciSkipped = 0;

  for (const row of raciSheet) {
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
      raciSkipped++;
      continue;
    }

    // Look up acbfDeliverableId by code
    const acbfDeliverableId = deliverableLookup[deliverableCode] || null;
    if (!acbfDeliverableId) {
      raciSkipped++;
      continue;
    }

    // Check if RACI entry already exists for this deliverable
    const existingRaci = await prisma.raciMatrix.findFirst({
      where: { acbfDeliverableId },
    });
    if (existingRaci) {
      raciSkipped++;
      continue;
    }

    // Look up strategicAxisId
    let strategicAxisId: string | null = null;
    if (axisExcel) {
      const axisCode = mapAxeCode(axisExcel);
      strategicAxisId = axesLookup[axisCode] || null;
    }

    // Try to map responsible text to a user
    let responsibleUserId: string | null = null;
    if (responsible) {
      responsibleUserId = findUserByValidatorName(responsible, usersByPosition, usersByPtaCode);
    }

    // Try to map accountable text to a user
    let accountableUserId: string | null = null;
    if (accountable) {
      accountableUserId = findUserByValidatorName(accountable, usersByPosition, usersByPtaCode);
    }

    try {
      await prisma.raciMatrix.create({
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
      raciCreated++;
    } catch (err) {
      console.log(`  ❌ Erreur RACI ${deliverableCode}: ${err}`);
      raciSkipped++;
    }
  }
  console.log(`  ✅ ${raciCreated} entrées RACI créées, ${raciSkipped} ignorées\n`);

  // ============================================================
  // Résumé final
  // ============================================================
  console.log("═══════════════════════════════════════════════════");
  console.log("🌱 SEED TERMINÉ AVEC SUCCÈS !");
  console.log("═══════════════════════════════════════════════════");
  console.log("  📊 Données chargées depuis Excel:");
  console.log(`     ${directionCount} directions`);
  console.log(`     ${axesSheet.length} axes stratégiques`);
  console.log(`     ${seenDomains.size} domaines ACBF`);
  console.log(`     ${deliverableCount} livrables ACBF`);
  console.log(`     ${equipeSheet.length} membres de l'équipe`);
  console.log(`     ${activityCreated} activités PTA`);
  console.log(`     ${raciCreated} entrées RACI`);
  console.log("  🔐 Comptes de connexion :");
  console.log("     Admin    : admin@aaea.org / Admin2026!");
  console.log("     Fantomas : fantomas / fantomas  (email: fantomas@aaea.org)");
  console.log("     Directeur: f.gosso@aaea.org / AAEA2026!");
  console.log("     MEAL     : a.kanga@aaea.org / AAEA2026!");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
