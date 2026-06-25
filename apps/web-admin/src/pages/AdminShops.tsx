import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';

interface Enterprise {
  id: string;
  name: string;
}

interface Shop {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  owner?: {
    id: string;
    display_name: string;
    email?: string;
    phone?: string;
  };
  enterprise_id: string;
  enterprise?: {
    id: string;
    name: string;
    license_tier: string;
  };
  shop_type: 'BOUTIQUE' | 'MAGASIN';
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  is_blocked: boolean;
  blocked_reason?: string;
  enabled_modules: string[];
  created_at: string;
  _count?: {
    user_roles: number;
    products: number;
    sales: number;
    customers: number;
    suppliers: number;
  };
}

interface CreateShopData {
  shop_name: string;
  shop_code?: string;
  owner_name?: string;
  owner_phone?: string;
  enterprise_id?: string;
  shop_type?: 'BOUTIQUE' | 'MAGASIN';
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  enabled_modules?: string[];
}

const AVAILABLE_MODULES = [
  // CORE
  { value: 'auth', label: 'Authentification', tier: 'CORE' },
  { value: 'products', label: 'Produits', tier: 'CORE' },
  { value: 'customers', label: 'Clients', tier: 'CORE' },
  { value: 'sales', label: 'Ventes', tier: 'CORE' },
  { value: 'cash', label: 'Caisse', tier: 'CORE' },
  { value: 'inventory', label: 'Inventaire', tier: 'CORE' },
  // EXTENDED
  { value: 'suppliers', label: 'Fournisseurs', tier: 'EXTENDED' },
  { value: 'payments', label: 'Paiements', tier: 'EXTENDED' },
  { value: 'receivables', label: 'Creances', tier: 'EXTENDED' },
  { value: 'debts', label: 'Dettes', tier: 'EXTENDED' },
  { value: 'admin', label: 'Gestion Utilisateurs', tier: 'EXTENDED' },
  { value: 'reports', label: 'Rapports', tier: 'EXTENDED' },
  // PREMIUM
  { value: 'enterprise', label: 'Multi-boutique', tier: 'PREMIUM' },
  { value: 'transfers', label: 'Transferts', tier: 'PREMIUM' },
  { value: 'invoices', label: 'Factures', tier: 'PREMIUM' },
  { value: 'notifications', label: 'Notifications', tier: 'PREMIUM' },
  { value: 'import', label: 'Import Bulk', tier: 'PREMIUM' },
  { value: 'packaging-types', label: 'Conditionnements', tier: 'PREMIUM' },
];

