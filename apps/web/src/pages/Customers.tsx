import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@swalo/core/utils';
import { customersApi } from '../lib/api';

interface Customer {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
  current_balance?: number;
  is_active: boolean;
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: '',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await customersApi.getAll();
      const normalized: Customer[] = data.map((customer: any) => ({
        id: customer.id,
        name: customer.name,
        first_name: customer.first_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        credit_limit: customer.credit_limit ?? 0,
        current_balance: customer.total_balance ?? 0,
        is_active: customer.is_active,
      }));
      setCustomers(normalized);
    } catch (error) {
      console.error('Erreur lors du chargement des clients:', error);
      alert('Impossible de charger les clients pour le moment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        first_name: customer.first_name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        credit_limit: customer.credit_limit ? String(customer.credit_limit / 100) : '',
      });
    } else {
      setSelectedCustomer(null);
      setFormData({
        name: '',
        first_name: '',
        phone: '',
        email: '',
        address: '',
        credit_limit: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedCustomer(null);
    setFormData({
      name: '',
      first_name: '',
      phone: '',
      email: '',
      address: '',
      credit_limit: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const creditLimitValue = formData.credit_limit?.trim();
    const payload = {
      name: formData.name.trim(),
      first_name: formData.first_name.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      credit_limit: creditLimitValue ? Math.round(parseFloat(creditLimitValue) * 100) : undefined,
    };

    if (!payload.name) {
      alert('Le nom est obligatoire.');
      return;
    }

    try {
      if (selectedCustomer) {
        await customersApi.update(selectedCustomer.id, payload);
      } else {
        await customersApi.create(payload);
      }
      handleCloseModal();
      loadCustomers();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      alert("Impossible d'enregistrer le client.");
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      customer.phone?.includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.is_active).length,
    withBalance: customers.filter(c => (c.current_balance || 0) > 0).length,
    totalBalance: customers.reduce((sum, c) => sum + (c.current_balance || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-sky-400 via-action-500 to-action-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Total Clients</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Actifs</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-success-50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Avec créances</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.withBalance}</p>
            </div>
            <div className="w-12 h-12 bg-warning-50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💳</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Total créances</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(stats.totalBalance)}
              </p>
            </div>
            <div className="w-12 h-12 bg-danger-50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions et recherche */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex-1 w-full md:w-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un client..."
                className="input pl-10"
              />
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <span>+</span>
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* Liste des clients */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Liste des clients</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">👥</span>
            </div>
            <p className="text-slate-500">
              {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            </p>
            {!searchQuery && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Créer le premier client
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Limite crédit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Créance actuelle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {customer.first_name} {customer.name}
                        </p>
                        {customer.email && (
                          <p className="text-sm text-slate-500">{customer.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{customer.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">
                        {customer.credit_limit ? formatCurrency(customer.credit_limit) : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p
                        className={`text-sm font-medium ${
                          (customer.current_balance || 0) > 0 ? 'text-danger-600' : 'text-slate-400'
                        }`}
                      >
                        {formatCurrency(customer.current_balance || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`badge ${customer.is_active ? 'badge-success' : 'badge-danger'}`}
                      >
                        {customer.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="text-action-600 hover:text-action-700 font-medium text-sm"
                        >
                          Voir détails
                        </button>
                        <button
                          onClick={() => handleOpenModal(customer)}
                          className="text-action-600 hover:text-action-700 font-medium text-sm"
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-sky-400 via-action-500 to-action-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedCustomer ? '✏️ Modifier le client' : '➕ Nouveau client'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {selectedCustomer
                      ? 'Mettre à jour les informations'
                      : 'Ajouter un nouveau client'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Nom <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Prénom</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    placeholder="+221 XX XXX XX XX"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="input"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Adresse</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="input resize-none"
                  placeholder="Adresse complète..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Limite de crédit (FCFA)
                </label>
                <input
                  type="number"
                  value={formData.credit_limit}
                  onChange={e => setFormData({ ...formData, credit_limit: e.target.value })}
                  className="input"
                  min="0"
                  step="1000"
                  placeholder="0"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Montant maximum que le client peut devoir
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {selectedCustomer ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
