import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api';

interface Enterprise {
  id: string;
  code: string;
  name: string;
  license_tier: string;
  max_shops: number;
  max_users_per_shop: number;
  licensed_until: string | null;
  monthly_price?: number | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  owner?: { id: string; display_name: string; email?: string; phone?: string };
  shops?: Array<{ id: string; name: string; code: string; is_blocked: boolean; shop_type: string }>;
  _count?: { shops: number };
  audit_logs?: Array<{
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    admin?: { display_name: string };
  }>;
}

interface CreateEnterpriseData {
  name: string;
  code?: string;
  license_tier: string;
  max_shops: number;
  max_users_per_shop: number;
  licensed_until?: string;
  monthly_price: number;
}

export default function AdminEnterprises() {
  const navigate = useNavigate();
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showShopModulesModal, setShowShopModulesModal] = useState(false);
  const [enterpriseToDelete, setEnterpriseToDelete] = useState<Enterprise | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [shopModulesTarget, setShopModulesTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const [shopModules, setShopModules] = useState<string[]>([]);
  const [savingModules, setSavingModules] = useState(false);
  const [licenseConfig, setLicenseConfig] = useState<{
    modules: Array<{ code: string; name: string; tier: string; minimumLicenseTier: string }>;
    tiers: Record<string, { modules: string[] }>;
  } | null>(null);

  const [formData, setFormData] = useState<CreateEnterpriseData>({
    name: '',
    code: '',
    license_tier: 'STARTER',
    max_shops: 1,
    max_users_per_shop: 5,
    licensed_until: '',
    monthly_price: 0,
  });

  const [licenseData, setLicenseData] = useState({
    license_tier: 'STARTER',
    licensed_until: '',
    max_shops: 1,
    max_users_per_shop: 5,
    monthly_price: 0,
  });

  useEffect(() => {
    loadEnterprises();
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const loadEnterprises = async () => {
    try {
      setIsLoading(true);
      const data = await adminApi.getAllEnterprises();
      setEnterprises(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des entreprises');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEnterpriseDetails = async (id: string) => {
    try {
      setIsLoadingDetails(true);
      const data = await adminApi.getEnterpriseDetails(id);
      setSelectedEnterprise(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des détails');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code || undefined,
        licensed_until: formData.licensed_until || undefined,
      };
      await adminApi.createEnterprise(payload);
      setSuccess('Entreprise créée avec succès');
      setShowCreateModal(false);
      resetForm();
      loadEnterprises();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnterprise) return;
    try {
      const payload = {
        ...formData,
        code: formData.code || undefined,
        licensed_until: formData.licensed_until || undefined,
      };
      await adminApi.updateEnterprise(selectedEnterprise.id, payload);
      setSuccess('Entreprise mise à jour avec succès');
      setShowEditModal(false);
      resetForm();
      loadEnterprises();
      if (selectedEnterprise) {
        loadEnterpriseDetails(selectedEnterprise.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async () => {
    if (!enterpriseToDelete) return;
    try {
      await adminApi.deleteEnterprise(enterpriseToDelete.id);
      setSuccess('Entreprise supprimée avec succès');
      setShowDeleteModal(false);
      setEnterpriseToDelete(null);
      if (selectedEnterprise?.id === enterpriseToDelete.id) {
        setSelectedEnterprise(null);
      }
      loadEnterprises();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnterprise) return;
    try {
      const payload = {
        license_tier: licenseData.license_tier,
        licensed_until: licenseData.licensed_until || undefined,
        max_shops: licenseData.max_shops,
        max_users_per_shop: licenseData.max_users_per_shop,
        monthly_price: licenseData.monthly_price,
      };
      await adminApi.updateLicense(selectedEnterprise.id, payload);
      setSuccess('Licence mise à jour avec succès');
      setShowLicenseModal(false);
      loadEnterprises();
      loadEnterpriseDetails(selectedEnterprise.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour de la licence');
    }
  };

  const handleBlockToggle = async () => {
    if (!selectedEnterprise) return;
    try {
      if (selectedEnterprise.is_blocked) {
        await adminApi.unblockEnterprise(selectedEnterprise.id);
        setSuccess('Entreprise debloquee avec succes');
      } else {
        await adminApi.blockEnterprise(
          selectedEnterprise.id,
          blockReason || 'Aucune raison specifiee'
        );
        setSuccess('Entreprise bloquee avec succes');
      }
      setShowBlockModal(false);
      setBlockReason('');
      loadEnterprises();
      loadEnterpriseDetails(selectedEnterprise.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du blocage/deblocage');
    }
  };

  const openShopModulesModal = async (shop: { id: string; name: string }) => {
    try {
      const data = await adminApi.getShopModules(shop.id);
      setShopModulesTarget(shop);
      setShopModules(data.enabled_modules || []);
      // Load license config for tier grouping
      if (!licenseConfig) {
        const config = await adminApi.getLicenseConfig();
        setLicenseConfig(config);
      }
      setShowShopModulesModal(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des modules');
    }
  };

  const handleSaveShopModules = async () => {
    if (!shopModulesTarget) return;
    try {
      setSavingModules(true);
      await adminApi.updateShopModules(shopModulesTarget.id, shopModules);
      setSuccess(`Modules de "${shopModulesTarget.name}" mis a jour`);
      setShowShopModulesModal(false);
      if (selectedEnterprise) {
        loadEnterpriseDetails(selectedEnterprise.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise a jour des modules');
    } finally {
      setSavingModules(false);
    }
  };

  const toggleShopModule = (code: string) => {
    setShopModules(prev => (prev.includes(code) ? prev.filter(m => m !== code) : [...prev, code]));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      license_tier: 'STARTER',
      max_shops: 1,
      max_users_per_shop: 5,
      licensed_until: '',
      monthly_price: 0,
    });
  };

  const openEditModal = (enterprise: Enterprise) => {
    setSelectedEnterprise(enterprise);
    setFormData({
      name: enterprise.name,
      code: enterprise.code,
      license_tier: enterprise.license_tier,
      max_shops: enterprise.max_shops,
      max_users_per_shop: enterprise.max_users_per_shop,
      licensed_until: enterprise.licensed_until ? enterprise.licensed_until.split('T')[0] : '',
      monthly_price: enterprise.monthly_price ?? 0,
    });
    setShowEditModal(true);
  };

  const openLicenseModal = (enterprise: Enterprise) => {
    setLicenseData({
      license_tier: enterprise.license_tier,
      licensed_until: enterprise.licensed_until ? enterprise.licensed_until.split('T')[0] : '',
      max_shops: enterprise.max_shops,
      max_users_per_shop: enterprise.max_users_per_shop,
      monthly_price: enterprise.monthly_price ?? 0,
    });
    setShowLicenseModal(true);
  };

  const openDeleteModal = (enterprise: Enterprise) => {
    setEnterpriseToDelete(enterprise);
    setShowDeleteModal(true);
  };

  const getLicenseBadgeColor = (tier: string) => {
    switch (tier) {
      case 'STARTER':
        return 'bg-gray-100 text-gray-800';
      case 'PROFESSIONAL':
        return 'bg-blue-100 text-blue-800';
      case 'ENTERPRISE':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-slate-600">Chargement des entreprises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-900 mb-2">🏢 Gestion des Entreprises</h1>
          <p className="text-slate-600">Administration des entreprises et licences</p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            ✅ {success}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors"
          >
            ➕ Créer une entreprise
          </button>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enterprises List */}
          <div className="bg-white rounded-2xl shadow-card">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-primary-900">
                📋 Liste des entreprises ({enterprises.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-200 max-h-[calc(100vh-300px)] overflow-y-auto">
              {enterprises.map(enterprise => (
                <div
                  key={enterprise.id}
                  className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                    selectedEnterprise?.id === enterprise.id ? 'bg-action-50' : ''
                  }`}
                  onClick={() => loadEnterpriseDetails(enterprise.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-primary-900">{enterprise.name}</h3>
                      <p className="text-sm text-slate-600">Code: {enterprise.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/enterprises/${enterprise.id}/console`);
                        }}
                        title="Ouvrir la console"
                        aria-label={`Ouvrir la console de ${enterprise.name}`}
                        className="inline-flex items-center gap-1 rounded-md bg-action-50 px-2 py-1 text-xs font-medium text-action-600 transition-colors hover:bg-action-100"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        Console
                      </button>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getLicenseBadgeColor(
                          enterprise.license_tier
                        )}`}
                      >
                        {enterprise.license_tier}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-2">
                    <div>
                      🏪 Boutiques: {enterprise._count?.shops || 0} / {enterprise.max_shops}
                    </div>
                    <div>👥 Users max: {enterprise.max_users_per_shop}</div>
                  </div>
                  {enterprise.owner && (
                    <p className="text-sm text-slate-600">
                      👤 Propriétaire: {enterprise.owner.display_name}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Créé le {formatDate(enterprise.created_at)}
                  </p>
                  {enterprise.is_blocked && (
                    <div className="mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                      🚫 Bloquée: {enterprise.blocked_reason || 'Raison non spécifiée'}
                    </div>
                  )}
                  {enterprise.licensed_until && (
                    <p className="text-xs text-slate-500 mt-1">
                      📅 Licence jusqu'au {formatDate(enterprise.licensed_until)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Details */}
          <div className="bg-white rounded-2xl shadow-card">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-primary-900">🔍 Détails de l'entreprise</h2>
            </div>
            {isLoadingDetails ? (
              <div className="p-8 text-center text-slate-600">
                <div className="text-2xl mb-2">⏳</div>
                <p>Chargement des détails...</p>
              </div>
            ) : selectedEnterprise ? (
              <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Enterprise Info */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-primary-900">
                        {selectedEnterprise.name}
                      </h3>
                      <p className="text-slate-600">Code: {selectedEnterprise.code}</p>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded ${getLicenseBadgeColor(
                        selectedEnterprise.license_tier
                      )}`}
                    >
                      {selectedEnterprise.license_tier}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-600">Boutiques</p>
                      <p className="text-lg font-semibold text-primary-900">
                        {selectedEnterprise._count?.shops || 0} / {selectedEnterprise.max_shops}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-600">Users par boutique</p>
                      <p className="text-lg font-semibold text-primary-900">
                        {selectedEnterprise.max_users_per_shop}
                      </p>
                    </div>
                  </div>

                  {selectedEnterprise.licensed_until && (
                    <div className="mb-4 p-3 bg-action-50 rounded">
                      <p className="text-xs text-slate-600">Licence valide jusqu'au</p>
                      <p className="text-sm font-semibold text-action-700">
                        {formatDate(selectedEnterprise.licensed_until)}
                      </p>
                    </div>
                  )}

                  {selectedEnterprise.is_blocked && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-semibold text-red-800">🚫 Entreprise bloquée</p>
                      <p className="text-xs text-red-700 mt-1">
                        {selectedEnterprise.blocked_reason || 'Raison non spécifiée'}
                      </p>
                    </div>
                  )}

                  {/* Console drill-down */}
                  <button
                    onClick={() => navigate(`/enterprises/${selectedEnterprise.id}/console`)}
                    className="w-full mt-2 px-3 py-2 bg-primary-900 text-white text-sm rounded hover:bg-primary-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="M8 21h8M12 18v3" />
                    </svg>
                    Ouvrir la console
                  </button>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => openEditModal(selectedEnterprise)}
                      className="flex-1 px-3 py-2 bg-action-500 text-white text-sm rounded hover:bg-action-600 transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => openLicenseModal(selectedEnterprise)}
                      className="flex-1 px-3 py-2 bg-action-500 text-white text-sm rounded hover:bg-action-600 transition-colors"
                    >
                      Licence
                    </button>
                    <button
                      onClick={() => setShowBlockModal(true)}
                      className={`flex-1 px-3 py-2 text-white text-sm rounded transition-colors ${
                        selectedEnterprise.is_blocked
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {selectedEnterprise.is_blocked ? 'Debloquer' : 'Bloquer'}
                    </button>
                    <button
                      onClick={() => openDeleteModal(selectedEnterprise)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {/* Shops */}
                {selectedEnterprise.shops && selectedEnterprise.shops.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-primary-900 mb-3">
                      Boutiques ({selectedEnterprise.shops.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEnterprise.shops.map((shop: any) => (
                        <div key={shop.id} className="p-3 bg-slate-50 rounded">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-primary-900">{shop.name}</p>
                              <p className="text-xs text-slate-600">Code: {shop.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {shop.shop_type}
                              </span>
                              {shop.is_blocked && (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                                  Bloquee
                                </span>
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openShopModulesModal({ id: shop.id, name: shop.name });
                                }}
                                className="text-xs px-2 py-1 bg-action-50 text-action-600 rounded hover:bg-action-100 transition-colors"
                              >
                                Modules
                              </button>
                            </div>
                          </div>
                          {/* Module badges */}
                          {shop.enabled_modules && shop.enabled_modules.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {shop.enabled_modules.map((m: string) => (
                                <span
                                  key={m}
                                  className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-green-600">Tous les modules (par defaut)</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Audit Logs */}
                {selectedEnterprise.audit_logs && selectedEnterprise.audit_logs.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-primary-900 mb-3">
                      📝 Historique récent ({selectedEnterprise.audit_logs.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEnterprise.audit_logs.slice(0, 10).map(log => (
                        <div key={log.id} className="p-2 bg-slate-50 rounded text-xs">
                          <p className="font-medium text-primary-900">
                            {log.action} - {log.entity_type}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-slate-600">
                            <span>{log.admin?.display_name || 'Système'}</span>
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                <div className="text-4xl mb-2">🏢</div>
                <p>Sélectionnez une entreprise pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-primary-900 mb-4">➕ Créer une entreprise</h2>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Code (optionnel)
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="Code unique"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.license_tier}
                      onChange={e => setFormData({ ...formData, license_tier: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max de boutiques <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_shops}
                      onChange={e =>
                        setFormData({ ...formData, max_shops: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max d'utilisateurs par boutique <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_users_per_shop}
                      onChange={e =>
                        setFormData({ ...formData, max_users_per_shop: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Licence valide jusqu'au (optionnel)
                    </label>
                    <input
                      type="date"
                      value={formData.licensed_until}
                      onChange={e => setFormData({ ...formData, licensed_until: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Prix mensuel (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.monthly_price}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          monthly_price: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-primary-900 mb-4">✏️ Modifier l'entreprise</h2>
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="Code unique"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.license_tier}
                      onChange={e => setFormData({ ...formData, license_tier: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max de boutiques <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_shops}
                      onChange={e =>
                        setFormData({ ...formData, max_shops: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max d'utilisateurs par boutique <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_users_per_shop}
                      onChange={e =>
                        setFormData({ ...formData, max_users_per_shop: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Licence valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={formData.licensed_until}
                      onChange={e => setFormData({ ...formData, licensed_until: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Prix mensuel (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.monthly_price}
                      onChange={e =>
                        setFormData({
                          ...formData,
                          monthly_price: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* License Modal */}
      {showLicenseModal && selectedEnterprise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-primary-900 mb-4">
                📜 Mettre à jour la licence
              </h2>
              <form onSubmit={handleUpdateLicense}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={licenseData.license_tier}
                      onChange={e =>
                        setLicenseData({ ...licenseData, license_tier: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Licence valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={licenseData.licensed_until}
                      onChange={e =>
                        setLicenseData({ ...licenseData, licensed_until: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max de boutiques <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={licenseData.max_shops}
                      onChange={e =>
                        setLicenseData({ ...licenseData, max_shops: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre max d'utilisateurs par boutique <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={licenseData.max_users_per_shop}
                      onChange={e =>
                        setLicenseData({
                          ...licenseData,
                          max_users_per_shop: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Prix mensuel (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={licenseData.monthly_price}
                      onChange={e =>
                        setLicenseData({
                          ...licenseData,
                          monthly_price: Math.max(0, parseInt(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowLicenseModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors"
                  >
                    Mettre à jour
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && enterpriseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-primary-900 mb-4">Supprimer l'entreprise</h2>
              <p className="text-slate-600 mb-6">
                Etes-vous sur de vouloir supprimer l'entreprise{' '}
                <strong>{enterpriseToDelete.name}</strong> ? Cette action est irreversible et
                supprimera egalement toutes les boutiques associees.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setEnterpriseToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block/Unblock Modal */}
      {showBlockModal && selectedEnterprise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-primary-900 mb-4">
                {selectedEnterprise.is_blocked ? "Debloquer l'entreprise" : "Bloquer l'entreprise"}
              </h2>
              {!selectedEnterprise.is_blocked ? (
                <>
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                    Bloquer une entreprise bloque aussi toutes ses boutiques.
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Raison du blocage
                    </label>
                    <textarea
                      value={blockReason}
                      onChange={e => setBlockReason(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      rows={3}
                      placeholder="Raison du blocage..."
                    />
                  </div>
                </>
              ) : (
                <p className="text-slate-600 mb-4">
                  Debloquer l'entreprise <strong>{selectedEnterprise.name}</strong> et ses boutiques
                  bloquees en cascade ?
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBlockModal(false);
                    setBlockReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleBlockToggle}
                  className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                    selectedEnterprise.is_blocked
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {selectedEnterprise.is_blocked ? 'Debloquer' : 'Bloquer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Modules Edit Modal */}
      {showShopModulesModal && shopModulesTarget && licenseConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-elevated max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-primary-900 mb-4">
                Modules de "{shopModulesTarget.name}"
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                Cochez les modules a activer. Les modules non autorises par la licence sont
                desactives.
              </p>
              {/* Grouped by tier */}
              {(['CORE', 'EXTENDED', 'PREMIUM'] as const).map(tierGroup => {
                const tierLabel =
                  tierGroup === 'CORE' ? 'Coeur' : tierGroup === 'EXTENDED' ? 'Etendu' : 'Premium';
                const mods = licenseConfig.modules.filter(m => m.tier === tierGroup);
                // Modules allowed by enterprise license
                const allowedByLicense = selectedEnterprise
                  ? licenseConfig.tiers[selectedEnterprise.license_tier]?.modules || []
                  : [];
                return (
                  <div key={tierGroup} className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">{tierLabel}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {mods.map(m => {
                        const allowed = allowedByLicense.includes(m.code);
                        return (
                          <label
                            key={m.code}
                            className={`flex items-center gap-2 p-2 rounded border border-slate-200 text-sm ${
                              allowed
                                ? 'cursor-pointer hover:bg-slate-50'
                                : 'opacity-50 cursor-not-allowed bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={shopModules.includes(m.code)}
                              disabled={!allowed}
                              onChange={() => toggleShopModule(m.code)}
                              className="rounded text-action-500"
                            />
                            <span>{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowShopModulesModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveShopModules}
                  disabled={savingModules}
                  className="flex-1 px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition-colors disabled:opacity-50"
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
