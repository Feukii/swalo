import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/api';

interface SystemStats {
  totalShops: number;
  totalUsers: number;
  activeShops: number;
  totalSales: number;
  totalProducts: number;
}

const quickActions = [
  {
    name: 'Entreprises',
    path: '/enterprises',
    icon: '🏛️',
    description: 'Gerer les entreprises et licences',
    color: 'from-purple-500 to-purple-700',
  },
  {
    name: 'Boutiques',
    path: '/shops',
    icon: '🏪',
    description: 'Creer et gerer les boutiques',
    color: 'from-blue-500 to-blue-700',
  },
  {
    name: 'Utilisateurs',
    path: '/users',
    icon: '👥',
    description: 'Voir tous les utilisateurs',
    color: 'from-green-500 to-green-700',
  },
  {
    name: "Logs d'audit",
    path: '/audit-logs',
    icon: '📝',
    description: 'Historique des actions',
    color: 'from-amber-500 to-amber-700',
  },
  {
    name: 'Configuration',
    path: '/config',
    icon: '⚙️',
    description: 'Parametres systeme',
    color: 'from-gray-500 to-gray-700',
  },
  {
    name: 'Statistiques',
    path: '/system',
    icon: '📈',
    description: 'Stats detaillees',
    color: 'from-cyan-500 to-cyan-700',
  },
];

export default function DashboardHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await adminApi.getSystemStats();
        setStats(data);
      } catch (err) {
        console.error('Erreur chargement stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-action-500 to-action-600 p-6 text-white shadow-card">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-action-50 mt-1">Vue d'ensemble de la plateforme Swalo</p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card">
            <p className="text-sm text-slate-500">Boutiques</p>
            <p className="text-3xl font-bold text-primary-900">{stats.totalShops}</p>
            <p className="text-xs text-success-600 mt-1">{stats.activeShops} actives</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Utilisateurs</p>
            <p className="text-3xl font-bold text-primary-900">{stats.totalUsers}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Produits</p>
            <p className="text-3xl font-bold text-primary-900">{stats.totalProducts}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Ventes totales</p>
            <p className="text-3xl font-bold text-primary-900">{stats.totalSales}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">Plateforme</p>
            <p className="text-lg font-bold text-success-600">En ligne</p>
            <p className="text-xs text-slate-500 mt-1">Tous les services actifs</p>
          </div>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-4">Acces rapide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="card-hover text-left group"
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform`}
                >
                  {action.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-primary-900 group-hover:text-action-600 transition-colors">
                    {action.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{action.description}</p>
                </div>
                <span className="text-slate-300 group-hover:text-action-500 transition-colors text-xl">
                  →
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