export default function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnterprise, setFilterEnterprise] = useState<string>('');
  const [filterBlocked, setFilterBlocked] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);
  const [shopToBlock, setShopToBlock] = useState<Shop | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [modulesTarget, setModulesTarget] = useState<Shop | null>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [licenseConfig, setLicenseConfig] = useState<{
    modules: Array<{ code: string; name: string; tier: string; minimumLicenseTier: string }>;
    tiers: Record<string, { modules: string[] }>;
  } | null>(null);

  const [formData, setFormData] = useState<CreateShopData>({
    shop_name: '',
    shop_code: '',
    owner_name: '',
    owner_phone: '',
    enterprise_id: '',
    shop_type: 'BOUTIQUE',
    address: '',
    phone: '',
    email: '',
    currency: 'XOF',
    enabled_modules: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [shopsData, enterprisesData] = await Promise.all([
        adminApi.getAllShops(),
        adminApi.getAllEnterprises(),
      ]);
      setShops(shopsData);
      setEnterprises(enterprisesData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      const dataToSend: CreateShopData = {
        shop_name: formData.shop_name,
        shop_type: formData.shop_type,
        currency: formData.currency,
      };

      if (formData.shop_code) dataToSend.shop_code = formData.shop_code;
      if (formData.owner_name) dataToSend.owner_name = formData.owner_name;
      if (formData.owner_phone) dataToSend.owner_phone = formData.owner_phone;
      if (formData.enterprise_id) dataToSend.enterprise_id = formData.enterprise_id;
      if (formData.address) dataToSend.address = formData.address;
      if (formData.phone) dataToSend.phone = formData.phone;
      if (formData.email) dataToSend.email = formData.email;
      if (formData.enabled_modules && formData.enabled_modules.length > 0) {
        dataToSend.enabled_modules = formData.enabled_modules;
      }

      await adminApi.createShop(dataToSend);
      setShowCreateModal(false);
      setFormData({
        shop_name: '',
        shop_code: '',
        owner_name: '',
        owner_phone: '',
        enterprise_id: '',
        shop_type: 'BOUTIQUE',
        address: '',
        phone: '',
        email: '',
        currency: 'XOF',
        enabled_modules: [],
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création de la boutique');
    }
  };

  const handleDeleteShop = async () => {
    if (!shopToDelete) return;
    try {
      setError(null);
      await adminApi.deleteShop(shopToDelete.id);
      setShopToDelete(null);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression de la boutique');
    }
  };

  const handleBlockShop = async () => {
    if (!shopToBlock) return;
    try {
      setError(null);
      if (shopToBlock.is_blocked) {
        await adminApi.unblockShop(shopToBlock.id);
      } else {
        await adminApi.blockShop(shopToBlock.id, blockReason || 'Aucune raison spécifiée');
      }
      setShopToBlock(null);
      setBlockReason('');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du blocage/déblocage de la boutique');
    }
  };

  const openModulesModal = async (shop: Shop) => {
    try {
      const data = await adminApi.getShopModules(shop.id);
      setModulesTarget(shop);
      setEditModules(data.enabled_modules || []);
      if (!licenseConfig) {
        const config = await adminApi.getLicenseConfig();
        setLicenseConfig(config);
      }
      setShowModulesModal(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des modules');
    }
  };

  const handleSaveModules = async () => {
    if (!modulesTarget) return;
    try {
      setSavingModules(true);
      setError(null);
      await adminApi.updateShopModules(modulesTarget.id, editModules);
      setShowModulesModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise a jour des modules');
    } finally {
      setSavingModules(false);
    }
  };

  const toggleEditModule = (code: string) => {
    setEditModules(prev => (prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]));
  };

  const toggleModule = (moduleValue: string) => {
    setFormData(prev => {
      const current = prev.enabled_modules || [];
      if (current.includes(moduleValue)) {
        return { ...prev, enabled_modules: current.filter(m => m !== moduleValue) };
      } else {
        return { ...prev, enabled_modules: [...current, moduleValue] };
      }
    });
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch =
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.code.includes(searchTerm) ||
      (shop.owner?.display_name &&
        shop.owner.display_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEnterprise = !filterEnterprise || shop.enterprise_id === filterEnterprise;

    const matchesBlocked =
      !filterBlocked ||
      (filterBlocked === 'blocked' && shop.is_blocked) ||
      (filterBlocked === 'active' && !shop.is_blocked);

    return matchesSearch && matchesEnterprise && matchesBlocked;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Chargement des boutiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🏪 Gestion des Boutiques</h1>
        <p className="text-gray-600">Administration des boutiques et magasins</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ❌ {error}
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 Rechercher (nom, code, propriétaire)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
          />

          <select
            value={filterEnterprise}
            onChange={e => setFilterEnterprise(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
          >
            <option value="">🏢 Toutes les entreprises</option>
            {enterprises.map(ent => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>

          <select
            value={filterBlocked}
            onChange={e => setFilterBlocked(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
          >
            <option value="">📊 Tous les statuts</option>
            <option value="active">✅ Actives</option>
            <option value="blocked">🚫 Bloquées</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-action-500 text-white px-4 py-2 rounded-lg hover:bg-action-600 transition"
          >
            ➕ Créer une boutique
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {filteredShops.length} boutique(s) affichée(s) sur {shops.length} au total
        </div>
      </div>

      {/* Shops List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredShops.map(shop => (
          <div key={shop.id} className="bg-white rounded-lg shadow hover:shadow-md transition">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">{shop.name}</h3>
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {shop.code}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        shop.shop_type === 'BOUTIQUE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {shop.shop_type}
                    </span>
                    {shop.is_blocked && (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                        🚫 Bloquée
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    {shop.owner?.display_name && (
                      <div>
                        <span className="font-semibold">👤 Propriétaire:</span>{' '}
                        {shop.owner?.display_name}
                      </div>
                    )}
                    {shop.enterprise && (
                      <div>
                        <span className="font-semibold">🏢 Entreprise:</span> {shop.enterprise.name}
                      </div>
                    )}
                    <div>
                      <span className="font-semibold">👥 Utilisateurs:</span>{' '}
                      {shop._count?.user_roles || 0}
                    </div>
                    <div>
                      <span className="font-semibold">📦 Produits:</span>{' '}
                      {shop._count?.products || 0}
                    </div>
                    <div>
                      <span className="font-semibold">💰 Ventes:</span> {shop._count?.sales || 0}
                    </div>
                    <div>
                      <span className="font-semibold">📅 Créée le:</span>{' '}
                      {new Date(shop.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    <div>
                      <span className="font-semibold">💱 Devise:</span> {shop.currency}
                    </div>
                    {shop.phone && (
                      <div>
                        <span className="font-semibold">📞 Tél:</span> {shop.phone}
                      </div>
                    )}
                  </div>

                  {expandedShopId === shop.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {shop.address && (
                          <div>
                            <span className="font-semibold">📍 Adresse:</span> {shop.address}
                          </div>
                        )}
                        {shop.email && (
                          <div>
                            <span className="font-semibold">✉️ Email:</span> {shop.email}
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="font-semibold">🔧 Modules activés:</span>{' '}
                          {shop.enabled_modules.length === 0 ? (
                            <span className="text-green-600">Tous les modules (par défaut)</span>
                          ) : (
                            <span>
                              {shop.enabled_modules
                                .map(m => AVAILABLE_MODULES.find(am => am.value === m)?.label || m)
                                .join(', ')}
                            </span>
                          )}
                        </div>
                        {shop.is_blocked && shop.blocked_reason && (
                          <div className="col-span-2 bg-red-50 p-3 rounded">
                            <span className="font-semibold text-red-800">
                              🚫 Raison du blocage:
                            </span>{' '}
                            <span className="text-red-700">{shop.blocked_reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setExpandedShopId(expandedShopId === shop.id ? null : shop.id)}
                    className="text-action-600 hover:text-action-700 px-3 py-1 rounded hover:bg-action-50"
                    title="Voir les details"
                  >
                    {expandedShopId === shop.id ? '[-]' : '[+]'}
                  </button>
                  <button
                    onClick={() => openModulesModal(shop)}
                    className="text-indigo-600 hover:text-indigo-800 px-3 py-1 rounded hover:bg-indigo-50 text-sm"
                    title="Modifier les modules"
                  >
                    Modules
                  </button>
                  <button
                    onClick={() => setShopToBlock(shop)}
                    className={`px-3 py-1 rounded transition text-sm ${
                      shop.is_blocked
                        ? 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        : 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                    }`}
                    title={shop.is_blocked ? 'Debloquer' : 'Bloquer'}
                  >
                    {shop.is_blocked ? 'Debloquer' : 'Bloquer'}
                  </button>
                  <button
                    onClick={() => setShopToDelete(shop)}
                    className="text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50 text-sm"
                    title="Supprimer"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredShops.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-6xl mb-4">🏪</div>
          <p className="text-gray-600">Aucune boutique trouvée</p>
        </div>
      )}

      {/* Create Shop Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">➕ Créer une nouvelle boutique</h2>
              <form onSubmit={handleCreateShop} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Nom de la boutique <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.shop_name}
                    onChange={e => setFormData({ ...formData, shop_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Code boutique (4-10 caractères, A-Z et 0-9)
                    </label>
                    <input
                      type="text"
                      value={formData.shop_code}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          shop_code: e.target.value
                            .replace(/[^A-Za-z0-9]/g, '')
                            .toUpperCase()
                            .slice(0, 10),
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500 font-mono"
                      placeholder="Auto-généré si vide"
                      maxLength={10}
                      pattern="[A-Z0-9]{4,10}"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.shop_type}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          shop_type: e.target.value as 'BOUTIQUE' | 'MAGASIN',
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    >
                      <option value="BOUTIQUE">Boutique</option>
                      <option value="MAGASIN">Magasin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nom du propriétaire</label>
                    <input
                      type="text"
                      value={formData.owner_name}
                      onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Téléphone propriétaire
                    </label>
                    <input
                      type="tel"
                      value={formData.owner_phone}
                      onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Entreprise</label>
                  <select
                    value={formData.enterprise_id}
                    onChange={e => setFormData({ ...formData, enterprise_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                  >
                    <option value="">Aucune entreprise</option>
                    {enterprises.map(ent => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Téléphone boutique</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Devise <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-action-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Modules activés (vide = tous les modules)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {AVAILABLE_MODULES.map(module => (
                      <label key={module.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enabled_modules?.includes(module.value) || false}
                          onChange={() => toggleModule(module.value)}
                          className="rounded text-action-500 focus:ring-2 focus:ring-action-500"
                        />
                        <span className="text-sm">{module.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-action-500 text-white px-4 py-2 rounded-lg hover:bg-action-600 transition"
                  >
                    ✅ Créer la boutique
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                  >
                    ❌ Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {shopToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4 text-red-600">🗑️ Confirmer la suppression</h2>
            <p className="mb-4 text-gray-700">
              Êtes-vous sûr de vouloir supprimer la boutique <strong>{shopToDelete.name}</strong>{' '}
              (code: {shopToDelete.code}) ?
            </p>
            <p className="mb-6 text-sm text-red-600 font-semibold">
              ⚠️ Cette action est irréversible et supprimera toutes les données associées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteShop}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
              >
                🗑️ Supprimer
              </button>
              <button
                onClick={() => setShopToDelete(null)}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block/Unblock Confirmation Modal */}
      {shopToBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              {shopToBlock.is_blocked ? '✅ Débloquer la boutique' : '🚫 Bloquer la boutique'}
            </h2>
            <p className="mb-4 text-gray-700">
              {shopToBlock.is_blocked
                ? `Débloquer la boutique ${shopToBlock.name} ?`
                : `Bloquer la boutique ${shopToBlock.name} ?`}
            </p>
            {!shopToBlock.is_blocked && (
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1">
                  Raison du blocage (optionnel)
                </label>
                <textarea
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="Entrez la raison du blocage..."
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleBlockShop}
                className={`flex-1 text-white px-4 py-2 rounded-lg transition ${
                  shopToBlock.is_blocked
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {shopToBlock.is_blocked ? '✅ Débloquer' : '🚫 Bloquer'}
              </button>
              <button
                onClick={() => {
                  setShopToBlock(null);
                  setBlockReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modules Edit Modal */}
      {showModulesModal && modulesTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">Modules de "{modulesTarget.name}"</h2>
              <p className="text-sm text-gray-600 mb-4">
                Cochez les modules a activer. Les modules non autorises par la licence sont
                desactives.
              </p>
              {licenseConfig ? (
                (['CORE', 'EXTENDED', 'PREMIUM'] as const).map(tierGroup => {
                  const tierLabel =
                    tierGroup === 'CORE'
                      ? 'Coeur'
                      : tierGroup === 'EXTENDED'
                        ? 'Etendu'
                        : 'Premium';
                  const mods = licenseConfig.modules.filter(m => m.tier === tierGroup);
                  const licenseTier = modulesTarget.enterprise?.license_tier || 'STARTER';
                  const allowedByLicense = licenseConfig.tiers[licenseTier]?.modules || [];
                  return (
                    <div key={tierGroup} className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">{tierLabel}</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {mods.map(m => {
                          const allowed = allowedByLicense.includes(m.code);
                          return (
                            <label
                              key={m.code}
                              className={`flex items-center gap-2 p-2 rounded border text-sm ${
                                allowed
                                  ? 'cursor-pointer hover:bg-gray-50'
                                  : 'opacity-50 cursor-not-allowed bg-gray-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={editModules.includes(m.code)}
                                disabled={!allowed}
                                onChange={() => toggleEditModule(m.code)}
                                className="rounded text-blue-600"
                              />
                              <span>{m.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {AVAILABLE_MODULES.map(module => (
                    <label key={module.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editModules.includes(module.value)}
                        onChange={() => toggleEditModule(module.value)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm">{module.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowModulesModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveModules}
                  disabled={savingModules}
                  className="flex-1 bg-action-500 text-white px-4 py-2 rounded-lg hover:bg-action-600 transition disabled:opacity-50"
                >
                  {savingModules ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
