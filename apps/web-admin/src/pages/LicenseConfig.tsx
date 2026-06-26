import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Abonnements & licences
// Vue de gestion des abonnements / licences par entreprise :
//   - cartes de plans (catalogue) en tête
//   - tableau des abonnements actifs câblé aux données réelles
//   - édition de la licence d'une entreprise (plan, prix mensuel, échéance)
// Toutes les données proviennent de adminApi.getAllEnterprises() et sont
// mises à jour via adminApi.updateLicense(). Aucune donnée n'est inventée.
// ---------------------------------------------------------------------------

interface Enterprise {
  id: string;
  code: string;
  name: string;
  license_tier: string;
  max_shops: number;
  max_users_per_shop: number;
  licensed_until: string | null;
  monthly_price?: number | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  owner?: { id: string; display_name: string };
  _count?: { shops: number };
}

const TIER_ORDER = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
type Tier = (typeof TIER_ORDER)[number];

const TIER_SHORT: Record<string, string> = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
};

/** Présentation statique des plans (description du périmètre, pas de prix inventé). */
const PLAN_INFO: Record<Tier, { label: string; scope: string }> = {
  STARTER: { label: 'STARTER', scope: 'Cœur · 6 modules' },
  PROFESSIONAL: { label: 'PROFESSIONAL', scope: 'Cœur + Étendu · 13' },
  ENTERPRISE: { label: 'ENTERPRISE', scope: 'Tous · multi-boutiques' },
};

/** Compact FCFA : 420 000 -> "420 K F", 4 850 000 -> "4,85 M F", 0 -> "— F". */
function formatFcfaCompact(value: number): string {
  if (value <= 0) return '— F';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = Math.round(millions * 100) / 100;
    return `${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M F`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} K F`;
  }
  return `${value} F`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatEcheance(dateIso: string | null): string {
  if (!dateIso) return '—';
  return new Date(dateIso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function avatarTint(name: string): string {
  const tints = [
    'bg-action-50 text-action-600',
    'bg-success-50 text-success-700',
    'bg-warning-50 text-warning-700',
    'bg-primary-50 text-primary-700',
    'bg-danger-50 text-danger-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % tints.length;
  return tints[hash];
}

interface LicenseDraft {
  license_tier: Tier;
  licensed_until: string;
  monthly_price: number;
}

export default function LicenseConfig() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editing, setEditing] = useState<Enterprise | null>(null);
  const [draft, setDraft] = useState<LicenseDraft>({
    license_tier: 'STARTER',
    licensed_until: '',
    monthly_price: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEnterprises();
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

  const loadEnterprises = async () => {
    try {
      setLoading(true);
      const data = (await adminApi.getAllEnterprises()) as Enterprise[];
      setEnterprises(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(resolveError(err, 'Erreur lors du chargement des abonnements'));
    } finally {
      setLoading(false);
    }
  };

  // KPI par plan : nombre d'entreprises sur chaque tier (donnée réelle).
  const planCounts = useMemo(() => {
    const counts: Record<Tier, number> = { STARTER: 0, PROFESSIONAL: 0, ENTERPRISE: 0 };
    for (const e of enterprises) {
      if (e.license_tier in counts) counts[e.license_tier as Tier] += 1;
    }
    return counts;
  }, [enterprises]);

  // Tableau des abonnements actifs, triés par MRR réel décroissant.
  const subscriptions = useMemo(() => {
    return [...enterprises].sort((a, b) => (b.monthly_price ?? 0) - (a.monthly_price ?? 0));
  }, [enterprises]);

  const openEdit = (enterprise: Enterprise) => {
    setEditing(enterprise);
    setDraft({
      license_tier: (TIER_ORDER as readonly string[]).includes(enterprise.license_tier)
        ? (enterprise.license_tier as Tier)
        : 'STARTER',
      licensed_until: enterprise.licensed_until ? enterprise.licensed_until.split('T')[0] : '',
      monthly_price: enterprise.monthly_price ?? 0,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      setSaving(true);
      await adminApi.updateLicense(editing.id, {
        license_tier: draft.license_tier,
        licensed_until: draft.licensed_until || undefined,
        monthly_price: draft.monthly_price,
      });
      setSuccess(`Licence de « ${editing.name} » mise à jour`);
      setEditing(null);
      await loadEnterprises();
    } catch (err) {
      setError(resolveError(err, 'Erreur lors de la mise à jour de la licence'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Abonnements &amp; licences</h1>
        <p className="text-sm text-slate-500 mt-0.5">Plans, modules &amp; échéances</p>
      </div>

      {/* Notifications */}
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

      {/* Cartes de plans */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIER_ORDER.map(tier => {
          const isPro = tier === 'PROFESSIONAL';
          const info = PLAN_INFO[tier];
          return (
            <div
              key={tier}
              className={`rounded-2xl bg-white p-5 shadow-card ${
                isPro ? 'ring-2 ring-action-400' : 'border border-slate-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    isPro ? 'text-action-600' : 'text-slate-500'
                  }`}
                >
                  {info.label}
                </p>
                <p className="text-xs text-slate-400">{planCounts[tier]} entr.</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-primary-900">
                {tier === 'ENTERPRISE' ? 'Sur devis' : ''}
                {tier !== 'ENTERPRISE' && <span>—</span>}
              </p>
              <p className="mt-1 text-xs text-slate-400">{info.scope}</p>
            </div>
          );
        })}
      </div>

      {/* Abonnements actifs */}
      <div className="rounded-2xl bg-white shadow-card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-primary-900">Abonnements actifs</h2>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Aucun abonnement</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Entreprise</th>
                  <th className="px-6 py-3">Plan</th>
                  <th className="px-6 py-3 text-center">Boutiq.</th>
                  <th className="px-6 py-3 text-right">MRR</th>
                  <th className="px-6 py-3 text-right">Échéance</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map(e => {
                  const mrr = e.is_blocked ? 0 : (e.monthly_price ?? 0);
                  return (
                    <tr key={e.id} className="text-sm">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(
                              e.name
                            )}`}
                          >
                            {initials(e.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary-900">{e.name}</p>
                            <p className="text-xs text-slate-400">{e.code}</p>
                          </div>
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
                      <td className="px-6 py-3 text-center text-slate-600">
                        {e._count?.shops ?? 0}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-primary-900">
                        {formatFcfaCompact(mrr)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-500">
                        {formatEcheance(e.licensed_until)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => openEdit(e)}
                          className="text-sm font-medium text-action-600 transition-colors hover:text-action-700"
                        >
                          Gérer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modale d'édition de la licence */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated">
            <h2 className="text-lg font-bold text-primary-900">Gérer la licence</h2>
            <p className="mt-0.5 text-sm text-slate-500">{editing.name}</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plan</label>
                <select
                  value={draft.license_tier}
                  onChange={ev => setDraft({ ...draft, license_tier: ev.target.value as Tier })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-action-500 focus:ring-2 focus:ring-action-500"
                >
                  {TIER_ORDER.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Prix mensuel (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  value={draft.monthly_price}
                  onChange={ev =>
                    setDraft({
                      ...draft,
                      monthly_price: Math.max(0, parseInt(ev.target.value, 10) || 0),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-action-500 focus:ring-2 focus:ring-action-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Échéance (licence valide jusqu&apos;au)
                </label>
                <input
                  type="date"
                  value={draft.licensed_until}
                  onChange={ev => setDraft({ ...draft, licensed_until: ev.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-action-500 focus:ring-2 focus:ring-action-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-action-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-action-600 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
