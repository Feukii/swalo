import { useState, useEffect } from 'react';
import { cashApi, suppliersApi, customersApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';
import { ENTRY_CATEGORIES, EXIT_CATEGORIES, MIN_NOTE_LENGTH, requiresNote } from '@swalo/core';
import { useAuthStore } from '../store/authStore';

interface CashEntry {
  id: string;
  type: 'IN' | 'OUT' | 'OPENING' | 'CLOSING';
  category: string;
  amount: number;
  note?: string;
  created_at: string;
  supplier?: {
    id: string;
    name: string;
    first_name?: string;
  };
  customer?: {
    id: string;
    name: string;
    first_name?: string;
  };
}

interface CashStats {
  balance: number;
  todayEntries: number;
  todayExits: number;
  todayNet: number;
  entriesCount: number;
  exitsCount: number;
}

interface Supplier {
  id: string;
  name: string;
  first_name?: string;
}

interface Customer {
  id: string;
  name: string;
  first_name?: string;
}

export default function POS() {
  const { role: userRole } = useAuthStore();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [stats, setStats] = useState<CashStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState<'IN' | 'OUT' | null>(null);

  // Lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Search states
  const [supplierSearch, setSupplierSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

  // Form state
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null);

  useEffect(() => {
    loadData();
    loadSuppliers();
    loadCustomers();
  }, []);

  const loadData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [entriesData, statsData] = await Promise.all([
        cashApi.getAll({
          start_date: today.toISOString(),
        }),
        cashApi.getStats({
          start_date: today.toISOString(),
        }),
      ]);

      setEntries(entriesData);
      const todayEntries = statsData.todayEntries || 0;
      const todayExits = statsData.todayExits || 0;
      setStats({
        ...statsData,
        todayEntries,
        todayExits,
        todayNet: todayEntries - todayExits,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await suppliersApi.getAll({ is_active: true });
      setSuppliers(data);
      setFilteredSuppliers(data.slice(0, 5)); // Initial: 5 premiers
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await customersApi.getAll({ is_active: true });
      setCustomers(data);
      setFilteredCustomers(data.slice(0, 5)); // Initial: 5 premiers
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
    }
  };

  // Fonction de recherche pour fournisseurs
  const handleSupplierSearch = (searchText: string) => {
    setSupplierSearch(searchText);

    if (!searchText.trim()) {
      setFilteredSuppliers(suppliers.slice(0, 5));
      return;
    }

    const query = searchText.toLowerCase();
    const filtered = suppliers
      .filter(supplier => {
        const name = supplier.name.toLowerCase();
        const firstName = supplier.first_name?.toLowerCase() || '';
        return name.includes(query) || firstName.includes(query);
      })
      .slice(0, 5);

    setFilteredSuppliers(filtered);
  };

  // Fonction de recherche pour clients
  const handleCustomerSearch = (searchText: string) => {
    setCustomerSearch(searchText);

    if (!searchText.trim()) {
      setFilteredCustomers(customers.slice(0, 5));
      return;
    }

    const query = searchText.toLowerCase();
    const filtered = customers
      .filter(customer => {
        const name = customer.name.toLowerCase();
        const firstName = customer.first_name?.toLowerCase() || '';
        return name.includes(query) || firstName.includes(query);
      })
      .slice(0, 5);

    setFilteredCustomers(filtered);
  };

  const handleOpenModal = (type: 'IN' | 'OUT') => {
    setShowModal(type);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedSupplierId('');
    setSelectedCustomerId('');
    setSupplierSearch('');
    setCustomerSearch('');
    setFilteredSuppliers(suppliers.slice(0, 5));
    setFilteredCustomers(customers.slice(0, 5));
  };

  const handleCloseModal = () => {
    setShowModal(null);
    setCategory('');
    setAmount('');
    setNote('');
    setSelectedSupplierId('');
    setSelectedCustomerId('');
    setSupplierSearch('');
    setCustomerSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !amount) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validation pour catégorie "Divers" - commentaire obligatoire
    if (requiresNote(category) && (!note || note.trim().length < MIN_NOTE_LENGTH)) {
      alert(
        `Rajoutez un commentaire après le choix de la catégorie Divers (minimum ${MIN_NOTE_LENGTH} caractères)`
      );
      return;
    }

    // Validation pour règlement fournisseur
    if (category === 'Règlement fournisseur' && !selectedSupplierId) {
      alert('Veuillez sélectionner un fournisseur');
      return;
    }

    // Validation pour remboursement client
    if (category === 'Remboursement client' && !selectedCustomerId) {
      alert('Veuillez sélectionner un client');
      return;
    }

    const amountInt = Math.round(parseFloat(amount));

    if (isNaN(amountInt)) {
      alert('Montant invalide');
      return;
    }

    // Seuls les BOSS peuvent entrer des montants négatifs (corrections)
    if (amountInt < 0 && userRole !== 'BOSS') {
      alert(
        'Permission refusée: Seuls les propriétaires peuvent effectuer des corrections avec des montants négatifs'
      );
      return;
    }

    if (amountInt === 0) {
      alert('Le montant ne peut pas être zéro');
      return;
    }

    // Validation solde pour une sortie
    if (showModal === 'OUT' && amountInt > 0) {
      const currentBalance = stats?.balance || 0;
      if (amountInt > currentBalance) {
        alert('Solde insuffisant: le montant de la sortie depasse le solde de caisse');
        return;
      }
    }

    setIsLoading(true);
    try {
      await cashApi.createEntry({
        type: showModal!,
        category,
        amount: amountInt,
        note: note || undefined,
        supplier_id: selectedSupplierId || undefined,
        customer_id: selectedCustomerId || undefined,
      });

      handleCloseModal();
      loadData();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert(error.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getPersonName = (person?: { name: string; first_name?: string }) => {
    if (!person) return '';
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Déterminer si on doit afficher la sélection fournisseur ou client
  const showSupplierSelect = category === 'Règlement fournisseur';
  const showCustomerSelect = category === 'Remboursement client';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance Section - Hero Card */}
      <div className="card bg-gradient-to-br from-sky-400 via-action-500 to-action-600 text-white">
        <div className="mb-4">
          <p className="text-white/80 text-sm mb-2">💰 Solde de caisse</p>
          <h2 className="text-5xl font-bold tracking-tight">
            {formatCurrency(stats?.balance || 0)}
          </h2>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-white/70 mb-1">Entrées</p>
            <p className="text-xl font-semibold">{formatCurrency(stats?.todayEntries || 0)}</p>
            <p className="text-xs text-white/60 mt-1">{stats?.entriesCount || 0} op.</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-white/70 mb-1">Sorties</p>
            <p className="text-xl font-semibold">{formatCurrency(stats?.todayExits || 0)}</p>
            <p className="text-xs text-white/60 mt-1">{stats?.exitsCount || 0} op.</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-white/70 mb-1">Net</p>
            <p
              className={`text-xl font-semibold ${(stats?.todayNet || 0) >= 0 ? 'text-white' : 'text-danger-200'}`}
            >
              {formatCurrency(stats?.todayNet || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleOpenModal('IN')}
          className="btn-success btn-lg rounded-2xl h-16 flex items-center justify-center space-x-2 shadow-soft hover:shadow-medium"
        >
          <span className="text-xl">↗️</span>
          <span>Entrée</span>
        </button>
        <button
          onClick={() => handleOpenModal('OUT')}
          className="btn-danger btn-lg rounded-2xl h-16 flex items-center justify-center space-x-2 shadow-soft hover:shadow-medium"
        >
          <span className="text-xl">↙️</span>
          <span>Sortie</span>
        </button>
      </div>

      {/* Operations List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">📊 Opérations du jour</h3>
          <span className="badge-primary">{entries.length}</span>
        </div>

        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">📝</span>
            </div>
            <p className="text-sm text-slate-500">Aucune opération aujourd'hui</p>
            <p className="text-xs text-slate-400 mt-1">
              Commencez par enregistrer une entrée ou sortie
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="card-hover p-4 animate-slide-in cursor-pointer"
                onClick={() => setSelectedEntry(entry)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`badge ${entry.type === 'IN' ? 'badge-success' : 'badge-danger'}`}
                      >
                        {entry.type === 'IN' ? '↗️ ' : '↙️ '}
                        {entry.category}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatTime(entry.created_at)}
                      </span>
                    </div>
                    {(entry.supplier || entry.customer) && (
                      <p className="text-sm font-medium text-slate-700 mt-1">
                        {entry.supplier && `🏭 ${getPersonName(entry.supplier)}`}
                        {entry.customer && `👤 ${getPersonName(entry.customer)}`}
                      </p>
                    )}
                    {entry.note && (
                      <p className="text-sm text-slate-600 truncate mt-1">{entry.note}</p>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <p
                      className={`text-lg font-bold ${
                        entry.type === 'IN' ? 'text-success-600' : 'text-danger-600'
                      }`}
                    >
                      {entry.type === 'IN' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-3xl shadow-medium animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div
              className={`px-6 py-5 rounded-t-3xl ${selectedEntry.type === 'IN' ? 'bg-gradient-to-r from-success-500 to-success-600' : 'bg-gradient-to-r from-danger-500 to-danger-600'}`}
            >
              <div className="flex items-center justify-between text-white">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedEntry.type === 'IN' ? 'Entree' : 'Sortie'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">{selectedEntry.category}</p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p
                  className={`text-3xl font-bold ${selectedEntry.type === 'IN' ? 'text-success-600' : 'text-danger-600'}`}
                >
                  {selectedEntry.type === 'IN' ? '+' : '-'}
                  {formatCurrency(selectedEntry.amount)}
                </p>
                <p className="text-sm text-slate-500 mt-1">FCFA</p>
              </div>
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Type</span>
                  <span className="text-sm font-medium">
                    {selectedEntry.type === 'IN' ? 'Entree' : 'Sortie'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Categorie</span>
                  <span className="text-sm font-medium">{selectedEntry.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Date/Heure</span>
                  <span className="text-sm font-medium">
                    {new Date(selectedEntry.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
                {selectedEntry.supplier && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Fournisseur</span>
                    <span className="text-sm font-medium">
                      {getPersonName(selectedEntry.supplier)}
                    </span>
                  </div>
                )}
                {selectedEntry.customer && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Client</span>
                    <span className="text-sm font-medium">
                      {getPersonName(selectedEntry.customer)}
                    </span>
                  </div>
                )}
                {selectedEntry.note && (
                  <div>
                    <span className="text-sm text-slate-500">Note</span>
                    <p className="text-sm font-medium mt-1">{selectedEntry.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entry/Exit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div
              className={`px-6 py-5 rounded-t-3xl sticky top-0 ${showModal === 'IN' ? 'bg-gradient-to-r from-success-500 to-success-600' : 'bg-gradient-to-r from-danger-500 to-danger-600'}`}
            >
              <div className="flex items-center justify-between text-white">
                <div>
                  <h2 className="text-xl font-bold">
                    {showModal === 'IN' ? '↗️ Nouvelle entrée' : '↙️ Nouvelle sortie'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {showModal === 'IN'
                      ? "Ajouter de l'argent en caisse"
                      : "Retirer de l'argent de la caisse"}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Category Select */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Catégorie</label>
                <select
                  value={category}
                  onChange={e => {
                    setCategory(e.target.value);
                    // Reset selections when category changes
                    setSelectedSupplierId('');
                    setSelectedCustomerId('');
                  }}
                  className="input"
                  required
                >
                  <option value="">Sélectionner une catégorie...</option>
                  {(showModal === 'IN' ? ENTRY_CATEGORIES : EXIT_CATEGORIES).map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Select with autocomplete (if Règlement fournisseur) */}
              {showSupplierSelect && (
                <div className="animate-slide-in relative">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Fournisseur <span className="text-danger-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={e => handleSupplierSearch(e.target.value)}
                    placeholder="🔍 Rechercher et sélectionner un fournisseur..."
                    className="input"
                    required
                  />
                  {/* Suggestions dropdown */}
                  {supplierSearch && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSuppliers.map(supplier => (
                        <div
                          key={supplier.id}
                          className="px-4 py-3 hover:bg-action-50 cursor-pointer border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setSelectedSupplierId(supplier.id);
                            setSupplierSearch(getPersonName(supplier));
                          }}
                        >
                          {getPersonName(supplier)}
                        </div>
                      ))}
                    </div>
                  )}
                  {suppliers.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun fournisseur actif. Ajoutez-en un dans l'onglet Fournisseurs.
                    </p>
                  )}
                  {supplierSearch && filteredSuppliers.length === 0 && suppliers.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun résultat pour "{supplierSearch}"
                    </p>
                  )}
                </div>
              )}

              {/* Customer Select with autocomplete (if Remboursement client) */}
              {showCustomerSelect && (
                <div className="animate-slide-in relative">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Client <span className="text-danger-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => handleCustomerSearch(e.target.value)}
                    placeholder="🔍 Rechercher et sélectionner un client..."
                    className="input"
                    required
                  />
                  {/* Suggestions dropdown */}
                  {customerSearch && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          className="px-4 py-3 hover:bg-action-50 cursor-pointer border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setSelectedCustomerId(customer.id);
                            setCustomerSearch(getPersonName(customer));
                          }}
                        >
                          {getPersonName(customer)}
                        </div>
                      ))}
                    </div>
                  )}
                  {customers.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun client actif. Ajoutez-en un dans l'onglet Clients.
                    </p>
                  )}
                  {customerSearch && filteredCustomers.length === 0 && customers.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun résultat pour "{customerSearch}"
                    </p>
                  )}
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Montant (FCFA)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    step="1"
                    className="input text-2xl font-semibold pr-20"
                    required
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-400">
                    FCFA
                  </span>
                </div>
                {userRole === 'BOSS' && (
                  <p className="text-sm text-action-700 mt-2 italic">
                    💡 Propriétaires: vous pouvez entrer des montants négatifs pour corriger des
                    erreurs
                  </p>
                )}
              </div>

              {/* Note Input */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Note (optionnelle)
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Ajouter une note ou description..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 ${showModal === 'IN' ? 'btn-success' : 'btn-danger'} flex items-center justify-center gap-2`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 spinner"></div>
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Valider</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
