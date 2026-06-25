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
  is_blocked?: boolean;
  blocked_reason?: string;
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

interface EnhancedStats {
  users: { total: number; active: number; blocked: number };
  shops: { total: number; blocked: number; active: number };
  enterprises: { total: number; blocked: number; active: number };
  connectedDevices: { last15min: number; last24h: number; last7d: number };
  licenses: { expired: number; expiringSoon: number };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    reason?: string;
    created_at: string;
    admin: { id: string; display_name: string };
  }>;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [blockModal, setBlockModal] = useState<{
    type: 'shop' | 'user';
    id: string;
    name: string;
  } | null>(null);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shopsData, statsData] = await Promise.all([
        adminApi.getAllShops(),
        adminApi.getEnhancedSystemStats().catch(() => null),
      ]);
      setShops(shopsData);
      if (statsData) setStats(statsData);
    } catch (error: any) {
      console.error('Erreur lors du chargement:', error);
      if (error.response?.status === 403) {
        alert('Acces refuse. Vous devez etre Super Admin.');
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!blockModal || !blockReason.trim()) return;
    try {
      if (blockModal.type === 'shop') {
        await adminApi.blockShop(blockModal.id, blockReason);
      } else {
        await adminApi.blockUser(blockModal.id, blockReason);
      }
      setBlockModal(null);
      setBlockReason('');
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors du blocage');
    }
  };

  const handleUnblock = async (type: 'shop' | 'user', id: string) => {
    if (!confirm('Confirmer le deblocage ?')) return;
    try {
      if (type === 'shop') {
        await adminApi.unblockShop(id);
      } else {
        await adminApi.unblockUser(id);
      }
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors du deblocage');
    }
  };

  const filteredShops = shops.filter(shop => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'blocked' && shop.is_blocked) ||
      (filter === 'active' && !shop.is_blocked);
    const matchesSearch =
      !searchTerm ||
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.code.includes(searchTerm) ||
      shop.owner.display_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const actionLabels: Record<string, string> = {
    BLOCK_SHOP: 'Blocage boutique',
    UNBLOCK_SHOP: 'Deblocage boutique',
    BLOCK_USER: 'Blocage utilisateur',
    UNBLOCK_USER: 'Deblocage utilisateur',
    BLOCK_ENTERPRISE: 'Blocage entreprise',
    UNBLOCK_ENTERPRISE: 'Deblocage entreprise',
    UPDATE_SHOP_MODULES: 'Modules mis a jour',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration Systeme</h1>
          <p className="text-gray-600 mt-1">Gestion des boutiques, utilisateurs et entreprises</p>
        </div>
        <button
          onClick={() => navigate('/audit-logs')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          Logs d'audit
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Utilisateurs</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.users.total}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-600">{stats.users.active} actifs</span>
              {stats.users.blocked > 0 && (
                <span className="text-xs text-red-600">{stats.users.blocked} bloques</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Boutiques</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.shops.total}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-600">{stats.shops.active} actives</span>
              {stats.shops.blocked > 0 && (
                <span className="text-xs text-red-600">{stats.shops.blocked} bloquees</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Entreprises</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.enterprises.total}</div>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-600">{stats.enterprises.active} actives</span>
              {stats.enterprises.blocked > 0 && (
                <span className="text-xs text-red-600">{stats.enterprises.blocked} bloquees</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Entites bloquees</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {stats.users.blocked + stats.shops.blocked + stats.enterprises.blocked}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Appareils connectes</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {stats.connectedDevices.last15min}{' '}
              <span className="text-sm font-medium text-green-600">en ligne</span>
            </div>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-gray-500">{stats.connectedDevices.last24h} / 24h</span>
              <span className="text-xs text-gray-500">{stats.connectedDevices.last7d} / 7j</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-500">Licences</div>
            <div
              className={`text-2xl font-bold mt-1 ${
                stats.licenses.expired > 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {stats.licenses.expired} expiree{stats.licenses.expired > 1 ? 's' : ''}
            </div>
            <div className="flex gap-2 mt-1">
              {stats.licenses.expiringSoon > 0 && (
                <span className="text-xs text-amber-600">
                  {stats.licenses.expiringSoon} bientot expiree
                  {stats.licenses.expiringSoon > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Audit Logs */}
      {stats?.recentAuditLogs && stats.recentAuditLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Actions recentes</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recentAuditLogs.map(log => (
              <div key={log.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-900">{log.admin.display_name}</span>
                  <span className="text-gray-500 ml-2">
                    {actionLabels[log.action] || log.action}
                  </span>
                  {log.reason && <span className="text-gray-400 ml-1">- {log.reason}</span>}
                </div>
                <span className="text-xs text-gray-400">{formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
        />
        {(['all', 'active', 'blocked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              filter === f
                ? 'bg-[#0F2A44] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Toutes' : f === 'active' ? 'Actives' : 'Bloquees'}
          </button>
        ))}
      </div>

      {/* Shops List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F2A44] mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Boutique
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Proprietaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredShops.map(shop => (
                <tr key={shop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                    <div className="text-xs text-gray-500">Code: {shop.code}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{shop.owner.display_name}</div>
                    <div className="text-xs text-gray-500">
                      {shop.owner.email || shop.owner.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {shop.is_blocked ? (
                      <div>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Bloquee
                        </span>
                        {shop.blocked_reason && (
                          <div className="text-xs text-gray-400 mt-1">{shop.blocked_reason}</div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {shop._count.user_roles}U / {shop._count.products}P / {shop._count.sales}V
                  </td>
                  <td className="px-6 py-4">
                    {shop.is_blocked ? (
                      <button
                        onClick={() => handleUnblock('shop', shop.id)}
                        className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      >
                        Debloquer
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setBlockModal({ type: 'shop', id: shop.id, name: shop.name })
                        }
                        className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                      >
                        Bloquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bloquer {blockModal.type === 'shop' ? 'la boutique' : "l'utilisateur"} "
              {blockModal.name}"
            </h3>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="Raison du blocage (obligatoire)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setBlockModal(null);
                  setBlockReason('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleBlock}
                disabled={!blockReason.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Confirmer le blocage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
