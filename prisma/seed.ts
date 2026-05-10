import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Début du seed AAEA Pilotage 360...\n");

  // ============================================================
  // 1. Créer les permissions
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
    { code: "reports:validate", name: "Valider des rapports", module: "reports" },
    { code: "reports:*", name: "Gestion complète des rapports", module: "reports" },

    // Module Notifications
    { code: "notifications:read", name: "Lire les notifications", module: "notifications" },
    { code: "notifications:*", name: "Gestion complète des notifications", module: "notifications" },

    // Module Import
    { code: "import:execute", name: "Exécuter des imports", module: "import" },
    { code: "import:*", name: "Gestion complète des imports", module: "import" },

    // Module Export
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
  // 2. Créer les rôles
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
        "docs:read", "reports:read", "reports:create", "reports:validate",
        "notifications:read", "export:execute", "import:execute",
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
        "reports:read", "reports:create", "reports:validate",
        "notifications:read", "export:execute", "import:execute",
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
        "raci:read", "export:execute",
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
  // 3. Créer les directions
  // ============================================================
  console.log("🏛️ Création des directions...");

  const directionsData = [
    { code: "DEX", name: "Cabinet Direction Exécutive", description: "Direction exécutive de l'AAEA" },
    { code: "DSMP", name: "Direction des Services aux Membres et des Programmes", description: "Services aux membres et programmes" },
    { code: "DAF", name: "Direction Administrative et Financière", description: "Administration et finances" },
  ];

  const directions: Record<string, string> = {};
  for (const d of directionsData) {
    let dir = await prisma.direction.findUnique({ where: { code: d.code } });
    if (!dir) {
      dir = await prisma.direction.create({ data: d });
    }
    directions[d.code] = dir.id;
  }
  console.log(`  ✅ ${directionsData.length} directions créées\n`);

  // ============================================================
  // 4. Créer les axes stratégiques
  // ============================================================
  console.log("🎯 Création des axes stratégiques...");

  const axesData = [
    { code: "AXE1", name: "Renforcement des capacités", objective: "Renforcer durablement les compétences techniques, managériales, institutionnelles et de plaidoyer des acteurs WASH.", expectedResults: "Professionnalisation accrue, formations certifiantes, mentorat, apprentissage entre pairs et bonnes pratiques diffusées.", indicators: "Nombre de professionnels formés/certifiés; taux de satisfaction; nombre de formations; nombre de bonnes pratiques diffusées.", concernedUnits: "DSMP; Coordinateurs; Connaissances; RH; MEAL", order: 1 },
    { code: "AXE2", name: "Développement des services", objective: "Structurer et déployer une offre intégrée de services à forte valeur ajoutée pour les membres, institutions et partenaires.", expectedResults: "Utilisation accrue des services, satisfaction renforcée, amélioration des performances des institutions appuyées.", indicators: "Taux d'utilisation des services; nombre d'institutions accompagnées; satisfaction; nombre de services déployés.", concernedUnits: "DSMP; Services aux membres; Événements; Sponsoring; MEAL; Numérique; Communication", order: 2 },
    { code: "AXE3", name: "Données et innovation", objective: "Faire de la donnée, de l'innovation et du numérique des leviers de performance, redevabilité et plaidoyer sectoriel.", expectedResults: "Données WASH fiables, plateformes numériques sécurisées, tableaux de bord, rapports sectoriels et décisions fondées sur les données.", indicators: "Nombre d'outils numériques opérationnels; fréquence des tableaux de bord; nombre de rapports produits; niveau d'utilisation des données.", concernedUnits: "MEAL; Numérique; DEx; DSMP; Communication; Coordinateurs", order: 3 },
    { code: "AXE4", name: "Développement de partenariat", objective: "Consolider, structurer et élargir les partenariats institutionnels, techniques et financiers de l'AAEA.", expectedResults: "Portefeuille de partenariats diversifié, ressources mobilisées, projets conjoints et collaborations structurées.", indicators: "Nombre de partenariats actifs; ressources mobilisées; projets conjoints; MoU signés; niveau d'alignement stratégique.", concernedUnits: "DEx; DSMP; Sponsoring; Coordinateurs; DAF; Communication", order: 4 },
    { code: "AXE5", name: "Gouvernance et durabilité institutionnelle", objective: "Renforcer la gouvernance, la conformité, la performance organisationnelle et la durabilité financière de l'AAEA.", expectedResults: "Gouvernance modernisée, autonomie financière renforcée, pilotage stratégique amélioré, risques maîtrisés.", indicators: "Taux d'exécution du plan stratégique; audits réalisés; rapports qualité; conformité; ressources propres; risques suivis.", concernedUnits: "DEx; DAF; Conformité & Performance; RH; Logistique; Finance; MEAL", order: 5 },
  ];

  for (const axe of axesData) {
    const existing = await prisma.strategicAxis.findUnique({ where: { code: axe.code } });
    if (!existing) {
      await prisma.strategicAxis.create({ data: axe });
    }
  }
  console.log(`  ✅ ${axesData.length} axes stratégiques créés\n`);

  // ============================================================
  // 5. Créer les domaines ACBF
  // ============================================================
  console.log("📊 Création des domaines ACBF...");

  const acbfDomainsData = [
    { code: "ACBF1", name: "Governance & Organizational Structure", order: 1 },
    { code: "ACBF2", name: "Strategic & Operational Planning", order: 2 },
    { code: "ACBF3", name: "Program & Project Management", order: 3 },
    { code: "ACBF4", name: "Monitoring, Evaluation, Accountability & Learning — MEAL", order: 4 },
    { code: "ACBF5", name: "Human Resources & Leadership", order: 5 },
    { code: "ACBF6", name: "Financial Management & Compliance", order: 6 },
    { code: "ACBF7", name: "Administrative & Operational Systems", order: 7 },
    { code: "ACBF8", name: "ICT, Digital Systems & Infrastructure", order: 8 },
    { code: "ACBF9", name: "Communications, Advocacy & Visibility", order: 9 },
    { code: "ACBF10", name: "Membership & Stakeholder Management", order: 10 },
    { code: "ACBF11", name: "Sustainability, Resource Mobilization & Partnerships", order: 11 },
    { code: "ACBF12", name: "Legal & Compliance", order: 12 },
    { code: "ACBF13", name: "Research and Knowledge Management", order: 13 },
    { code: "ACBF14", name: "Optional / Supporting Documents", order: 14 },
  ];

  for (const domain of acbfDomainsData) {
    const existing = await prisma.acbfDomain.findUnique({ where: { code: domain.code } });
    if (!existing) {
      await prisma.acbfDomain.create({ data: domain });
    }
  }
  console.log(`  ✅ ${acbfDomainsData.length} domaines ACBF créés\n`);

  // ============================================================
  // 6. Créer les utilisateurs
  // ============================================================
  console.log("👤 Création des utilisateurs AAEA...");

  const defaultPassword = await hash("AAEA2026!", 12);

  const teamMembers = [
    { ptaCode: "DEX", name: "François Olivier Gosso", position: "Directeur Exécutif", department: "Cabinet Direction Exécutive", role: "DIRECTEUR", email: "f.gosso@aaea.org" },
    { ptaCode: "DSMP", name: "Moussa Seck", position: "Directeur Services aux Membres et des Programmes", department: "Direction des Services aux Membres et des Programmes", role: "DIRECTEUR", email: "m.seck@aaea.org" },
    { ptaCode: "DAF", name: "Olivier Gnanpa", position: "Directeur Administration et Finance", department: "Direction Administrative et Financière", role: "DIRECTEUR", email: "o.gnanpa@aaea.org" },
    { ptaCode: "CONF", name: "Christian ZOCLI", position: "Responsable Conformité & Performance", department: "Cabinet Direction Exécutive", role: "RESPONSABLE", email: "c.zocli@aaea.org" },
    { ptaCode: "MEAL", name: "Alexandre KANGA", position: "Responsable Données et Suivi-évaluation", department: "Cabinet Direction Exécutive", role: "MEAL", email: "a.kanga@aaea.org" },
    { ptaCode: "NUM", name: "Nicaise KOUAKOU", position: "Responsable Développement Numérique et Innovation", department: "Cabinet Direction Exécutive", role: "RESPONSABLE", email: "n.kouakou@aaea.org" },
    { ptaCode: "COM", name: "Stephanie Nzickonan", position: "Responsable Communication", department: "Cabinet Direction Exécutive", role: "RESPONSABLE", email: "s.nzickonan@aaea.org" },
    { ptaCode: "ADX", name: "Mariam Ba Coulibaly", position: "Assistante du Directeur Exécutif", department: "Cabinet Direction Exécutive", role: "RESPONSABLE", email: "m.coulibaly@aaea.org" },
    { ptaCode: "ASS", name: "Valentin Yao", position: "Coordonnateur Senior Assainissement", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "v.yao@aaea.org" },
    { ptaCode: "EAU", name: "Dr Hemez Kouassi", position: "Coordonnateur Eau", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "h.kouassi@aaea.org" },
    { ptaCode: "GEN", name: "Dr Leticia Ackun", position: "Coordonnatrice Senior Genre et Réseaux", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "l.ackun@aaea.org" },
    { ptaCode: "KNOW", name: "Djalia Umutangampundu", position: "Responsable projets, gestion et partage de connaissances", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "d.umutangampundu@aaea.org" },
    { ptaCode: "MEMB", name: "Micheline Lawson", position: "Responsable événements et services aux membres", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "m.lawson@aaea.org" },
    { ptaCode: "SPON", name: "Kalou Aimé Digbeu", position: "Responsable Expositions et sponsoring", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "k.digbeu@aaea.org" },
    { ptaCode: "PROJASS", name: "Julian Musime", position: "Chargé de projets assainissement", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "j.musime@aaea.org" },
    { ptaCode: "ASM", name: "Khady Dankoulou", position: "Assistante DSMP Services aux Membres", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "k.dankoulou@aaea.org" },
    { ptaCode: "ASPP", name: "Benedicte Kanga", position: "Assistante DSMP Programmes, Projets et Partenariats", department: "Direction des Services aux Membres et des Programmes", role: "RESPONSABLE", email: "b.kanga@aaea.org" },
    { ptaCode: "RH", name: "Emmanuel Kouadio", position: "Responsable des ressources humaines", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "e.kouadio@aaea.org" },
    { ptaCode: "ARH", name: "Corine Assienin", position: "Assistante Ressources Humaines", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "c.assienin@aaea.org" },
    { ptaCode: "FIN", name: "Sonia Nguessan", position: "Responsable comptable et finance", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "s.nguessan@aaea.org" },
    { ptaCode: "TRES", name: "Vanessa Tihi", position: "Comptable Senior en charge de la Trésorerie", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "v.tihi@aaea.org" },
    { ptaCode: "ACF", name: "Franc Mabio", position: "Assistant comptable", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "f.mabio@aaea.org" },
    { ptaCode: "ATRES", name: "Edwidge Gueu", position: "Assistante comptable volet trésorerie", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "e.gueu@aaea.org" },
    { ptaCode: "AGR", name: "Théodora Kouakou", position: "Assistante comptable services aux membres et AGR", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "t.kouakou@aaea.org" },
    { ptaCode: "LOG", name: "Amos Yao", position: "Responsable Logistique et Achats", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "a.yao@aaea.org" },
    { ptaCode: "CLOG", name: "Abdoulaye Fadiga", position: "Chargé Logistique et Achats", department: "Direction Administrative et Financière", role: "RESPONSABLE", email: "a.fadiga@aaea.org" },
    { ptaCode: "CHAUF1", name: "Mathieu Kouakou", position: "Chauffeur", department: "Direction Administrative et Financière", role: "LECTEUR", email: "m.kouakou@aaea.org" },
    { ptaCode: "CHAUF2", name: "Dominique Diézahi", position: "Chauffeur", department: "Direction Administrative et Financière", role: "LECTEUR", email: "d.diezahi@aaea.org" },
  ];

  for (const member of teamMembers) {
    let user = await prisma.user.findUnique({ where: { email: member.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: member.email,
          password: defaultPassword,
          name: member.name,
          ptaCode: member.ptaCode,
          position: member.position,
          department: member.department,
        },
      });
    }

    const roleId = roles[member.role];
    if (roleId) {
      const existing = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId } },
      });
      if (!existing) {
        await prisma.userRole.create({ data: { userId: user.id, roleId } });
      }
    }

    if (["DEX", "DSMP", "DAF"].includes(member.ptaCode)) {
      await prisma.direction.update({
        where: { code: member.ptaCode },
        data: { headUserId: user.id },
      });
    }
  }
  console.log(`  ✅ ${teamMembers.length} utilisateurs créés\n`);

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

  const fantomasPassword = await hash("admin", 12);
  let fantomas = await prisma.user.findUnique({ where: { email: "fantomas@aaea.org" } });
  if (!fantomas) {
    fantomas = await prisma.user.create({
      data: {
        email: "fantomas@aaea.org",
        password: fantomasPassword,
        name: "Fantomas",
        ptaCode: "FANTOMAS",
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
  console.log("  ✅ Compte fantôme créé (fantomas / admin)\n");

  console.log("═══════════════════════════════════════════════════");
  console.log("🌱 SEED TERMINÉ AVEC SUCCÈS !");
  console.log("═══════════════════════════════════════════════════");
  console.log("  🔐 Comptes de connexion :");
  console.log("     Admin    : admin@aaea.org / Admin2026!");
  console.log("     Fantomas : fantomas / admin  (email: fantomas@aaea.org)");
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
