import { useState, useEffect } from 'react';
import { cashApi, receivablesApi, debtsApi, productsApi, salesApi } from '../lib/api';

interface CashStats {
  balance: number;
  todayEntries: number;
  todayExits: number;
  todayNet: number;
  entriesCount: number;
  exitsCount: number;
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

export default function Home() {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
          <p className="mt-4 text-gray-500 text-sm">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-red-600 font-semibold mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-colors"
            >
              Reessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const todayEntries = cashStats?.todayEntries || 0;
  const todayExits = cashStats?.todayExits || 0;
  const todayNet = cashStats?.todayNet || 0;
  const todaySalesCount = salesStats?.today_sales || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
            <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activite</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Card - Solde de caisse */}
        <div
          className="rounded-2xl p-8 text-center shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #0F2A44 0%, #183B5A 100%)',
          }}
        >
          <p className="text-sm font-medium text-white/80 mb-2">Solde de caisse</p>
          <p className="text-4xl font-bold text-white tracking-tight">
            {formatFCFA(cashBalance)}
          </p>
        </div>

        {/* KPI Cards - Activite du jour */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activite du jour</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventes du jour */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Ventes du jour
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {todaySalesCount}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                vente{todaySalesCount > 1 ? 's' : ''}
              </p>
            </div>

            {/* Entrees */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2">
                Entrees
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatFCFA(todayEntries)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {cashStats?.entriesCount || 0} operation{(cashStats?.entriesCount || 0) > 1 ? 's' : ''}
              </p>
            </div>

            {/* Sorties */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
                Sorties
              </p>
              <p className="text-2xl font-bold text-red-600">
                {formatFCFA(todayExits)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {cashStats?.exitsCount || 0} operation{(cashStats?.exitsCount || 0) > 1 ? 's' : ''}
              </p>
            </div>

            {/* Solde Net */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Solde Net
              </p>
              <p className={`text-2xl font-bold ${todayNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {todayNet >= 0 ? '+' : ''}{formatFCFA(todayNet)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                entrees - sorties
              </p>
            </div>
          </div>
        </div>

        {/* Creances & Dettes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Creances clients */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Creances clients</h3>
            {receivablesStats ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Montant total du</p>
                  <p className="text-3xl font-bold text-orange-500">
                    {formatFCFA(receivablesStats.totalReceivable)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {receivablesStats.totalCount}
                    </p>
                    <p className="text-xs text-gray-500">Actives</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {receivablesStats.pendingCount}
                    </p>
                    <p className="text-xs text-gray-500">En attente</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {receivablesStats.partialCount}
                    </p>
                    <p className="text-xs text-gray-500">Partielles</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Aucune donnee disponible</p>
            )}
          </div>

          {/* Dettes fournisseurs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dettes fournisseurs</h3>
            {debtsStats ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Montant total du</p>
                  <p className="text-3xl font-bold text-red-500">
                    {formatFCFA(debtsStats.totalDebt)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {debtsStats.totalCount}
                    </p>
                    <p className="text-xs text-gray-500">Actives</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {debtsStats.pendingCount}
                    </p>
                    <p className="text-xs text-gray-500">En attente</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {debtsStats.partialCount}
                    </p>
                    <p className="text-xs text-gray-500">Partielles</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Aucune donnee disponible</p>
            )}
          </div>
        </div>

        {/* Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock</h3>
          {productStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Total produits</p>
                <p className="text-2xl font-bold text-gray-900">
                  {productStats.total_products}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {productStats.active_products} actif{productStats.active_products > 1 ? 's' : ''}
                </p>
              </div>
              <div className={`rounded-lg p-4 text-center ${productStats.low_stock_count > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className="text-sm text-gray-500 mb-1">Alertes stock faible</p>
                <p className={`text-2xl font-bold ${productStats.low_stock_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {productStats.low_stock_count}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {productStats.low_stock_count > 0 ? 'produit(s) en alerte' : 'tout est en ordre'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Valeur du stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatFCFA(productStats.total_inventory_value)}
                </p>
                <p className="text-xs text-gray-400 mt-1">valeur totale inventaire</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Chiffre d'affaires total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatFCFA(salesStats?.total_revenue || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {salesStats?.total_sales || 0} vente{(salesStats?.total_sales || 0) > 1 ? 's' : ''} au total
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Aucune donnee disponible</p>
          )}
        </div>
      </div>
    </div>
  );
}
