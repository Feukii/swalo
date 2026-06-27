import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopSupervision } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "2026-06-12T14:32:…" -> "14:32". */
function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseSupervision() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();

  const [data, setData] = useState<AdminShopSupervision | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminApi.getShopSupervision(shopId);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Impossible de charger la supervision de cette boutique.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl shadow-card animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-2xl shadow-card animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <p className="text-danger-700 font-medium">
            {error ?? 'Aucune donnée de supervision disponible.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Critiques"
          value={String(data.critical_count)}
          accent={data.critical_count > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="À vérifier"
          value={String(data.review_count)}
          accent={data.review_count > 0 ? 'warning' : 'default'}
        />
        <KpiCard label="Total" value={String(data.total)} />
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-base font-semibold text-primary-900 mb-4">Alertes</h2>
        {data.alerts.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Aucune alerte. Tout est en ordre.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Alerte</th>
                  <th className="pb-3 pr-4">Gravité</th>
                  <th className="pb-3 pr-4">Auteur</th>
                  <th className="pb-3 text-right">Heure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.alerts.map(alert => (
                  <tr key={alert.id} className="text-sm align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-primary-900">{alert.title}</p>
                      <p className="text-xs text-slate-400">{alert.detail}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{alert.author ?? '—'}</td>
                    <td className="py-3 text-right text-slate-500">{formatTime(alert.created_at)}</td>
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

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Supervision</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Alertes &amp; contrôles · <span className="text-slate-400">Vue lecture seule</span>
      </p>
    </div>
  );
}

function KpiCard({
  value,
  label,
  accent = 'default',
}: {
  value: string;
  label: string;
  accent?: 'default' | 'danger' | 'warning';
}) {
  const valueClass =
    accent === 'danger'
      ? 'text-danger-600'
      : accent === 'warning'
        ? 'text-warning-600'
        : 'text-primary-900';
  return (
    <div className="bg-white rounded-2xl shadow-card px-5 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold leading-tight mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'review' }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800">
        Critique
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-warning-100 px-2.5 py-0.5 text-xs font-medium text-warning-800">
      À vérifier
    </span>
  );
}
