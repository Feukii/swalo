import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  can as canCapability,
  resolveEffectivePermissions,
  type Capability,
  type PermissionModule,
  type Role,
} from '@swalo/core/modules/permissions';

const KNOWN_ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'BOSS', 'SUPERADMIN'];

function toRole(role: string | null): Role | null {
  return role && (KNOWN_ROLES as string[]).includes(role) ? (role as Role) : null;
}

/**
 * Gating frontend des permissions fines.
 * Lit la matrice effective renvoyée par /auth/me (store `permissions`) et le rôle.
 * - SUPERADMIN / BOSS : accès permissif (toutes capacités).
 * - Sinon : on s'appuie sur la matrice effective ; à défaut, on résout les
 *   défauts du rôle via `resolveEffectivePermissions(role)`.
 */
export function usePermissions() {
  const { permissions, role } = useAuthStore();
  const resolvedRole = toRole(role);

  // Matrice effective : celle du store si présente, sinon défauts du rôle.
  const effective = useMemo<Record<PermissionModule, Capability[]> | null>(() => {
    if (permissions) return permissions;
    if (resolvedRole) return resolveEffectivePermissions(resolvedRole);
    return null;
  }, [permissions, resolvedRole]);

  const isPermissive = resolvedRole === 'SUPERADMIN' || resolvedRole === 'BOSS';

  const can = (module: PermissionModule | string, capability: Capability): boolean => {
    if (isPermissive) return true;
    return canCapability(effective ?? undefined, module, capability);
  };

  return { can, permissions: effective, role: resolvedRole, isPermissive };
}
