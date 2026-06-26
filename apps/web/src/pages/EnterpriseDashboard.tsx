import { useState, useEffect } from 'react';
import { enterpriseApi, transfersApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface Enterprise {
  id: string;
  code: string;
  name: string;
  owner_id: string;
  created_at: string;
  owner?: { id: string; display_name: string };
  shops?: Shop[];
}

interface Shop {
  id: string;
  code: string;
  name: string;
  shop_type: string;
}

interface EnterpriseStats {
  total_shops: number;
  total_products: number;
  total_sales: number;
  total_revenue: number;
  total_customers: number;
  total_pending_transfers: number;
}

interface ShopFinancialHealth {
  shop_id: string;
  shop_name: string;
  revenue: number;
  cash_balance: number;
  net_cash_flow: number;
  receivables_outstanding: number;
  supplier_debts: number;
  stock_value: number;
  low_stock_count: number;
  health_score: number;
}

interface FinancialSummary {
  enterprise: {
    total_shops: number;
    revenue: number;
    cash_balance: number;
    net_cash_flow: number;
    receivables_outstanding: number;
    supplier_debts: number;
    stock_value: number;
    low_stock_count: number;
    health_score: number;
  };
  per_shop: ShopFinancialHealth[];
  period: { start_date: string | null; end_date: string | null };
}

interface Transfer {
  id: string;
  status: string;
  notes?: string;
  created_at: string;
  source_shop: { id: string; code: string; name: string };
  target_shop: { id: string; code: string; name: string };
  creator: { id: string; display_name: string };
  items: Array<{
    id: string;
    product_sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
    total: number;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-warning-100 text-warning-800' },
  CONFIRMED: { label: 'Confirme', className: 'bg-action-100 text-action-800' },
  SHIPPED: { label: 'Expedie', className: 'bg-action-100 text-action-700' },
  RECEIVED: { label: 'Recu', className: 'bg-success-100 text-success-800' },
  CANCELLED: { label: 'Annule', className: 'bg-danger-100 text-danger-800' },
};

export default function EnterpriseDashboard() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [stats, setStats] = useState<EnterpriseStats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadEnterprises();
    loadTransfers();
  }, []);

  useEffect(() => {
    if (selectedEnterprise) {
      loadEnterpriseDetails(selectedEnterprise.id);
      loadFinancialSummary(selectedEnterprise.id);
    }
  }, [selectedEnterprise]);

  const loadEnterprises = async () => {
    try {
      setIsLoading(true);
      const data = await enterpriseApi.getAll();
      setEnterprises(data);
      if (data.length > 0) {
        setSelectedEnterprise(data[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des entreprises');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEnterpriseDetails = async (id: string) => {
    try {
      const [statsData, shopsData] = await Promise.all([
        enterpriseApi.getStats(id),
        enterpriseApi.getShops(id),
      ]);
      setStats(statsData);
      setShops(shopsData);
    } catch (err: any) {
      console.error('Erreur chargement details entreprise:', err);
    }
  };

  const loadFinancialSummary = async (id: string) => {
    try {
      const filters: { start_date?: string; end_date?: string } = {};
      if (startDate) filters.start_date = new Date(startDate).toISOString();
      if (endDate) filters.end_date = new Date(endDate).toISOString();
      const data = await enterpriseApi.getFinancialSummary(id, filters);
      setFinancialSummary(data);
    } catch (err: any) {
      console.error('Erreur chargement recapitulatif financier:', err);
    }
  };

  const handleApplyFilter = () => {
    if (selectedEnterprise) {
      loadFinancialSummary(selectedEnterprise.id);
    }
  };

  const loadTransfers = async () => {
    try {
      const data = await transfersApi.getAll();
      setTransfers(data);
    } catch (err: any) {
      console.error('Erreur chargement transferts:', err);
    }
  };

  const handleTransferAction = async (
    transferId: string,
    action: 'confirm' | 'ship' | 'receive' | 'cancel'
  ) => {
    const actionLabels: Record<string, string> = {
      confirm: 'confirmer',
      ship: 'expedier',
      receive: 'recevoir',
      cancel: 'annuler',
    };

    if (!window.confirm(`Voulez-vous ${actionLabels[action]} ce transfert ?`)) return;

    setActionLoading(transferId);
    try {
      await transfersApi[action](transferId);
      await loadTransfers();
      if (selectedEnterprise) {
        await loadEnterpriseDetails(selectedEnterprise.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Erreur lors de l'operation");
    } finally {
      setActionLoading(null);
    }
  };

  const getTransferTotal = (transfer: Transfer) => {
    return transfer.items.reduce((sum, item) => sum + item.total, 0);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const pendingTransfers = transfers.filter(t =>
    ['DRAFT', 'CONFIRMED', 'SHIPPED'].includes(t.status)
  );
  const completedTransfers = transfers.filter(t => t.status === 'RECEIVED');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-50 border border-danger-200 rounded-xl p-6 text-center">
        <p className="text-danger-600 font-medium">{error}</p>
        <button
          onClick={loadEnterprises}
          className="mt-4 px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors"
        >
          Reessayer
        </button>
      </div>
    );
  }

  if (enterprises.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-12 text-center">
        <div className="text-5xl mb-4">🏢</div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Aucune entreprise</h2>
        <p className="text-slate-500">
          Vous n'avez pas encore cree d'entreprise pour regrouper vos boutiques.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enterprise Selector */}
      {enterprises.length > 1 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Entreprise :</label>
          <select
            value={selectedEnterprise?.id || ''}
            onChange={e => {
              const ent = enterprises.find(en => en.id === e.target.value);
              if (ent) setSelectedEnterprise(ent);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-action-500 focus:border-action-500"
          >
            {enterprises.map(ent => (
              <option key={ent.id} value={ent.id}>
                {ent.name} ({ent.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Boutiques</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_shops}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Produits</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_products}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Ventes</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_sales}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-action-700 mt-1">
              {formatCurrency(stats.total_revenue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Clients</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total_customers}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Transferts en cours</p>
            <p className="text-2xl font-bold text-warning-600 mt-1">
              {stats.total_pending_transfers}
            </p>
          </div>
        </div>
      )}

      {/* Sante financiere par boutique */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Sante financiere par boutique</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-0.5">Du</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-action-500 focus:border-action-500"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-0.5">Au</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-action-500 focus:border-action-500"
              />
            </div>
            <button
              onClick={handleApplyFilter}
              className="px-3 py-1.5 bg-action-500 text-white text-sm font-medium rounded-lg hover:bg-action-600 transition-colors"
            >
              Appliquer
            </button>
          </div>
        </div>
        <p className="px-6 pt-3 text-xs text-slate-400">
          Le chiffre d'affaires est filtre par la periode. La tresorerie (solde de caisse), les
          creances, dettes et la valeur du stock sont calcules en cumul (tous temps confondus).
        </p>
        <div className="overflow-x-auto p-2">
          {!financialSummary || financialSummary.per_shop.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">
              Aucune donnee financiere disponible
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Boutique</th>
                  <th className="px-4 py-2 font-medium text-right">CA (periode)</th>
                  <th className="px-4 py-2 font-medium text-right">Solde caisse</th>
                  <th className="px-4 py-2 font-medium text-right">Creances</th>
                  <th className="px-4 py-2 font-medium text-right">Dettes fourn.</th>
                  <th className="px-4 py-2 font-medium text-right">Valeur stock</th>
                  <th className="px-4 py-2 font-medium text-right">Alertes stock</th>
                  <th className="px-4 py-2 font-medium text-right">Score sante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financialSummary.per_shop.map(shop => (
                  <tr key={shop.shop_id} className="text-slate-700">
                    <td className="px-4 py-2 font-medium text-slate-900">{shop.shop_name}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(shop.revenue)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(shop.cash_balance)}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(shop.receivables_outstanding)}
                    </td>
                    <td className="px-4 py-2 text-right text-danger-600">
                      {formatCurrency(shop.supplier_debts)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(shop.stock_value)}</td>
                    <td className="px-4 py-2 text-right">
                      {shop.low_stock_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                          {shop.low_stock_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${
                        shop.health_score >= 0 ? 'text-success-700' : 'text-danger-700'
                      }`}
                    >
                      {formatCurrency(shop.health_score)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-semibold text-slate-900 bg-slate-50">
                  <td className="px-4 py-2">Total entreprise</td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(financialSummary.enterprise.revenue)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(financialSummary.enterprise.cash_balance)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(financialSummary.enterprise.receivables_outstanding)}
                  </td>
                  <td className="px-4 py-2 text-right text-danger-600">
                    {formatCurrency(financialSummary.enterprise.supplier_debts)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(financialSummary.enterprise.stock_value)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {financialSummary.enterprise.low_stock_count}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatCurrency(financialSummary.enterprise.health_score)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Shops List */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Boutiques ({shops.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {shops.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">
              Aucune boutique dans cette entreprise
            </div>
          ) : (
            shops.map(shop => (
              <div key={shop.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-action-50 flex items-center justify-center">
                    <span className="text-lg">{shop.shop_type === 'MAGASIN' ? '🏭' : '🏪'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{shop.name}</p>
                    <p className="text-sm text-slate-500">
                      {shop.code} - {shop.shop_type === 'MAGASIN' ? 'Magasin' : 'Boutique'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Transfers */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Transferts en cours ({pendingTransfers.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingTransfers.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">Aucun transfert en cours</div>
          ) : (
            pendingTransfers.map(transfer => {
              const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
              const total = getTransferTotal(transfer);
              const itemCount = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div key={transfer.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {transfer.source_shop.name}
                      </span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="font-medium text-slate-900">
                        {transfer.target_shop.name}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                    <span>{formatDate(transfer.created_at)}</span>
                    <span>
                      {transfer.items.length} article{transfer.items.length > 1 ? 's' : ''} -{' '}
                      {itemCount} unite{itemCount > 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
                    {transfer.notes && (
                      <span className="italic text-slate-400 truncate max-w-xs">
                        {transfer.notes}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {transfer.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'confirm')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-action-500 text-white text-xs font-medium rounded-lg hover:bg-action-600 disabled:opacity-50 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'cancel')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-danger-600 text-white text-xs font-medium rounded-lg hover:bg-danger-700 disabled:opacity-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                    {transfer.status === 'CONFIRMED' && (
                      <>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'ship')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-action-500 text-white text-xs font-medium rounded-lg hover:bg-action-600 disabled:opacity-50 transition-colors"
                        >
                          Expedier
                        </button>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'cancel')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-danger-600 text-white text-xs font-medium rounded-lg hover:bg-danger-700 disabled:opacity-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                    {transfer.status === 'SHIPPED' && (
                      <button
                        onClick={() => handleTransferAction(transfer.id, 'receive')}
                        disabled={actionLoading === transfer.id}
                        className="px-3 py-1.5 bg-success-600 text-white text-xs font-medium rounded-lg hover:bg-success-700 disabled:opacity-50 transition-colors"
                      >
                        Confirmer reception
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Completed Transfers */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Transferts termines ({completedTransfers.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {completedTransfers.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">Aucun transfert termine</div>
          ) : (
            completedTransfers.slice(0, 10).map(transfer => {
              const total = getTransferTotal(transfer);
              return (
                <div key={transfer.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900">{transfer.source_shop.name}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="font-medium text-slate-900">{transfer.target_shop.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">{formatDate(transfer.created_at)}</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800">
                      Recu
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
