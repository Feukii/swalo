import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  TrashIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

interface Shop {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at: string;
  owner: {
    id: string;
    display_name: string;
    email?: string;
    phone?: string;
  };
  _count: {
    user_roles: number;
    products: number;
    sales: number;
    customers: number;
    suppliers: number;
  };
}

interface SystemStats {
  totalShops: number;
  totalUsers: number;
  activeShops: number;
  totalSales: number;
  totalProducts: number;
}

interface User {
  id: string;
  display_name: string;
  email?: string;
  phone?: string;
  role: string;
  created_at: string;
  last_activity?: string;
  devices?: Device[];
}

interface Device {
  id: string;
  device_name: string;
  device_model?: string;
  last_used_at: string;
  is_active: boolean;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopUsers, setShopUsers] = useState<User[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'shops' | 'users'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shopsData, statsData] = await Promise.all([
        adminApi.getAllShops(),
        adminApi.getSystemStats(),
      ]);
      setShops(shopsData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Erreur lors du chargement:', error);
      if (error.response?.status === 403) {
        alert('Accès refusé. Vous devez être Super Admin.');
        navigate('/');
      } else {
        alert('Impossible de charger les données');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadShopUsers = async (shopId: string) => {
    try {
      const users = await adminApi.getShopUsers(shopId);
      setShopUsers(users);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      alert('Impossible de charger les utilisateurs');
    }
  };

  const handleViewShop = async (shop: Shop) => {
    setSelectedShop(shop);
    await loadShopUsers(shop.id);
    setActiveTab('users');
  };

  const handleDeleteShop = (shop: Shop) => {
    setShopToDelete(shop);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteShop = async () => {
    if (!shopToDelete) return;

    try {
      await adminApi.deleteShop(shopToDelete.id);
      alert(`Boutique "${shopToDelete.name}" supprimée avec succès`);
      setShowDeleteConfirm(false);
      setShopToDelete(null);
      loadData();
    } catch (error) {
      console.error('Erreur suppression boutique:', error);
      alert('Impossible de supprimer la boutique');
    }
  };

  const handleRevokeUserAccess = async (userId: string, userName: string) => {
    if (!confirm(`Révoquer l'accès de ${userName} ?`)) return;

    try {
      await adminApi.deactivateUser(userId);
      alert(`Accès révoqué pour ${userName}`);
      if (selectedShop) {
        loadShopUsers(selectedShop.id);
      }
    } catch (error) {
      console.error('Erreur révocation:', error);
      alert("Impossible de révoquer l'accès");
    }
  };

  const handleRevokeDevices = async (userId: string, userName: string) => {
    if (!confirm(`Déconnecter tous les appareils de ${userName} ?`)) return;

    try {
      await adminApi.revokeAllUserDevices(userId, '');
      alert(`Tous les appareils de ${userName} ont été déconnectés`);
      if (selectedShop) {
        loadShopUsers(selectedShop.id);
      }
    } catch (error) {
      console.error('Erreur révocation appareils:', error);
      alert('Impossible de déconnecter les appareils');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panneau d'Administration</h1>
        <p className="text-gray-600 mt-2">Gestion complète de la plateforme Swalo</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChartBarIcon className="w-5 h-5 inline mr-2" />
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('shops')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shops'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingBagIcon className="w-5 h-5 inline mr-2" />
            Boutiques ({shops.length})
          </button>
          {selectedShop && (
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserGroupIcon className="w-5 h-5 inline mr-2" />
              {selectedShop.name} - Utilisateurs
            </button>
          )}
        </nav>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Chargement...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && stats && (
            <div>
              {/* System Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Boutiques</p>
                      <p className="text-3xl font-bold mt-2">{stats.totalShops}</p>
                    </div>
                    <ShoppingBagIcon className="w-12 h-12 opacity-50" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Utilisateurs</p>
                      <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
                    </div>
                    <UserGroupIcon className="w-12 h-12 opacity-50" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Ventes totales</p>
                      <p className="text-3xl font-bold mt-2">{stats.totalSales}</p>
                    </div>
                    <CurrencyDollarIcon className="w-12 h-12 opacity-50" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Produits</p>
                      <p className="text-3xl font-bold mt-2">{stats.totalProducts}</p>
                    </div>
                    <ChartBarIcon className="w-12 h-12 opacity-50" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Actives</p>
                      <p className="text-3xl font-bold mt-2">{stats.activeShops}</p>
                      <p className="text-xs opacity-75 mt-1">
                        {Math.round((stats.activeShops / stats.totalShops) * 100)}% du total
                      </p>
                    </div>
                    <CheckCircleIcon className="w-12 h-12 opacity-50" />
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('shops')}
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <ShoppingBagIcon className="w-5 h-5 mr-2 text-blue-600" />
                    <span className="text-sm font-medium">Gérer les boutiques</span>
                  </button>
                  <button
                    onClick={() => navigate('/create-shop')}
                    className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                  >
                    <span className="text-sm font-medium">+ Nouvelle boutique</span>
                  </button>
                  <button
                    onClick={loadData}
                    className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <span className="text-sm font-medium">🔄 Actualiser</span>
                  </button>
                </div>
              </div>

              {/* Recent Shops */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Boutiques récentes</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {shops.slice(0, 5).map(shop => (
                    <div
                      key={shop.id}
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewShop(shop)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{shop.name}</p>
                          <p className="text-xs text-gray-500">
                            Code: {shop.code} • Créée le {formatDate(shop.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {shop._count.user_roles} utilisateurs
                          </p>
                          <p className="text-xs text-gray-500">{shop._count.sales} ventes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Shops Tab */}
          {activeTab === 'shops' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Toutes les boutiques</h2>
                <button
                  onClick={() => navigate('/create-shop')}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                >
                  + Nouvelle boutique
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Boutique
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Propriétaire
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Utilisateurs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activité
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Créée le
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shops.map(shop => (
                      <tr key={shop.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                            <div className="text-sm text-gray-500">Code: {shop.code}</div>
                            {shop.phone && (
                              <div className="text-xs text-gray-400 mt-1">{shop.phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm text-gray-900">{shop.owner.display_name}</div>
                            {shop.owner.phone && (
                              <div className="text-xs text-gray-500">{shop.owner.phone}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{shop._count.user_roles}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{shop._count.sales} ventes</div>
                          <div className="text-xs text-gray-500">
                            {shop._count.products} produits
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(shop.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleViewShop(shop)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded hover:bg-blue-200 transition"
                          >
                            Voir détails
                          </button>
                          <button
                            onClick={() => handleDeleteShop(shop)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition"
                          >
                            <TrashIcon className="w-4 h-4 mr-1" />
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && selectedShop && (
            <div>
              <div className="bg-white rounded-lg shadow mb-6 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedShop.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">Code: {selectedShop.code}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedShop(null);
                      setActiveTab('shops');
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Retour aux boutiques
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Utilisateurs ({shopUsers.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Utilisateur
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Rôle
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Dernière activité
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {shopUsers.map(user => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.display_name}
                              </div>
                              {user.email && (
                                <div className="text-xs text-gray-500">{user.email}</div>
                              )}
                              {user.phone && (
                                <div className="text-xs text-gray-500">{user.phone}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.role === 'OWNER'
                                  ? 'bg-purple-100 text-purple-800'
                                  : user.role === 'MANAGER'
                                    ? 'bg-blue-100 text-blue-800'
                                    : user.role === 'EMPLOYEE'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {user.last_activity ? formatDateTime(user.last_activity) : 'Jamais'}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleRevokeDevices(user.id, user.display_name)}
                              className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-medium rounded hover:bg-orange-200"
                            >
                              Déconnecter appareils
                            </button>
                            <button
                              onClick={() => handleRevokeUserAccess(user.id, user.display_name)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200"
                            >
                              <XCircleIcon className="w-4 h-4 mr-1" />
                              Révoquer accès
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && shopToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer la boutique <strong>"{shopToDelete.name}"</strong>{' '}
              ? Cette action est irréversible et supprimera toutes les données associées.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setShopToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteShop}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
