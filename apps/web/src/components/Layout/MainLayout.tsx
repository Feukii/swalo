import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useModules } from '../../hooks/useModules';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  badge?: number;
  module?: string;
  disabled?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

type Period = 'day' | '7d' | '30d' | 'month';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: '7d', label: '7j' },
  { id: '30d', label: '30j' },
  { id: 'month', label: 'Mois' },
];

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, shop, enterprise, role, logout } = useAuthStore();
  const { isModuleEnabled, licenseTier } = useModules();
  const [period, setPeriod] = useState<Period>('7d');
  const [search, setSearch] = useState('');

  const navSections: NavSection[] = [
    {
      label: 'Ventes',
      items: [
        { name: 'Point de vente', path: '/sale', icon: '🛒', module: 'sales' },
        { name: 'Caisse', path: '/cash', icon: '💰', module: 'cash' },
        { name: 'Factures', path: '/invoices', icon: '🧾', module: 'sales' },
        { name: 'Historique', path: '/sales', icon: '🕘', module: 'sales' },
      ],
    },
    {
      label: 'Stock',
      items: [
        { name: 'Produits', path: '/products', icon: '📦', module: 'products' },
        { name: 'Inventaire', path: '/stock', icon: '📋', module: 'inventory' },
        { name: 'Transferts', path: '/transfers', icon: '🔁', module: 'inventory' },
      ],
    },
    {
      label: 'Relations',
      items: [
        { name: 'Clients', path: '/customers', icon: '👥', module: 'customers' },
        { name: 'Créances', path: '/receivables', icon: '💳', module: 'receivables' },
        { name: 'Relances', path: '/relances', icon: '⏰', module: 'customers' },
        { name: 'Fournisseurs', path: '/suppliers', icon: '🏪', module: 'suppliers' },
        { name: 'Dettes', path: '/debts', icon: '💸', module: 'debts' },
      ],
    },
    {
      label: 'Pilotage',
      items: [
        { name: 'Rapports', path: '/reports', icon: '📈', module: 'reports' },
        { name: 'Comptabilité', path: '#', icon: '🧮', disabled: true },
        { name: 'Bilans boutiques', path: '#', icon: '🏬', disabled: true },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const tierLabel = licenseTier || 'STARTER';

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar marine */}
      <aside className="w-[230px] shrink-0 bg-primary-900 flex flex-col">
        {/* En-tête logo */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500 flex items-center justify-center shadow-card">
              <span className="text-white font-extrabold text-lg leading-none">S</span>
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-base leading-tight">Swalo</p>
              <p className="text-primary-300 text-xs truncate">
                {enterprise?.name || shop?.name || 'Boutique'}
              </p>
            </div>
          </div>

          {/* Pastille plan */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-800 px-3 py-1 text-xs font-medium text-sky-300">
            <span className="font-semibold">Plan {tierLabel}</span>
          </div>
        </div>

        {/* Navigation sectionnée */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {navSections.map(section => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const moduleEnabled = !item.module || isModuleEnabled(item.module);
                  const usable = moduleEnabled && !item.disabled;
                  const active = !item.disabled && isActive(item.path);

                  if (!usable) {
                    const title = item.disabled
                      ? 'Bientôt disponible'
                      : `Module non inclus dans votre licence ${tierLabel}`;
                    return (
                      <div
                        key={item.name}
                        title={title}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-400 opacity-50 cursor-not-allowed"
                      >
                        <span className="text-base w-5 text-center">{item.icon}</span>
                        <span className="flex-1 truncate">{item.name}</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-action-500 text-white font-medium shadow-card'
                          : 'text-primary-100 hover:bg-primary-800'
                      }`}
                    >
                      <span className="text-base w-5 text-center">{item.icon}</span>
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge ? (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-danger-500 text-white text-[11px] font-semibold">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer utilisateur */}
        <div className="border-t border-primary-800 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-action-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user?.display_name || 'Utilisateur'}
              </p>
              <p className="text-primary-300 text-xs truncate">{role || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-2 rounded-lg text-primary-300 hover:bg-primary-800 hover:text-white transition-colors"
            >
              <span className="text-base">🚪</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-10 bg-surface border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Chips période */}
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {PERIODS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    period === p.id
                      ? 'bg-primary-900 text-white shadow-card'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Recherche */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  🔍
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-action-400 focus:ring-2 focus:ring-action-100 focus:bg-surface transition-colors"
                />
              </div>
            </div>

            {/* Statut synchro */}
            <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success-700">
              <span className="w-2 h-2 rounded-full bg-success-500" />
              Synchronisé
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6 bg-canvas">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
