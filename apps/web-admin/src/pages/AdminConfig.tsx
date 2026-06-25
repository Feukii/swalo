import { useState, useEffect } from 'react';
import { adminApi } from '../lib/api';

interface SystemConfig {
  key: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface AuditLogFilters {
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
}

export default function AdminConfig() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Add/Edit form state
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Audit log filters
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getSystemConfigs();
      setConfigs(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormKey('');
    setFormValue('');
    setFormDescription('');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleEdit = (config: SystemConfig) => {
    setFormKey(config.key);
    setFormValue(config.value);
    setFormDescription(config.description || '');
    setFormError(null);
    setEditingKey(config.key);
  };

  const handleSave = async () => {
    if (!formKey.trim()) {
      setFormError('La clé est requise');
      return;
    }
    if (!formValue.trim()) {
      setFormError('La valeur est requise');
      return;
    }

    try {
      setFormError(null);
      await adminApi.setSystemConfig(formKey, {
        value: formValue,
        description: formDescription || undefined,
      });
      await loadConfigs();
      setShowAddModal(false);
      setEditingKey(null);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await adminApi.deleteSystemConfig(key);
      await loadConfigs();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      setExporting(true);
      const csvData = await adminApi.exportAuditLogs(auditFilters);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de l'export des logs");
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">⏳ Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-8">⚙️ Configuration Système</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          ❌ {error}
        </div>
      )}

      {/* Configuration Section */}
      <section className="bg-white rounded-2xl shadow-card p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary-900">📋 Paramètres de Configuration</h2>
          <button
            onClick={handleAdd}
            className="bg-action-500 hover:bg-action-600 text-white px-4 py-2 rounded-lg transition"
          >
            ➕ Ajouter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3 font-semibold text-slate-700">Clé</th>
                <th className="text-left p-3 font-semibold text-slate-700">Valeur</th>
                <th className="text-left p-3 font-semibold text-slate-700">Description</th>
                <th className="text-left p-3 font-semibold text-slate-700">Dernière mise à jour</th>
                <th className="text-right p-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-slate-500">
                    Aucune configuration définie
                  </td>
                </tr>
              ) : (
                configs.map(config => (
                  <tr key={config.key} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-3 font-mono text-sm">{config.key}</td>
                    <td className="p-3 text-sm">{config.value}</td>
                    <td className="p-3 text-sm text-slate-600">{config.description || '-'}</td>
                    <td className="p-3 text-sm text-slate-500">{formatDate(config.updated_at)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleEdit(config)}
                        className="text-action-600 hover:text-action-700 mr-3"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(config.key)}
                        className="text-red-600 hover:text-red-800"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Audit Log Export Section */}
      <section className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-xl font-semibold text-primary-900 mb-4">📊 Export Logs d'Audit</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <input
              type="text"
              value={auditFilters.action || ''}
              onChange={e => setAuditFilters({ ...auditFilters, action: e.target.value })}
              placeholder="CREATE, UPDATE, DELETE..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type d'entité</label>
            <input
              type="text"
              value={auditFilters.entity_type || ''}
              onChange={e => setAuditFilters({ ...auditFilters, entity_type: e.target.value })}
              placeholder="Customer, Sale, Product..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date début</label>
            <input
              type="date"
              value={auditFilters.start_date || ''}
              onChange={e => setAuditFilters({ ...auditFilters, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date fin</label>
            <input
              type="date"
              value={auditFilters.end_date || ''}
              onChange={e => setAuditFilters({ ...auditFilters, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleExportAuditLogs}
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? '⏳ Export en cours...' : '📥 Télécharger CSV'}
          </button>
        </div>
      </section>

      {/* Add/Edit Modal */}
      {(showAddModal || editingKey) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-elevated p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-primary-900 mb-4">
              {showAddModal ? '➕ Ajouter une configuration' : '✏️ Modifier la configuration'}
            </h3>

            {formError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Clé <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formKey}
                  onChange={e => setFormKey(e.target.value)}
                  disabled={!!editingKey}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent font-mono disabled:bg-slate-100"
                  placeholder="ex: max_upload_size"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Valeur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
                  placeholder="ex: 10485760"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-transparent"
                  rows={3}
                  placeholder="Description optionnelle..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingKey(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-action-500 text-white rounded-lg hover:bg-action-600 transition"
              >
                💾 Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-elevated p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-primary-900 mb-4">⚠️ Confirmer la suppression</h3>
            <p className="mb-6">
              Êtes-vous sûr de vouloir supprimer la configuration{' '}
              <span className="font-mono font-bold">{deleteConfirm}</span> ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                🗑️ Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
