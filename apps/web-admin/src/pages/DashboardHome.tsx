import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Types (shapes returned by the existing admin API)
// ---------------------------------------------------------------------------

interface EnterpriseShop {
  id: string;
  name: string;
  code: string;
  is_blocked: boolean;
  shop_type: string;
}

interface Enterprise {
  id: string;
  code: string;
  name: string;
  license_tier: string;
  max_shops: number;
  licensed_until: string | null;
  monthly_price?: number | null;
  is_blocked: boolean;
  created_at: string;
  owner?: { id: string; display_name: string };
  shops?: EnterpriseShop[];
  _count?: { shops: number };
}

interface SystemStats {
  totalShops: number;
  totalUsers: number;
  activeShops: number;
  totalSales: number;
  totalProducts: number;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string;
  created_at: string;
  admin?: { display_name?: string };
}

interface AuditLogResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// MRR is computed from the REAL `monthly_price` stored on each enterprise
// (integer FCFA / month). No price grid is used: an enterprise with
// monthly_price = 0 (or null) contributes 0 to the MRR — which is the real,
// un-estimated figure.
// ---------------------------------------------------------------------------

const TIER_ORDER = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;

const TIER_SHORT: Record<string, string> = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

/** Compact FCFA formatter: 4 850 000 -> "4,85 M F", 95 000 -> "95 K F". */
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

/** Real monthly recurring revenue of an enterprise (integer FCFA). */
function enterpriseMrr(enterprise: Enterprise): number {
  return enterprise.monthly_price ?? 0;
}

function relativeTime(dateIso: string): string {
  const now = Date.now();
  const then = new Date(dateIso).getTime();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'hier';
  return `il y a ${diffDays} j`;
}

