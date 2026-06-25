import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { cashApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface PeriodStats {
  totalEntries: number;
  totalExits: number;
  net: number;
  balance: number;
  entriesCount: number;
  exitsCount: number;
}

interface CashEntry {
  id: string;
  type: 'IN' | 'OUT';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  supplier?: {
    name: string;
    first_name?: string;
  };
  customer?: {
    name: string;
    first_name?: string;
  };
}

interface CategoryDistribution {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface FinancialSummary {
  totalReceivables: number;
  totalDebts: number;
}

export default function BusinessReports() {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>(
    'today'
  );
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    totalReceivables: 0,
    totalDebts: 0,
  });

  const periods = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'year', label: 'Cette année' },
  ];

  // Colors for charts
  const entryColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];
  const exitColors = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];

  useEffect(() => {
    checkAccess();
  }, []);

  useEffect(() => {
    if (role !== 'EMPLOYEE') {
      loadStats();
      loadFinancialSummary();
    }
  }, [selectedPeriod, role]);

  const checkAccess = () => {
    if (role === 'EMPLOYEE') {
      navigate('/');
    }
  };

  const getPeriodDates = () => {
    const now = new Date();
    const start = new Date();

    switch (selectedPeriod) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
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

    return {
      start_date: start.toISOString(),
      end_date: now.toISOString(),
    };
  };

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const dates = getPeriodDates();
      const [statsData, balanceData, entriesData] = await Promise.all([
        cashApi.getStats(dates),
        cashApi.getBalance(),
        cashApi.getAll(dates),
      ]);

      setStats({
        totalEntries: statsData.todayEntries || 0,
        totalExits: statsData.todayExits || 0,
        net: (statsData.todayEntries || 0) - (statsData.todayExits || 0),
        balance: balanceData.balance || 0,
        entriesCount: statsData.entriesCount || 0,
        exitsCount: statsData.exitsCount || 0,
      });

      setEntries(entriesData);
    } catch (error) {
      console.error('Erreur lors du chargement des stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFinancialSummary = async () => {
    try {
      // Calculer les créances/dettes pour la période sélectionnée
      // en analysant les entrées de caisse liées aux clients/fournisseurs
      const dates = getPeriodDates();
      const entriesData = await cashApi.getAll(dates);

      let totalReceivables = 0;
      let totalDebts = 0;

      entriesData.forEach((entry: any) => {
        // Créances clients (entrées liées aux clients)
        if (entry.type === 'IN' && entry.customer_id) {
          totalReceivables += entry.amount || 0;
        }
        // Dettes fournisseurs (sorties liées aux fournisseurs)
        if (entry.type === 'OUT' && entry.supplier_id) {
          totalDebts += entry.amount || 0;
        }
      });

      setFinancialSummary({ totalReceivables, totalDebts });
    } catch (error) {
      console.error('Erreur lors du chargement du sommaire financier:', error);
      setFinancialSummary({ totalReceivables: 0, totalDebts: 0 });
    }
  };

  const getPeriodLabel = () => {
    const period = periods.find(p => p.value === selectedPeriod);
    return period?.label || 'Période';
  };

  const getEntriesDistribution = (): CategoryDistribution[] => {
    const entriesOnly = entries.filter(e => e.type === 'IN');
    if (entriesOnly.length === 0) return [];

    const categoryTotals: { [key: string]: number } = {};
    let total = 0;

    entriesOnly.forEach(entry => {
      categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + entry.amount;
      total += entry.amount;
    });

    return Object.entries(categoryTotals)
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: (amount / total) * 100,
        color: entryColors[index % entryColors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  const getExitsDistribution = (): CategoryDistribution[] => {
    const exitsOnly = entries.filter(e => e.type === 'OUT');
    if (exitsOnly.length === 0) return [];

    const categoryTotals: { [key: string]: number } = {};
    let total = 0;

    exitsOnly.forEach(entry => {
      categoryTotals[entry.category] = (categoryTotals[entry.category] || 0) + entry.amount;
      total += entry.amount;
    });

    return Object.entries(categoryTotals)
      .map(([category, amount], index) => ({
        category,
        amount,
        percentage: (amount / total) * 100,
        color: exitColors[index % exitColors.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (role === 'EMPLOYEE') {
    return null;
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Bilans & Rapports</h1>
              <p className="text-sm text-slate-500 mt-1">Analyse de l'activité</p>
            </div>
            <button onClick={() => navigate(-1)} className="btn-secondary">
              ← Retour
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {periods.map(period => (
            <button
              key={period.value}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-action-500 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-action-50 hover:text-action-600'
              }`}
              onClick={() => setSelectedPeriod(period.value as any)}
            >
              {period.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-action-500"></div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="card">
              <h2 className="text-xl font-bold text-slate-900 mb-6">📊 Sommaire Financier</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium mb-2">Total Créances Clients</p>
                  <p className="text-2xl font-bold text-success-600 mb-1">
                    {formatCurrency(financialSummary.totalReceivables, 'XOF', 'fr-FR')}
                  </p>
                  <p className="text-xs text-slate-400">À recevoir</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 font-medium mb-2">
                    Total Dettes Fournisseurs
                  </p>
                  <p className="text-2xl font-bold text-danger-600 mb-1">
                    {formatCurrency(financialSummary.totalDebts, 'XOF', 'fr-FR')}
                  </p>
                  <p className="text-xs text-slate-400">À payer</p>
                </div>
              </div>

              <div className="bg-action-50 rounded-xl p-4 text-center">
                <p className="text-sm text-action-700 font-semibold mb-2">
                  Solde Net (Créances - Dettes)
                </p>
                <p
                  className={`text-3xl font-bold ${
                    financialSummary.totalReceivables - financialSummary.totalDebts >= 0
                      ? 'text-success-600'
                      : 'text-danger-600'
                  }`}
                >
                  {formatCurrency(
                    financialSummary.totalReceivables - financialSummary.totalDebts,
                    'XOF',
                    'fr-FR'
                  )}
                </p>
              </div>
            </div>

            {/* Period Stats */}
            <div className="card">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                Chiffre d'affaires - {getPeriodLabel()}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">↗️</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Entrées</p>
                  <p className="text-2xl font-bold text-slate-900 mb-1">
                    {formatCurrency(stats.totalEntries, 'XOF', 'fr-FR')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {stats.entriesCount} opération{stats.entriesCount > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">↙️</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">Sorties</p>
                  <p className="text-2xl font-bold text-slate-900 mb-1">
                    {formatCurrency(stats.totalExits, 'XOF', 'fr-FR')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {stats.exitsCount} opération{stats.exitsCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl p-4 text-center ${
                  stats.net >= 0 ? 'bg-success-100' : 'bg-danger-100'
                }`}
              >
                <p className="text-sm text-slate-700 mb-2">Résultat net</p>
                <p
                  className={`text-3xl font-bold ${
                    stats.net >= 0 ? 'text-success-700' : 'text-danger-700'
                  }`}
                >
                  {stats.net >= 0 ? '+' : ''}
                  {formatCurrency(stats.net, 'XOF', 'fr-FR')}
                </p>
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="card">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Comparaison Entrées/Sorties</h2>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold text-slate-700">Entrées</p>
                    <p className="text-base font-semibold text-slate-900">
                      {formatCurrency(stats.totalEntries, 'XOF', 'fr-FR')}
                    </p>
                  </div>
                  <div className="h-8 bg-slate-200 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-success-500 rounded-lg transition-all duration-500"
                      style={{
                        width:
                          stats.totalEntries > 0
                            ? `${Math.min((stats.totalEntries / (stats.totalEntries + stats.totalExits)) * 100, 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold text-slate-700">Sorties</p>
                    <p className="text-base font-semibold text-slate-900">
                      {formatCurrency(stats.totalExits, 'XOF', 'fr-FR')}
                    </p>
                  </div>
                  <div className="h-8 bg-slate-200 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-danger-500 rounded-lg transition-all duration-500"
                      style={{
                        width:
                          stats.totalExits > 0
                            ? `${Math.min((stats.totalExits / (stats.totalEntries + stats.totalExits)) * 100, 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Entries Distribution */}
            {getEntriesDistribution().length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold text-slate-900 mb-6">📈 Répartition des Entrées</h2>
                <div className="space-y-4">
                  {getEntriesDistribution().map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-semibold text-slate-700">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-6 bg-slate-200 rounded-md overflow-hidden mb-1">
                        <div
                          className="h-full rounded-md transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <p className="text-sm text-slate-600 font-semibold">
                        {formatCurrency(item.amount, 'XOF', 'fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exits Distribution */}
            {getExitsDistribution().length > 0 && (
              <div className="card">
                <h2 className="text-xl font-bold text-slate-900 mb-6">📉 Répartition des Sorties</h2>
                <div className="space-y-4">
                  {getExitsDistribution().map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-semibold text-slate-700">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-6 bg-slate-200 rounded-md overflow-hidden mb-1">
                        <div
                          className="h-full rounded-md transition-all duration-500"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                      <p className="text-sm text-slate-600 font-semibold">
                        {formatCurrency(item.amount, 'XOF', 'fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History Section */}
            <div className="card">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Historique des opérations - {getPeriodLabel()}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {entries.length} opération{entries.length > 1 ? 's' : ''}
                </p>
              </div>

              {entries.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">📋</span>
                  <p className="text-slate-500">Aucune opération sur cette période</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {(showAllEntries ? entries : entries.slice(0, 5)).map(entry => (
                      <div
                        key={entry.id}
                        className="flex justify-between items-start p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="mb-2">
                            <span
                              className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold ${
                                entry.type === 'IN'
                                  ? 'bg-success-100 text-success-800'
                                  : 'bg-danger-100 text-danger-800'
                              }`}
                            >
                              {entry.type === 'IN' ? '↗️' : '↙️'} {entry.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-1">
                            {formatDate(entry.created_at)}
                          </p>
                          {(entry.supplier || entry.customer) && (
                            <p className="text-sm font-medium text-slate-700 mb-1">
                              {entry.supplier &&
                                `🏭 ${entry.supplier.first_name ? `${entry.supplier.first_name} ${entry.supplier.name}` : entry.supplier.name}`}
                              {entry.customer &&
                                `👤 ${entry.customer.first_name ? `${entry.customer.first_name} ${entry.customer.name}` : entry.customer.name}`}
                            </p>
                          )}
                          {entry.note && <p className="text-xs text-slate-600 mt-1">{entry.note}</p>}
                        </div>
                        <p
                          className={`text-lg font-bold ml-4 ${
                            entry.type === 'IN' ? 'text-success-600' : 'text-danger-600'
                          }`}
                        >
                          {entry.type === 'IN' ? '+' : '-'}
                          {formatCurrency(entry.amount, 'XOF', 'fr-FR')}
                        </p>
                      </div>
                    ))}
                  </div>

                  {entries.length > 5 && (
                    <button
                      className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-action-600 transition-colors"
                      onClick={() => setShowAllEntries(!showAllEntries)}
                    >
                      {showAllEntries
                        ? 'Voir moins'
                        : `Voir toutes les opérations (${entries.length})`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Info Box */}
            <div className="flex gap-3 bg-action-50 rounded-xl p-4">
              <span className="text-2xl">ℹ️</span>
              <div>
                <h3 className="text-sm font-semibold text-action-700 mb-2">
                  Fonctionnalités à venir
                </h3>
                <p className="text-sm text-action-600 leading-relaxed">
                  • Graphiques détaillés par catégorie
                  <br />
                  • Suivi des créances clients
                  <br />
                  • Suivi des dettes fournisseurs
                  <br />
                  • Export des rapports en PDF
                  <br />• Comparaisons sur plusieurs périodes
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
