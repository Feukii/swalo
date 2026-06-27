export type ModuleTier = 'CORE' | 'EXTENDED' | 'PREMIUM';
export type LicenseTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface ModuleDefinition {
  code: string;
  name: string;
  description: string;
  tier: ModuleTier;
  minimumLicenseTier: LicenseTier;
  syncableEntities: string[];
  dependencies: string[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // CORE modules (toujours actifs)
  {
    code: 'auth',
    name: 'Authentification',
    description: 'Connexion, gestion de session, PIN et JWT',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['users', 'user_roles'],
    dependencies: [],
  },
  {
    code: 'products',
    name: 'Catalogue Produits',
    description: 'Gestion des produits, catégories, familles',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['products', 'stock_batches'],
    dependencies: [],
  },
  {
    code: 'customers',
    name: 'Gestion Clients',
    description: 'Fiche client, coordonnées, historique',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['customers'],
    dependencies: [],
  },
  {
    code: 'sales',
    name: 'Transactions de Vente',
    description: 'Ventes, panier, facturation rapide',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['sales', 'sale_items'],
    dependencies: ['products', 'customers'],
  },
  {
    code: 'cash',
    name: 'Gestion de Caisse',
    description: 'Entrées/sorties de caisse, sessions',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['cash_entries', 'cash_sessions'],
    dependencies: [],
  },
  {
    code: 'inventory',
    name: 'Suivi de Stock',
    description: 'Mouvements de stock, inventaires, alertes',
    tier: 'CORE',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['inventory_movements'],
    dependencies: ['products'],
  },

  // EXTENDED modules
  {
    code: 'suppliers',
    name: 'Gestion Fournisseurs',
    description: 'Fiche fournisseur, coordonnées, historique',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['suppliers'],
    dependencies: [],
  },
  {
    code: 'payments',
    name: 'Traitement Paiements',
    description: 'Paiements multi-méthodes, suivi',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['payments'],
    dependencies: ['sales'],
  },
  {
    code: 'receivables',
    name: 'Créances Clients',
    description: 'Gestion des créances, paiements partiels, limites de crédit',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['client_receivables', 'client_receivable_payments'],
    dependencies: ['customers'],
  },
  {
    code: 'debts',
    name: 'Dettes Fournisseurs',
    description: "Gestion des dettes, paiements partiels, limites d'emprunt",
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: ['supplier_debts', 'supplier_debt_payments'],
    dependencies: ['suppliers'],
  },
  {
    code: 'admin',
    name: 'Gestion Utilisateurs',
    description: 'Rôles, permissions, appareils, PIN invites',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: [],
    dependencies: ['auth'],
  },
  {
    code: 'reports',
    name: 'KPIs et Analytiques',
    description: 'Rapports de vente, tableaux de bord, statistiques',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: [],
    dependencies: ['sales', 'cash'],
  },
  {
    code: 'supervision',
    name: 'Supervision',
    description: 'Journal des actions anormales, alertes et acquittements',
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: [],
    dependencies: ['sales', 'cash'],
  },
  {
    code: 'pin-invites',
    name: 'Invitations PIN',
    description: "Création de codes d'accès PIN pour les employés",
    tier: 'EXTENDED',
    minimumLicenseTier: 'STARTER',
    syncableEntities: [],
    dependencies: ['auth'],
  },

  // PREMIUM modules
  {
    code: 'enterprise',
    name: 'Multi-boutique',
    description: "Gestion d'entreprise, multi-boutiques, consolidation",
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['admin'],
  },
  {
    code: 'transfers',
    name: 'Transferts Inter-boutiques',
    description: 'Transfert de stock entre boutiques',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['enterprise', 'inventory'],
  },
  {
    code: 'invoices',
    name: 'Facturation Formelle',
    description: 'Factures clients et fournisseurs, PDF',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: ['invoices', 'invoice_items'],
    dependencies: ['sales', 'customers'],
  },
  {
    code: 'notifications',
    name: 'Notifications Email',
    description: 'Récapitulatifs mensuels, alertes par email',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['customers'],
  },
  {
    code: 'import',
    name: 'Import Bulk',
    description: 'Import de catalogues depuis Excel/CSV',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['products'],
  },
  {
    code: 'packaging-types',
    name: 'Conditionnements Avancés',
    description: 'Unités de conditionnement personnalisées',
    tier: 'PREMIUM',
    minimumLicenseTier: 'ENTERPRISE',
    syncableEntities: ['packaging_types'],
    dependencies: ['products'],
  },
  {
    code: 'accounting',
    name: 'Comptabilité',
    description: 'Bilan, compte de résultat et journal comptable',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['sales', 'cash'],
  },
  {
    code: 'relances',
    name: 'Relances Clients',
    description: 'Tâches de relance et suivi des créances clients',
    tier: 'PREMIUM',
    minimumLicenseTier: 'PROFESSIONAL',
    syncableEntities: [],
    dependencies: ['customers'],
  },
];

export function getModuleDefinition(code: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find(m => m.code === code);
}

export function getModulesByTier(tier: ModuleTier): ModuleDefinition[] {
  return MODULE_DEFINITIONS.filter(m => m.tier === tier);
}

export function getCoreModules(): ModuleDefinition[] {
  return getModulesByTier('CORE');
}

export function validateModuleDependencies(enabledModules: string[]): {
  valid: boolean;
  missingDependencies: { module: string; missing: string[] }[];
} {
  const missingDependencies: { module: string; missing: string[] }[] = [];

  for (const moduleCode of enabledModules) {
    const definition = getModuleDefinition(moduleCode);
    if (!definition) continue;

    const missing = definition.dependencies.filter(dep => !enabledModules.includes(dep));
    if (missing.length > 0) {
      missingDependencies.push({ module: moduleCode, missing });
    }
  }

  return {
    valid: missingDependencies.length === 0,
    missingDependencies,
  };
}

export function getDefaultModules(): string[] {
  return getCoreModules().map(m => m.code);
}

export function getAllModuleCodes(): string[] {
  return MODULE_DEFINITIONS.map(m => m.code);
}

const LICENSE_TIER_ORDER: Record<LicenseTier, number> = {
  STARTER: 0,
  PROFESSIONAL: 1,
  ENTERPRISE: 2,
};

export function getAvailableModulesForLicense(licenseTier: LicenseTier): ModuleDefinition[] {
  const tierLevel = LICENSE_TIER_ORDER[licenseTier];
  return MODULE_DEFINITIONS.filter(m => LICENSE_TIER_ORDER[m.minimumLicenseTier] <= tierLevel);
}
