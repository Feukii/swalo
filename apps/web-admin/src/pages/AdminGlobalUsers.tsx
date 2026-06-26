import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Utilisateurs — Comptes & rôles plateforme
// Liste globale des utilisateurs (adminApi.getGlobalUsers) avec rôle, périmètre
// (boutiques), statut. KPIs et matrice de répartition calculés depuis les
// données réelles renvoyées par l'API.
//
// Écarts assumés (API ne renvoie pas ces champs) :
//   - « Entreprise » : l'endpoint /admin/users/global ne rattache pas chaque
//     boutique à son entreprise → la matrice est groupée par BOUTIQUE (donnée
//     réellement disponible) et la colonne entreprise affiche « — ».
//   - « Dernière connexion » : non exposée → « — ».
//   - Ajout d'un utilisateur à une entreprise : non exposé par l'API → bouton
//     « Inviter » marqué « À venir ».
// ---------------------------------------------------------------------------

interface GlobalUserRole {
  role: string;
  shop: { id: string; name: string; code: string };
}

interface GlobalUser {
  id: string;
  display_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  is_blocked: boolean;
  blocked_reason?: string;
  created_at: string;
  user_roles: GlobalUserRole[];
}

interface UsersResponse {
  data: GlobalUser[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const ROLES = ['SUPERADMIN', 'BOSS', 'MANAGER', 'EMPLOYEE'] as const;
type RoleName = (typeof ROLES)[number];

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-action-100 text-action-700',
  BOSS: 'bg-primary-100 text-primary-700',
  MANAGER: 'bg-success-100 text-success-700',
  EMPLOYEE: 'bg-slate-100 text-slate-600',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Périmètre d'un utilisateur depuis ses rôles/boutiques (donnée réelle). */
function userScope(user: GlobalUser): string {
  const shops = Array.from(new Set(user.user_roles.map(r => r.shop?.name).filter(Boolean)));
  if (shops.length === 0) return '—';
  if (shops.length === 1) return shops[0];
  return 'Toutes boutiques';
}

/** Rôle principal : on prend le plus élevé dans la hiérarchie. */
function primaryRole(user: GlobalUser): string | null {
  const order: Record<string, number> = { SUPERADMIN: 3, BOSS: 2, MANAGER: 1, EMPLOYEE: 0 };
  let best: string | null = null;
  for (const ur of user.user_roles) {
    if (best === null || (order[ur.role] ?? -1) > (order[best] ?? -1)) best = ur.role;
  }
  return best;
}

function resolveError(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { message?: unknown } } }).response?.data?.message ===
      'string'
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return fallback;
}

