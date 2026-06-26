import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cashApi, receivablesApi, debtsApi, productsApi, salesApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface CashStats {
  balance: number;
  todayEntries: number;
  todayExits: number;
  todayNet: number;
  entriesCount: number;
  exitsCount: number;
  totalSales: number;
  salesCash: number;
  salesCredit: number;
  salesMobile: number;
}

interface ReceivablesStats {
  totalReceivable: number;
  pendingCount: number;
  partialCount: number;
  totalCount: number;
}

interface DebtsStats {
  totalDebt: number;
  pendingCount: number;
  partialCount: number;
  totalCount: number;
}

interface ProductStats {
  total_products: number;
  active_products: number;
  low_stock_count: number;
  total_inventory_value: number;
}

interface SalesStats {
  total_sales: number;
  today_sales: number;
  total_revenue: number;
}

/**
 * Formate un montant entier en FCFA avec separateur de milliers (format francais).
 */
const formatFCFA = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

/**
 * Formate un montant FCFA de maniere compacte pour les cartes KPI.
 * Exemples: 1 250 000 -> "1,25 M F", 980 000 -> "980 K F", 4 500 -> "4 500 F".
 */
const formatCompactFCFA = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} M F`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000).toLocaleString('fr-FR')} K F`;
  }
  return `${sign}${abs.toLocaleString('fr-FR')} F`;
};

const PLACEHOLDER = '—';

