import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';

interface Enterprise {
  id: string;
  code: string;
  name: string;
  license_tier: string;
  max_shops: number;
  max_users_per_shop: number;
  licensed_until: string | null;
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
}

export default function AdminEnterprises() {
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
  const [enterpriseToDelete, setEnterpriseToDelete] = useState<Enterprise | null>(null);

  const [formData, setFormData] = useState<CreateEnterpriseData>({
    name: '',
    code: '',
    license_tier: 'STARTER',
    max_shops: 1,
    max_users_per_shop: 5,
    licensed_until: '',
  });

  const [licenseData, setLicenseData] = useState({
    license_tier: 'STARTER',
    licensed_until: '',
    max_shops: 1,
    max_users_per_shop: 5,
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

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      license_tier: 'STARTER',
      max_shops: 1,
      max_users_per_shop: 5,
      licensed_until: '',
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
    });
    setShowEditModal(true);
  };

  const openLicenseModal = (enterprise: Enterprise) => {
    setLicenseData({
      license_tier: enterprise.license_tier,
      licensed_until: enterprise.licensed_until ? enterprise.licensed_until.split('T')[0] : '',
      max_shops: enterprise.max_shops,
      max_users_per_shop: enterprise.max_users_per_shop,
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
          <p className="text-gray-600">Chargement des entreprises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏢 Gestion des Entreprises</h1>
          <p className="text-gray-600">Administration des entreprises et licences</p>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ➕ Créer une entreprise
          </button>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enterprises List */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                📋 Liste des entreprises ({enterprises.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
              {enterprises.map(enterprise => (
                <div
                  key={enterprise.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedEnterprise?.id === enterprise.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => loadEnterpriseDetails(enterprise.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{enterprise.name}</h3>
                      <p className="text-sm text-gray-600">Code: {enterprise.code}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${getLicenseBadgeColor(
                        enterprise.license_tier
                      )}`}
                    >
                      {enterprise.license_tier}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                    <div>
                      🏪 Boutiques: {enterprise._count?.shops || 0} / {enterprise.max_shops}
                    </div>
                    <div>👥 Users max: {enterprise.max_users_per_shop}</div>
                  </div>
                  {enterprise.owner && (
                    <p className="text-sm text-gray-600">
                      👤 Propriétaire: {enterprise.owner.display_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Créé le {formatDate(enterprise.created_at)}
                  </p>
                  {enterprise.is_blocked && (
                    <div className="mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                      🚫 Bloquée: {enterprise.blocked_reason || 'Raison non spécifiée'}
                    </div>
                  )}
                  {enterprise.licensed_until && (
                    <p className="text-xs text-gray-500 mt-1">
                      📅 Licence jusqu'au {formatDate(enterprise.licensed_until)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Details */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">🔍 Détails de l'entreprise</h2>
            </div>
            {isLoadingDetails ? (
              <div className="p-8 text-center text-gray-600">
                <div className="text-2xl mb-2">⏳</div>
                <p>Chargement des détails...</p>
              </div>
            ) : selectedEnterprise ? (
              <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Enterprise Info */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {selectedEnterprise.name}
                      </h3>
                      <p className="text-gray-600">Code: {selectedEnterprise.code}</p>
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
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600">Boutiques</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedEnterprise._count?.shops || 0} / {selectedEnterprise.max_shops}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600">Users par boutique</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedEnterprise.max_users_per_shop}
                      </p>
                    </div>
                  </div>

                  {selectedEnterprise.licensed_until && (
                    <div className="mb-4 p-3 bg-blue-50 rounded">
                      <p className="text-xs text-gray-600">Licence valide jusqu'au</p>
                      <p className="text-sm font-semibold text-blue-900">
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

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openEditModal(selectedEnterprise)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      onClick={() => openLicenseModal(selectedEnterprise)}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                    >
                      📜 Licence
                    </button>
                    <button
                      onClick={() => openDeleteModal(selectedEnterprise)}
                      className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Shops */}
                {selectedEnterprise.shops && selectedEnterprise.shops.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      🏪 Boutiques ({selectedEnterprise.shops.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEnterprise.shops.map(shop => (
                        <div key={shop.id} className="p-3 bg-gray-50 rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{shop.name}</p>
                              <p className="text-xs text-gray-600">Code: {shop.code}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {shop.shop_type}
                              </span>
                              {shop.is_blocked && (
                                <span className="ml-2 text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                                  🚫 Bloquée
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Audit Logs */}
                {selectedEnterprise.audit_logs && selectedEnterprise.audit_logs.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      📝 Historique récent ({selectedEnterprise.audit_logs.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedEnterprise.audit_logs.slice(0, 10).map(log => (
                        <div key={log.id} className="p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium text-gray-900">
                            {log.action} - {log.entity_type}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-gray-600">
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
              <div className="p-8 text-center text-gray-500">
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">➕ Créer une entreprise</h2>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code (optionnel)
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Code unique"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.license_tier}
                      onChange={e => setFormData({ ...formData, license_tier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Licence valide jusqu'au (optionnel)
                    </label>
                    <input
                      type="date"
                      value={formData.licensed_until}
                      onChange={e => setFormData({ ...formData, licensed_until: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">✏️ Modifier l'entreprise</h2>
              <form onSubmit={handleEdit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Code unique"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.license_tier}
                      onChange={e => setFormData({ ...formData, license_tier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Licence valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={formData.licensed_until}
                      onChange={e => setFormData({ ...formData, licensed_until: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📜 Mettre à jour la licence</h2>
              <form onSubmit={handleUpdateLicense}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type de licence <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={licenseData.license_tier}
                      onChange={e =>
                        setLicenseData({ ...licenseData, license_tier: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Licence valide jusqu'au
                    </label>
                    <input
                      type="date"
                      value={licenseData.licensed_until}
                      onChange={e =>
                        setLicenseData({ ...licenseData, licensed_until: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowLicenseModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🗑️ Supprimer l'entreprise</h2>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir supprimer l'entreprise{' '}
                <strong>{enterpriseToDelete.name}</strong> ? Cette action est irréversible et
                supprimera également toutes les boutiques associées.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setEnterpriseToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
    </div>
  );
}
