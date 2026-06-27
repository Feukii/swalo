import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@swalo/core/utils';
import { suppliersApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  formatPhoneOnInput,
  formatCameroonPhone,
  isValidCameroonPhone,
  cleanPhoneNumber,
} from '../utils/phone';

interface Supplier {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  current_debt?: number;
  borrowing_limit?: number;
  last_operation_at?: string;
  is_active: boolean;
}

export default function Suppliers() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('suppliers', 'create');
  const canEdit = can('suppliers', 'edit');
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
    borrowing_limit: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await suppliersApi.getAll();
      const normalized: Supplier[] = data.map((supplier: Record<string, unknown>) => ({
        id: supplier.id as string,
        name: supplier.name as string,
        first_name: supplier.first_name as string | undefined,
        phone: supplier.phone as string | undefined,
        email: supplier.email as string | undefined,
        address: supplier.address as string | undefined,
        current_debt: (supplier.total_balance as number) ?? 0,
        borrowing_limit: (supplier.borrowing_limit as number) ?? 0,
        last_operation_at: (supplier.last_operation_at ?? supplier.updated_at) as
          | string
          | undefined,
        is_active: supplier.is_active as boolean,
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
        phone: supplier.phone ? formatCameroonPhone(supplier.phone) : '',
        email: supplier.email || '',
        address: supplier.address || '',
        borrowing_limit: supplier.borrowing_limit ? String(supplier.borrowing_limit) : '',
      });
    } else {
      setSelectedSupplier(null);
      setFormData({
        name: '',
        first_name: '',
        phone: '',
        email: '',
        address: '',
        borrowing_limit: '',
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
      borrowing_limit: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Le nom est obligatoire.');
      return;
    }

    const phoneValue = formData.phone.trim();
    if (phoneValue && !isValidCameroonPhone(phoneValue)) {
      alert('Numéro de téléphone invalide. Format attendu : +237 6XX XXX XXX.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      first_name: formData.first_name.trim() || undefined,
      phone: phoneValue ? cleanPhoneNumber(phoneValue) : undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      borrowing_limit: formData.borrowing_limit.trim()
        ? Number(formData.borrowing_limit)
        : undefined,
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

  const getInitials = (supplier: Supplier) => {
    const first = supplier.first_name?.trim()?.[0] ?? '';
    const second = supplier.name?.trim()?.[0] ?? '';
    return `${first}${second}`.toUpperCase() || supplier.name.slice(0, 2).toUpperCase();
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Fournisseurs</h1>
          <p className="text-sm text-slate-500 mt-1">Répertoire &amp; dettes</p>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher…"
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

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">À payer</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {formatCurrency(stats.totalDebt)}
          </p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fournisseurs</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">{stats.total}</p>
        </div>

        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avec dettes</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">
            {stats.withDebt > 0 ? stats.withDebt : '—'}
          </p>
        </div>
      </div>

      {/* Table fournisseurs */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-marine-900">Fournisseurs</h2>
          {canCreate && (
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>+</span>
              <span>Nouveau fournisseur</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">🏪</span>
            </div>
            <p className="text-slate-500">
              {searchQuery ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
            </p>
            {!searchQuery && canCreate && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Créer le premier fournisseur
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Téléphone
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Vous devez
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Limite d'emprunt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Dern. opé
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map(supplier => {
                  const debt = supplier.current_debt || 0;
                  const limit = supplier.borrowing_limit || 0;
                  const ratio = limit > 0 ? Math.min((debt / limit) * 100, 100) : 0;
                  const overLimit = limit > 0 && debt > limit;
                  const nearLimit = limit > 0 && ratio >= 80;
                  const barColor = overLimit
                    ? 'bg-danger-500'
                    : nearLimit
                      ? 'bg-warning-500'
                      : 'bg-success-500';
                  const settled = debt <= 0;

                  return (
                    <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                      {/* Nom + avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {getInitials(supplier)}
                          </div>
                          <div>
                            <p className="font-medium text-marine-900">
                              {supplier.first_name
                                ? `${supplier.first_name} ${supplier.name}`
                                : supplier.name}
                            </p>
                            {supplier.email && (
                              <p className="text-xs text-slate-400">{supplier.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">
                          {supplier.phone ? formatCameroonPhone(supplier.phone) : '—'}
                        </p>
                      </td>

                      {/* Vous devez */}
                      <td className="px-6 py-4 text-right">
                        {debt > 0 ? (
                          <p className="text-sm font-bold text-warning-600">
                            {formatCurrency(debt)}
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-success-600">À jour</p>
                        )}
                      </td>

                      {/* Limite d'emprunt */}
                      <td className="px-6 py-4">
                        {limit > 0 ? (
                          <div className="w-32">
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {formatCurrency(limit)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>

                      {/* Dern. opé */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-500">
                          {formatShortDate(supplier.last_operation_at)}
                        </p>
                      </td>

                      {/* Statut */}
                      <td className="px-6 py-4">
                        {settled ? (
                          <span className="badge bg-success-100 text-success-700">Soldé</span>
                        ) : (
                          <span className="badge bg-warning-100 text-warning-700">En cours</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => navigate(`/suppliers/${supplier.id}`)}
                            className="text-action-600 hover:text-action-700 font-medium text-sm"
                          >
                            Voir
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleOpenModal(supplier)}
                              className="text-slate-500 hover:text-slate-700 font-medium text-sm"
                            >
                              Modifier
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-sky-500 to-action-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
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
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
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
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
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
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e =>
                      setFormData({ ...formData, phone: formatPhoneOnInput(e.target.value) })
                    }
                    className="input"
                    placeholder="+237 6XX XXX XXX"
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

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Limite d'emprunt (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.borrowing_limit}
                    onChange={e => setFormData({ ...formData, borrowing_limit: e.target.value })}
                    className="input"
                    placeholder="0 = illimitée"
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

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
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
