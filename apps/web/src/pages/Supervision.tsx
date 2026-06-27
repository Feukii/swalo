import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../store/authStore';
import { supervisionApi } from '../lib/api';
import type { SupervisionReport, SupervisionAlert } from '../lib/api';

function formatTime(dateString?: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Icône emoji selon le type d'alerte. */
function iconForKind(kind: string): string {
  switch (kind) {
    case 'discount':
      return '🏷️';
    case 'cash_out':
      return '💸';
    case 'cancel':
      return '🚫';
    case 'price':
      return '💰';
    case 'stock':
      return '📦';
    case 'refund':
      return '↩️';
    default:
      return '⚠️';
  }
}

export default function Supervision() {
  const navigate = useNavigate();
  const { can, isPermissive } = usePermissions();
  const canView = isPermissive || can('reports', 'view');
  const role = useAuthStore(s => s.role);
  const isBoss = role === 'BOSS' || role === 'SUPERADMIN';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SupervisionReport | null>(null);
  const [acking, setAcking] = useState<string | null>(null);

  const handleAcknowledge = useCallback(async (alert: SupervisionAlert) => {
    setAcking(alert.id);
    try {
      await supervisionApi.acknowledgeAlert(alert.id);
      setReport(prev =>
        prev ? { ...prev, alerts: prev.alerts.filter(a => a.id !== alert.id) } : prev
      );
    } catch {
      // garde l'alerte si l'acquittement échoue
    } finally {
      setAcking(null);
    }
  }, []);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supervisionApi.getReport();
      setReport(data);
    } catch {
      setError('Impossible de charger la supervision. Veuillez réessayer.');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) {
      navigate('/');
      return;
    }
    loadReport();
  }, [canView, navigate, loadReport]);

  if (!canView) {
    return null;
  }

  const alerts: SupervisionAlert[] = report?.alerts ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Supervision</h1>
        <p className="text-sm text-slate-500 mt-1">Actions anormales du jour</p>
      </div>

      {/* Bannière bordeaux */}
      <div className="rounded-2xl bg-[#5B1A1A] px-6 py-5 text-white shadow-card">
        <p className="text-lg font-bold">Tableau de supervision</p>
        <p className="text-sm text-white/70 mt-0.5 capitalize">{formatLongDate(new Date())}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <div className="inline-block w-12 h-12 spinner" />
        </div>
      ) : error ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger-50 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-slate-600 mb-4">{error}</p>
          <button type="button" className="btn-primary" onClick={loadReport}>
            Réessayer
          </button>
        </div>
      ) : !report ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <span className="text-3xl">🛡️</span>
          </div>
          <p className="text-slate-500">Aucune donnée de supervision à afficher</p>
        </div>
      ) : (
        <>
          {/* Cartes statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-medium text-slate-500">Critiques</p>
              <p className="text-3xl font-bold text-danger-600 mt-2">{report.critical_count}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-medium text-slate-500">À vérifier</p>
              <p className="text-3xl font-bold text-warning-600 mt-2">{report.review_count}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-card p-5">
              <p className="text-xs font-medium text-slate-500">Total du jour</p>
              <p className="text-3xl font-bold text-primary-900 mt-2">{report.total}</p>
            </div>
          </div>

          {/* Journal des alertes */}
          <div className="card">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Journal des alertes
            </h2>

            {alerts.length === 0 ? (
              <p className="text-center text-slate-400 py-10">Aucune alerte aujourd&apos;hui</p>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => {
                  const critical = alert.severity === 'critical';
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 p-4"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-lg shrink-0">
                        {iconForKind(alert.kind)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-primary-900">{alert.title}</p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              critical
                                ? 'bg-danger-50 text-danger-700'
                                : 'bg-warning-50 text-warning-700'
                            }`}
                          >
                            {critical ? 'Critique' : 'À vérifier'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">{alert.detail}</p>
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <p className="text-xs text-slate-400">
                            {alert.author ? `${alert.author} · ` : ''}
                            {formatTime(alert.created_at)}
                          </p>
                          {isBoss && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alert)}
                              disabled={acking === alert.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 hover:bg-success-100 disabled:opacity-50"
                            >
                              {acking === alert.id ? '…' : '✓ Acquitter'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
