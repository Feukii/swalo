import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopCustomer } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Full FCFA: 12500 -> "12 500 F". */
function formatFcfa(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} F`;
}

/** Compact FCFA for KPI hero: 2_340_000 -> "2,34 M F", 95_000 -> "95 K F". */
function formatFcfaCompact(value: number): string {
  if (value >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 100) / 100;
    return `${millions.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M F`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} K F`;
  }
  return `${value} F`;
}

/** "2026-06-12T…" -> "12 juin". */
function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Stable avatar tint from the name (deterministic, no randomness).
const AVATAR_TINTS = [
  'bg-action-50 text-action-600',
  'bg-marine-50 text-marine-600',
  'bg-success-50 text-success-600',
  'bg-warning-50 text-warning-600',
  'bg-danger-50 text-danger-600',
  'bg-sky-100 text-sky-700',
] as const;

function avatarTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseClients() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();
  const [customers, setCustomers] = useState<AdminShopCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await adminApi.getShopCustomers(shopId);
        if (!cancelled) setCustomers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('Impossible de charger les clients de la boutique.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const metrics = useMemo(() => {
    const debtors = customers.filter(c => c.balance > 0);
    const toRecover = debtors.reduce((sum, c) => sum + c.balance, 0);
    return {
      toRecover,
      debtorCount: debtors.length,
      // No due-date data on customers → "en retard" = debtor count (no invention).
      overdueCount: debtors.length,
    };
  }, [customers]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-10 text-center">
        <p className="text-danger-700 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Clients</h1>
        <p className="mt-0.5 text-sm text-slate-500">Répertoire &amp; créances</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="À recouvrer"
          value={metrics.toRecover > 0 ? formatFcfaCompact(metrics.toRecover) : '—'}
        />
        <KpiCard label="Clients débiteurs" value={String(metrics.debtorCount)} />
        <KpiCard label="En retard" value={String(metrics.overdueCount)} />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-primary-900">Clients</h2>
          <button
            type="button"
            disabled
            title="Lecture seule — console super-admin"
            className="inline-flex items-center gap-1.5 rounded-xl bg-action-500 px-4 py-2 text-sm font-medium text-white shadow-sm opacity-50 cursor-not-allowed"
          >
            <span className="text-base leading-none">+</span>
            Nouveau client
          </button>
        </div>

        {customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucun client</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Nom</th>
                  <th className="pb-3 pr-4">Téléphone</th>
                  <th className="pb-3 pr-4 text-right">Doit</th>
                  <th className="pb-3 pr-4">Limite de crédit</th>
                  <th className="pb-3 pr-4">Dern. opé</th>
                  <th className="pb-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(c => (
                  <tr key={c.id} className="text-sm">
                    {/* NOM */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(
                            c.name
                          )}`}
                        >
                          {initials(c.name)}
                        </span>
                        <span className="font-medium text-primary-900">{c.name}</span>
                      </div>
                    </td>

                    {/* TÉLÉPHONE */}
                    <td className="py-3 pr-4 text-slate-500">{c.phone ?? '—'}</td>

                    {/* DOIT */}
                    <td className="py-3 pr-4 text-right">
                      <DebtCell balance={c.balance} />
                    </td>

                    {/* LIMITE DE CRÉDIT */}
                    <td className="py-3 pr-4">
                      <CreditLimitCell balance={c.balance} limit={c.credit_limit} />
                    </td>

                    {/* DERN. OPÉ */}
                    <td className="py-3 pr-4 text-slate-500">
                      {formatDateShort(c.last_operation)}
                    </td>

                    {/* STATUT */}
                    <td className="py-3 text-right">
                      <StatusBadge balance={c.balance} limit={c.credit_limit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card px-5 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-primary-900 leading-tight mt-1">{value}</p>
    </div>
  );
}

/** Owed amount. >0 red "X F / Doit", 0 green "À jour / Soldé", <0 sky "À rembourser". */
function DebtCell({ balance }: { balance: number }) {
  if (balance > 0) {
    return (
      <div>
        <p className="font-semibold text-danger-600">{formatFcfa(balance)}</p>
        <p className="text-[11px] text-slate-400">Doit</p>
      </div>
    );
  }
  if (balance < 0) {
    return (
      <div>
        <p className="font-semibold text-sky-600">{formatFcfa(-balance)}</p>
        <p className="text-[11px] text-slate-400">À rembourser</p>
      </div>
    );
  }
  return (
    <div>
      <p className="font-semibold text-success-600">À jour</p>
      <p className="text-[11px] text-slate-400">Soldé</p>
    </div>
  );
}

/** Progress bar of balance/limit. Green <80%, red ≥80%. "—" when limit is 0. */
function CreditLimitCell({ balance, limit }: { balance: number; limit: number }) {
  if (limit <= 0) {
    return <span className="text-slate-300">—</span>;
  }
  const ratio = Math.min(1, Math.max(0, balance / limit));
  const pct = ratio * 100;
  const isHigh = ratio >= 0.8;
  return (
    <div className="w-32">
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${isHigh ? 'bg-danger-500' : 'bg-success-500'}`}
          style={{ width: `${Math.max(pct, balance > 0 ? 4 : 0)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{formatFcfa(limit)}</p>
    </div>
  );
}

/** En cours (debt) / Soldé (settled) / Limite (balance ≥ limit > 0). */
function StatusBadge({ balance, limit }: { balance: number; limit: number }) {
  if (limit > 0 && balance >= limit) {
    return (
      <span className="inline-flex rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800">
        Limite
      </span>
    );
  }
  if (balance > 0) {
    return (
      <span className="inline-flex rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800">
        En cours
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
      Soldé
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <div className="h-7 w-32 bg-slate-200 rounded mb-2 animate-pulse" />
        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-card px-5 py-4 animate-pulse">
            <div className="h-3 w-24 bg-slate-100 rounded mb-3" />
            <div className="h-7 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-card p-6 h-72 animate-pulse" />
    </div>
  );
}
