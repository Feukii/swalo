import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi, receivablesApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface CustomerDetails {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number;
  notes?: string;
  receivables: Array<{
    id: string;
    amount: number;
    balance: number;
    paid_amount: number;
    status: string;
    description?: string;
    created_at: string;
    payments: Array<{
      id: string;
      amount: number;
      payment_date: string;
      notes?: string;
    }>;
  }>;
  sales: Array<{
    id: string;
    subtotal: number;
    total: number;
    status: string;
    created_at: string;
  }>;
  cash_entries: Array<{
    id: string;
    type: string;
    category: string;
    amount: number;
    note?: string;
    created_at: string;
    cashier: {
      display_name: string;
    };
  }>;
  stats: {
    total_receivables: number;
    total_balance: number;
    total_paid: number;
    receivables_count: number;
    sales_count: number;
    cash_refunds_count: number;
    total_cash_refunds: number;
  };
}

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivables' | 'sales' | 'cash' | 'all'>('all');

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    first_name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: '',
  });

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await customersApi.getOne(id);
      setCustomer(data);
    } catch (error) {
      console.error('Erreur lors du chargement du client:', error);
      alert('Impossible de charger les détails du client');
    } finally {
      setIsLoading(false);
    }
  };

  const getPersonName = () => {
    if (!customer) return '';
    return customer.first_name ? `${customer.first_name} ${customer.name}` : customer.name;
  };

  // Payment functions
  const handleOpenPaymentModal = () => {
    setShowPaymentModal(true);
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentNote('');
  };

  const handleSubmitPayment = async () => {
    if (!paymentAmount || !customer) {
      alert('Veuillez entrer un montant');
      return;
    }

    const amountInCentimes = Math.round(parseFloat(paymentAmount) * 100);

    if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
      alert('Montant invalide');
      return;
    }

    // Find oldest pending receivable
    const pendingReceivables = customer.receivables
      .filter(r => r.status === 'PENDING' || r.status === 'PARTIAL')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (pendingReceivables.length === 0) {
      alert('Aucune créance à payer');
      return;
    }

    setIsSubmitting(true);
    try {
      const receivableId = pendingReceivables[0].id;
      await receivablesApi.addPayment(receivableId, {
        amount: amountInCentimes,
        payment_method: 'Espèces',
        note: paymentNote || `Paiement de ${getPersonName()}`,
      });

      alert('Paiement enregistré avec succès');
      handleClosePaymentModal();
      loadCustomer();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit functions
  const handleOpenEditModal = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      first_name: customer.first_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      credit_limit: customer.credit_limit ? (customer.credit_limit / 100).toString() : '',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleSubmitEdit = async () => {
    if (!editForm.name || !id) {
      alert('Le nom est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {
        name: editForm.name,
        first_name: editForm.first_name || undefined,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
      };

      if (editForm.credit_limit) {
        const creditLimitInCentimes = Math.round(parseFloat(editForm.credit_limit) * 100);
        if (!isNaN(creditLimitInCentimes) && creditLimitInCentimes >= 0) {
          updateData.credit_limit = creditLimitInCentimes;
        }
      }

      await customersApi.update(id, updateData);
      alert('Client mis à jour avec succès');
      handleCloseEditModal();
      loadCustomer();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!customer || !id) return;

    if (window.confirm(`Voulez-vous vraiment supprimer le client ${getPersonName()} ?`)) {
      customersApi
        .delete(id)
        .then(() => {
          alert('Client supprimé avec succès');
          navigate('/customers');
        })
        .catch((error: any) => {
          console.error('Erreur lors de la suppression:', error);
          alert(error.message || 'Erreur lors de la suppression');
        });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: 'badge-danger',
      PARTIAL: 'badge-warning',
      PAID: 'badge-success',
      CANCELLED: 'badge-secondary',
      COMPLETED: 'badge-success',
      DRAFT: 'badge-warning',
    };
    return badges[status as keyof typeof badges] || 'badge-secondary';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDING: 'En attente',
      PARTIAL: 'Partiel',
      PAID: 'Payé',
      CANCELLED: 'Annulé',
      COMPLETED: 'Terminé',
      DRAFT: 'Brouillon',
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Combiner toutes les transactions dans une timeline
  const getAllTransactions = () => {
    if (!customer) return [];

    const transactions: Array<{
      id: string;
      type: 'receivable' | 'payment' | 'sale' | 'cash';
      date: string;
      amount: number;
      description: string;
      status?: string;
    }> = [];

    // Build a set of cash_entry_ids that are linked to receivable payments
    // These cash entries should NOT be shown separately
    const linkedCashEntryIds = new Set<string>();
    customer.receivables.forEach(receivable => {
      receivable.payments.forEach(payment => {
        if ((payment as any).cash_entry_id) {
          linkedCashEntryIds.add((payment as any).cash_entry_id);
        }
      });
    });

    // Ajouter les créances
    customer.receivables.forEach(receivable => {
      // Skip receivables created for refund offset (PAID status with "Remboursement" description)
      if (receivable.status === 'PAID' && receivable.description?.includes('Remboursement')) {
        return;
      }

      transactions.push({
        id: receivable.id,
        type: 'receivable',
        date: receivable.created_at,
        amount: receivable.amount,
        description: receivable.description || 'Créance client',
        status: receivable.status,
      });

      // Ajouter les paiements de cette créance
      // Show ALL payments (whether from cash entry or direct)
      receivable.payments.forEach(payment => {
        transactions.push({
          id: payment.id,
          type: 'payment',
          date: payment.payment_date,
          amount: -payment.amount,
          description: payment.notes || 'Paiement créance',
        });
      });
    });

    // Ajouter les ventes (only non-credit sales)
    customer.sales.forEach(sale => {
      // Skip credit sales as they're represented by receivables
      if ((sale as any).is_credit || sale.status === 'DRAFT') {
        return;
      }
      transactions.push({
        id: sale.id,
        type: 'sale',
        date: sale.created_at,
        amount: sale.total,
        description: `Vente - ${formatCurrency(sale.total)}`,
        status: sale.status,
      });
    });

    // Ajouter les remboursements en caisse (only those not linked to payments)
    customer.cash_entries.forEach(entry => {
      // Skip if this cash entry is already represented by a receivable payment
      if (linkedCashEntryIds.has(entry.id)) {
        return;
      }
      transactions.push({
        id: entry.id,
        type: 'cash',
        date: entry.created_at,
        amount: entry.type === 'OUT' ? -entry.amount : entry.amount,
        description: entry.note || entry.category,
      });
    });

    // Trier par date décroissante
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Client non trouvé</p>
      </div>
    );
  }

  const filteredTransactions = getAllTransactions().filter(t => {
    if (activeTab === 'receivables') return t.type === 'receivable' || t.type === 'payment';
    if (activeTab === 'sales') return t.type === 'sale';
    if (activeTab === 'cash') return t.type === 'cash';
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec bouton retour */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/customers')}
          className="btn-secondary w-10 h-10 p-0 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{getPersonName()}</h1>
          <p className="text-sm text-gray-500">Détails du client</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleOpenEditModal} className="btn-secondary" title="Modifier">
            ✏️ Modifier
          </button>
          <button onClick={handleDelete} className="btn-danger" title="Supprimer">
            🗑️ Supprimer
          </button>
        </div>
      </div>

      {/* Informations du client */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customer.phone && (
            <div>
              <p className="text-sm text-gray-500">Téléphone</p>
              <p className="font-medium text-gray-900">{customer.phone}</p>
            </div>
          )}
          {customer.email && (
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{customer.email}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">Limite de crédit</p>
            <p className="font-medium text-gray-900">
              {customer.credit_limit > 0 ? formatCurrency(customer.credit_limit) : 'Illimitée'}
            </p>
            {customer.credit_limit > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{formatCurrency(customer.stats.total_balance)} utilisés</span>
                  <span>
                    {Math.round((customer.stats.total_balance / customer.credit_limit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      customer.stats.total_balance / customer.credit_limit > 0.9
                        ? 'bg-red-500'
                        : customer.stats.total_balance / customer.credit_limit > 0.7
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (customer.stats.total_balance / customer.credit_limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {customer.address && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Adresse</p>
              <p className="font-medium text-gray-900">{customer.address}</p>
            </div>
          )}
          {customer.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500">Notes</p>
              <p className="font-medium text-gray-900">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-warning-50 to-warning-100 border-warning-200">
          <p className="text-sm text-warning-700 mb-1">Créances totales</p>
          <p className="text-2xl font-bold text-warning-900">
            {formatCurrency(customer.stats.total_receivables)}
          </p>
          <p className="text-xs text-warning-600 mt-1">
            {customer.stats.receivables_count} créance(s)
          </p>
        </div>

        <div className="card bg-gradient-to-br from-danger-50 to-danger-100 border-danger-200">
          <p className="text-sm text-danger-700 mb-1">Solde restant</p>
          <p className="text-2xl font-bold text-danger-900">
            {formatCurrency(customer.stats.total_balance)}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-success-50 to-success-100 border-success-200">
          <p className="text-sm text-success-700 mb-1">Total payé</p>
          <p className="text-2xl font-bold text-success-900">
            {formatCurrency(customer.stats.total_paid)}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
          <p className="text-sm text-primary-700 mb-1">Ventes</p>
          <p className="text-2xl font-bold text-primary-900">{customer.stats.sales_count}</p>
        </div>
      </div>

      {/* Bouton d'action pour enregistrer un paiement */}
      {customer.stats.total_balance > 0 && (
        <button
          onClick={handleOpenPaymentModal}
          className="w-full btn-primary py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
        >
          💰 Enregistrer un paiement
        </button>
      )}

      {/* Timeline des transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">📊 Historique des transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tout
            </button>
            <button
              onClick={() => setActiveTab('receivables')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'receivables'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Créances
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'sales'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ventes
            </button>
            <button
              onClick={() => setActiveTab('cash')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'cash'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Caisse
            </button>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <span className="text-3xl">📝</span>
            </div>
            <p className="text-sm text-gray-500">Aucune transaction</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map(transaction => (
              <div key={transaction.id} className="card-hover p-4 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {transaction.type === 'receivable' && (
                      <>
                        <span className="badge badge-warning">📋 Créance</span>
                        {transaction.status && (
                          <span className={`badge ${getStatusBadge(transaction.status)}`}>
                            {getStatusLabel(transaction.status)}
                          </span>
                        )}
                      </>
                    )}
                    {transaction.type === 'payment' && (
                      <span className="badge badge-success">💰 Paiement</span>
                    )}
                    {transaction.type === 'sale' && (
                      <>
                        <span className="badge badge-primary">🛒 Vente</span>
                        {transaction.status && (
                          <span className={`badge ${getStatusBadge(transaction.status)}`}>
                            {getStatusLabel(transaction.status)}
                          </span>
                        )}
                      </>
                    )}
                    {transaction.type === 'cash' && (
                      <span className="badge badge-success">🏦 Remboursement</span>
                    )}
                    <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{transaction.description}</p>
                </div>
                <div className="ml-4 text-right">
                  <p
                    className={`text-lg font-bold ${
                      transaction.amount > 0 ? 'text-danger-600' : 'text-success-600'
                    }`}
                  >
                    {transaction.amount > 0 ? '+' : ''}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de paiement */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="bg-gradient-to-r from-success-600 to-success-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">💸 Paiement client</h3>
                  <p className="text-sm opacity-90">{getPersonName()}</p>
                </div>
                <button
                  onClick={handleClosePaymentModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-transparent text-lg"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (optionnelle)
                </label>
                <textarea
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-transparent"
                  placeholder="Ajouter une note..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleClosePaymentModal}
                  className="flex-1 btn-secondary"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitPayment}
                  className="flex-1 btn-success"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Traitement...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-scale-in my-8">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">✏️ Modifier le client</h3>
                  <p className="text-sm opacity-90">{getPersonName()}</p>
                </div>
                <button
                  onClick={handleCloseEditModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite de crédit (FCFA)
                  </label>
                  <input
                    type="number"
                    value={editForm.credit_limit}
                    onChange={e => setEditForm({ ...editForm, credit_limit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCloseEditModal}
                  className="flex-1 btn-secondary"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitEdit}
                  className="flex-1 btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
