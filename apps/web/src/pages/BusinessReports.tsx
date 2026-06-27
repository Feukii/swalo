import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { reportsApi } from '../lib/api';
import type {
  NetworkReport,
  NetworkShopReport,
  ShopHealth,
  ShopCashFlowReport,
  ShopSalesReport,
  ShopCashReport,
  ShopTopProduct,
} from '../lib/api';

/**
 * Formate un montant en centimes au format "réseau" de la maquette :
 * - >= 1 000 000 F  ->  "5,87 M F"
 * - >= 1 000 F      ->  "12,5 k F"
 * - sinon           ->  "1 500 F"
 * Les montants reçus de l'API sont en FCFA (affichés tels quels).
 */
function formatNetworkAmount(value: number): string {
  const amount = value;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    const value = abs / 1_000_000;
    return `${sign}${value.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} M F`;
  }

  if (abs >= 10_000) {
    const value = abs / 1_000;
    return `${sign}${value.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} k F`;
  }

  return `${sign}${Math.round(abs).toLocaleString('fr-FR')} F`;
}

/** Montant FCFA brut avec séparateur de milliers (aucune division). */
function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} F`;
}

/** Montant FCFA signé (utilisé pour le net journalier du graphe). */
function formatMoneySigned(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(Math.round(value)).toLocaleString('fr-FR')} F`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} %`;
}

interface HealthBadge {
  label: string;
  className: string;
}

function getHealthBadge(etat: ShopHealth): HealthBadge {
  switch (etat) {
    case 'Sain':
      return { label: 'Sain', className: 'bg-success-100 text-success-700' };
    case 'A surveiller':
      return { label: 'À surveiller', className: 'bg-warning-100 text-warning-700' };
    case 'En difficulte':
      return { label: 'En difficulté', className: 'bg-danger-100 text-danger-700' };
    default:
      return { label: etat, className: 'bg-slate-100 text-slate-600' };
  }
}

// ============================================================
// Vue boutique (rapport business mono-boutique, miroir mobile)
// ============================================================

type ShopPeriod = 'today' | 'week' | 'month' | 'year';

const SHOP_PERIOD_LABELS: Record<ShopPeriod, string> = {
  today: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
};

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_NAMES = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Libellés conviviaux des catégories d'encaissement (miroir mobile).
const ENCAISSEMENT_LABELS: Record<string, string> = {
  ventes: 'Ventes comptoir',
  remboursement_client: 'Paiements créance',
  remboursement_fournisseur: 'Remb. fournisseur',
  divers: 'Divers',
};

/** Plage de dates ISO pour la période sélectionnée. */
function getShopPeriodRange(period: ShopPeriod): { start_date: string; end_date: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start_date: start.toISOString(), end_date: end.toISOString() };
}

/** Libellé convivial d'une date YYYY-MM-DD, ex. « Ven 26 juin ». */
function friendlyDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function weekdayLetter(dateStr: string): string {
  return WEEKDAY_LETTERS[new Date(`${dateStr}T00:00:00`).getDay()];
}

interface ShopReportData {
  cashFlow: ShopCashFlowReport;
  sales: ShopSalesReport;
  cash: ShopCashReport;
  topProducts: ShopTopProduct[];
}

function ShopBusinessReport() {
  const [period, setPeriod] = useState<ShopPeriod>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShopReportData | null>(null);
  const [selectedDay, setSelectedDay] = useState(6);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getShopPeriodRange(period);
      const [cashFlow, sales, cash, topProducts] = await Promise.all([
        reportsApi.getCashFlow(range),
        reportsApi.getSales(range),
        reportsApi.getCash(range),
        reportsApi.getTopProducts(range, 5),
      ]);
      setData({ cashFlow, sales, cash, topProducts });
      setSelectedDay(cashFlow.daily.length > 0 ? cashFlow.daily.length - 1 : 0);
    } catch {
      setError('Impossible de charger le rapport de la boutique. Veuillez réessayer.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-12 h-12 spinner" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-50 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <p className="text-slate-600 mb-4">{error ?? 'Aucune donnée à afficher.'}</p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-marine-900 text-white font-semibold text-sm hover:bg-marine-800 transition-colors"
          onClick={load}
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { cashFlow, sales, cash, topProducts } = data;

  // Ventes : espèces vs crédit (à partir de la répartition par moyen de paiement).
  const creditRow = sales.by_payment_method.find(m => m.method === 'CREDIT');
  const creditAmount = creditRow?.total ?? 0;
  const creditCount = creditRow?.count ?? 0;
  const cashAmount = Math.max(0, sales.total_revenue - creditAmount);
  const cashCount = Math.max(0, sales.completed_sales - creditCount);
  const totalSplit = cashAmount + creditAmount;
  const cashFraction = totalSplit > 0 ? (cashAmount / totalSplit) * 100 : 0;
  const creditFraction = totalSplit > 0 ? (creditAmount / totalSplit) * 100 : 0;
  const cashSharePercent =
    sales.completed_sales > 0 ? Math.round((cashCount / sales.completed_sales) * 100) : 0;
  const creditAvgTicket = creditCount > 0 ? creditAmount / creditCount : 0;

  // Graphe flux de caisse 7 jours.
  const maxFlow = Math.max(1, ...cashFlow.daily.map(d => d.net));
  const selectedBar =
    cashFlow.daily[Math.min(selectedDay, cashFlow.daily.length - 1)] ?? null;

  // Top produits.
  const maxTopValue = Math.max(1, ...topProducts.map(p => p.value));

  return (
    <div className="space-y-6">
      {/* Sélecteur de période */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-full max-w-md">
        {(Object.keys(SHOP_PERIOD_LABELS) as ShopPeriod[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              period === p
                ? 'bg-marine-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-marine-900'
            }`}
          >
            {SHOP_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Encaissements</p>
          <p className="text-xl font-bold text-success-600 mt-2">{formatMoney(cashFlow.total_in)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Décaissements</p>
          <p className="text-xl font-bold text-danger-600 mt-2">{formatMoney(cashFlow.total_out)}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Solde net</p>
          <p
            className={`text-xl font-bold mt-2 ${
              cashFlow.net >= 0 ? 'text-marine-900' : 'text-danger-600'
            }`}
          >
            {formatMoney(cashFlow.net)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ventes</p>
          <p className="text-xl font-bold text-sky-600 mt-2">{sales.completed_sales}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Créances</p>
          <p className="text-xl font-bold text-success-600 mt-2">
            {formatMoney(cash.pending_receivables)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dettes</p>
          <p className="text-xl font-bold text-danger-600 mt-2">
            {formatMoney(cash.pending_debts)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Graphe flux de caisse — 7 derniers jours */}
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-marine-900">Flux de caisse</h2>
            <span className="text-xs text-slate-400">7 derniers jours</span>
          </div>

          {selectedBar && (
            <div className="flex items-center justify-between mt-3 mb-2">
              <span className="text-sm font-semibold text-marine-900">
                {friendlyDay(selectedBar.date)}
              </span>
              <span
                className={`text-base font-bold ${
                  selectedBar.net >= 0 ? 'text-success-600' : 'text-danger-600'
                }`}
              >
                {formatMoneySigned(selectedBar.net)}
              </span>
            </div>
          )}

          <div className="flex items-end justify-between gap-2 h-48 mt-2">
            {cashFlow.daily.map((bar, index) => {
              const heightPct = Math.max((Math.max(0, bar.net) / maxFlow) * 100, 4);
              const isSelected = index === selectedDay;
              return (
                <button
                  key={bar.date}
                  type="button"
                  onClick={() => setSelectedDay(index)}
                  className="flex flex-col items-center justify-end flex-1 h-full min-w-0"
                  title={`${friendlyDay(bar.date)} · ${formatMoneySigned(bar.net)}`}
                >
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className={`w-full max-w-[2.5rem] rounded-t-lg transition-all duration-500 ${
                        isSelected ? 'bg-sky-500' : 'bg-sky-200'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span
                    className={`mt-2 text-xs ${
                      isSelected ? 'text-sky-600 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {weekdayLetter(bar.date)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Ventes : espèces vs crédit */}
        <div className="card">
          <h2 className="text-lg font-bold text-marine-900 mb-4">Ventes : espèces vs crédit</h2>
          <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full bg-success-500" style={{ width: `${cashFraction}%` }} />
            <div className="h-full bg-warning-500" style={{ width: `${creditFraction}%` }} />
          </div>
          <div className="flex justify-between mt-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
                <span className="text-sm font-bold text-marine-900">Espèces · {cashCount}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{cashSharePercent}% des ventes</p>
              <p className="text-sm font-semibold text-marine-900 mt-1">{formatMoney(cashAmount)}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="w-2.5 h-2.5 rounded-full bg-warning-500" />
                <span className="text-sm font-bold text-marine-900">Crédit · {creditCount}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                ticket moy. {formatMoney(creditAvgTicket)}
              </p>
              <p className="text-sm font-semibold text-marine-900 mt-1">
                {formatMoney(creditAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top produits */}
        <div className="card">
          <h2 className="text-lg font-bold text-marine-900 mb-4">Top produits</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Aucune vente sur cette période</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map(product => (
                <div key={product.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-marine-900 truncate pr-3">
                      {product.name}
                    </span>
                    <span className="text-sm font-semibold text-marine-900 whitespace-nowrap">
                      {formatMoney(product.value)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${(product.value / maxTopValue) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{product.count} vendus</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Répartition des encaissements */}
        <div className="card">
          <h2 className="text-lg font-bold text-marine-900 mb-4">Répartition des encaissements</h2>
          {cashFlow.by_category_in.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Aucun encaissement sur cette période</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cashFlow.by_category_in.map(row => {
                const percent =
                  cashFlow.total_in > 0 ? Math.round((row.amount / cashFlow.total_in) * 100) : 0;
                return (
                  <div key={row.category} className="flex items-center gap-3 py-3">
                    <span className="text-sm font-medium text-marine-900 flex-1 truncate">
                      {ENCAISSEMENT_LABELS[row.category] ?? 'Autres'}
                    </span>
                    <span className="text-sm font-semibold text-marine-900 whitespace-nowrap">
                      {formatMoney(row.amount)}
                    </span>
                    <span className="text-xs font-bold text-sky-600 w-10 text-right">{percent}%</span>
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

// ============================================================
// Vue réseau (multi-boutiques)
// ============================================================

function NetworkBusinessReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<NetworkReport | null>(null);

  const loadNetwork = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportsApi.getNetwork();
      setReport(data);
    } catch {
      setError('Impossible de charger le rapport réseau. Veuillez réessayer.');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  const shops: NetworkShopReport[] = report?.shops ?? [];
  const totals = report?.totals ?? null;
  const maxCa = shops.reduce((max, shop) => Math.max(max, shop.ca_jour), 0);

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-12 h-12 spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-50 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <p className="text-slate-600 mb-4">{error}</p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-marine-900 text-white font-semibold text-sm hover:bg-marine-800 transition-colors"
          onClick={loadNetwork}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!report || shops.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
          <span className="text-3xl">🏬</span>
        </div>
        <p className="text-slate-500">Aucune boutique à afficher sur le réseau</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cartes KPI réseau */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            CA réseau (jour)
          </p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {formatNetworkAmount(totals?.ca_reseau ?? 0)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Marge moyenne</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {formatPercent(totals?.marge_moyenne ?? 0)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Trésorerie réseau
          </p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {formatNetworkAmount(totals?.tresorerie_reseau ?? 0)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Créances réseau
          </p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {formatNetworkAmount(totals?.creances_reseau ?? 0)}
          </p>
        </div>
      </div>

      {/* Performance par boutique + CA par boutique */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tableau performance par boutique */}
        <div className="card xl:col-span-2">
          <h2 className="text-lg font-bold text-marine-900 mb-5">Performance par boutique</h2>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Boutique
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    CA du jour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Marge
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Caisse
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Créances
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    État
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shops.map(shop => {
                  const badge = getHealthBadge(shop.etat);
                  return (
                    <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-marine-900">{shop.name}</td>
                      <td className="px-6 py-4 text-right font-semibold text-marine-900">
                        {formatNetworkAmount(shop.ca_jour)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">
                        {formatPercent(shop.marge)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">
                        {formatNetworkAmount(shop.caisse)}
                      </td>
                      <td className="px-6 py-4 text-right text-danger-600 font-medium">
                        {formatNetworkAmount(shop.creances)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`badge ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Graphe CA par boutique — barres verticales CSS */}
        <div className="card">
          <h2 className="text-lg font-bold text-marine-900">CA par boutique</h2>
          <p className="text-xs text-slate-400 mb-5">Aujourd'hui</p>

          <div className="flex items-end justify-between gap-2 h-48">
            {shops.map(shop => {
              const heightPct = maxCa > 0 ? Math.max((shop.ca_jour / maxCa) * 100, 4) : 4;
              return (
                <div
                  key={shop.id}
                  className="flex flex-col items-center justify-end flex-1 h-full min-w-0"
                  title={`${shop.name} · ${formatNetworkAmount(shop.ca_jour)}`}
                >
                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      className="w-full max-w-[2.5rem] rounded-t-lg bg-sky-500 transition-all duration-500"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="mt-2 text-[10px] text-slate-500 truncate w-full text-center">
                    {shop.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page principale (onglets Réseau / Ma boutique)
// ============================================================

type ReportTab = 'network' | 'shop';

export default function BusinessReports() {
  const navigate = useNavigate();
  const { enterprise } = useAuthStore();
  const { can, isPermissive } = usePermissions();
  const canView = isPermissive || can('reports', 'view');

  const [tab, setTab] = useState<ReportTab>('shop');

  useEffect(() => {
    if (!canView) {
      navigate('/');
    }
  }, [canView, navigate]);

  if (!canView) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Rapports</h1>
          <p className="text-sm text-slate-500 mt-1">
            {tab === 'shop'
              ? 'Analyse de l’activité de la boutique'
              : `Vue réseau${enterprise?.name ? ` · ${enterprise.name}` : ''}`}
          </p>
        </div>

        {/* Onglets de vue */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTab('shop')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'shop'
                ? 'bg-marine-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-marine-900'
            }`}
          >
            Ma boutique
          </button>
          <button
            type="button"
            onClick={() => setTab('network')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'network'
                ? 'bg-marine-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-marine-900'
            }`}
          >
            Réseau
          </button>
        </div>
      </div>

      {tab === 'shop' ? <ShopBusinessReport /> : <NetworkBusinessReport />}
    </div>
  );
}
