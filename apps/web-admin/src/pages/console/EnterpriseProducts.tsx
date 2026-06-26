import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopProduct } from '../../lib/api';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

/** Stock level (units) at or below which a product is flagged as low stock. */
const LOW_STOCK_THRESHOLD = 5;

/** Full FCFA formatter: 69600 -> "69 600 F". */
function formatFcfa(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;
}

/** Compact FCFA formatter for KPIs: 14_200_000 -> "14,2 M F". */
function formatFcfaCompact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    return `${rounded.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M F`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} K F`;
  }
  return `${value} F`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterpriseProducts() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();

  const [products, setProducts] = useState<AdminShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminApi.getShopProducts(shopId);
        if (!cancelled) setProducts(Array.isArray(result) ? result : []);
      } catch {
        if (!cancelled) setError('Impossible de charger le catalogue de cette boutique.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  // -------------------------------------------------------------------------
  // Derived KPIs (all computed from the real list)
  // -------------------------------------------------------------------------

  const kpis = useMemo(() => {
    const totalRefs = products.length;
    const stockValue = products.reduce((sum, p) => sum + (p.value ?? 0), 0);
    const outOfStock = products.filter(p => p.stock <= 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length;
    return { totalRefs, stockValue, outOfStock, lowStock };
  }, [products]);

  // -------------------------------------------------------------------------
  // Render: loading
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl shadow-card animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-2xl shadow-card animate-pulse" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: error
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <p className="text-danger-700 font-medium">{error}</p>
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

  // -------------------------------------------------------------------------
  // Render: content
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <PageHeading />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard value={kpis.totalRefs.toLocaleString('fr-FR')} label="Références totales" />
        <KpiCard value={formatFcfaCompact(kpis.stockValue)} label="Valeur du stock" />
        <KpiCard
          value={String(kpis.outOfStock)}
          label="Ruptures"
          accent={kpis.outOfStock > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          value={String(kpis.lowStock)}
          label="Alertes stock"
          accent={kpis.lowStock > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Catalogue table */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-primary-900">Catalogue &amp; inventaire</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Vue lecture seule"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
            >
              Filtrer
            </button>
            <button
              type="button"
              disabled
              title="Vue lecture seule"
              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
            >
              + Réception (lot)
            </button>
          </div>
        </div>

        {products.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Aucun produit dans le catalogue de cette boutique.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4">Produit</th>
                  <th className="pb-3 pr-4">Catégorie</th>
                  <th className="pb-3 pr-4 text-right">Stock</th>
                  <th className="pb-3 pr-4 text-right">Lots</th>
                  <th className="pb-3 pr-4 text-right">P. achat</th>
                  <th className="pb-3 pr-4 text-right">P. vente</th>
                  <th className="pb-3 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => {
                  const outOfStock = p.stock <= 0;
                  const lowStock = p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD;
                  const stockClass = outOfStock
                    ? 'text-danger-600'
                    : lowStock
                      ? 'text-warning-600'
                      : 'text-primary-900';
                  return (
                    <tr key={p.id} className="text-sm">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base text-slate-300">
                            📦
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className="font-medium text-primary-900 truncate"
                                title={p.name}
                              >
                                {p.name}
                              </p>
                              {p.multi_price && (
                                <span className="inline-flex rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                                  Multi
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{p.category ?? '—'}</td>
                      <td className={`py-3 pr-4 text-right font-medium ${stockClass}`}>{p.stock}</td>
                      <td className="py-3 pr-4 text-right text-slate-600">
                        {p.batch_count > 0 ? `${p.batch_count} lot${p.batch_count > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-600">
                        {formatFcfa(p.cost_price)}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-primary-900">
                        {formatFcfa(p.sell_price)}
                      </td>
                      <td className="py-3 text-right font-semibold text-primary-900">
                        {formatFcfa(p.value)}
                      </td>
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

// ---------------------------------------------------------------------------
// Page heading + KPI card
// ---------------------------------------------------------------------------

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Produits</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Catalogue · <span className="text-slate-400">Vue lecture seule</span>
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
