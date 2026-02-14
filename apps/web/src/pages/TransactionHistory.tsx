import { useState, useEffect } from 'react';
import { salesApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface Sale {
  id: string;
  total: number;
  discount?: number;
  status: string;
  notes?: string;
  created_at: string;
  customer?: { id: string; name: string; first_name?: string };
  items?: SaleItem[];
  user?: { display_name?: string };
}

interface SaleItem {
  id: string;
  product_name?: string;
  product?: { name: string; sku: string };
  qty: number;
  unit_price: number;
  total: number;
}

export default function TransactionHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailView, setDetailView] = useState<Sale | null>(null);

  useEffect(() => {
    loadData();
  }, [filterStatus, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (startDate) params.start_date = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.end_date = end.toISOString();
      }
      const data = await salesApi.getAll(params);
      setSales(data);
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCustomerName = (c?: { name: string; first_name?: string }) => {
    if (!c) return 'Client comptant';
    return c.first_name ? `${c.first_name} ${c.name}` : c.name;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="badge badge-success">Completee</span>;
      case 'CANCELLED': return <span className="badge badge-danger">Annulee</span>;
      case 'DRAFT': return <span className="badge bg-gray-100 text-gray-600">Brouillon</span>;
      default: return <span className="badge bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const handleCancel = async (id: string) => {
    if (!confirm('Annuler cette vente ?')) return;
    try {
      await salesApi.cancel(id);
      loadData();
      setDetailView(null);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'annulation');
    }
  };

  // Stats
  const completedSales = sales.filter(s => s.status === 'COMPLETED');
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total, 0);
  const todaySales = completedSales.filter(s => {
    const d = new Date(s.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <p className="text-sm text-white/80">Chiffre d'affaires</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card">
          <p className="text-gray-500 text-sm">Total ventes</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{sales.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-500 text-sm">Completees</p>
          <p className="text-3xl font-bold text-success-600 mt-1">{completedSales.length}</p>
        </div>
        <div className="card">
          <p className="text-gray-500 text-sm">Aujourd'hui</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{todaySales.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto">
            <option value="">Tous statuts</option>
            <option value="COMPLETED">Completees</option>
            <option value="CANCELLED">Annulees</option>
            <option value="DRAFT">Brouillons</option>
          </select>
          <div className="flex gap-2 items-center">
            <label className="text-sm text-gray-500">Du</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-auto" />
            <label className="text-sm text-gray-500">au</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-auto" />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Historique des ventes</h2>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-12 h-12 spinner"></div></div>
        ) : sales.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune vente trouvee</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Articles</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{formatDate(sale.created_at)}</p>
                      <p className="text-xs text-gray-500">{formatTime(sale.created_at)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{getCustomerName(sale.customer)}</p>
                      {sale.notes && <p className="text-xs text-gray-500 truncate max-w-xs">{sale.notes}</p>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="badge-primary">
                        {sale.items?.reduce((s, i) => s + i.qty, 0) || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(sale.total)}</p>
                      {sale.discount && sale.discount > 0 && (
                        <p className="text-xs text-danger-500">-{formatCurrency(sale.discount)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(sale.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setDetailView(sale)}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 bg-gradient-to-r from-success-500 to-success-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Detail de la vente</h2>
                  <p className="text-sm text-white/80 mt-1">
                    {formatDate(detailView.created_at)} a {formatTime(detailView.created_at)}
                  </p>
                </div>
                <button onClick={() => setDetailView(null)} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium">{getCustomerName(detailView.customer)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  {getStatusBadge(detailView.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="font-bold text-lg">{formatCurrency(detailView.total)}</p>
                </div>
                {detailView.user?.display_name && (
                  <div>
                    <p className="text-sm text-gray-500">Vendeur</p>
                    <p className="font-medium">{detailView.user.display_name}</p>
                  </div>
                )}
              </div>

              {detailView.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-700">{detailView.notes}</p>
                </div>
              )}

              {/* Items */}
              {detailView.items && detailView.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Articles</p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 text-left text-xs font-medium text-gray-500">Produit</th>
                          <th className="py-2 text-center text-xs font-medium text-gray-500">Qte</th>
                          <th className="py-2 text-right text-xs font-medium text-gray-500">Prix unit.</th>
                          <th className="py-2 text-right text-xs font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detailView.items.map(item => (
                          <tr key={item.id}>
                            <td className="py-2 text-sm text-gray-900">
                              {item.product?.name || item.product_name || '-'}
                            </td>
                            <td className="py-2 text-center text-sm text-gray-600">{item.qty}</td>
                            <td className="py-2 text-right text-sm text-gray-600">{formatCurrency(item.unit_price)}</td>
                            <td className="py-2 text-right text-sm font-medium text-gray-900">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                {detailView.status === 'COMPLETED' && (
                  <button onClick={() => handleCancel(detailView.id)} className="btn-sm text-danger-600 hover:bg-danger-50 border border-danger-200 rounded-lg px-4 py-2">
                    Annuler la vente
                  </button>
                )}
                <button onClick={() => setDetailView(null)} className="btn-secondary flex-1">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
