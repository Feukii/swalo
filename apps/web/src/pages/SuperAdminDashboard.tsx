import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

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

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Super Admin</h1>
        <p className="text-gray-600 mt-1">Vue d'ensemble du système</p>
      </div>

      {/* System Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="text-sm opacity-90">Boutiques</div>
            <div className="text-3xl font-bold mt-1">{stats.totalShops}</div>
          </div>
          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="text-sm opacity-90">Utilisateurs</div>
            <div className="text-3xl font-bold mt-1">{stats.totalUsers}</div>
          </div>
          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="text-sm opacity-90">Ventes totales</div>
            <div className="text-3xl font-bold mt-1">{stats.totalSales}</div>
          </div>
          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="text-sm opacity-90">Produits</div>
            <div className="text-3xl font-bold mt-1">{stats.totalProducts}</div>
          </div>
          <div className="card bg-gradient-to-br from-pink-500 to-pink-600 text-white">
            <div className="text-sm opacity-90">Actives</div>
            <div className="text-3xl font-bold mt-1">{stats.activeShops}</div>
          </div>
        </div>
      )}

      {/* Shops List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Toutes les boutiques</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Boutique
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Propriétaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Utilisateurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Produits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ventes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Clients/Fournisseurs
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
                      {shop.phone && <div className="text-xs text-gray-400">{shop.phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm text-gray-900">{shop.owner.display_name}</div>
                      {shop.owner.email && (
                        <div className="text-xs text-gray-500">{shop.owner.email}</div>
                      )}
                      {shop.owner.phone && (
                        <div className="text-xs text-gray-500">{shop.owner.phone}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{shop._count.user_roles}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{shop._count.products}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{shop._count.sales}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {shop._count.customers} / {shop._count.suppliers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
