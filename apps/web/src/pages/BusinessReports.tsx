import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { reportsApi } from '../lib/api';
import type { NetworkReport, NetworkShopReport, ShopHealth } from '../lib/api';

/**
 * Formate un montant en centimes au format "réseau" de la maquette :
 * - >= 1 000 000 F  ->  "5,87 M F"
 * - >= 1 000 F      ->  "12,5 k F"
 * - sinon           ->  "1 500 F"
 * Les montants reçus de l'API sont en FCFA (affichés tels quels).
 */
function formatNetworkAmount(value: number): string {
  const amount = value;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000) {
    const value = abs / 1_000_000;
    return `${sign}${value.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} M F`;
  }

  if (abs >= 10_000) {
    const value = abs / 1_000;
    return `${sign}${value.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} k F`;
  }

  return `${sign}${Math.round(abs).toLocaleString('fr-FR')} F`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })} %`;
}

interface HealthBadge {
  label: string;
  className: string;
}

function getHealthBadge(etat: ShopHealth): HealthBadge {
  switch (etat) {
    case 'Sain':
      return { label: 'Sain', className: 'bg-success-100 text-success-700' };
    case 'A surveiller':
      return { label: 'À surveiller', className: 'bg-warning-100 text-warning-700' };
    case 'En difficulte':
      return { label: 'En difficulté', className: 'bg-danger-100 text-danger-700' };
    default:
      return { label: etat, className: 'bg-slate-100 text-slate-600' };
  }
}

export default function BusinessReports() {
  const navigate = useNavigate();
  const { enterprise } = useAuthStore();
  const { can, isPermissive } = usePermissions();
  const canView = isPermissive || can('reports', 'view');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<NetworkReport | null>(null);

  const loadNetwork = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportsApi.getNetwork();
      setReport(data);
    } catch {
      setError('Impossible de charger le rapport réseau. Veuillez réessayer.');
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
    loadNetwork();
  }, [canView, navigate, loadNetwork]);

  if (!canView) {
    return null;
  }

  const shops: NetworkShopReport[] = report?.shops ?? [];
  const totals = report?.totals ?? null;
  const maxCa = shops.reduce((max, shop) => Math.max(max, shop.ca_jour), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Rapports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Vue réseau{enterprise?.name ? ` · ${enterprise.name}` : ''} · {shops.length} boutique
            {shops.length > 1 ? 's' : ''}
          </p>
        </div>
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
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-marine-900 text-white font-semibold text-sm hover:bg-marine-800 transition-colors"
            onClick={loadNetwork}
          >
            Réessayer
          </button>
        </div>
      ) : !report || shops.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <span className="text-3xl">🏬</span>
          </div>
          <p className="text-slate-500">Aucune boutique à afficher sur le réseau</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cartes KPI réseau */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                CA réseau (jour)
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatNetworkAmount(totals?.ca_reseau ?? 0)}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Marge moyenne
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatPercent(totals?.marge_moyenne ?? 0)}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Trésorerie réseau
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatNetworkAmount(totals?.tresorerie_reseau ?? 0)}
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Créances réseau
              </p>
              <p className="text-2xl font-bold text-marine-900 mt-2">
                {formatNetworkAmount(totals?.creances_reseau ?? 0)}
              </p>
            </div>
          </div>

          {/* Performance par boutique + CA par boutique */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Tableau performance par boutique */}
            <div className="card xl:col-span-2">
              <h2 className="text-lg font-bold text-marine-900 mb-5">Performance par boutique</h2>

              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Boutique
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        CA du jour
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Marge
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Caisse
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Créances
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                        État
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shops.map(shop => {
                      const badge = getHealthBadge(shop.etat);
                      return (
                        <tr key={shop.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-marine-900">{shop.name}</td>
                          <td className="px-6 py-4 text-right font-semibold text-marine-900">
                            {formatNetworkAmount(shop.ca_jour)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">
                            {formatPercent(shop.marge)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">
                            {formatNetworkAmount(shop.caisse)}
                          </td>
                          <td className="px-6 py-4 text-right text-danger-600 font-medium">
                            {formatNetworkAmount(shop.creances)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`badge ${badge.className}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Graphe CA par boutique — barres verticales CSS */}
            <div className="card">
              <h2 className="text-lg font-bold text-marine-900">CA par boutique</h2>
              <p className="text-xs text-slate-400 mb-5">Aujourd'hui</p>

              <div className="flex items-end justify-between gap-2 h-48">
                {shops.map(shop => {
                  const heightPct = maxCa > 0 ? Math.max((shop.ca_jour / maxCa) * 100, 4) : 4;
                  return (
                    <div
                      key={shop.id}
                      className="flex flex-col items-center justify-end flex-1 h-full min-w-0"
                      title={`${shop.name} · ${formatNetworkAmount(shop.ca_jour)}`}
                    >
                      <div className="w-full flex items-end justify-center h-full">
                        <div
                          className="w-full max-w-[2.5rem] rounded-t-lg bg-sky-500 transition-all duration-500"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="mt-2 text-[10px] text-slate-500 truncate w-full text-center">
                        {shop.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
