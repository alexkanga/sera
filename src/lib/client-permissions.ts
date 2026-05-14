"use client";

import { useSession } from "next-auth/react";

/**
 * Client-side permission checking hook.
 * Uses the same algorithm as the backend userHasPermission():
 * - "admin:*" overrides everything
 * - Module wildcard "xxx:*" matches any "xxx:action"
 * - Exact match
 */
export function useHasPermission() {
  const { data: session } = useSession();

  const allPermissions: string[] = [];
  if (session?.user?.roles) {
    for (const role of session.user.roles) {
      for (const perm of role.permissions) {
        allPermissions.push(perm);
      }
    }
  }

  /**
   * Check if the current user has a specific permission.
   * Follows the same logic as backend userHasPermission():
   * - admin:* overrides everything
   * - module:* matches module:action
   * - exact match
   */
  const has = (requiredPermission: string): boolean => {
    return allPermissions.some((p) => {
      // admin:* overrides everything
      if (p === "admin:*") return true;
      // Exact match
      if (p === requiredPermission) return true;
      // Module wildcard: "users:*" matches "users:read", "users:create", etc.
      const permModule = requiredPermission.split(":")[0];
      if (p === `${permModule}:*`) return true;
      return false;
    });
  };

  return { has, allPermissions, isAuthenticated: !!session?.user };
}

/**
 * Non-hook version for use in components that already have the roles array.
 * Same algorithm as backend userHasPermission().
 */
export function checkPermission(
  roles: Array<{ permissions: string[] }>,
  requiredPermission: string
): boolean {
  return roles.some((r) =>
    r.permissions.some((p) => {
      if (p === "admin:*") return true;
      if (p === requiredPermission) return true;
      const permModule = requiredPermission.split(":")[0];
      if (p === `${permModule}:*`) return true;
      return false;
    })
  );
}
