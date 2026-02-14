/**
 * Hook for offline RBAC enforcement.
 * Returns the user's role and module permissions from cached data.
 * Works both online (from AsyncStorage) and offline (from auth_cache via AsyncStorage).
 */

import { useMemo } from 'react';
import { useCurrentUser } from './useCurrentUser';

type Role = 'SUPERADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'EMPLOYEE' | 'ADMIN';

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPERADMIN: 6,
  ADMIN: 5,
  OWNER: 4,
  MANAGER: 3,
  CASHIER: 2,
  EMPLOYEE: 1,
};

interface UseOfflinePermissionsResult {
  role: Role | null;
  enabledModules: string[];
  /** Check if the user has at least the given role level */
  hasRole: (minimumRole: Role) => boolean;
  /** Check if a module is enabled for the shop (empty array = all allowed) */
  hasModule: (moduleName: string) => boolean;
  /** Check if user can perform a specific action based on role */
  canManage: boolean;
  canAdmin: boolean;
  loading: boolean;
}

export function useOfflinePermissions(): UseOfflinePermissionsResult {
  const { user, shop, loading } = useCurrentUser();

  const role = (user?.role as Role) ?? null;
  const enabledModules: string[] = useMemo(() => {
    if (!shop) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (shop as any).enabled_modules ?? [];
  }, [shop]);

  const hasRole = useMemo(() => {
    return (minimumRole: Role): boolean => {
      if (!role) return false;
      return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimumRole] ?? 99);
    };
  }, [role]);

  const hasModule = useMemo(() => {
    return (moduleName: string): boolean => {
      // Empty array means all modules allowed (backwards compat)
      if (enabledModules.length === 0) return true;
      return enabledModules.includes(moduleName);
    };
  }, [enabledModules]);

  return {
    role,
    enabledModules,
    hasRole,
    hasModule,
    canManage: hasRole('MANAGER'),
    canAdmin: hasRole('OWNER'),
    loading,
  };
}
