import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type RoleCode = 
  | "ADMIN" 
  | "DIRECTEUR" 
  | "MEAL" 
  | "VALIDATEUR" 
  | "RESPONSABLE" 
  | "LECTEUR";

export type PermissionCode = string;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  ptaCode?: string | null;
  position?: string | null;
  department?: string | null;
  roles: Array<{
    id: string;
    code: RoleCode;
    name: string;
    permissions: PermissionCode[];
  }>;
}

/**
 * Récupère la session utilisateur courante côté serveur
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as unknown as AuthUser;
}

/**
 * Vérifie si un utilisateur a une permission spécifique.
 * La permission "admin:*" override toutes les autres permissions.
 * Si un requiredPermission est "users:read", alors "users:*" et "admin:*" sont aussi acceptés.
 */
export function userHasPermission(
  user: AuthUser,
  requiredPermission: string
): boolean {
  return user.roles.some((r) =>
    r.permissions.some((p) => {
      // admin:* overrides everything
      if (p === "admin:*") return true;
      // Exact match
      if (p === requiredPermission) return true;
      // Module wildcard: "users:*" matches "users:read", "users:create", etc.
      const permModule = requiredPermission.split(":")[0];
      if (p === `${permModule}:*`) return true;
      return false;
    })
  );
}

/**
 * Vérifie si l'utilisateur a au moins une des permissions spécifiées.
 * "admin:*" override tout.
 */
export function userHasAnyPermission(
  user: AuthUser,
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((perm) => userHasPermission(user, perm));
}

/**
 * Vérifie si l'utilisateur courant a un rôle spécifique
 */
export async function hasRole(roleCode: RoleCode): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.roles.some((r) => r.code === roleCode);
}

/**
 * Vérifie si l'utilisateur courant a une permission spécifique
 */
export async function hasPermission(permissionCode: PermissionCode): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return userHasPermission(user, permissionCode);
}

/**
 * Vérifie si l'utilisateur courant a au moins une des permissions spécifiées
 */
export async function hasAnyPermission(permissionCodes: PermissionCode[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return userHasAnyPermission(user, permissionCodes);
}

/**
 * Vérifie si l'utilisateur est administrateur
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole("ADMIN");
}

/**
 * Récupère toutes les permissions de l'utilisateur courant
 */
export async function getUserPermissions(): Promise<PermissionCode[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const permissions = new Set<PermissionCode>();
  user.roles.forEach((r) => r.permissions.forEach((p) => permissions.add(p)));
  return Array.from(permissions);
}
