import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Modules — Activation par niveau de licence
// Le catalogue de modules (CORE / EXTENDED / PREMIUM) et le tier de licence
// minimum requis par module proviennent de adminApi.getLicenseConfig().
// L'édition porte sur le tier minimum de chaque module (PUT /admin/license-config,
// via adminApi.updateLicenseConfig) — la seule action d'activation réellement
// exposée par l'API au niveau catalogue.
//
// La sélection d'une entreprise et d'un plan permet de PRÉVISUALISER les modules
// disponibles pour ce plan (lecture seule, calculée depuis les tiers retournés
// par l'API). Le tableau « Licences par entreprise » est câblé aux données
// réelles de adminApi.getAllEnterprises(). Aucune donnée n'est inventée.
// ---------------------------------------------------------------------------

interface ModuleInfo {
  code: string;
  name: string;
  description: string;
  tier: 'CORE' | 'EXTENDED' | 'PREMIUM';
  minimumLicenseTier: string;
  dependencies: string[];
  overridden: boolean;
}

interface TierSummary {
  modules: string[];
  count: number;
}

interface LicenseConfigData {
  modules: ModuleInfo[];
  tiers: Record<string, TierSummary>;
}

interface Enterprise {
  id: string;
  code: string;
  name: string;
  license_tier: string;
  monthly_price?: number | null;
  _count?: { shops: number };
}

const TIER_OPTIONS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
type Tier = (typeof TIER_OPTIONS)[number];

const TIER_ORDER: Record<string, number> = { STARTER: 0, PROFESSIONAL: 1, ENTERPRISE: 2 };

const TIER_SHORT: Record<string, string> = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
};

const MODULE_TIER_LABEL: Record<string, string> = {
  CORE: 'Cœur',
  EXTENDED: 'Étendu',
  PREMIUM: 'Premium',
};

const MODULE_TIER_BADGE: Record<string, string> = {
  CORE: 'text-success-600',
  EXTENDED: 'text-action-600',
  PREMIUM: 'text-warning-600',
};

const PLAN_LABEL: Record<Tier, string> = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
};

