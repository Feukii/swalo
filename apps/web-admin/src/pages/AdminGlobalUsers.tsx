import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../lib/api';

interface GlobalUser {
  id: string;
  display_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason?: string;
  created_at: string;
  user_roles: Array<{
    role: string;
    shop: { id: string; name: string; code: string };
  }>;
}

interface UsersResponse {
  data: GlobalUser[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const ROLES = ['SUPERADMIN', 'BOSS', 'MANAGER', 'EMPLOYEE'];

const ROLE_COLORS = {
  SUPERADMIN: 'bg-purple-100 text-purple-800 border-purple-300',
  BOSS: 'bg-blue-100 text-blue-800 border-blue-300',
  MANAGER: 'bg-green-100 text-green-800 border-green-300',
  EMPLOYEE: 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function AdminGlobalUsers() {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    total_pages: 0,
  });

  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.role = roleFilter;

      const response: UsersResponse = await adminApi.getGlobalUsers(params);
      setUsers(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        total_pages: response.total_pages,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBlockUser = async (userId: string) => {
    if (!blockReason.trim()) {
      alert('Veuillez saisir une raison pour le blocage');
      return;
    }
    try {
      setActionLoading(userId);
      await adminApi.blockUser(userId, blockReason);
      setBlockingUserId(null);
      setBlockReason('');
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors du blocage');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    if (!confirm('Confirmer le déblocage de cet utilisateur ?')) return;
    try {
      setActionLoading(userId);
      await adminApi.unblockUser(userId);
      await fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors du déblocage');
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadgeColor = (role: string): string => {
    return ROLE_COLORS[role as keyof typeof ROLE_COLORS] || ROLE_COLORS.EMPLOYEE;
  };

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-900">👥 Gestion Globale des Utilisateurs</h1>
          <p className="text-slate-600 mt-2">
            Vue d'ensemble de tous les utilisateurs sur toutes les boutiques
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">🔍 Rechercher</label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Nom, email ou téléphone..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                🎭 Filtrer par rôle
              </label>
              <select
                value={roleFilter}
                onChange={e => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
              >
                <option value="">Tous les rôles</option>
                {ROLES.map(role => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-card p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-action-500"></div>
            <p className="mt-4 text-slate-600">Chargement des utilisateurs...</p>
          </div>
        ) : (
          <>
            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Rôles & Boutiques
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Date création
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          😔 Aucun utilisateur trouvé
                        </td>
                      </tr>
                    ) : (
                      users.map(user => (
                        <tr key={user.id} className={user.is_blocked ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-primary-900">
                                  {user.display_name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  ID: {user.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-primary-900">
                              {user.email && (
                                <div className="flex items-center">📧 {user.email}</div>
                              )}
                              {user.phone && (
                                <div className="flex items-center mt-1">📱 {user.phone}</div>
                              )}
                              {!user.email && !user.phone && (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {user.user_roles.length === 0 ? (
                                <span className="text-sm text-slate-400">Aucun rôle</span>
                              ) : (
                                user.user_roles.map((ur, idx) => (
                                  <div
                                    key={idx}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                                      ur.role
                                    )}`}
                                  >
                                    {ur.role} @ {ur.shop.name}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {user.is_active ? '✅ Actif' : '❌ Inactif'}
                              </span>
                              {user.is_blocked && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  🚫 Bloqué
                                </span>
                              )}
                            </div>
                            {user.is_blocked && user.blocked_reason && (
                              <div className="text-xs text-red-600 mt-1">
                                Raison: {user.blocked_reason}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {new Date(user.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {blockingUserId === user.id ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={blockReason}
                                  onChange={e => setBlockReason(e.target.value)}
                                  placeholder="Raison du blocage..."
                                  className="px-2 py-1 text-xs border border-slate-300 rounded"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleBlockUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Confirmer
                                  </button>
                                  <button
                                    onClick={() => {
                                      setBlockingUserId(null);
                                      setBlockReason('');
                                    }}
                                    className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded hover:bg-slate-200"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : user.is_blocked ? (
                              <button
                                onClick={() => handleUnblockUser(user.id)}
                                disabled={actionLoading === user.id}
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                              >
                                {actionLoading === user.id ? '...' : '🔓 Débloquer'}
                              </button>
                            ) : (
                              <button
                                onClick={() => setBlockingUserId(user.id)}
                                disabled={actionLoading === user.id}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                🚫 Bloquer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="bg-white rounded-2xl shadow-card mt-6 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-700">
                    Page <span className="font-medium">{page}</span> sur{' '}
                    <span className="font-medium">{pagination.total_pages}</span> •{' '}
                    <span className="font-medium">{pagination.total}</span> utilisateur(s) au total
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Précédent
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                      disabled={page === pagination.total_pages}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Suivant →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
