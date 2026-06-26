import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminEnterpriseReports, type AdminShopHealth } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Compact FCFA formatter: 5 870 000 -> "5,87 M F", 95 000 -> "95 K F". */
function formatFcfaCompact(value: number): string {
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

/** Percentage formatter: 35.5 -> "35,5 %". */
function formatPercent(value: number): string {
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

/**
 * The API returns ASCII health labels ('Sain' | 'A surveiller' | 'En difficulte').
 * This maps them to fully-accented French labels + the matching badge palette.
 */
const HEALTH_META: Record<AdminShopHealth, { label: string; badgeClass: string }> = {
  Sain: {
    label: 'Sain',
    badgeClass: 'bg-success-100 text-success-800',
  },
  'A surveiller': {
    label: 'À surveiller',
    badgeClass: 'bg-warning-100 text-warning-800',
  },
  'En difficulte': {
    label: 'En difficulté',
    badgeClass: 'bg-danger-100 text-danger-800',
  },
};

/** Short label for chart axis: "Boutique 01 — Centre" -> "Centre". */
function shortShopLabel(name: string): string {
  const parts = name.split('—');
  const last = parts[parts.length - 1]?.trim();
  return last && last.length > 0 ? last : name;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseReports() {
  const { enterpriseId } = useParams<{ enterpriseId: string }>();
  const [data, setData] = useState<AdminEnterpriseReports | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enterpriseId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const reports = await adminApi.getEnterpriseReports(enterpriseId);
        if (!cancelled) setData(reports);
      } catch {
        if (!cancelled) setError('Impossible de charger les rapports de cette entreprise.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enterpriseId]);

  const maxCaJour = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.shops.map(s => s.ca_jour));
  }, [data]);

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Heading subtitle="Analyses & exports" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl bg-white p-5 shadow-card">
              <div className="mb-2 h-3 w-20 rounded bg-slate-100" />
              <div className="h-7 w-24 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-card lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-card" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <Heading subtitle="Analyses & exports" />
        <div className="rounded-2xl bg-white p-10 text-center shadow-card">
          <p className="font-medium text-danger-700">{error ?? 'Aucune donnée disponible.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-action-500 px-4 py-2 text-sm text-white transition-colors hover:bg-action-600"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { shops, totals } = data;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <Heading subtitle="Analyses & exports" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="CA réseau (jour)" value={formatFcfaCompact(totals.ca_reseau)} />
        <KpiCard label="Marge moyenne" value={formatPercent(totals.marge_moyenne)} />
        <KpiCard label="Trésorerie réseau" value={formatFcfaCompact(totals.tresorerie_reseau)} />
        <KpiCard label="Créances réseau" value={formatFcfaCompact(totals.creances_reseau)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Performance par boutique */}
        <div className="rounded-2xl bg-white p-6 shadow-card lg:col-span-2">
          <h2 className="text-base font-semibold text-primary-900">Performance par boutique</h2>

          {shops.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucune boutique</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Boutique</th>
                    <th className="pb-3 pr-4">CA jour</th>
                    <th className="pb-3 pr-4">Marge</th>
                    <th className="pb-3 pr-4">Caisse</th>
                    <th className="pb-3 pr-4">Créances</th>
                    <th className="pb-3 text-right">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shops.map(shop => {
                    const meta = HEALTH_META[shop.etat];
                    return (
                      <tr key={shop.id} className="text-sm">
                        <td className="py-3 pr-4 font-medium text-primary-900">{shop.name}</td>
                        <td className="py-3 pr-4 font-medium text-primary-900">
                          {formatFcfaCompact(shop.ca_jour)}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{formatPercent(shop.marge)}</td>
                        <td className="py-3 pr-4 text-slate-600">
                          {formatFcfaCompact(shop.caisse)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-danger-600">
                          {formatFcfaCompact(shop.creances)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CA par boutique — bar chart */}
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-primary-900">CA par boutique</h2>
          <p className="mt-0.5 text-xs text-slate-400">Aujourd'hui</p>

          {shops.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucune boutique</p>
          ) : (
            <div className="mt-6 flex h-52 items-end justify-between gap-2">
              {shops.map(shop => {
                const heightPct = Math.max(6, (shop.ca_jour / maxCaJour) * 100);
                return (
                  <div
                    key={shop.id}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-lg bg-sky-400"
                        style={{ height: `${heightPct}%` }}
                        title={`${shop.name} · ${formatFcfaCompact(shop.ca_jour)}`}
                      />
                    </div>
                    <span className="mt-2 w-full truncate text-center text-[11px] text-slate-400">
                      {shortShopLabel(shop.name)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function Heading({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Rapports</h1>
      <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight text-primary-900">{value}</p>
    </div>
  );
}
