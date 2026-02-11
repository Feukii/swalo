import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: any;
  new_value: any;
  reason?: string;
  ip_address?: string;
  created_at: string;
  admin: {
    id: string;
    display_name: string;
    email?: string;
  };
}

interface PaginatedResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, string> = {
  BLOCK_SHOP: 'Blocage boutique',
  UNBLOCK_SHOP: 'Deblocage boutique',
  BLOCK_USER: 'Blocage utilisateur',
  UNBLOCK_USER: 'Deblocage utilisateur',
  BLOCK_ENTERPRISE: 'Blocage entreprise',
  UNBLOCK_ENTERPRISE: 'Deblocage entreprise',
  UPDATE_SHOP_MODULES: 'Modules mis a jour',
};

const ENTITY_LABELS: Record<string, string> = {
  SHOP: 'Boutique',
  USER: 'Utilisateur',
  ENTERPRISE: 'Entreprise',
};

export default function AuditLogs() {
  const navigate = useNavigate();
  const [response, setResponse] = useState<PaginatedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [page, filterAction, filterEntityType]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getAuditLogs({
        page,
        limit: 20,
        action: filterAction || undefined,
        entity_type: filterEntityType || undefined,
      });
      setResponse(data);
    } catch (error: any) {
      console.error('Erreur:', error);
      if (error.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs d'audit</h1>
          <p className="text-gray-600 mt-1">Historique de toutes les actions administratives</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
        >
          Retour au dashboard
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={filterAction}
          onChange={e => {
            setFilterAction(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filterEntityType}
          onChange={e => {
            setFilterEntityType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Tous les types</option>
          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        {response && (
          <span className="text-sm text-gray-500 self-center ml-auto">
            {response.total} resultats
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F2A44] mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Admin
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entite
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Raison
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {response?.data.map(log => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{log.admin.display_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          log.action.startsWith('BLOCK')
                            ? 'bg-red-100 text-red-800'
                            : log.action.startsWith('UNBLOCK')
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                      <span className="text-xs text-gray-400 ml-1">
                        ({log.entity_id.slice(0, 8)}...)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{log.reason || '-'}</td>
                    <td className="px-4 py-3">
                      {(log.old_value || log.new_value) && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {expandedId === log.id ? 'Masquer' : 'Voir'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-details`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {log.old_value && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Avant</div>
                              <pre className="bg-white p-2 rounded border text-gray-600 overflow-auto max-h-32">
                                {JSON.stringify(log.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <div className="font-semibold text-gray-700 mb-1">Apres</div>
                              <pre className="bg-white p-2 rounded border text-gray-600 overflow-auto max-h-32">
                                {JSON.stringify(log.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {response?.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Aucun log d'audit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {response && response.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Precedent
          </button>
          <span className="text-sm text-gray-600">
            Page {response.page} / {response.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(response.totalPages, p + 1))}
            disabled={page === response.totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