export default function AdminGlobalUsers() {
  // Liste paginée (tableau « Tous les utilisateurs »).
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, total_pages: 0 });

  // Échantillon large pour KPIs + matrice (toutes boutiques confondues).
  const [allUsers, setAllUsers] = useState<GlobalUser[]>([]);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteHint, setInviteHint] = useState(false);

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
      const params: { page: number; limit: number; search?: string; role?: string } = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter) params.role = roleFilter;

      const response = (await adminApi.getGlobalUsers(params)) as UsersResponse;
      setUsers(response.data);
      setPagination({
        total: response.total,
        limit: response.limit,
        total_pages: response.total_pages,
      });
    } catch (err) {
      setError(resolveError(err, 'Erreur lors du chargement des utilisateurs'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Charge un large échantillon une fois pour les KPIs / la matrice.
  useEffect(() => {
    let cancelled = false;
    const loadAggregate = async () => {
      try {
        const response = (await adminApi.getGlobalUsers({ page: 1, limit: 500 })) as UsersResponse;
        if (cancelled) return;
        setAllUsers(response.data);
        setTotalUsers(response.total);
      } catch {
        // KPIs dégradent en silence si l'agrégat échoue.
      }
    };
    void loadAggregate();
    return () => {
      cancelled = true;
    };
  }, []);

  // KPIs par rôle (depuis l'échantillon agrégé).
  const roleCounts = useMemo(() => {
    const counts: Record<RoleName, number> = { SUPERADMIN: 0, BOSS: 0, MANAGER: 0, EMPLOYEE: 0 };
    for (const u of allUsers) {
      const pr = primaryRole(u);
      if (pr && pr in counts) counts[pr as RoleName] += 1;
    }
    return counts;
  }, [allUsers]);

  // Matrice par BOUTIQUE & rôle (entreprise non exposée par l'API).
  const shopMatrix = useMemo(() => {
    const map = new Map<
      string,
      { name: string; BOSS: number; MANAGER: number; EMPLOYEE: number; total: number }
    >();
    for (const u of allUsers) {
      for (const ur of u.user_roles) {
        if (!ur.shop) continue;
        const entry = map.get(ur.shop.id) ?? {
          name: ur.shop.name,
          BOSS: 0,
          MANAGER: 0,
          EMPLOYEE: 0,
          total: 0,
        };
        if (ur.role === 'BOSS') entry.BOSS += 1;
        else if (ur.role === 'MANAGER') entry.MANAGER += 1;
        else if (ur.role === 'EMPLOYEE') entry.EMPLOYEE += 1;
        entry.total += 1;
        map.set(ur.shop.id, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [allUsers]);

  const handleBlockUser = async (userId: string) => {
    if (!blockReason.trim()) {
      setError('Veuillez saisir une raison pour le blocage');
      return;
    }
    try {
      setActionLoading(userId);
      await adminApi.blockUser(userId, blockReason);
      setBlockingUserId(null);
      setBlockReason('');
      await fetchUsers();
    } catch (err) {
      setError(resolveError(err, 'Erreur lors du blocage'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      await adminApi.unblockUser(userId);
      await fetchUsers();
    } catch (err) {
      setError(resolveError(err, 'Erreur lors du déblocage'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Utilisateurs</h1>
        <p className="text-sm text-slate-500 mt-0.5">Comptes &amp; rôles plateforme</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          value={totalUsers !== null ? totalUsers.toLocaleString('fr-FR') : '—'}
          label="Utilisateurs"
        />
        <KpiCard value={String(roleCounts.BOSS)} label="Propriétaires" />
        <KpiCard value={String(roleCounts.MANAGER)} label="Managers" />
        <KpiCard value={String(roleCounts.EMPLOYEE)} label="Employés" />
      </div>

      {/* Matrice par boutique & rôle */}
      <div className="rounded-2xl bg-white shadow-card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-primary-900">
            Utilisateurs par boutique &amp; rôle
          </h2>
        </div>
        {shopMatrix.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune donnée disponible</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Boutique</th>
                  <th className="px-6 py-3 text-right">Propriétaire</th>
                  <th className="px-6 py-3 text-right">Manager</th>
                  <th className="px-6 py-3 text-right">Employé</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shopMatrix.map(row => (
                  <tr key={row.name} className="text-sm">
                    <td className="px-6 py-3 font-medium text-primary-900">{row.name}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{row.BOSS}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{row.MANAGER}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{row.EMPLOYEE}</td>
                    <td className="px-6 py-3 text-right font-semibold text-primary-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tous les utilisateurs */}
      <div className="rounded-2xl bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-primary-900">Tous les utilisateurs</h2>
          <div className="relative">
            <button
              onClick={() => setInviteHint(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-action-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-600"
            >
              <span className="text-base leading-none">+</span>
              Inviter
            </button>
            {inviteHint && (
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-elevated">
                <p className="font-semibold text-primary-900">À venir</p>
                <p className="mt-1">
                  L&apos;ajout d&apos;un utilisateur à une entreprise n&apos;est pas encore exposé
                  par l&apos;API. Cette action sera disponible prochainement.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-6 py-4 md:grid-cols-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher (nom, email, téléphone)…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-action-500 focus:ring-2 focus:ring-action-500"
          />
          <select
            value={roleFilter}
            onChange={e => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-action-500 focus:ring-2 focus:ring-action-500"
          >
            <option value="">Tous les rôles</option>
            {ROLES.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3">Utilisateur</th>
                  <th className="px-6 py-3">Rôle</th>
                  <th className="px-6 py-3">Entreprise</th>
                  <th className="px-6 py-3">Périmètre</th>
                  <th className="px-6 py-3">Connexion</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  users.map(user => {
                    const pr = primaryRole(user);
                    return (
                      <tr
                        key={user.id}
                        className={user.is_blocked ? 'bg-danger-50/40 text-sm' : 'text-sm'}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {initials(user.display_name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-primary-900">
                                {user.display_name}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {user.email || user.phone || '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          {pr ? (
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                                ROLE_BADGE[pr] ?? ROLE_BADGE.EMPLOYEE
                              }`}
                            >
                              {pr}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-400">—</td>
                        <td className="px-6 py-3 text-slate-600">{userScope(user)}</td>
                        <td className="px-6 py-3 text-slate-400">—</td>
                        <td className="px-6 py-3">
                          {user.is_blocked ? (
                            <span className="inline-flex rounded-full bg-danger-100 px-2.5 py-0.5 text-xs font-medium text-danger-800">
                              Suspendu
                            </span>
                          ) : user.is_active ? (
                            <span className="inline-flex rounded-full bg-success-100 px-2.5 py-0.5 text-xs font-medium text-success-800">
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                              Inactif
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {blockingUserId === user.id ? (
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="text"
                                value={blockReason}
                                onChange={e => setBlockReason(e.target.value)}
                                placeholder="Raison…"
                                className="w-40 rounded border border-slate-300 px-2 py-1 text-xs"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleBlockUser(user.id)}
                                  disabled={actionLoading === user.id}
                                  className="rounded bg-danger-600 px-2 py-1 text-xs text-white hover:bg-danger-700 disabled:opacity-50"
                                >
                                  Confirmer
                                </button>
                                <button
                                  onClick={() => {
                                    setBlockingUserId(null);
                                    setBlockReason('');
                                  }}
                                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : user.is_blocked ? (
                            <button
                              onClick={() => handleUnblockUser(user.id)}
                              disabled={actionLoading === user.id}
                              className="text-xs font-medium text-success-700 hover:text-success-800 disabled:opacity-50"
                            >
                              {actionLoading === user.id ? '…' : 'Réactiver'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setBlockingUserId(user.id)}
                              disabled={actionLoading === user.id}
                              className="text-xs font-medium text-danger-600 hover:text-danger-700 disabled:opacity-50"
                            >
                              Suspendre
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-sm text-slate-500">
              Page <span className="font-medium text-primary-900">{page}</span> /{' '}
              {pagination.total_pages} · {pagination.total} utilisateur(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page === pagination.total_pages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-4 shadow-card">
      <p className="text-2xl font-bold leading-tight text-primary-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
