import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useModules } from '../../hooks/useModules';
import Logo from '../ui/Logo';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  badge?: number;
  module?: string;
}

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, shop, enterprise, role, logout } = useAuthStore();
  const { isModuleEnabled, licenseTier } = useModules();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  const baseNavItems: NavItem[] = [
    { name: 'Accueil', path: '/', icon: '🏠' },
    { name: 'Vente', path: '/sale', icon: '🛒', module: 'sales' },
    { name: 'Caisse', path: '/cash', icon: '💰', module: 'cash' },
    { name: 'Historique', path: '/sales', icon: '📊', module: 'sales' },
    { name: 'Produits', path: '/products', icon: '📦', module: 'products' },
    { name: 'Catalogue', path: '/catalog', icon: '🗂️', module: 'products' },
    { name: 'Stock', path: '/stock', icon: '📋', module: 'inventory' },
    { name: 'Clients', path: '/customers', icon: '👥', module: 'customers' },
    { name: 'Creances', path: '/receivables', icon: '💳', module: 'receivables' },
    { name: 'Fournisseurs', path: '/suppliers', icon: '🏪', module: 'suppliers' },
    { name: 'Dettes', path: '/debts', icon: '💸', module: 'debts' },
    { name: 'Rapports', path: '/reports', icon: '📈', module: 'reports' },
    { name: 'Entreprises', path: '/enterprise', icon: '🏢', module: 'enterprise' },
  ];

  // Admin menu items (shop-level admin only)
  const adminNavItems: NavItem[] = [];

  if (role === 'MANAGER' || role === 'BOSS' || role === 'SUPERADMIN') {
    adminNavItems.push({ name: 'Gestion Utilisateurs', path: '/admin/users', icon: '👤' });
  }

  const navItems: NavItem[] = [...baseNavItems, ...adminNavItems];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo & Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <>
              <Logo variant="full" size="sm" />
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ◀
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors mx-auto"
            >
              <Logo variant="icon" size="sm" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {navItems.map(item => {
              const enabled = !item.module || isModuleEnabled(item.module);
              const tierLabel = licenseTier || 'STARTER';

              if (enabled) {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center ${
                      sidebarOpen ? 'px-3' : 'px-2 justify-center'
                    } py-3 rounded-lg transition-all duration-200 group relative ${
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    {sidebarOpen && <span className="ml-3 text-sm">{item.name}</span>}
                    {item.badge && sidebarOpen && (
                      <span className="ml-auto badge-danger">{item.badge}</span>
                    )}
                    {!sidebarOpen && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              }

              return (
                <div
                  key={item.path}
                  className={`flex items-center ${
                    sidebarOpen ? 'px-3' : 'px-2 justify-center'
                  } py-3 rounded-lg opacity-40 cursor-not-allowed group relative`}
                  title={`Module non disponible avec votre licence ${tierLabel}`}
                >
                  <span className="text-2xl grayscale">{item.icon}</span>
                  {sidebarOpen && <span className="ml-3 text-sm text-gray-400">{item.name}</span>}
                  {sidebarOpen && <span className="ml-auto text-xs text-gray-400">🔒</span>}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 max-w-48">
                    Licence {tierLabel} - Module non inclus
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 p-4">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-white font-medium">
                  {user?.display_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.display_name || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {enterprise
                      ? `${enterprise.name} - ${shop?.name || 'Boutique'}`
                      : shop?.name || 'Boutique'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full btn-secondary btn-sm flex items-center justify-center space-x-2"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
              title="Déconnexion"
            >
              <span className="text-xl">🚪</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {navItems.find(item => isActive(item.path))?.name || 'Swalo'}
            </h1>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <span className="text-xl">🔔</span>
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
            </button>
            {/* Settings Menu */}
            <div className="relative">
              <button
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-xl">⚙️</span>
              </button>

              {/* Settings Dropdown */}
              {settingsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSettingsMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                    {/* Bilans - Pour tous sauf EMPLOYEE */}
                    {role && role !== 'EMPLOYEE' && (
                      <button
                        onClick={() => {
                          navigate('/business-reports');
                          setSettingsMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                      >
                        <span className="text-xl">📊</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Bilans</p>
                          <p className="text-xs text-gray-500">Analyses et rapports</p>
                        </div>
                      </button>
                    )}

                    {/* Administration - Pour MANAGER, BOSS, SUPERADMIN */}
                    {(role === 'MANAGER' || role === 'BOSS' || role === 'SUPERADMIN') && (
                      <button
                        onClick={() => {
                          navigate('/shop-admin');
                          setSettingsMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                      >
                        <span className="text-xl">⚙️</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Administration</p>
                          <p className="text-xs text-gray-500">Gestion boutique et PIN</p>
                        </div>
                      </button>
                    )}

                    <div className="border-t border-gray-200 my-2" />

                    {/* Déconnexion */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setSettingsMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center space-x-3 transition-colors text-red-600"
                    >
                      <span className="text-xl">🚪</span>
                      <div>
                        <p className="text-sm font-medium">Déconnexion</p>
                        <p className="text-xs text-red-500">Quitter l'application</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
