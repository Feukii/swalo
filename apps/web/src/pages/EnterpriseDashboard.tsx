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
  DRAFT: { label: 'Brouillon', className: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Confirme', className: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Expedie', className: 'bg-indigo-100 text-indigo-800' },
  RECEIVED: { label: 'Recu', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annule', className: 'bg-red-100 text-red-800' },
};

export default function EnterpriseDashboard() {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [stats, setStats] = useState<EnterpriseStats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadEnterprises}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Reessayer
        </button>
      </div>
    );
  }

  if (enterprises.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">🏢</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune entreprise</h2>
        <p className="text-gray-500">
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
          <label className="text-sm font-medium text-gray-700">Entreprise :</label>
          <select
            value={selectedEnterprise?.id || ''}
            onChange={e => {
              const ent = enterprises.find(en => en.id === e.target.value);
              if (ent) setSelectedEnterprise(ent);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Boutiques</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_shops}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Produits</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_products}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Ventes</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_sales}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">
              {formatCurrency(stats.total_revenue)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Clients</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_customers}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Transferts en cours</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {stats.total_pending_transfers}
            </p>
          </div>
        </div>
      )}

      {/* Shops List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Boutiques ({shops.length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {shops.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Aucune boutique dans cette entreprise
            </div>
          ) : (
            shops.map(shop => (
              <div key={shop.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <span className="text-lg">{shop.shop_type === 'MAGASIN' ? '🏭' : '🏪'}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{shop.name}</p>
                    <p className="text-sm text-gray-500">
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
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Transferts en cours ({pendingTransfers.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {pendingTransfers.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">Aucun transfert en cours</div>
          ) : (
            pendingTransfers.map(transfer => {
              const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
              const total = getTransferTotal(transfer);
              const itemCount = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div key={transfer.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{transfer.source_shop.name}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="font-medium text-gray-900">{transfer.target_shop.name}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span>{formatDate(transfer.created_at)}</span>
                    <span>
                      {transfer.items.length} article{transfer.items.length > 1 ? 's' : ''} -{' '}
                      {itemCount} unite{itemCount > 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
                    {transfer.notes && (
                      <span className="italic text-gray-400 truncate max-w-xs">
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
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'cancel')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Expedier
                        </button>
                        <button
                          onClick={() => handleTransferAction(transfer.id, 'cancel')}
                          disabled={actionLoading === transfer.id}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          Annuler
                        </button>
                      </>
                    )}
                    {transfer.status === 'SHIPPED' && (
                      <button
                        onClick={() => handleTransferAction(transfer.id, 'receive')}
                        disabled={actionLoading === transfer.id}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Transferts termines ({completedTransfers.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {completedTransfers.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">Aucun transfert termine</div>
          ) : (
            completedTransfers.slice(0, 10).map(transfer => {
              const total = getTransferTotal(transfer);
              return (
                <div key={transfer.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">{transfer.source_shop.name}</span>
                    <span className="text-gray-400">&rarr;</span>
                    <span className="font-medium text-gray-900">{transfer.target_shop.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{formatDate(transfer.created_at)}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
