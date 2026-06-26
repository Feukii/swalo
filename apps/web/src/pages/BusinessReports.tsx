import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { cashApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

type PeriodKey = 'today' | 'week' | 'month' | 'year';

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('today');
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

  const grossMargin =
    stats && stats.totalEntries > 0
      ? (((stats.totalEntries - stats.totalExits) / stats.totalEntries) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête + sélecteur de période */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Rapports</h1>
          <p className="text-sm text-slate-500 mt-1">Analyses &amp; exports</p>
        </div>
        <div className="inline-flex rounded-xl bg-white shadow-card p-1 self-start">
          {periods.map(period => (
            <button
              key={period.value}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-marine-900 text-white'
                  : 'text-slate-600 hover:text-action-600'
              }`}
              onClick={() => setSelectedPeriod(period.value as PeriodKey)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-block w-12 h-12 spinner"></div>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Cartes KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                CA boutique ({getPeriodLabel()})
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatCurrency(stats.totalEntries, 'XOF', 'fr-FR')}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Marge moyenne
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">{grossMargin} %</p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Trésorerie (caisse)
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatCurrency(stats.balance, 'XOF', 'fr-FR')}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Créances</p>
              <p className="text-2xl font-bold text-danger-600 mt-2">
                {formatCurrency(financialSummary.totalReceivables, 'XOF', 'fr-FR')}
              </p>
            </div>
          </div>

          {/* Performance + CA */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Sommaire financier */}
            <div className="card xl:col-span-2">
              <h2 className="text-lg font-bold text-marine-900 mb-5">Sommaire financier</h2>

              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Poste
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        État
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-marine-900">Créances clients</td>
                      <td className="px-6 py-4 text-right font-semibold text-success-600">
                        {formatCurrency(financialSummary.totalReceivables, 'XOF', 'fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="badge bg-success-100 text-success-700">À recevoir</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-marine-900">Dettes fournisseurs</td>
                      <td className="px-6 py-4 text-right font-semibold text-danger-600">
                        {formatCurrency(financialSummary.totalDebts, 'XOF', 'fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="badge bg-danger-100 text-danger-700">À payer</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-marine-900">
                        Solde net (créances − dettes)
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-bold ${
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
                      </td>
                      <td className="px-6 py-4">
                        {financialSummary.totalReceivables - financialSummary.totalDebts >= 0 ? (
                          <span className="badge bg-success-100 text-success-700">Sain</span>
                        ) : (
                          <span className="badge bg-warning-100 text-warning-700">À surveiller</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Entrées / Sorties — barres sky */}
            <div className="card">
              <h2 className="text-lg font-bold text-marine-900">Flux de caisse</h2>
              <p className="text-xs text-slate-400 mb-5">{getPeriodLabel()}</p>

              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-sm font-medium text-slate-600">Entrées</p>
                    <p className="text-sm font-semibold text-marine-900">
                      {formatCurrency(stats.totalEntries, 'XOF', 'fr-FR')}
                    </p>
                  </div>
                  <div className="h-7 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-lg transition-all duration-500"
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
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-sm font-medium text-slate-600">Sorties</p>
                    <p className="text-sm font-semibold text-marine-900">
                      {formatCurrency(stats.totalExits, 'XOF', 'fr-FR')}
                    </p>
                  </div>
                  <div className="h-7 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-sky-300 rounded-lg transition-all duration-500"
                      style={{
                        width:
                          stats.totalExits > 0
                            ? `${Math.min((stats.totalExits / (stats.totalEntries + stats.totalExits)) * 100, 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Résultat net</p>
                  <p
                    className={`text-xl font-bold ${
                      stats.net >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}
                  >
                    {stats.net >= 0 ? '+' : ''}
                    {formatCurrency(stats.net, 'XOF', 'fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Répartitions par catégorie */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {getEntriesDistribution().length > 0 && (
              <div className="card">
                <h2 className="text-lg font-bold text-marine-900 mb-5">Répartition des entrées</h2>
                <div className="space-y-4">
                  {getEntriesDistribution().map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{item.category}</span>
                        <span className="text-sm font-semibold text-marine-900">
                          {formatCurrency(item.amount, 'XOF', 'fr-FR')}
                          <span className="text-slate-400 font-normal ml-2">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-5 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-md transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getExitsDistribution().length > 0 && (
              <div className="card">
                <h2 className="text-lg font-bold text-marine-900 mb-5">Répartition des sorties</h2>
                <div className="space-y-4">
                  {getExitsDistribution().map((item, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-slate-700">{item.category}</span>
                        <span className="text-sm font-semibold text-marine-900">
                          {formatCurrency(item.amount, 'XOF', 'fr-FR')}
                          <span className="text-slate-400 font-normal ml-2">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="h-5 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-sky-300 rounded-md transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Historique des opérations */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-marine-900">Historique des opérations</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {entries.length} opération{entries.length > 1 ? 's' : ''} · {getPeriodLabel()}
                </p>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <span className="text-3xl">📋</span>
                </div>
                <p className="text-slate-500">Aucune opération sur cette période</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {(showAllEntries ? entries : entries.slice(0, 5)).map(entry => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-start py-4 hover:bg-slate-50 transition-colors -mx-2 px-2 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="mb-1.5">
                          <span
                            className={`badge ${
                              entry.type === 'IN'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {entry.type === 'IN' ? 'Entrée' : 'Sortie'} · {entry.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1">{formatDate(entry.created_at)}</p>
                        {(entry.supplier || entry.customer) && (
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            {entry.supplier &&
                              (entry.supplier.first_name
                                ? `${entry.supplier.first_name} ${entry.supplier.name}`
                                : entry.supplier.name)}
                            {entry.customer &&
                              (entry.customer.first_name
                                ? `${entry.customer.first_name} ${entry.customer.name}`
                                : entry.customer.name)}
                          </p>
                        )}
                        {entry.note && <p className="text-xs text-slate-500 mt-1">{entry.note}</p>}
                      </div>
                      <p
                        className={`text-base font-bold ml-4 ${
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
                    className="w-full mt-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg font-semibold text-action-600 transition-colors text-sm"
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
        </div>
      ) : null}
    </div>
  );
}
