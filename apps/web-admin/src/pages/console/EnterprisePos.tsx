import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminApi, type AdminShopPos, type AdminPosSale } from '../../lib/api';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Full FCFA formatter: 88800 -> "88 800 F". */
function formatFcfa(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR').replace(/ | /g, ' ')} F`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnterprisePos() {
  const { shopId } = useParams<{ enterpriseId: string; shopId: string }>();

  const [data, setData] = useState<AdminShopPos | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await adminApi.getShopPos(shopId);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Impossible de charger le point de vente de cette boutique.');
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
  // Render: loading
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeading />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-12 bg-white rounded-2xl shadow-card animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 bg-white rounded-2xl shadow-card animate-pulse" />
              ))}
            </div>
          </div>
          <div className="h-96 bg-white rounded-2xl shadow-card animate-pulse" />
        </div>
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

  const products = data?.products ?? [];
  const ticket: AdminPosSale | null = data?.recent_sales?.[0] ?? null;

  // -------------------------------------------------------------------------
  // Render: content
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      <PageHeading />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: search + product grid */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar (visual only) */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <span className="text-slate-400">🔍</span>
            <span className="text-sm text-slate-400">
              Scanner un code-barres ou rechercher un article…
            </span>
            <span className="ml-auto rounded-md bg-action-50 px-2 py-1 text-[11px] font-medium text-action-600">
              F2 · Scanner
            </span>
          </div>

          {/* Product grid */}
          {products.length === 0 ? (
            <div className="rounded-2xl bg-white shadow-card p-10 text-center text-sm text-slate-400">
              Aucun article dans le catalogue de cette boutique.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map(product => {
                const outOfStock = product.stock <= 0;
                return (
                  <div
                    key={product.id}
                    className="rounded-2xl bg-white shadow-card overflow-hidden"
                  >
                    <div className="flex h-24 items-center justify-center bg-slate-50">
                      <span className="text-3xl text-slate-300">📦</span>
                    </div>
                    <div className="p-3">
                      <p
                        className="text-sm font-medium text-primary-900 truncate"
                        title={product.name}
                      >
                        {product.name}
                      </p>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-base font-bold text-primary-900">
                          {formatFcfa(product.price)}
                        </span>
                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            outOfStock ? 'text-danger-600' : 'text-success-600'
                          }`}
                        >
                          {outOfStock ? 'Rupture' : `${product.stock} en stock`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: ticket panel (read-only) */}
        <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col self-start">
          {ticket ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-primary-900">
                    Ticket #{ticket.short_id}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {ticket.item_count} article{ticket.item_count > 1 ? 's' : ''}
                    {ticket.created_at ? ` · ${formatDateTime(ticket.created_at)}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">
                  Encaissé
                </span>
              </div>

              {/* Lines: only the aggregate total is available read-only */}
              <div className="mt-5 flex-1 border-y border-slate-100 py-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-900">
                      {ticket.item_count} article{ticket.item_count > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400">Détail des lignes indisponible</p>
                  </div>
                  <span className="text-sm font-medium text-primary-900 whitespace-nowrap">
                    {formatFcfa(ticket.total)}
                  </span>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Sous-total</span>
                  <span className="text-primary-900">{formatFcfa(ticket.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Remise</span>
                  <span className="text-primary-900">{formatFcfa(0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-semibold text-primary-900">Total</span>
                  <span className="text-xl font-bold text-action-600">
                    {formatFcfa(ticket.total)}
                  </span>
                </div>
              </div>

              {/* Actions (disabled — read-only view) */}
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled
                  title="Vue lecture seule"
                  className="rounded-lg border border-danger-200 px-3 py-2 text-sm font-medium text-danger-400 cursor-not-allowed"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled
                  title="Vue lecture seule"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  Facturer
                </button>
                <button
                  type="button"
                  disabled
                  title="Vue lecture seule"
                  className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
                >
                  Encaisser
                </button>
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-4xl">🧾</p>
              <p className="mt-3 text-sm font-medium text-primary-900">Aucune vente récente</p>
              <p className="mt-1 text-xs text-slate-400">
                Le dernier ticket de la boutique apparaîtra ici.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page heading
// ---------------------------------------------------------------------------

function PageHeading() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-primary-900">Point de vente</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Encaissement &amp; facturation · <span className="text-slate-400">Vue lecture seule</span>
      </p>
    </div>
  );
}
