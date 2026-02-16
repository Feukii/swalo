import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface NavItem {
  name: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { name: 'Tableau de bord', path: '/', icon: '📊' },
  { name: 'Entreprises', path: '/enterprises', icon: '🏛️' },
  { name: 'Boutiques', path: '/shops', icon: '🏪' },
  { name: 'Utilisateurs', path: '/users', icon: '👥' },
  { name: "Logs d'audit", path: '/audit-logs', icon: '📝' },
  { name: 'Configuration', path: '/config', icon: '⚙️' },
  { name: 'Statistiques', path: '/system', icon: '📈' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {sidebarOpen ? (
            <>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-secondary-500 to-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  S
                </div>
                <div>
                  <span className="text-lg font-bold text-white">SWALO</span>
                  <span className="text-xs text-secondary-400 block -mt-1">Admin</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"
              >
                ◀
              </button>
            </>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors mx-auto"
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
                    ? 'bg-secondary-600/20 text-secondary-300 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span className="ml-3 text-sm">{item.name}</span>}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="border-t border-gray-800 p-4">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary-500 to-primary-500 flex items-center justify-center text-white font-medium">
                  {user?.display_name?.charAt(0) || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.display_name || 'Administrateur'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">SUPERADMIN</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <span>🚪</span>
                <span>Deconnexion</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full p-2 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
              title="Deconnexion"
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
              {navItems.find(item => isActive(item.path))?.name || 'SWALO Admin'}
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
          <div className="flex items-center space-x-2">
            <span className="badge bg-secondary-100 text-secondary-800">Plateforme Admin</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
