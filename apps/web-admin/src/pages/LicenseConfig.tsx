import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';

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

const TIER_OPTIONS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;

const TIER_LABELS: Record<string, string> = {
  CORE: 'Coeur',
  EXTENDED: 'Etendu',
  PREMIUM: 'Premium',
};

const TIER_BADGE_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-100 text-gray-800',
  PROFESSIONAL: 'bg-blue-100 text-blue-800',
  ENTERPRISE: 'bg-purple-100 text-purple-800',
};

const MODULE_TIER_COLORS: Record<string, string> = {
  CORE: 'bg-green-50 border-green-200',
  EXTENDED: 'bg-yellow-50 border-yellow-200',
  PREMIUM: 'bg-purple-50 border-purple-200',
};

export default function LicenseConfig() {
  const [config, setConfig] = useState<LicenseConfigData | null>(null);
  const [editedTiers, setEditedTiers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
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

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getLicenseConfig();
      setConfig(data);
      // Initialize edited tiers from current config
      const tiers: Record<string, string> = {};
      for (const m of data.modules) {
        tiers[m.code] = m.minimumLicenseTier;
      }
      setEditedTiers(tiers);
      setHasChanges(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (code: string, newTier: string) => {
    setEditedTiers(prev => ({ ...prev, [code]: newTier }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      setError(null);
      const overrides = config.modules.map(m => ({
        code: m.code,
        minimumLicenseTier: editedTiers[m.code] || m.minimumLicenseTier,
      }));
      const result = await adminApi.updateLicenseConfig(overrides);
      setSuccess(`Configuration sauvegardee. ${result.shops_updated} boutique(s) mise(s) a jour.`);
      await loadConfig();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!config) return;
    const tiers: Record<string, string> = {};
    for (const m of config.modules) {
      tiers[m.code] = m.minimumLicenseTier;
    }
    setEditedTiers(tiers);
    setHasChanges(false);
  };

  // Compute live tier summaries from edited state
  const computeTierSummaries = () => {
    if (!config) return {};
    const TIER_ORDER: Record<string, number> = { STARTER: 0, PROFESSIONAL: 1, ENTERPRISE: 2 };
    const summaries: Record<string, { modules: string[]; count: number }> = {};
    for (const tier of TIER_OPTIONS) {
      const tierLevel = TIER_ORDER[tier];
      const mods = config.modules
        .filter(m => TIER_ORDER[editedTiers[m.code] || m.minimumLicenseTier] <= tierLevel)
        .map(m => m.code);
      summaries[tier] = { modules: mods, count: mods.length };
    }
    return summaries;
  };

  const liveSummaries = computeTierSummaries();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl mb-2">&#9203;</div>
          <p className="text-gray-600">Chargement de la configuration des licences...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Impossible de charger la configuration des licences.
        </div>
      </div>
    );
  }

  const groupedModules: Record<string, ModuleInfo[]> = { CORE: [], EXTENDED: [], PREMIUM: [] };
  for (const m of config.modules) {
    groupedModules[m.tier]?.push(m);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration des Licences</h1>
          <p className="text-gray-600">
            Definir quel tier de licence est requis pour chaque module
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {success}
          </div>
        )}

        {/* Tier Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {TIER_OPTIONS.map(tier => (
            <div
              key={tier}
              className={`rounded-lg border-2 p-4 ${
                tier === 'STARTER'
                  ? 'border-gray-300 bg-gray-50'
                  : tier === 'PROFESSIONAL'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-purple-300 bg-purple-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{tier}</h3>
                <span
                  className={`px-2 py-1 text-sm font-medium rounded ${TIER_BADGE_COLORS[tier]}`}
                >
                  {liveSummaries[tier]?.count || 0} modules
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {liveSummaries[tier]?.modules.map(code => {
                  const mod = config.modules.find(m => m.code === code);
                  return (
                    <span
                      key={code}
                      className="text-xs px-2 py-0.5 bg-white rounded border"
                      title={mod?.name}
                    >
                      {mod?.name || code}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save/Reset buttons */}
        <div className="mb-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              hasChanges && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
          {hasChanges && (
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler les modifications
            </button>
          )}
        </div>

        {/* Module Table by Tier Group */}
        {(['CORE', 'EXTENDED', 'PREMIUM'] as const).map(groupTier => (
          <div key={groupTier} className="mb-6">
            <div className={`rounded-lg border ${MODULE_TIER_COLORS[groupTier]} overflow-hidden`}>
              <div className="px-4 py-3 border-b font-semibold text-gray-900">
                {TIER_LABELS[groupTier]} ({groupedModules[groupTier].length} modules)
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-600 uppercase border-b">
                    <th className="px-4 py-2">Module</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Dependances</th>
                    <th className="px-4 py-2">Tier minimum</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedModules[groupTier].map(m => {
                    const isCore = m.tier === 'CORE';
                    const currentTier = editedTiers[m.code] || m.minimumLicenseTier;
                    const originalDef = config.modules.find(om => om.code === m.code);
                    const isChanged = originalDef && currentTier !== originalDef.minimumLicenseTier;

                    return (
                      <tr key={m.code} className="border-b last:border-b-0 hover:bg-white/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{m.code}</div>
                          {m.overridden && (
                            <span className="text-xs text-orange-600 font-medium">
                              (personnalise)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{m.description}</td>
                        <td className="px-4 py-3">
                          {m.dependencies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {m.dependencies.map(dep => (
                                <span
                                  key={dep}
                                  className="text-xs px-1.5 py-0.5 bg-gray-200 rounded"
                                >
                                  {dep}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isCore ? (
                            <span className="px-3 py-1 text-xs font-medium rounded bg-gray-200 text-gray-600">
                              STARTER (fixe)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={currentTier}
                                onChange={e => handleTierChange(m.code, e.target.value)}
                                className={`px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                                  isChanged ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                                }`}
                              >
                                {TIER_OPTIONS.map(t => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              {isChanged && <span className="text-xs text-orange-600">*</span>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
