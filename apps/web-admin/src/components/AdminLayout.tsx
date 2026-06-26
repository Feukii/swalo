import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  /** Badge (ex. nombre de renouvellements imminents) */
  badge?: string;
}

interface NavSection {
  /** Libellé de section en majuscules (null = item en tête, sans section) */
  label: string | null;
  items: NavItem[];
}

// Icônes SVG inline (stroke = currentColor pour suivre la couleur du texte)
const icons: Record<string, ReactElement> = {
  overview: <path d="M4 5h6v6H4V5zm10 0h6v4h-6V5zM4 15h6v4H4v-4zm10-2h6v6h-6v-6z" />,
  enterprises: <path d="M3 21V7l6-4 6 4v14M9 21v-4h6v4M15 21V9l6 3v9" />,
  shops: <path d="M3 9l1-5h16l1 5M4 9h16v11H4V9zm5 11v-6h6v6" />,
  licenses: <path d="M14 7a3 3 0 11-6 0 3 3 0 016 0zM11 10l-7 7v3h3l1-1h2v-2h2l1.5-1.5" />,
  users: (
    <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 11a3 3 0 100-6M19 20a6 6 0 00-3-5.2" />
  ),
  modules: <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />,
  billing: <path d="M3 6h18v12H3V6zm0 4h18M7 14h4" />,
  audit: <path d="M9 12l2 2 4-4M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z" />,
  config: (
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.7 1.7 0 00.4 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 13H4.5a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0011 4.6V4.5a2 2 0 014 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021.5 11h.1a2 2 0 110 4h-.2z" />
  ),
};

const navSections: NavSection[] = [
  {
    label: null,
    items: [{ name: "Vue d'ensemble", path: '/', icon: 'overview' }],
  },
  {
    label: 'Clients SaaS',
    items: [
      { name: 'Entreprises', path: '/enterprises', icon: 'enterprises' },
      { name: 'Boutiques', path: '/shops', icon: 'shops' },
      { name: 'Abonnements & licences', path: '/license-config', icon: 'licenses', badge: '3' },
      { name: 'Utilisateurs', path: '/users', icon: 'users' },
    ],
  },
  {
    label: 'Produit',
    items: [
      { name: 'Modules', path: '/modules', icon: 'modules' },
      { name: 'Facturation & revenus', path: '/license-config', icon: 'billing' },
    ],
  },
  {
    label: 'Système',
    items: [
      { name: "Journaux d'audit", path: '/audit-logs', icon: 'audit' },
      { name: 'Configuration', path: '/config', icon: 'config' },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const initials = (user?.display_name || 'SA')
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar marine */}
      <aside className="flex w-[230px] shrink-0 flex-col bg-primary-900 text-primary-100">
        {/* En-tête / marque */}
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-500 shadow-sm">
            <img src="/swalo_icone_ciel.svg" alt="Swalo" className="h-6 w-6 object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold text-white">Swalo Admin</p>
            <p className="text-[10px] font-semibold tracking-wider text-primary-300">
              CONSOLE ÉDITEUR
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navSections.map((section, idx) => (
            <div key={section.label ?? `section-${idx}`} className={idx === 0 ? '' : 'mt-5'}>
              {section.label && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-400">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? 'bg-action-500 font-medium text-white shadow-sm'
                          : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-warning-500 px-1.5 text-[11px] font-bold text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer utilisateur */}
        <div className="border-t border-primary-800 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action-500 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user?.display_name || 'Admin Swalo'}
              </p>
              <p className="truncate text-[10px] font-semibold tracking-wider text-primary-400">
                SUPERADMIN
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="rounded-lg p-1.5 text-primary-300 transition-colors hover:bg-primary-800 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Zone contenu */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-canvas px-6">
          <div className="relative w-full max-w-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Entreprise, boutique, code…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-action-400 focus:ring-action-400"
            />
          </div>
          <button
            onClick={() => navigate('/enterprises')}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-action-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-action-600"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Nouvelle entreprise</span>
          </button>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
