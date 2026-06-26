// Swalo — Modèle de permissions fines (module × rôle × capacités).
// Source de vérité partagée API / web-admin / web / mobile.
// SUPERADMIN contourne toujours. La config (PermissionMatrix) est stockée par
// boutique (Shop.module_permissions) avec un défaut d'entreprise
// (Enterprise.default_module_permissions) ; sinon DEFAULT_PERMISSIONS s'applique.

export type Role = 'EMPLOYEE' | 'MANAGER' | 'BOSS' | 'SUPERADMIN';

export type Capability = 'view' | 'create' | 'edit' | 'delete' | 'refund' | 'validate' | 'export';

// Rôles configurables dans la matrice (SUPERADMIN n'y figure pas : accès total).
export const CONFIGURABLE_ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'BOSS'];

// Modules apparaissant dans la matrice de permissions (modules opérationnels).
export const PERMISSION_MODULES = [
  'products',
  'customers',
  'sales',
  'cash',
  'inventory',
  'suppliers',
  'receivables',
  'debts',
  'reports',
  'transfers',
  'invoices',
  'packaging-types',
  'notifications',
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

// Capacités disponibles par module (ce qui peut être coché).
export const MODULE_CAPABILITIES: Record<PermissionModule, Capability[]> = {
  products: ['view', 'create', 'edit', 'delete'],
  customers: ['view', 'create', 'edit', 'delete'],
  sales: ['view', 'create', 'refund'],
  cash: ['view', 'create', 'validate'],
  inventory: ['view', 'create', 'edit'],
  suppliers: ['view', 'create', 'edit', 'delete'],
  receivables: ['view', 'create', 'edit', 'refund'],
  debts: ['view', 'create', 'edit'],
  reports: ['view', 'export'],
  transfers: ['view', 'create', 'validate'],
  invoices: ['view', 'create', 'export'],
  'packaging-types': ['view', 'create', 'edit', 'delete'],
  notifications: ['view', 'edit'],
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  view: 'Voir',
  create: 'Créer',
  edit: 'Modifier',
  delete: 'Supprimer',
  refund: 'Rembourser',
  validate: 'Valider',
  export: 'Exporter',
};

// Matrice stockée (partielle) : module -> rôle -> capacités.
export type PermissionMatrix = Partial<
  Record<PermissionModule, Partial<Record<Role, Capability[]>>>
>;

// Capacités par défaut pour un rôle/module si rien n'est configuré.
export function defaultCapabilities(role: Role, module: PermissionModule): Capability[] {
  const all = MODULE_CAPABILITIES[module] ?? [];
  if (role === 'SUPERADMIN' || role === 'BOSS') return [...all];
  if (role === 'MANAGER') return all.filter(c => c !== 'delete');
  // EMPLOYEE : lecture + création de base, pas de modif/suppression/spéciales
  return all.filter(c => c === 'view' || c === 'create');
}

// Matrice de défauts complète (utile pour pré-remplir l'UI).
export function buildDefaultMatrix(): Record<Role, Record<PermissionModule, Capability[]>> {
  const out = {} as Record<Role, Record<PermissionModule, Capability[]>>;
  for (const role of ['EMPLOYEE', 'MANAGER', 'BOSS'] as Role[]) {
    out[role] = {} as Record<PermissionModule, Capability[]>;
    for (const m of PERMISSION_MODULES) out[role][m] = defaultCapabilities(role, m);
  }
  return out;
}

function isPermissionModule(m: string): m is PermissionModule {
  return (PERMISSION_MODULES as readonly string[]).includes(m);
}

// Lit une matrice stockée (JSON non typé) de façon sûre.
function readMatrix(raw: unknown): PermissionMatrix {
  if (!raw || typeof raw !== 'object') return {};
  return raw as PermissionMatrix;
}

/**
 * Permissions effectives d'un rôle pour une boutique :
 * config boutique > défaut entreprise > défaut intégré.
 * Renvoie, par module, la liste des capacités autorisées.
 */
export function resolveEffectivePermissions(
  role: Role,
  shopConfig?: unknown,
  enterpriseDefault?: unknown
): Record<PermissionModule, Capability[]> {
  const result = {} as Record<PermissionModule, Capability[]>;
  if (role === 'SUPERADMIN') {
    for (const m of PERMISSION_MODULES) result[m] = [...MODULE_CAPABILITIES[m]];
    return result;
  }
  const shop = readMatrix(shopConfig);
  const ent = readMatrix(enterpriseDefault);
  for (const m of PERMISSION_MODULES) {
    const fromShop = shop[m]?.[role];
    const fromEnt = ent[m]?.[role];
    const caps = fromShop ?? fromEnt ?? defaultCapabilities(role, m);
    // Filtre sur les capacités réellement disponibles du module
    result[m] = caps.filter(c => MODULE_CAPABILITIES[m].includes(c));
  }
  return result;
}

/** Vérifie une capacité depuis des permissions effectives résolues. */
export function can(
  effective: Record<PermissionModule, Capability[]> | undefined,
  module: string,
  capability: Capability
): boolean {
  if (!effective || !isPermissionModule(module)) return false;
  return (effective[module] ?? []).includes(capability);
}