export default function Home() {
  const { shop } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cashBalance, setCashBalance] = useState(0);
  const [cashStats, setCashStats] = useState<CashStats | null>(null);
  const [receivablesStats, setReceivablesStats] = useState<ReceivablesStats | null>(null);
  const [debtsStats, setDebtsStats] = useState<DebtsStats | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [salesStats, setSalesStats] = useState<SalesStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Dates pour les stats du jour
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const dates = {
        start_date: startOfDay.toISOString(),
        end_date: now.toISOString(),
      };

      const results = await Promise.allSettled([
        cashApi.getBalance(),
        cashApi.getStats(dates),
        receivablesApi.getStats(),
        debtsApi.getStats(),
        productsApi.getStats(),
        salesApi.getStats(),
      ]);

      if (results[0].status === 'fulfilled') setCashBalance(results[0].value.balance || 0);
      if (results[1].status === 'fulfilled') setCashStats(results[1].value);
      if (results[2].status === 'fulfilled') setReceivablesStats(results[2].value);
      if (results[3].status === 'fulfilled') setDebtsStats(results[3].value);
      if (results[4].status === 'fulfilled') setProductStats(results[4].value);
      if (results[5].status === 'fulfilled') setSalesStats(results[5].value);

      // Only show error if ALL calls failed
      const allFailed = results.every(r => r.status === 'rejected');
      if (allFailed) {
        setError('Impossible de charger les donnees du tableau de bord. Veuillez reessayer.');
      }
    } catch (err) {
      console.error('Erreur lors du chargement du tableau de bord:', err);
      setError('Impossible de charger les donnees du tableau de bord. Veuillez reessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-action-500"></div>
          <p className="mt-4 text-slate-500 text-sm">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-card p-8">
            <p className="text-danger-600 font-semibold mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-2 bg-action-500 text-white rounded-lg font-semibold hover:bg-action-600 transition-colors"
            >
              Reessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Donnees derivees a partir des stats deja recuperees (aucune nouvelle
  // requete). Les metriques sans source sont affichees avec un placeholder.
  // ------------------------------------------------------------------
  const todayRevenue = cashStats?.totalSales ?? salesStats?.total_revenue ?? null; // CA du jour (ventes cash + credit)
  const todaySalesCount = salesStats?.today_sales ?? null; // nb de ventes du jour
  const todayEncaisse = cashStats?.todayEntries ?? null; // total encaisse en caisse
  const receivableTotal = receivablesStats?.totalReceivable ?? null;
  const debtTotal = debtsStats?.totalDebt ?? null;
  const stockValue = productStats?.total_inventory_value ?? null;
  const totalProducts = productStats?.total_products ?? null;
  const debtorCount = receivablesStats?.totalCount ?? null;
  const supplierCount = debtsStats?.totalCount ?? null;
  const lowStockCount = productStats?.low_stock_count ?? null;

  // Repartition des encaissements (derivee des ventes par mode)
  const payCash = cashStats?.salesCash ?? 0;
  const payMobile = cashStats?.salesMobile ?? 0;
  const payCredit = cashStats?.salesCredit ?? 0;
  const payTotal = payCash + payMobile + payCredit;
  const payPct = (value: number): number => (payTotal > 0 ? Math.round((value / payTotal) * 100) : 0);

  const shopName = shop?.name || 'Boutique';
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      {/* En-tete */}
      <div>
        <h1 className="text-2xl font-bold text-marine-900 tracking-tight">Tableau de bord</h1>
        <p className="text-sm text-slate-500 mt-0.5 first-letter:uppercase">
          {shopName} · {todayLabel}
        </p>
      </div>

      {/* 5 cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          icon={<IconRevenue />}
          tone="sky"
          value={todayRevenue !== null ? formatCompactFCFA(todayRevenue) : PLACEHOLDER}
          label="Chiffre d'affaires (jour)"
        />
        <KpiCard
          icon={<IconMargin />}
          tone="marine"
          value={PLACEHOLDER}
          label="Marge brute"
        />
        <KpiCard
          icon={<IconCash />}
          tone="success"
          value={todayEncaisse !== null ? formatCompactFCFA(todayEncaisse) : PLACEHOLDER}
          label="Encaissé"
        />
        <KpiCard
          icon={<IconReceivable />}
          tone="warning"
          value={receivableTotal !== null ? formatCompactFCFA(receivableTotal) : PLACEHOLDER}
          label="Créances clients"
          badge={debtorCount !== null ? `${debtorCount} client${debtorCount > 1 ? 's' : ''}` : undefined}
          badgeTone="warning"
        />
        <KpiCard
          icon={<IconStock />}
          tone="marine"
          value={stockValue !== null ? formatCompactFCFA(stockValue) : PLACEHOLDER}
          label="Valeur du stock"
          badge={totalProducts !== null ? `${totalProducts.toLocaleString('fr-FR')} réf.` : undefined}
          badgeTone="neutral"
        />
      </div>

      {/* Grille principale : colonne gauche (CA + operations) / droite (a recouvrer/payer + repartition + stock bas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chiffre d'affaires - 7 derniers jours */}
          <section className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-marine-900">Chiffre d'affaires</h2>
                <p className="text-xs text-slate-400 mt-0.5">7 derniers jours</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-marine-900">{PLACEHOLDER}</p>
                <p className="text-xs text-slate-400">vs sem. préc.</p>
              </div>
            </div>
            {/* Donnees journalieres indisponibles avec les stats actuelles */}
            <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-400">
                Historique journalier indisponible
              </p>
            </div>
          </section>

          {/* Dernieres operations */}
          <section className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-marine-900">Dernières opérations</h2>
              <Link to="/sales" className="text-sm font-medium text-action-500 hover:text-action-600">
                Voir tout
              </Link>
            </div>
            {/* Le detail des operations n'est pas charge sur cette page */}
            <div className="flex items-center justify-center h-32 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center px-4">
              <p className="text-sm text-slate-400">
                {todaySalesCount !== null && todaySalesCount > 0
                  ? `${todaySalesCount} vente${todaySalesCount > 1 ? 's' : ''} aujourd'hui · détail dans l'historique`
                  : 'Aucune opération à afficher'}
              </p>
            </div>
          </section>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* A recouvrer / A payer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-sm font-medium text-slate-500">À recouvrer</p>
              <p className="text-2xl font-bold text-danger-600 mt-2">
                {receivableTotal !== null ? formatCompactFCFA(receivableTotal) : PLACEHOLDER}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {debtorCount !== null
                  ? `${debtorCount} client${debtorCount > 1 ? 's' : ''} débiteur${debtorCount > 1 ? 's' : ''}`
                  : 'clients débiteurs'}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-sm font-medium text-slate-500">À payer</p>
              <p className="text-2xl font-bold text-warning-500 mt-2">
                {debtTotal !== null ? formatCompactFCFA(debtTotal) : PLACEHOLDER}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {supplierCount !== null
                  ? `${supplierCount} fournisseur${supplierCount > 1 ? 's' : ''}`
                  : 'fournisseurs'}
              </p>
            </div>
          </div>

          {/* Repartition des encaissements */}
          <section className="bg-white rounded-2xl shadow-card p-6">
            <h2 className="text-base font-semibold text-marine-900 mb-4">
              Répartition des encaissements
            </h2>
            {payTotal > 0 ? (
              <div className="space-y-4">
                <PaymentRow
                  label="Espèces"
                  amount={payCash}
                  pct={payPct(payCash)}
                  barClass="bg-success-500"
                />
                <PaymentRow
                  label="Mobile Money"
                  amount={payMobile}
                  pct={payPct(payMobile)}
                  barClass="bg-sky-500"
                />
                <PaymentRow
                  label="Crédit"
                  amount={payCredit}
                  pct={payPct(payCredit)}
                  barClass="bg-warning-500"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-400">Aucun encaissement aujourd'hui</p>
            )}
          </section>

          {/* Stock bas */}
          <section className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-marine-900">Stock bas</h2>
                {lowStockCount !== null && lowStockCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-danger-500 text-white text-xs font-semibold">
                    {lowStockCount}
                  </span>
                )}
              </div>
              <Link
                to="/stock"
                className="text-sm font-medium text-action-500 hover:text-action-600"
              >
                Réapprovisionner
              </Link>
            </div>
            {/* Le detail des produits en alerte n'est pas charge sur cette page */}
            {lowStockCount !== null ? (
              <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center px-4">
                <p className="text-sm text-slate-400">
                  {lowStockCount > 0
                    ? `${lowStockCount} produit${lowStockCount > 1 ? 's' : ''} sous le seuil d'alerte`
                    : 'Aucun produit sous le seuil'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Donnée indisponible</p>
            )}
          </section>
        </div>
      </div>

      {/* Solde de caisse (conserve : donnee reelle) */}
      <div className="rounded-2xl p-6 shadow-elevated bg-gradient-to-br from-sky-400 via-action-500 to-action-600 flex items-center justify-between">
        <p className="text-sm font-medium text-white/80">Solde de caisse</p>
        <p className="text-2xl font-bold text-white tracking-tight">{formatFCFA(cashBalance)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composants de presentation (sans logique metier)
// ---------------------------------------------------------------------------

type KpiTone = 'sky' | 'marine' | 'success' | 'warning';
type BadgeTone = 'warning' | 'neutral';

const KPI_TONE: Record<KpiTone, string> = {
  sky: 'bg-sky-50 text-sky-600',
  marine: 'bg-marine-50 text-marine-700',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
};

const BADGE_TONE: Record<BadgeTone, string> = {
  warning: 'bg-warning-50 text-warning-700',
  neutral: 'bg-slate-100 text-slate-500',
};

function KpiCard({
  icon,
  tone,
  value,
  label,
  badge,
  badgeTone = 'neutral',
}: {
  icon: React.ReactNode;
  tone: KpiTone;
  value: string;
  label: string;
  badge?: string;
  badgeTone?: BadgeTone;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${KPI_TONE[tone]}`}
        >
          {icon}
        </span>
        {badge && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_TONE[badgeTone]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-marine-900 tracking-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function PaymentRow({
  label,
  amount,
  pct,
  barClass,
}: {
  label: string;
  amount: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-sm font-medium text-marine-900">
          {amount.toLocaleString('fr-FR')} F · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icones (SVG inline, currentColor)
// ---------------------------------------------------------------------------

function IconRevenue() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 7h7v7" />
    </svg>
  );
}

function IconMargin() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 20V10M12 20V4M18 20v-6" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconReceivable() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 11a4 4 0 10-8 0M4 20a6 6 0 0116 0"
      />
    </svg>
  );
}

function IconStock() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 16V8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"
      />
    </svg>
  );
}