function daysUntil(dateIso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ACTION_LABELS: Record<string, string> = {
  BLOCK_SHOP: 'Boutique bloquée',
  UNBLOCK_SHOP: 'Boutique débloquée',
  BLOCK_USER: 'Utilisateur bloqué',
  UNBLOCK_USER: 'Utilisateur débloqué',
  BLOCK_ENTERPRISE: 'Entreprise bloquée',
  UNBLOCK_ENTERPRISE: 'Entreprise débloquée',
  UPDATE_SHOP_MODULES: 'Modules mis à jour',
  CREATE_ENTERPRISE: 'Entreprise créée',
  UPDATE_ENTERPRISE: 'Entreprise modifiée',
  DELETE_ENTERPRISE: 'Entreprise supprimée',
  UPDATE_LICENSE: 'Licence mise à jour',
  CREATE_SHOP: 'Boutique créée',
  DELETE_SHOP: 'Boutique supprimée',
};

function auditDotClass(action: string): string {
  if (action.startsWith('BLOCK')) return 'bg-danger-500';
  if (action.startsWith('UNBLOCK')) return 'bg-success-500';
  if (action.startsWith('CREATE')) return 'bg-action-500';
  if (action.startsWith('DELETE')) return 'bg-danger-500';
  if (action.includes('LICENSE')) return 'bg-warning-500';
  return 'bg-action-500';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [entData, statsData] = await Promise.all([
          adminApi.getAllEnterprises() as Promise<Enterprise[]>,
          adminApi.getSystemStats() as Promise<SystemStats>,
        ]);
        if (cancelled) return;
        setEnterprises(Array.isArray(entData) ? entData : []);
        setStats(statsData);

        // Audit logs are optional — degrade gracefully if the endpoint fails.
        try {
          const logs = (await adminApi.getAuditLogs({ page: 1, limit: 5 })) as AuditLogResponse;
          if (!cancelled) setAuditLogs(Array.isArray(logs?.data) ? logs.data : []);
        } catch {
          if (!cancelled) setAuditLogs([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Impossible de charger les données du tableau de bord.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Derived metrics (all computed from REAL data)
  // -------------------------------------------------------------------------

  const metrics = useMemo(() => {
    const active = enterprises.filter(e => !e.is_blocked);
    const blocked = enterprises.filter(e => e.is_blocked);

    // MRR = sum of the REAL monthly_price of each ACTIVE enterprise
    // (blocked = not billing).
    const totalMrr = active.reduce((sum, e) => sum + enterpriseMrr(e), 0);

    // Boutiques = sum of shop counts across all enterprises.
    const totalShops =
      stats?.totalShops ?? enterprises.reduce((s, e) => s + (e._count?.shops ?? 0), 0);

    // Renewals within 7 days (real, from licensed_until).
    const renewals = enterprises
      .filter(e => !e.is_blocked && e.licensed_until)
      .map(e => ({ enterprise: e, days: daysUntil(e.licensed_until as string) }))
      .filter(r => r.days >= 0 && r.days <= 7)
      .sort((a, b) => a.days - b.days);

    // Churn (30d): enterprises currently blocked / total. There is no historical
    // status timeline in the API, so this is the share of blocked accounts.
    const churnRate = enterprises.length > 0 ? (blocked.length / enterprises.length) * 100 : null;

    // MRR breakdown per tier (sum of real monthly_price per tier).
    const byTier = TIER_ORDER.map(tier => {
      const list = active.filter(e => e.license_tier === tier);
      return {
        tier,
        count: list.length,
        mrr: list.reduce((s, e) => s + enterpriseMrr(e), 0),
      };
    });
    const maxTierMrr = Math.max(1, ...byTier.map(t => t.mrr));

    return {
      active,
      blocked,
      totalMrr,
      totalShops,
      renewals,
      churnRate,
      byTier,
      maxTierMrr,
    };
  }, [enterprises, stats]);

  // MRR history is NOT stored anywhere. We show the current month's real MRR on
  // the last bar; previous months are unknown ("—") and rendered as empty bars.
  const mrrSeries = useMemo(() => {
    const now = new Date();
    const series: { label: string; value: number | null; current: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const current = i === 0;
      series.push({
        label: MONTH_LABELS[d.getMonth()],
        value: current ? metrics.totalMrr : null,
        current,
      });
    }
    return series;
  }, [metrics.totalMrr]);

  const maxSeriesValue = Math.max(1, ...mrrSeries.map(p => p.value ?? 0));

  // Subscriptions table — top enterprises by real MRR.
  const subscriptions = useMemo(() => {
    return [...enterprises].sort((a, b) => enterpriseMrr(b) - enterpriseMrr(a)).slice(0, 5);
  }, [enterprises]);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-card p-5 animate-pulse">
              <div className="h-7 w-24 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-64 bg-white rounded-2xl shadow-card animate-pulse" />
          <div className="h-64 bg-white rounded-2xl shadow-card animate-pulse" />
        </div>
      </div>
    );
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
      {/* Page heading + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Vue d'ensemble</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pilotage des abonnements · <span className="capitalize">{monthLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">
            <span className="mr-2">🔍</span>
            <span>Entreprise, boutique, code…</span>
          </div>
          <button
            onClick={() => navigate('/enterprises')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-action-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-action-600 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Nouvelle entreprise
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          value={metrics.totalMrr > 0 ? formatFcfaCompact(metrics.totalMrr) : '—'}
          label="MRR"
        />
        <KpiCard value={String(metrics.active.length)} label="Entreprises actives" />
        <KpiCard value={String(metrics.totalShops)} label="Boutiques" />
        <KpiCard
          value={
            metrics.churnRate === null
              ? '—'
              : `${metrics.churnRate.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
          }
          label="Taux d'attrition (30j)"
        />
        <KpiCard value={String(metrics.renewals.length)} label="Renouv. ≤ 7j" />
      </div>

      {/* MRR chart + plan breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* MRR bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary-900">
                Revenu mensuel récurrent (MRR)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">6 derniers mois</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-primary-900">
                {metrics.totalMrr > 0 ? formatFcfaCompact(metrics.totalMrr) : '—'}
              </p>
              {/* Delta requires MRR history which is not stored → unavailable. */}
              <p className="text-xs text-slate-400 mt-0.5">historique indisponible</p>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3 h-44">
            {mrrSeries.map((point, idx) => {
              const heightPct =
                point.value === null ? 0 : Math.max(8, (point.value / maxSeriesValue) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[11px] font-medium text-slate-500 mb-1">
                    {point.value === null ? '—' : formatFcfaCompact(point.value)}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    {point.value === null ? (
                      <div className="w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 h-full" />
                    ) : (
                      <div
                        className={`w-full rounded-lg ${
                          point.current ? 'bg-action-500' : 'bg-slate-200'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-slate-400 mt-2">{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plan breakdown */}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-primary-900">Répartition par plan</h2>
            <span className="text-xs text-slate-400">{enterprises.length} entr.</span>
          </div>
          <div className="mt-5 space-y-5">
            {metrics.byTier.map(t => {
              const widthPct = Math.max(4, (t.mrr / metrics.maxTierMrr) * 100);
              const isPro = t.tier === 'PROFESSIONAL';
              return (
                <div key={t.tier}>
                  <div className="flex items-center justify-between text-sm">
                    <span
                      className={`font-medium ${isPro ? 'text-action-600' : 'text-primary-900'}`}
                    >
                      {t.tier}
                    </span>
                    <span className="text-slate-500">
                      {t.count} · {t.mrr > 0 ? formatFcfaCompact(t.mrr) : '—'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isPro ? 'bg-action-500' : 'bg-primary-900'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subscriptions table + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Subscriptions table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-primary-900">Abonnements</h2>
            <button
              onClick={() => navigate('/enterprises')}
              className="text-sm font-medium text-action-600 hover:text-action-700 transition-colors"
            >
              Tout gérer
            </button>
          </div>

          {subscriptions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun abonnement</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4">Entreprise</th>
                    <th className="pb-3 pr-4">Plan</th>
                    <th className="pb-3 pr-4">Boutiq.</th>
                    <th className="pb-3 pr-4">MRR</th>
                    <th className="pb-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscriptions.map(e => {
                    const mrr = e.is_blocked ? 0 : enterpriseMrr(e);
                    const renewalDays = e.licensed_until ? daysUntil(e.licensed_until) : null;
                    return (
                      <tr key={e.id} className="text-sm">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action-50 text-xs font-semibold text-action-600">
                              {initials(e.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-primary-900 truncate">{e.name}</p>
                              <p className="text-xs text-slate-400">
                                {e.licensed_until
                                  ? `éch. ${new Date(e.licensed_until).toLocaleDateString('fr-FR', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}`
                                  : 'éch. —'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {TIER_SHORT[e.license_tier] ?? e.license_tier}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{e._count?.shops ?? 0}</td>
                        <td className="py-3 pr-4 font-medium text-primary-900">
                          {mrr > 0 ? formatFcfaCompact(mrr) : '— F'}
                        </td>
                        <td className="py-3">
                          {e.is_blocked ? (
                            <span className="inline-flex rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800">
                              Bloqué
                            </span>
                          ) : renewalDays !== null && renewalDays >= 0 && renewalDays <= 7 ? (
                            <span className="inline-flex rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800">
                              Expire {renewalDays}j
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
                              Actif
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: renewals + audit */}
        <div className="space-y-5">
          {/* Renewals ≤ 7j */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-semibold text-primary-900">Renouvellements ≤ 7j</h2>
              {metrics.renewals.length > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-warning-500 px-1.5 text-[11px] font-semibold text-white">
                  {metrics.renewals.length}
                </span>
              )}
            </div>
            {metrics.renewals.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                Aucun renouvellement imminent
              </p>
            ) : (
              <ul className="space-y-3">
                {metrics.renewals.map(({ enterprise: e, days }) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
                      🕐
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary-900 truncate">{e.name}</p>
                      <p className="text-xs text-slate-400">
                        {TIER_SHORT[e.license_tier] ?? e.license_tier} ·{' '}
                        {enterpriseMrr(e) > 0 ? formatFcfaCompact(enterpriseMrr(e)) : '—'}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-warning-600 whitespace-nowrap">
                      dans {days}j
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Audit journal */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h2 className="text-base font-semibold text-primary-900 mb-4">Journal d'audit</h2>
            {auditLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Aucune activité récente</p>
            ) : (
              <ul className="space-y-4">
                {auditLogs.map(log => (
                  <li key={log.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${auditDotClass(log.action)}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-primary-900 leading-snug">
                        {ACTION_LABELS[log.action] ?? log.action}
                        {log.reason ? ` — ${log.reason}` : ''}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {log.admin?.display_name ?? 'Admin Swalo'} · {relativeTime(log.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function KpiCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-card px-5 py-4">
      <p className="text-2xl font-bold text-primary-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
