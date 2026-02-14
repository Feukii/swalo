import { useState, useEffect } from 'react';
import { debtsApi, suppliersApi, cashApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface Debt {
  id: string;
  supplier_id: string;
  supplier?: { id: string; name: string; first_name?: string };
  amount: number;
  paid_amount: number;
  remaining: number;
  description?: string;
  due_date?: string;
  status: string;
  created_at: string;
  payments?: Payment[];
}

interface Payment {
  id: string;
  amount: number;
  payment_method?: string;
  note?: string;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
}

interface Stats {
  totalDebt: number;
  pendingCount: number;
  partialCount: number;
  totalCount: number;
}

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ supplier_id: '', amount: '', description: '', due_date: '' });

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  // Detail view
  const [detailView, setDetailView] = useState<Debt | null>(null);

  useEffect(() => {
    loadData();
  }, [filterStatus, filterSupplier]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [debtsData, statsData, suppliersData] = await Promise.all([
        debtsApi.getAll({
          status: filterStatus || undefined,
          supplier_id: filterSupplier || undefined,
        }),
        debtsApi.getStats(),
        suppliersApi.getAll({ is_active: true }),
      ]);
      setDebts(debtsData);
      setStats(statsData);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Erreur chargement dettes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSupplierName = (s?: { name: string; first_name?: string }) => {
    if (!s) return '-';
    return s.first_name ? `${s.first_name} ${s.name}` : s.name;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <span className="badge bg-warning-100 text-warning-800">En attente</span>;
      case 'PARTIAL': return <span className="badge bg-info-100 text-info-800">Partielle</span>;
      case 'PAID': return <span className="badge badge-success">Payee</span>;
      case 'CANCELLED': return <span className="badge bg-gray-100 text-gray-600">Annulee</span>;
      default: return <span className="badge bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await debtsApi.create({
        supplier_id: createForm.supplier_id,
        amount: Math.round(parseFloat(createForm.amount) * 100),
        description: createForm.description || undefined,
        due_date: createForm.due_date || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({ supplier_id: '', amount: '', description: '', due_date: '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la creation');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    try {
      const amount = Math.round(parseFloat(paymentAmount) * 100);

      // Create cash exit for the payment
      const cashEntry = await cashApi.createEntry({
        type: 'OUT',
        category: 'Reglement fournisseur',
        amount,
        note: `Paiement dette ${getSupplierName(paymentModal.supplier)} - ${paymentNote || ''}`.trim(),
        supplier_id: paymentModal.supplier_id,
      });

      await debtsApi.addPayment(paymentModal.id, {
        amount,
        note: paymentNote || undefined,
        cash_exit_id: cashEntry?.id,
      });
      setPaymentModal(null);
      setPaymentAmount('');
      setPaymentNote('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors du paiement');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Annuler cette dette ?')) return;
    try {
      await debtsApi.cancel(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de l\'annulation');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-danger-500 to-danger-600 text-white">
            <p className="text-sm text-white/80">Total Dettes</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalDebt)}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">Actives</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalCount}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">En attente</p>
            <p className="text-3xl font-bold text-warning-600 mt-1">{stats.pendingCount}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">Partielles</p>
            <p className="text-3xl font-bold text-info-600 mt-1">{stats.partialCount}</p>
          </div>
        </div>
      )}

      {/* Filters + Actions */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-3 flex-1 w-full md:w-auto">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto">
              <option value="">Tous statuts</option>
              <option value="PENDING">En attente</option>
              <option value="PARTIAL">Partielles</option>
              <option value="PAID">Payees</option>
              <option value="CANCELLED">Annulees</option>
            </select>
            <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="input w-auto flex-1 md:flex-none">
              <option value="">Tous fournisseurs</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{getSupplierName(s)}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <span>+</span>
            <span>Nouvelle dette</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Dettes fournisseurs</h2>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-12 h-12 spinner"></div></div>
        ) : debts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucune dette trouvee</p>
          </div>
        ) : (
          <div className="space-y-3">
            {debts.map(d => {
              const remaining = d.remaining ?? (d.amount - (d.paid_amount || 0));
              return (
                <div key={d.id} className="card-hover p-4 animate-slide-in">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-gray-900">{getSupplierName(d.supplier)}</p>
                        {getStatusBadge(d.status)}
                      </div>
                      {d.description && <p className="text-sm text-gray-500 truncate">{d.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        Creee le {formatDate(d.created_at)}
                        {d.due_date && ` - Echeance: ${formatDate(d.due_date)}`}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(d.amount)}</p>
                      {remaining > 0 && remaining < d.amount && (
                        <p className="text-sm text-danger-600">Reste: {formatCurrency(remaining)}</p>
                      )}
                    </div>
                  </div>
                  {(d.status === 'PENDING' || d.status === 'PARTIAL') && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setPaymentModal(d);
                          setPaymentAmount(String(remaining / 100));
                        }}
                        className="btn-primary btn-sm flex-1"
                      >
                        Payer
                      </button>
                      <button onClick={() => setDetailView(d)} className="btn-secondary btn-sm">
                        Details
                      </button>
                      <button onClick={() => handleCancel(d.id)} className="btn-sm text-danger-600 hover:bg-danger-50 border border-danger-200 rounded-lg px-3">
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-medium animate-scale-in">
            <div className="px-6 py-5 bg-gradient-to-r from-danger-500 to-danger-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Nouvelle dette</h2>
                <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateDebt} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Fournisseur <span className="text-danger-500">*</span></label>
                <select value={createForm.supplier_id} onChange={e => setCreateForm({ ...createForm, supplier_id: e.target.value })} className="input" required>
                  <option value="">Selectionner un fournisseur</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{getSupplierName(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Montant (FCFA) <span className="text-danger-500">*</span></label>
                <input type="number" step="1" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={2} className="input resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date echeance</label>
                <input type="date" value={createForm.due_date} onChange={e => setCreateForm({ ...createForm, due_date: e.target.value })} className="input" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Creer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-medium animate-scale-in">
            <div className="px-6 py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Regler une dette</h2>
                  <p className="text-sm text-white/80 mt-1">{getSupplierName(paymentModal.supplier)}</p>
                </div>
                <button onClick={() => setPaymentModal(null)} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Reste a payer</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency((paymentModal.remaining ?? (paymentModal.amount - (paymentModal.paid_amount || 0))))}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Montant du paiement (FCFA) <span className="text-danger-500">*</span></label>
                <input type="number" step="1" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="input text-xl font-semibold" required autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Note</label>
                <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} className="input" placeholder="Note optionnelle..." />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setPaymentModal(null)} className="btn-secondary flex-1">Annuler</button>
                <button type="submit" className="btn-primary flex-1">Valider le paiement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailView && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Detail dette</h2>
                <button onClick={() => setDetailView(null)} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Fournisseur</p>
                  <p className="font-medium">{getSupplierName(detailView.supplier)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  {getStatusBadge(detailView.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Montant total</p>
                  <p className="font-bold text-lg">{formatCurrency(detailView.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Deja paye</p>
                  <p className="font-bold text-lg text-success-600">{formatCurrency(detailView.paid_amount || 0)}</p>
                </div>
              </div>
              {detailView.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-700">{detailView.description}</p>
                </div>
              )}
              {detailView.payments && detailView.payments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Historique paiements</p>
                  <div className="space-y-2">
                    {detailView.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-success-600">+{formatCurrency(p.amount)}</p>
                          {p.note && <p className="text-xs text-gray-500">{p.note}</p>}
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setDetailView(null)} className="btn-secondary w-full">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
