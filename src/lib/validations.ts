import { z } from "zod";

/**
 * Centralized validation schemas for all modules.
 * Shared between API routes to avoid duplication and ensure consistency.
 */

// Password complexity requirements:
// - Minimum 8 characters
// - At least 1 uppercase letter
// - At least 1 lowercase letter
// - At least 1 digit
// - At least 1 special character
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const PASSWORD_ERROR_MESSAGE =
  "Le mot de passe doit contenir au moins 8 caractères, dont 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial";

export const passwordSchema = z
  .string()
  .min(8, PASSWORD_ERROR_MESSAGE)
  .regex(PASSWORD_REGEX, PASSWORD_ERROR_MESSAGE);

// Export the regex and error message for client-side validation alignment
export { PASSWORD_REGEX, PASSWORD_ERROR_MESSAGE };

export const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  ptaCode: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  roleIds: z.array(z.string()).optional().default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  ptaCode: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  password: passwordSchema.optional(),
  roleIds: z.array(z.string()).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
});

// ─── Role schemas ─────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit contenir au moins 2 caractères")
    .refine((v) => v === v.toUpperCase(), "Le code doit être en majuscules"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).optional().default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).optional(),
});

// ─── Permission schemas ───────────────────────────────────────────────────

export const createPermissionSchema = z.object({
  code: z.string().min(3, "Le code doit contenir au moins 3 caractères"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  module: z.string().min(2, "Le module est requis"),
  description: z.string().optional().nullable(),
});

export const updatePermissionSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
});

export const archivePermissionSchema = z.object({
  action: z.enum(["archive", "restore"]),
});

// ─── Direction schemas (Module 2) ──────────────────────────────────────────

const orgCodeField = z
  .string()
  .min(1, "Le code est requis")
  .max(20, "Maximum 20 caractères")
  .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement");

const orgNameField = z
  .string()
  .min(2, "Le nom doit contenir au moins 2 caractères")
  .max(200, "Maximum 200 caractères");

const orgDescriptionField = z
  .string()
  .max(1000, "Maximum 1000 caractères")
  .optional()
  .nullable();

export const createDirectionSchema = z.object({
  code: orgCodeField,
  name: orgNameField,
  description: orgDescriptionField,
  headUserId: z.string().optional().nullable(),
});

