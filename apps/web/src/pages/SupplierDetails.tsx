import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { suppliersApi, debtsApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface SupplierDetails {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  borrowing_limit: number;
  notes?: string;
  debts: Array<{
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
    total_debts: number;
    total_balance: number;
    total_paid: number;
    debts_count: number;
    cash_payments_count: number;
    total_cash_payments: number;
  };
}

export default function SupplierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<SupplierDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'debts' | 'cash' | 'all'>('all');

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debt creation modal states
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    first_name: '',
    phone: '',
    email: '',
    address: '',
    borrowing_limit: '',
  });

  useEffect(() => {
    loadSupplier();
  }, [id]);

  const loadSupplier = async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await suppliersApi.getOne(id);
      setSupplier(data);
    } catch (error) {
      console.error('Erreur lors du chargement du fournisseur:', error);
      alert('Impossible de charger les détails du fournisseur');
    } finally {
      setIsLoading(false);
    }
  };

  const getPersonName = () => {
    if (!supplier) return '';
    return supplier.first_name ? `${supplier.first_name} ${supplier.name}` : supplier.name;
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
    if (!paymentAmount || !supplier) {
      alert('Veuillez entrer un montant');
      return;
    }

    const amountInCentimes = Math.round(parseFloat(paymentAmount) * 100);

    if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
      alert('Montant invalide');
      return;
    }

    // Find oldest pending debt
    const pendingDebts = supplier.debts
      .filter(d => d.status === 'PENDING' || d.status === 'PARTIAL')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (pendingDebts.length === 0) {
      alert('Aucune dette à payer');
      return;
    }

    setIsSubmitting(true);
    try {
      const debtId = pendingDebts[0].id;
      await debtsApi.addPayment(debtId, {
        amount: amountInCentimes,
        payment_method: 'Espèces',
        note: paymentNote || `Paiement à ${getPersonName()}`,
      });

      alert('Paiement enregistré avec succès');
      handleClosePaymentModal();
      loadSupplier();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Debt creation functions
  const handleOpenDebtModal = () => {
    setShowDebtModal(true);
    setDebtAmount('');
    setDebtNote('');
  };

  const handleCloseDebtModal = () => {
    setShowDebtModal(false);
    setDebtAmount('');
    setDebtNote('');
  };

  const handleSubmitDebt = async () => {
    if (!debtAmount) {
      alert('Veuillez entrer un montant');
      return;
    }

    const amountInCentimes = Math.round(parseFloat(debtAmount) * 100);

    if (isNaN(amountInCentimes) || amountInCentimes <= 0) {
      alert('Montant invalide');
      return;
    }

    setIsSubmitting(true);
    try {
      await debtsApi.create({
        supplier_id: id!,
        amount: amountInCentimes,
        description: debtNote || `Dette contractée auprès de ${getPersonName()}`,
      });

      alert('Dette enregistrée avec succès');
      handleCloseDebtModal();
      loadSupplier();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert(error.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit functions
  const handleOpenEditModal = () => {
    if (!supplier) return;
    setEditForm({
      name: supplier.name,
      first_name: supplier.first_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      borrowing_limit: supplier.borrowing_limit ? String(supplier.borrowing_limit) : '',
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

      if (editForm.borrowing_limit) {
        updateData.borrowing_limit = parseInt(editForm.borrowing_limit);
      } else {
        updateData.borrowing_limit = 0;
      }

      await suppliersApi.update(id, updateData);
      alert('Fournisseur mis à jour avec succès');
      handleCloseEditModal();
      loadSupplier();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!supplier || !id) return;

    if (window.confirm(`Voulez-vous vraiment supprimer le fournisseur ${getPersonName()} ?`)) {
      suppliersApi
        .delete(id)
        .then(() => {
          alert('Fournisseur supprimé avec succès');
          navigate('/suppliers');
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
    };
    return badges[status as keyof typeof badges] || 'badge-secondary';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDING: 'En attente',
      PARTIAL: 'Partiel',
      PAID: 'Payé',
      CANCELLED: 'Annulé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Combiner toutes les transactions dans une timeline
  const getAllTransactions = () => {
    if (!supplier) return [];

    const transactions: Array<{
      id: string;
      type: 'debt' | 'payment' | 'cash';
      date: string;
      amount: number;
      description: string;
      status?: string;
    }> = [];

    // Ajouter les dettes
    supplier.debts.forEach(debt => {
      transactions.push({
        id: debt.id,
        type: 'debt',
        date: debt.created_at,
        amount: debt.amount,
        description: debt.description || 'Dette fournisseur',
        status: debt.status,
      });

      // Ajouter les paiements de cette dette
      debt.payments.forEach(payment => {
        transactions.push({
          id: payment.id,
          type: 'payment',
          date: payment.payment_date,
          amount: -payment.amount,
          description: payment.notes || 'Paiement dette',
        });
      });
    });

    // Ajouter les paiements en caisse
    supplier.cash_entries.forEach(entry => {
      transactions.push({
        id: entry.id,
        type: 'cash',
        date: entry.created_at,
        amount: -entry.amount,
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

  if (!supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Fournisseur non trouvé</p>
      </div>
    );
  }

  const filteredTransactions = getAllTransactions().filter(t => {
    if (activeTab === 'debts') return t.type === 'debt' || t.type === 'payment';
    if (activeTab === 'cash') return t.type === 'cash';
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec bouton retour */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/suppliers')}
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
          <h1 className="text-2xl font-bold text-slate-900">{getPersonName()}</h1>
          <p className="text-sm text-slate-500">Détails du fournisseur</p>
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

      {/* Informations du fournisseur */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">📋 Informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supplier.phone && (
            <div>
              <p className="text-sm text-slate-500">Téléphone</p>
              <p className="font-medium text-slate-900">{supplier.phone}</p>
            </div>
          )}
          {supplier.email && (
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{supplier.email}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-slate-500">Limite d'emprunt</p>
            <p className="font-medium text-slate-900">
              {supplier.borrowing_limit > 0
                ? formatCurrency(supplier.borrowing_limit)
                : 'Illimitee'}
            </p>
            {supplier.borrowing_limit > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{formatCurrency(supplier.stats.total_balance)} utilises</span>
                  <span>
                    {Math.round((supplier.stats.total_balance / supplier.borrowing_limit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      supplier.stats.total_balance / supplier.borrowing_limit > 0.9
                        ? 'bg-danger-500'
                        : supplier.stats.total_balance / supplier.borrowing_limit > 0.7
                          ? 'bg-warning-500'
                          : 'bg-success-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (supplier.stats.total_balance / supplier.borrowing_limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {supplier.address && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Adresse</p>
              <p className="font-medium text-slate-900">{supplier.address}</p>
            </div>
          )}
          {supplier.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Notes</p>
              <p className="font-medium text-slate-900">{supplier.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-danger-50 to-danger-100">
          <p className="text-sm text-danger-700 mb-1">Dettes totales</p>
          <p className="text-2xl font-bold text-danger-900">
            {formatCurrency(supplier.stats.total_debts)}
          </p>
          <p className="text-xs text-danger-600 mt-1">{supplier.stats.debts_count} dette(s)</p>
        </div>

        <div className="card bg-gradient-to-br from-warning-50 to-warning-100">
          <p className="text-sm text-warning-700 mb-1">Solde restant</p>
          <p className="text-2xl font-bold text-warning-900">
            {formatCurrency(supplier.stats.total_balance)}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-success-50 to-success-100">
          <p className="text-sm text-success-700 mb-1">Total payé</p>
          <p className="text-2xl font-bold text-success-900">
            {formatCurrency(supplier.stats.total_paid)}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-action-50 to-action-100">
          <p className="text-sm text-action-700 mb-1">Paiements caisse</p>
          <p className="text-2xl font-bold text-action-700">
            {formatCurrency(supplier.stats.total_cash_payments)}
          </p>
          <p className="text-xs text-action-600 mt-1">
            {supplier.stats.cash_payments_count} paiement(s)
          </p>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleOpenDebtModal}
          className="btn-warning py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
        >
          📝 Contracter une dette
        </button>
        {supplier.stats.total_balance > 0 && (
          <button
            onClick={handleOpenPaymentModal}
            className="btn-danger py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            💰 Enregistrer un paiement
          </button>
        )}
      </div>

      {/* Timeline des transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">📊 Historique des transactions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-action-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tout
            </button>
            <button
              onClick={() => setActiveTab('debts')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'debts'
                  ? 'bg-action-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Dettes
            </button>
            <button
              onClick={() => setActiveTab('cash')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                activeTab === 'cash'
                  ? 'bg-action-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Caisse
            </button>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">📝</span>
            </div>
            <p className="text-sm text-slate-500">Aucune transaction</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map(transaction => (
              <div key={transaction.id} className="card-hover p-4 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {transaction.type === 'debt' && (
                      <>
                        <span className="badge badge-danger">📦 Dette</span>
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
                    {transaction.type === 'cash' && (
                      <span className="badge badge-primary">🏦 Caisse</span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(transaction.date)}</span>
                  </div>
                  <p className="text-sm text-slate-700">{transaction.description}</p>
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

      {/* Modal de création de dette */}
      {showDebtModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="bg-gradient-to-r from-warning-600 to-warning-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">📝 Nouvelle dette</h3>
                  <p className="text-sm opacity-90">{getPersonName()}</p>
                </div>
                <button
                  onClick={handleCloseDebtModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={debtAmount}
                  onChange={e => setDebtAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-transparent text-lg"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description (optionnelle)
                </label>
                <textarea
                  value={debtNote}
                  onChange={e => setDebtNote(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-transparent"
                  placeholder="Description de la dette..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCloseDebtModal}
                  className="flex-1 btn-secondary"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitDebt}
                  className="flex-1 btn-warning"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Traitement...' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de paiement */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
            <div className="bg-gradient-to-r from-danger-600 to-danger-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">💸 Paiement fournisseur</h3>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-transparent text-lg"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Note (optionnelle)
                </label>
                <textarea
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-danger-500 focus:border-transparent"
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
                  className="flex-1 btn-danger"
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
            <div className="bg-gradient-to-r from-sky-400 via-action-500 to-action-600 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">✏️ Modifier le fournisseur</h3>
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Prénom</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Limite d'emprunt (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.borrowing_limit}
                    onChange={e => setEditForm({ ...editForm, borrowing_limit: e.target.value })}
                    placeholder="0 = illimite"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500"
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
