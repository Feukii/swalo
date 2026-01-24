import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  badge?: number;
}

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, shop, role, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  const baseNavItems: NavItem[] = [
    { name: 'Caisse', path: '/pos', icon: '💰' },
    { name: 'Ventes', path: '/sales', icon: '📊' },
    { name: 'Produits', path: '/products', icon: '📦' },
    { name: 'Clients', path: '/customers', icon: '👥' },
    { name: 'Créances', path: '/receivables', icon: '💳' },
    { name: 'Fournisseurs', path: '/suppliers', icon: '🏪' },
    { name: 'Dettes', path: '/debts', icon: '💸' },
    { name: 'Inventaire', path: '/inventory', icon: '📋' },
    { name: 'Rapports', path: '/reports', icon: '📈' },
  ];

  // Admin menu items (only for ADMIN, OWNER, MANAGER, SUPERADMIN)
  const adminNavItems: NavItem[] = [];

  if (role === 'SUPERADMIN') {
    adminNavItems.push({ name: 'Admin Dashboard', path: '/admin/dashboard', icon: '👑' });
  }

  if (role === 'ADMIN' || role === 'OWNER' || role === 'MANAGER' || role === 'SUPERADMIN') {
    adminNavItems.push({ name: 'Gestion Utilisateurs', path: '/admin/users', icon: '👤' });
  }

  const navItems: NavItem[] = [...baseNavItems, ...adminNavItems];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

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
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  S
                </div>
                <span className="text-xl font-bold text-gradient">SWALO</span>
              </div>
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
              ▶
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {navItems.map(item => (
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
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 p-4">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-medium">
                  {user?.display_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.display_name || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{shop?.name || 'Boutique'}</p>
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
              {navItems.find(item => isActive(item.path))?.name || 'SWALO'}
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

                    {/* Administration - Pour ADMIN, OWNER, MANAGER, SUPERADMIN */}
                    {(role === 'ADMIN' ||
                      role === 'OWNER' ||
                      role === 'MANAGER' ||
                      role === 'SUPERADMIN') && (
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
