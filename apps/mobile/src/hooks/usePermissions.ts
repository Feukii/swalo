/**
 * Hook de gating des permissions fines (module × capacité), offline-first.
 *
 * Source de vérité : matrice effective `permissions` renvoyée par `/auth/me`
 * et mise en cache dans AsyncStorage (clé 'permissions'). Si le cache est absent
 * (premier lancement, login PIN qui ne renvoie pas encore la matrice, etc.),
 * on retombe sur `resolveEffectivePermissions(role)` (défauts par rôle) afin de
 * rester cohérent hors-ligne.
 *
 * SUPERADMIN / BOSS sont toujours permissifs (cohérent avec le modèle partagé).
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  can as canCore,
  resolveEffectivePermissions,
  type Capability,
  type PermissionModule,
  type Role as PermissionRole,
} from '@swalo/core/modules/permissions';
import { useCurrentUser } from './useCurrentUser';

type EffectivePermissions = Record<PermissionModule, Capability[]>;

// Rôles applicatifs réels (cf. roles-enum-correction). OWNER/ADMIN/CASHIER sont
// gardés comme alias de compat ascendante et mappés vers les rôles de la matrice.
const ROLE_MAP: Record<string, PermissionRole> = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'BOSS',
  BOSS: 'BOSS',
  OWNER: 'BOSS',
  MANAGER: 'MANAGER',
  CASHIER: 'EMPLOYEE',
  EMPLOYEE: 'EMPLOYEE',
};

function toPermissionRole(role: string | null | undefined): PermissionRole {
  if (!role) return 'EMPLOYEE';
  return ROLE_MAP[role] ?? 'EMPLOYEE';
}

interface UsePermissionsResult {
  /** Vérifie une capacité sur un module depuis la matrice effective. */
  can: (module: string, capability: Capability) => boolean;
  /** Vrai tant que le cache/role n'est pas chargé. */
  loading: boolean;
  /** Rôle applicatif courant (brut, ex: 'BOSS'). */
  role: string | null;
}

export function usePermissions(): UsePermissionsResult {
  const { user, loading: userLoading } = useCurrentUser();
  const role = user?.role ?? null;

  const [cached, setCached] = useState<EffectivePermissions | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('permissions');
        if (active) {
          setCached(raw ? (JSON.parse(raw) as EffectivePermissions) : null);
        }
      } catch {
        // Cache illisible : on retombera sur les défauts par rôle.
        if (active) setCached(null);
      } finally {
        if (active) setCacheLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const permissionRole = toPermissionRole(role);
  const permissive = permissionRole === 'SUPERADMIN' || permissionRole === 'BOSS';

  // Matrice effective : cache si présent, sinon défauts par rôle (offline-first).
  const effective: EffectivePermissions = cached ?? resolveEffectivePermissions(permissionRole);

  const can = (module: string, capability: Capability): boolean => {
    if (permissive) return true;
    return canCore(effective, module, capability);
  };

  return {
    can,
    loading: userLoading || cacheLoading,
    role,
  };
}
