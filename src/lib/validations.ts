import { z } from "zod";

/**
 * Centralized validation schemas for Module 1 (Auth & User Management).
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
});
