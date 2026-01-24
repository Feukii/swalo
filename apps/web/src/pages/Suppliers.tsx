import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@swalo/core/utils';
import { suppliersApi } from '../lib/api';

interface Supplier {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  current_debt?: number;
  is_active: boolean;
}

export default function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await suppliersApi.getAll();
      const normalized: Supplier[] = data.map((supplier: any) => ({
        id: supplier.id,
        name: supplier.name,
        first_name: supplier.first_name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        current_debt: supplier.total_balance ?? 0,
        is_active: supplier.is_active,
      }));
      setSuppliers(normalized);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
      alert('Impossible de charger les fournisseurs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setSelectedSupplier(supplier);
      setFormData({
        name: supplier.name,
        first_name: supplier.first_name || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
      });
    } else {
      setSelectedSupplier(null);
      setFormData({
        name: '',
        first_name: '',
        phone: '',
        email: '',
        address: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSupplier(null);
    setFormData({
      name: '',
      first_name: '',
      phone: '',
      email: '',
      address: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Le nom est obligatoire.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      first_name: formData.first_name.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
    };

    try {
      if (selectedSupplier) {
        await suppliersApi.update(selectedSupplier.id, payload);
      } else {
        await suppliersApi.create(payload);
      }
      handleCloseModal();
      loadSuppliers();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du fournisseur:', error);
      alert('Impossible de sauvegarder le fournisseur.');
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const fullName = `${supplier.first_name || ''} ${supplier.name}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      supplier.phone?.includes(query) ||
      supplier.email?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.is_active).length,
    withDebt: suppliers.filter(s => (s.current_debt || 0) > 0).length,
    totalDebt: suppliers.reduce((sum, s) => sum + (s.current_debt || 0), 0),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-secondary-500 to-secondary-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary-100 text-sm">Total Fournisseurs</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🏪</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Actifs</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-success-50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">✓</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Avec dettes</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.withDebt}</p>
            </div>
            <div className="w-12 h-12 bg-warning-50 rounded-xl flex items-center justify-center">
              <span className="text-2xl">💸</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total dettes</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.totalDebt)}
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
                placeholder="Rechercher un fournisseur..."
                className="input pl-10"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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
            <span>Nouveau fournisseur</span>
          </button>
        </div>
      </div>

      {/* Liste des fournisseurs */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Liste des fournisseurs</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <span className="text-3xl">🏪</span>
            </div>
            <p className="text-gray-500">
              {searchQuery ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
            </p>
            {!searchQuery && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Créer le premier fournisseur
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dette actuelle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {supplier.first_name
                            ? `${supplier.first_name} ${supplier.name}`
                            : supplier.name}
                        </p>
                        {supplier.email && (
                          <p className="text-sm text-gray-500">{supplier.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{supplier.phone || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p
                        className={`text-sm font-medium ${
                          (supplier.current_debt || 0) > 0 ? 'text-danger-600' : 'text-gray-400'
                        }`}
                      >
                        {formatCurrency(supplier.current_debt || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`badge ${supplier.is_active ? 'badge-success' : 'badge-danger'}`}
                      >
                        {supplier.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => navigate(`/suppliers/${supplier.id}`)}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          Voir détails
                        </button>
                        <button
                          onClick={() => handleOpenModal(supplier)}
                          className="text-gray-600 hover:text-gray-700 font-medium text-sm"
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
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedSupplier ? '✏️ Modifier le fournisseur' : '➕ Nouveau fournisseur'}
                  </h2>
                  <p className="text-sm text-secondary-100 mt-1">
                    {selectedSupplier
                      ? 'Mettre à jour les informations'
                      : 'Ajouter un nouveau fournisseur'}
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
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Nom / Entreprise <span className="text-danger-500">*</span>
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
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Prénom / Contact
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="input"
                    placeholder="+221 XX XXX XX XX"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Email</label>
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
                <label className="text-sm font-medium text-gray-700 mb-2 block">Adresse</label>
                <textarea
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="input resize-none"
                  placeholder="Adresse complète..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {selectedSupplier ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