function formatFcfaCompact(value: number): string {
  if (value <= 0) return '—';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = Math.round(millions * 100) / 100;
    return `${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M F`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)} K F`;
  return `${value} F`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function resolveError(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message ===
      'string'
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return fallback;
}

export default function AdminModules() {
  const [config, setConfig] = useState<LicenseConfigData | null>(null);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<Tier>('ENTERPRISE');

  // Tier minimum édité par module (override catalogue).
  const [editedTiers, setEditedTiers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [cfg, ents] = await Promise.all([
        adminApi.getLicenseConfig() as Promise<LicenseConfigData>,
        adminApi.getAllEnterprises() as Promise<Enterprise[]>,
      ]);
      setConfig(cfg);
      const tiers: Record<string, string> = {};
      for (const m of cfg.modules) tiers[m.code] = m.minimumLicenseTier;
      setEditedTiers(tiers);

      const list = Array.isArray(ents) ? ents : [];
      setEnterprises(list);
      if (list.length > 0) {
        setSelectedEnterpriseId(list[0].id);
        setSelectedPlan(
          (TIER_OPTIONS as readonly string[]).includes(list[0].license_tier)
            ? (list[0].license_tier as Tier)
            : 'ENTERPRISE'
        );
      }
    } catch (err) {
      setError(resolveError(err, 'Erreur lors du chargement des modules'));
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = useMemo(() => {
    if (!config) return false;
    return config.modules.some(
      m => (editedTiers[m.code] ?? m.minimumLicenseTier) !== m.minimumLicenseTier
    );
  }, [config, editedTiers]);

  // Un module est « actif » pour le plan sélectionné si son tier minimum (édité)
  // est <= au plan choisi.
  const isModuleActiveForPlan = (m: ModuleInfo): boolean => {
    const minTier = editedTiers[m.code] ?? m.minimumLicenseTier;
    return TIER_ORDER[minTier] <= TIER_ORDER[selectedPlan];
  };

  const activeCount = useMemo(() => {
    if (!config) return 0;
    return config.modules.filter(
      m => TIER_ORDER[editedTiers[m.code] ?? m.minimumLicenseTier] <= TIER_ORDER[selectedPlan]
    ).length;
  }, [config, editedTiers, selectedPlan]);

  // Toggle d'un module = (dé)place son tier minimum sous/au-dessus du plan choisi.
  // CORE reste STARTER (toujours actif). On ne peut pas désactiver un module CORE.
  const toggleModule = (m: ModuleInfo) => {
    if (m.tier === 'CORE') return;
    const active = isModuleActiveForPlan(m);
    setEditedTiers(prev => {
      if (active) {
        // Désactiver pour ce plan : remonter le tier minimum juste au-dessus.
        const nextLevel = TIER_ORDER[selectedPlan] + 1;
        const target = TIER_OPTIONS.find(t => TIER_ORDER[t] === nextLevel);
        if (!target) return prev; // déjà au plus haut tier, impossible de monter plus haut
        return { ...prev, [m.code]: target };
      }
      // Activer pour ce plan : abaisser le tier minimum au niveau du plan choisi.
      return { ...prev, [m.code]: selectedPlan };
    });
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const overrides = config.modules.map(m => ({
        code: m.code,
        minimumLicenseTier: editedTiers[m.code] ?? m.minimumLicenseTier,
      }));
      const result = (await adminApi.updateLicenseConfig(overrides)) as { shops_updated?: number };
      const updated = result?.shops_updated ?? 0;
      setSuccess(`Configuration enregistrée. ${updated} boutique(s) mise(s) à jour.`);
      await loadAll();
    } catch (err) {
      setError(resolveError(err, "Erreur lors de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!config) return;
    const tiers: Record<string, string> = {};
    for (const m of config.modules) tiers[m.code] = m.minimumLicenseTier;
    setEditedTiers(tiers);
  };

  // Coût mensuel estimé = prix réel de l'entreprise sélectionnée (si défini).
  const selectedEnterprise = enterprises.find(e => e.id === selectedEnterpriseId) ?? null;
  const estimatedCost =
    selectedPlan === 'ENTERPRISE'
      ? 'Sur devis'
      : selectedEnterprise && (selectedEnterprise.monthly_price ?? 0) > 0
        ? formatFcfaCompact(selectedEnterprise.monthly_price ?? 0)
        : '—';

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-card" />
        <div className="h-96 animate-pulse rounded-2xl bg-white shadow-card" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
        Impossible de charger le catalogue de modules.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Modules</h1>
        <p className="text-sm text-slate-500 mt-0.5">Activation par niveau de licence</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {success}
        </div>
      )}

      {/* Affecter / amender une licence */}
      <div className="rounded-2xl bg-white shadow-card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-primary-900">
            Affecter / amender une licence
          </h2>
        </div>

        <div className="space-y-6 p-6">
          {/* Sélecteurs entreprise + boutique */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Entreprise
              </label>
              <select
                value={selectedEnterpriseId}
                onChange={ev => {
                  setSelectedEnterpriseId(ev.target.value);
                  const ent = enterprises.find(e => e.id === ev.target.value);
                  if (ent && (TIER_OPTIONS as readonly string[]).includes(ent.license_tier)) {
                    setSelectedPlan(ent.license_tier as Tier);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-action-500 focus:ring-2 focus:ring-action-500"
              >
                {enterprises.length === 0 && <option value="">Aucune entreprise</option>}
                {enterprises.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Boutique (optionnel)
              </label>
              <select
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400"
                title="La sélection par boutique n'est pas encore disponible côté API"
              >
                <option>Toutes les boutiques</option>
              </select>
            </div>
          </div>

          {/* Plan de licence (cartes radio) */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Plan de licence
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {TIER_OPTIONS.map(tier => {
                const selected = selectedPlan === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSelectedPlan(tier)}
                    className={`flex items-start justify-between rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? 'border-action-400 bg-action-50 ring-1 ring-action-400'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary-900">{PLAN_LABEL[tier]}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {tier === 'ENTERPRISE' ? 'Sur devis' : '—'}
                      </p>
                    </div>
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected ? 'border-action-500' : 'border-slate-300'
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-action-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grille de modules */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Modules
              </p>
              <p className="text-xs font-medium text-action-600">
                {activeCount} / {config.modules.length} actifs
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {config.modules.map(m => {
                const active = isModuleActiveForPlan(m);
                const isCore = m.tier === 'CORE';
                return (
                  <div
                    key={m.code}
                    className={`flex items-center justify-between rounded-xl border p-3.5 ${
                      active ? 'border-slate-200 bg-success-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-primary-900">{m.name}</p>
                      <p className={`mt-0.5 text-xs font-medium ${MODULE_TIER_BADGE[m.tier]}`}>
                        {MODULE_TIER_LABEL[m.tier]}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={`${active ? 'Désactiver' : 'Activer'} ${m.name}`}
                      disabled={isCore}
                      onClick={() => toggleModule(m)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        active ? 'bg-success-500' : 'bg-slate-300'
                      } ${isCore ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                      title={isCore ? 'Module cœur — toujours actif' : undefined}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          active ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coût + actions */}
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-xs text-slate-400">Coût mensuel estimé</p>
              <p className="text-lg font-bold text-primary-900">{estimatedCost}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="rounded-lg bg-action-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-action-600 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Licences par entreprise (lecture seule, données réelles) */}
      <div className="rounded-2xl bg-white shadow-card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-primary-900">Licences par entreprise</h2>
        </div>
        {enterprises.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Aucune entreprise</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Entreprise</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3 text-right">Prix / mois</th>
                  <th className="px-6 py-3 text-center">Modules</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enterprises.map(e => {
                  const tier = (TIER_OPTIONS as readonly string[]).includes(e.license_tier)
                    ? (e.license_tier as Tier)
                    : null;
                  const moduleCount = tier ? (config.tiers[tier]?.count ?? 0) : 0;
                  return (
                    <tr key={e.id} className="text-sm">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action-50 text-[11px] font-semibold text-action-600">
                            {initials(e.name)}
                          </span>
                          <span className="font-medium text-primary-900">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            e.license_tier === 'PROFESSIONAL'
                              ? 'bg-action-50 text-action-600'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {TIER_SHORT[e.license_tier] ?? e.license_tier}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-primary-900">
                        {formatFcfaCompact(e.monthly_price ?? 0)}
                      </td>
                      <td className="px-6 py-3 text-center text-slate-600">{moduleCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
