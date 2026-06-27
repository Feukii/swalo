import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import {
  formatPhoneOnInput,
  formatCameroonPhone,
  isValidCameroonPhone,
  cleanPhoneNumber,
} from '../utils/phone';

interface CustomerReceivable {
  id: string;
  balance: number;
  status: string;
  due_date?: string | null;
}

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
  updated_at?: string;
  receivables?: CustomerReceivable[];
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  whatsapp_notifications_enabled?: boolean;
}

interface RawCustomer {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit?: number;
  total_balance?: number;
  is_active: boolean;
  updated_at?: string;
  receivables?: CustomerReceivable[];
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  whatsapp_notifications_enabled?: boolean;
}

/** Formatte un montant en centimes -> "12 500 F" (présentation, maquette). */
function formatF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

/** Formatte un montant en centimes en version compacte KPI -> "2,34 M F". */
function formatCompactF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} M F`;
  }
  if (amount >= 10_000) {
    return `${(amount / 1_000).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    })} k F`;
  }
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

/** Initiales stables à partir du nom complet. */
function getInitials(first?: string, name?: string): string {
  const a = (first || '').trim();
  const b = (name || '').trim();
  if (a && b) return `${a[0]}${b[0]}`.toUpperCase();
  const single = (b || a).split(/\s+/).filter(Boolean);
  if (single.length >= 2) return `${single[0][0]}${single[1][0]}`.toUpperCase();
  return (single[0] || '?').slice(0, 2).toUpperCase();
}

/** Toggle (switch) pour activer/désactiver un canal de notification. */
function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-marine-900">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-action-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** Teinte stable (déterministe) pour l'avatar, dérivée d'une chaîne. */
const AVATAR_HUES = [
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-marine-100', text: 'text-marine-700' },
  { bg: 'bg-warning-100', text: 'text-warning-700' },
  { bg: 'bg-success-100', text: 'text-success-700' },
  { bg: 'bg-danger-100', text: 'text-danger-700' },
  { bg: 'bg-info-100', text: 'text-info-700' },
];
function getAvatarHue(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

/** Formatte une date ISO -> "12 juin" (présentation). */
function formatDayMonth(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Un client est "en retard" s'il a une créance non soldée échue. */
function isOverdue(customer: Customer): boolean {
  const now = Date.now();
  return (customer.receivables || []).some(
    r =>
      r.status !== 'PAID' &&
      r.status !== 'CANCELLED' &&
      r.balance > 0 &&
      r.due_date != null &&
      new Date(r.due_date).getTime() < now
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('customers', 'create');
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
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    whatsapp_notifications_enabled: false,
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data: RawCustomer[] = await customersApi.getAll();
      const normalized: Customer[] = data.map(customer => ({
        id: customer.id,
        name: customer.name,
        first_name: customer.first_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        credit_limit: customer.credit_limit ?? 0,
        current_balance: customer.total_balance ?? 0,
        is_active: customer.is_active,
        updated_at: customer.updated_at,
        receivables: customer.receivables,
        email_notifications_enabled: customer.email_notifications_enabled,
        sms_notifications_enabled: customer.sms_notifications_enabled,
        whatsapp_notifications_enabled: customer.whatsapp_notifications_enabled,
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
        phone: customer.phone ? formatCameroonPhone(customer.phone) : '',
        email: customer.email || '',
        address: customer.address || '',
        credit_limit: customer.credit_limit ? String(customer.credit_limit / 100) : '',
        email_notifications_enabled: customer.email_notifications_enabled ?? true,
        sms_notifications_enabled: customer.sms_notifications_enabled ?? false,
        whatsapp_notifications_enabled: customer.whatsapp_notifications_enabled ?? false,
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
        email_notifications_enabled: true,
        sms_notifications_enabled: false,
        whatsapp_notifications_enabled: false,
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
      email_notifications_enabled: true,
      sms_notifications_enabled: false,
      whatsapp_notifications_enabled: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneValue = formData.phone.trim();
    if (phoneValue && !isValidCameroonPhone(phoneValue)) {
      alert('Numéro de téléphone invalide. Format attendu : +237 6XX XXX XXX.');
      return;
    }

    const creditLimitValue = formData.credit_limit?.trim();
    const payload = {
      name: formData.name.trim(),
      first_name: formData.first_name.trim() || undefined,
      phone: phoneValue ? cleanPhoneNumber(phoneValue) : undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      credit_limit: creditLimitValue ? Math.round(parseFloat(creditLimitValue) * 100) : undefined,
      email_notifications_enabled: formData.email_notifications_enabled,
      sms_notifications_enabled: formData.sms_notifications_enabled,
      whatsapp_notifications_enabled: formData.whatsapp_notifications_enabled,
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

  // KPI calculés depuis la liste déjà chargée
  const toRecover = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const debtorsCount = customers.filter(c => (c.current_balance || 0) > 0).length;
  const overdueCount = customers.filter(isOverdue).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête de page */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marine-900">Clients</h1>
        <p className="text-sm text-slate-500">Répertoire &amp; créances</p>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">À recouvrer</p>
          <p className="text-3xl font-bold text-marine-900 mt-2">{formatCompactF(toRecover)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Clients débiteurs</p>
          <p className="text-3xl font-bold text-marine-900 mt-2">{debtorsCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">En retard</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              overdueCount > 0 ? 'text-danger-600' : 'text-marine-900'
            }`}
          >
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Liste des clients */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-marine-900">Clients</h2>
          <div className="flex items-center gap-3">
            {/* Recherche (logique conservée) */}
            <div className="relative hidden lg:block">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
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
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500 transition-colors"
              />
            </div>
            {canCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-action-500 hover:bg-action-600 rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                <span className="text-base leading-none">+</span>
                <span>Nouveau client</span>
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500">
              {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
            </p>
            {!searchQuery && canCreate && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Créer le premier client
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Téléphone
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Doit
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Limite de crédit
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Dern. opé
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => {
                  const balance = customer.current_balance || 0;
                  const limit = customer.credit_limit || 0;
                  const hue = getAvatarHue(`${customer.first_name || ''}${customer.name}`);
                  const usage = limit > 0 ? Math.min(balance / limit, 1) : 0;
                  const isNearLimit = limit > 0 && balance / limit >= 0.8;
                  const overLimit = limit > 0 && balance >= limit;

                  return (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {/* NOM + avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${hue.bg} ${hue.text}`}
                          >
                            {getInitials(customer.first_name, customer.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-marine-900 truncate">
                              {customer.first_name
                                ? `${customer.first_name} ${customer.name}`
                                : customer.name}
                            </p>
                            {customer.email && (
                              <p className="text-xs text-slate-400 truncate">{customer.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* TÉLÉPHONE */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {customer.phone ? formatCameroonPhone(customer.phone) : '—'}
                      </td>
                      {/* DOIT */}
                      <td className="px-6 py-4 text-right">
                        {balance > 0 ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm font-semibold text-danger-600">
                              {formatF(balance)}
                            </span>
                            <span className="text-[11px] text-slate-400">Doit</span>
                          </div>
                        ) : balance < 0 ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm font-semibold text-sky-600">
                              {formatF(Math.abs(balance))}
                            </span>
                            <span className="text-[11px] text-slate-400">À rembourser</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm font-semibold text-success-600">À jour</span>
                            <span className="text-[11px] text-slate-400">Soldé</span>
                          </div>
                        )}
                      </td>
                      {/* LIMITE DE CRÉDIT */}
                      <td className="px-6 py-4">
                        {limit > 0 ? (
                          <div className="w-36">
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isNearLimit ? 'bg-danger-500' : 'bg-success-500'
                                }`}
                                style={{ width: `${Math.max(usage * 100, balance > 0 ? 4 : 0)}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{formatF(limit)}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>
                      {/* DERN. OPÉ */}
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDayMonth(customer.updated_at)}
                      </td>
                      {/* STATUT */}
                      <td className="px-6 py-4 text-right">
                        {overLimit ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-danger-100 text-danger-700">
                            Limite
                          </span>
                        ) : balance > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800">
                            En cours
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                            Soldé
                          </span>
                        )}
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
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-sky-400 via-action-500 to-action-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedCustomer ? 'Modifier le client' : 'Nouveau client'}
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

              {/* Préférences de notification */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Canaux de relance
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Comment prévenir ce client en cas d'échéance de créance.
                </p>
                <div className="space-y-2">
                  <NotificationToggle
                    label="Email"
                    description="Rappels par courriel"
                    checked={formData.email_notifications_enabled}
                    onChange={value =>
                      setFormData({ ...formData, email_notifications_enabled: value })
                    }
                  />
                  <NotificationToggle
                    label="SMS"
                    description="Rappels par message texte"
                    checked={formData.sms_notifications_enabled}
                    onChange={value =>
                      setFormData({ ...formData, sms_notifications_enabled: value })
                    }
                  />
                  <NotificationToggle
                    label="WhatsApp"
                    description="Rappels via WhatsApp"
                    checked={formData.whatsapp_notifications_enabled}
                    onChange={value =>
                      setFormData({ ...formData, whatsapp_notifications_enabled: value })
                    }
                  />
                </div>
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
