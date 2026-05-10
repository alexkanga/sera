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
  return user.roles.some((r) => r.permissions.includes(permissionCode));
}

/**
 * Vérifie si l'utilisateur courant a au moins une des permissions spécifiées
 */
export async function hasAnyPermission(permissionCodes: PermissionCode[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.roles.some((r) => 
    r.permissions.some((p) => permissionCodes.includes(p))
  );
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