export const updateDirectionSchema = z.object({
  code: orgCodeField.optional(),
  name: orgNameField.optional(),
  description: orgDescriptionField,
  headUserId: z.string().optional().nullable(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

export const createUnitSchema = z.object({
  code: orgCodeField,
  name: orgNameField,
  description: orgDescriptionField,
  directionId: z.string().min(1, "La direction est requise"),
  headUserId: z.string().optional().nullable(),
});

export const updateUnitSchema = z.object({
  code: orgCodeField.optional(),
  name: orgNameField.optional(),
  description: orgDescriptionField,
  directionId: z.string().min(1, "La direction est requise").optional(),
  headUserId: z.string().optional().nullable(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

// ─── Strategic Axis schemas (Module 3) ────────────────────────────────────

const axisTextField = z
  .string()
  .max(2000, "Maximum 2000 caractères")
  .optional()
  .nullable();

export const createStrategicAxisSchema = z.object({
  code: orgCodeField,
  name: orgNameField,
  objective: axisTextField,
  expectedResults: axisTextField,
  indicators: axisTextField,
  concernedUnits: z
    .string()
    .max(1000, "Maximum 1000 caractères")
    .optional()
    .nullable(),
  order: z.number().int().min(0).default(0),
});

export const updateStrategicAxisSchema = z.object({
  code: orgCodeField.optional(),
  name: orgNameField.optional(),
  objective: axisTextField,
  expectedResults: axisTextField,
  indicators: axisTextField,
  concernedUnits: z
    .string()
    .max(1000, "Maximum 1000 caractères")
    .optional()
    .nullable(),
  order: z.number().int().min(0).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

// ─── ACBF Domain schemas (Module 4) ────────────────────────────────────────

export const createAcbfDomainSchema = z.object({
  code: orgCodeField,
  name: orgNameField,
  order: z.number().int().min(0).default(0),
});

export const updateAcbfDomainSchema = z.object({
  code: orgCodeField.optional(),
  name: orgNameField.optional(),
  order: z.number().int().min(0).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

// ─── ACBF Deliverable schemas (Module 4) ───────────────────────────────────

export const createAcbfDeliverableSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .max(30, "Maximum 30 caractères")
    .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement"),
  name: orgNameField,
  domainId: z.string().min(1, "Le domaine ACBF est requis"),
  description: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  status: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
});

export const updateAcbfDeliverableSchema = z.object({
  code: z
    .string()
    .min(1, "Le code est requis")
    .max(30, "Maximum 30 caractères")
    .regex(/^[A-Z0-9_]+$/, "Code en majuscules, chiffres et _ uniquement")
    .optional(),
  name: orgNameField.optional(),
  domainId: z.string().min(1, "Le domaine ACBF est requis").optional(),
  description: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  status: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

// ─── Activity schemas (Module 5 — PTA individuels) ──────────────────────────

const activityTextField = z
  .string()
  .max(5000, "Maximum 5000 caractères")
  .optional()
  .nullable();

const activityMediumTextField = z
  .string()
  .max(2000, "Maximum 2000 caractères")
  .optional()
  .nullable();

const activityShortTextField = z
  .string()
  .max(1000, "Maximum 1000 caractères")
  .optional()
  .nullable();

export const createActivitySchema = z.object({
  activityCode: z.string().optional(),
  responsibleId: z.string().min(1, "Le responsable est requis"),
  directionId: z.string().optional().nullable(),
  primaryAxisId: z.string().optional().nullable(),
  secondaryAxisId: z.string().optional().nullable(),
  acbfDomainId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
  annualObjective: activityMediumTextField,
  title: z.string().min(1, "Le titre est requis").max(500, "Maximum 500 caractères"),
  detailedTasks: activityTextField,
  expectedDeliverable: activityMediumTextField,
  validatorId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).default("Moyenne"),
  performanceIndicator: activityShortTextField,
  verificationSource: activityShortTextField,
  status: z.enum(["Non démarré", "En cours", "Terminé", "Annulé"]).default("Non démarré"),
  progressRate: z.number().min(0).max(100).default(0),
  riskDescription: activityMediumTextField,
  comments: activityTextField,
  // C2 fix: validationStatus is NOT accepted on creation — always forced to "Brouillon"
  nature: z.string().max(200, "Maximum 200 caractères").optional().nullable(),
  dependency: activityShortTextField,
  duration: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
});

export const updateActivitySchema = z.object({
  activityCode: z.string().optional(),
  responsibleId: z.string().optional(),
  directionId: z.string().optional().nullable(),
  primaryAxisId: z.string().optional().nullable(),
  secondaryAxisId: z.string().optional().nullable(),
  acbfDomainId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
  annualObjective: activityMediumTextField,
  title: z.string().min(1, "Le titre est requis").max(500, "Maximum 500 caractères").optional(),
  detailedTasks: activityTextField,
  expectedDeliverable: activityMediumTextField,
  validatorId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  performanceIndicator: activityShortTextField,
  verificationSource: activityShortTextField,
  status: z.enum(["Non démarré", "En cours", "Terminé", "Annulé"]).optional(),
  progressRate: z.number().min(0).max(100).optional(),
  riskDescription: activityMediumTextField,
  comments: activityTextField,
  // C3 fix: validationStatus removed from update — only changed via PATCH actions
  nature: z.string().max(200, "Maximum 200 caractères").optional().nullable(),
  dependency: activityShortTextField,
  duration: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

// C1 fix: PATCH action schema with proper Zod validation
export const activityActionSchema = z.object({
  action: z.enum(["archive", "restore", "submit", "validate", "reject"], {
    message: "Action invalide. Utilisez 'archive', 'restore', 'submit', 'validate' ou 'reject'",
  }),
});

// Frontend form schema (matches createActivitySchema but with client-friendly messages)
export const activityFormSchema = z.object({
  title: z.string().min(2, "Minimum 2 caractères").max(500, "Maximum 500 caractères"),
  responsibleId: z.string().min(1, "Le responsable est requis"),
  directionId: z.string().optional().nullable(),
  primaryAxisId: z.string().optional().nullable(),
  secondaryAxisId: z.string().optional().nullable(),
  acbfDomainId: z.string().optional().nullable(),
  acbfDeliverableId: z.string().optional().nullable(),
  annualObjective: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  detailedTasks: z.string().max(5000, "Maximum 5000 caractères").optional().nullable(),
  expectedDeliverable: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  validatorId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).default("Moyenne"),
  performanceIndicator: z.string().max(1000, "Maximum 1000 caractères").optional().nullable(),
  verificationSource: z.string().max(1000, "Maximum 1000 caractères").optional().nullable(),
  status: z.enum(["Non démarré", "En cours", "Terminé", "Annulé"]).default("Non démarré"),
  progressRate: z.number().min(0).max(100).default(0),
  riskDescription: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  comments: z.string().max(5000, "Maximum 5000 caractères").optional().nullable(),
  nature: z.string().max(200, "Maximum 200 caractères").optional().nullable(),
  dependency: z.string().max(1000, "Maximum 1000 caractères").optional().nullable(),
  duration: z.string().max(100, "Maximum 100 caractères").optional().nullable(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

// ─── PTA Consolide schemas (Module 6) ──────────────────────────────────────

export const activityStatusEnum = z.enum([
  "Non démarré",
  "En cours",
  "Réalisé",
  "En retard",
  "Suspendu",
  "À reprogrammer",
  "Terminé",
  "Annulé",
]);

export const ptaConsolideGroupBySchema = z.enum([
  "direction",
  "axis",
  "domain",
  "responsible",
  "priority",
  "status",
]);

export const ptaConsolideFilterSchema = z.object({
  search: z.string().optional(),
  directionId: z.string().optional(),
  primaryAxisId: z.string().optional(),
  secondaryAxisId: z.string().optional(),
  acbfDomainId: z.string().optional(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  validationStatus: z.enum(["Brouillon", "Soumis", "Validé", "Rejeté"]).optional(),
  activityStatus: activityStatusEnum.optional(),
  responsibleId: z.string().optional(),
  groupBy: ptaConsolideGroupBySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ptaConsolideExportSchema = z.object({
  format: z.enum(["csv", "json"]).default("json"),
  search: z.string().optional(),
  directionId: z.string().optional(),
  primaryAxisId: z.string().optional(),
  secondaryAxisId: z.string().optional(),
  acbfDomainId: z.string().optional(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  validationStatus: z.enum(["Brouillon", "Soumis", "Validé", "Rejeté"]).optional(),
  activityStatus: activityStatusEnum.optional(),
  responsibleId: z.string().optional(),
});

export type PtaConsolideFilterValues = z.infer<typeof ptaConsolideFilterSchema>;
export type PtaConsolideExportValues = z.infer<typeof ptaConsolideExportSchema>;

// ─── RACI Matrix schemas (Module 8) ──────────────────────────────────────

const raciTextField = z
  .string()
  .max(2000, "Maximum 2000 caractères")
  .optional()
  .nullable();

const raciShortTextField = z
  .string()
  .max(500, "Maximum 500 caractères")
  .optional()
  .nullable();

export const createRaciSchema = z.object({
  acbfDeliverableId: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  responsible: raciShortTextField,
  responsibleUserId: z.string().optional().nullable(),
  accountable: raciShortTextField,
  accountableUserId: z.string().optional().nullable(),
  contributors: raciTextField,
  informed: raciTextField,
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  indicativeDeadline: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  verificationSource: raciTextField,
  comments: raciTextField,
});

export const updateRaciSchema = z.object({
  acbfDeliverableId: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  responsible: raciShortTextField,
  responsibleUserId: z.string().optional().nullable(),
  accountable: raciShortTextField,
  accountableUserId: z.string().optional().nullable(),
  contributors: raciTextField,
  informed: raciTextField,
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  indicativeDeadline: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : val === null ? null : undefined)),
  verificationSource: raciTextField,
  comments: raciTextField,
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: "Au moins un champ doit être fourni pour la mise à jour",
});

export const raciActionSchema = z.object({
  action: z.enum(["archive", "restore"], {
    message: "Action invalide. Utilisez 'archive' ou 'restore'",
  }),
});

// Frontend form schema
export const raciFormSchema = z.object({
  acbfDeliverableId: z.string().optional().nullable(),
  activityId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  responsible: z.string().max(500, "Maximum 500 caractères").optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  accountable: z.string().max(500, "Maximum 500 caractères").optional().nullable(),
  accountableUserId: z.string().optional().nullable(),
  contributors: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  informed: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional().nullable(),
  indicativeDeadline: z.string().optional().nullable(),
  verificationSource: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
  comments: z.string().max(2000, "Maximum 2000 caractères").optional().nullable(),
});

export type RaciFormValues = z.infer<typeof raciFormSchema>;

// ─── Gantt schemas (Module 9 — Gantt dynamique) ──────────────────────────

export const ganttFilterSchema = z.object({
  search: z.string().optional(),
  directionId: z.string().optional(),
  primaryAxisId: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(["Haute", "Moyenne", "Basse"]).optional(),
  validationStatus: z.enum(["Brouillon", "Soumis", "Validé", "Rejeté"]).optional(),
  groupBy: z.enum(["none", "direction", "axis", "responsible", "status"]).optional(),
});

export type GanttFilterValues = z.infer<typeof ganttFilterSchema>;

// ============================================================
// KPI Validation Schemas (Module 10)
// ============================================================

/**
 * Schema for creating a new KPI definition
 */
export const createKpiFormSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional().nullable(),
  category: z.enum(["Stratégique", "Opérationnel", "Organisationnel", "Qualité"], {
    message: "Catégorie invalide. Utilisez Stratégique, Opérationnel, Organisationnel ou Qualité",
  }),
  targetValue: z.number().default(0),
  currentValue: z.number().default(0),
  unit: z.string().optional().nullable(),
  direction: z.enum(["higher", "lower"]).default("higher"),
  frequency: z.enum(["Quotidien", "Hebdomadaire", "Mensuel", "Trimestriel", "Annuel"]).default("Mensuel"),
  strategicAxisId: z.string().optional().nullable(),
  directionId: z.string().optional().nullable(),
  isPublic: z.boolean().default(true),
});

/**
 * Schema for updating an existing KPI definition
 */
export const updateKpiFormSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.enum(["Stratégique", "Opérationnel", "Organisationnel", "Qualité"]).optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional().nullable(),
  direction: z.enum(["higher", "lower"]).optional(),
  frequency: z.enum(["Quotidien", "Hebdomadaire", "Mensuel", "Trimestriel", "Annuel"]).optional(),
  strategicAxisId: z.string().optional().nullable(),
  directionId: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

/**
 * Schema for capturing a KPI snapshot
 * Includes period format validation (YYYY-MM or YYYY-QN)
 */
export const captureSnapshotFormSchema = z.object({
  value: z.number({ message: "La valeur est requise" }),
  targetValue: z.number().optional(),
  period: z.string().min(1, "La période est requise").regex(
    /^\d{4}(-\d{2}|-Q[1-4])?$/,
    "Format invalide (YYYY-MM ou YYYY-QN)"
  ),
  notes: z.string().optional().nullable(),
});

/**
 * Schema for filtering KPI definitions
 */
export const kpiFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  strategicAxisId: z.string().optional(),
  directionId: z.string().optional(),
  isActive: z.enum(["true", "false", "all"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// KPI Named Types (Module 10)
// ============================================================

export type CreateKpiFormValues = {
  code: string;
  name: string;
  description?: string | null;
  category: "Stratégique" | "Opérationnel" | "Organisationnel" | "Qualité";
  targetValue: number;
  currentValue: number;
  unit?: string | null;
  direction: "higher" | "lower";
  frequency: "Quotidien" | "Hebdomadaire" | "Mensuel" | "Trimestriel" | "Annuel";
  strategicAxisId?: string | null;
  directionId?: string | null;
  isPublic: boolean;
};

export type UpdateKpiFormValues = {
  code?: string;
  name?: string;
  description?: string | null;
  category?: "Stratégique" | "Opérationnel" | "Organisationnel" | "Qualité";
  targetValue?: number;
  currentValue?: number;
  unit?: string | null;
  direction?: "higher" | "lower";
  frequency?: "Quotidien" | "Hebdomadaire" | "Mensuel" | "Trimestriel" | "Annuel";
  strategicAxisId?: string | null;
  directionId?: string | null;
  isPublic?: boolean;
};

export type CaptureSnapshotFormValues = {
  value: number;
  targetValue?: number;
  period: string;
  notes?: string | null;
};

export type KpiFilterValues = {
  search?: string;
  category?: string;
  strategicAxisId?: string;
  directionId?: string;
  isActive?: "true" | "false" | "all";
  page: number;
  limit: number;
};

// ─── Report Template schemas (Module 11 — Reporting automatique) ───────────

const validJsonRefine = (fieldLabel: string) =>
  z.string().optional().nullable().refine(
    (val) => {
      if (!val) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: `Le champ ${fieldLabel} doit être un JSON valide` }
  );

export const createReportTemplateSchema = z.object({
  code: z.string().min(1, "Le code est requis"),
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional().nullable(),
  type: z.enum(
    [
      "Mensuel",
      "Trimestriel",
      "Annuel",
      "ACBF",
      "Par axe",
      "Par direction",
      "Personnalisé",
    ],
    {
      message:
        "Type invalide. Utilisez Mensuel, Trimestriel, Annuel, ACBF, Par axe, Par direction ou Personnalisé",
    }
  ),
  category: z.enum(
    ["Général", "Stratégique", "Opérationnel", "ACBF", "Finance"],
    {
      message:
        "Catégorie invalide. Utilisez Général, Stratégique, Opérationnel, ACBF ou Finance",
    }
  ),
  periodFormat: z
    .enum(["YYYY-MM", "YYYY-QN", "YYYY", "custom"])
    .default("YYYY-MM"),
  sections: validJsonRefine("sections"),
  filters: validJsonRefine("filtres"),
});

export const updateReportTemplateSchema = z.object({
  code: z.string().min(1, "Le code est requis").optional(),
  name: z.string().min(1, "Le nom est requis").optional(),
  description: z.string().optional().nullable(),
  type: z
    .enum([
      "Mensuel",
      "Trimestriel",
      "Annuel",
      "ACBF",
      "Par axe",
      "Par direction",
      "Personnalisé",
    ])
    .optional(),
  category: z
    .enum(["Général", "Stratégique", "Opérationnel", "ACBF", "Finance"])
    .optional(),
  periodFormat: z.enum(["YYYY-MM", "YYYY-QN", "YYYY", "custom"]).optional(),
  sections: validJsonRefine("sections"),
  filters: validJsonRefine("filtres"),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "Au moins un champ doit être modifié" }
);

export const reportFilterSchema = z.object({
  tab: z.enum(["templates", "reports"]).default("templates"),
  search: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  directionId: z.string().optional(),
  strategicAxisId: z.string().optional(),
  acbfDomainId: z.string().optional(),
  period: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// E3 fix: Remove action field from generateReportSchema — action is validated separately
export const generateReportSchema = z.object({
  period: z.string().min(1, "La période est requise"),
  directionId: z.string().optional().nullable(),
  strategicAxisId: z.string().optional().nullable(),
  acbfDomainId: z.string().optional().nullable(),
});

export const reportActionSchema = z.object({
  action: z.enum(["validate", "reject", "archive", "restore", "template-archive", "template-restore"], {
    message:
      "Action invalide. Utilisez 'validate', 'reject', 'archive', 'restore', 'template-archive' ou 'template-restore'",
  }),
});

export type CreateReportTemplateValues = z.infer<typeof createReportTemplateSchema>;
export type UpdateReportTemplateValues = z.infer<typeof updateReportTemplateSchema>;
export type ReportFilterValues = z.infer<typeof reportFilterSchema>;
export type GenerateReportValues = z.infer<typeof generateReportSchema>;
export type ReportActionValues = z.infer<typeof reportActionSchema>;
