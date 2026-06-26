import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Types — shape returned by adminApi.getEnterpriseDetails()
// ---------------------------------------------------------------------------

interface ConsoleShop {
  id: string;
  name: string;
  code: string;
  is_blocked?: boolean;
  shop_type?: string;
}

interface ConsoleEnterprise {
  id: string;
  name: string;
  code: string;
  license_tier: string;
  shops?: ConsoleShop[];
  _count?: { shops: number };
}

// ---------------------------------------------------------------------------
// Navigation model
// ---------------------------------------------------------------------------

type NavScope = 'shop' | 'enterprise';

interface NavItem {
  name: string;
  icon: string;
  /** Active/navigable item. Disabled items are visible but greyed out. */
  enabled: boolean;
  /** Path builder for enabled items (relative to the console root). */
  to?: (enterpriseId: string, shopId: string) => string;
  /** matcher segment used to compute the active state. */
  match?: string;
  /** enterprise-level items don't depend on the selected shop. */
  scope: NavScope;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const TIER_SHORT: Record<string, string> = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  ENTERPRISE: 'ENTREPRISE',
};

// Inline SVG icons (stroke = currentColor to follow text color)
const icons: Record<string, ReactElement> = {
  pos: <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 4.5A1 1 0 005.6 19H17M16 19a2 2 0 100 4 2 2 0 000-4zM9 19a2 2 0 100 4 2 2 0 000-4z" />,
  cash: <path d="M3 6h18v12H3V6zm0 4h18M7 14h4" />,
  invoice: <path d="M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1zM13 4v5h5M9 13h6M9 17h4" />,
  history: <path d="M3 12a9 9 0 109-9 9 9 0 00-6.3 2.6L3 8M3 4v4h4M12 7v5l3 2" />,
  products: <path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7L12 12l8.7-5M12 22V12" />,
  inventory: <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />,
  transfers: <path d="M7 16H3m0 0l4-4m-4 4l4 4M17 8h4m0 0l-4-4m4 4l-4 4" />,
  customers: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 11a3 3 0 100-6M19 20a6 6 0 00-3-5.2" />,
  receivables: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />,
  suppliers: <path d="M3 9l1-5h16l1 5M4 9h16v11H4V9zm5 11v-6h6v6" />,
  debts: <path d="M12 5v14M19 12l-7 7-7-7" />,
  reports: <path d="M4 19V5m0 14h16M8 17v-5m4 5V9m4 8v-3" />,
  accounting: <path d="M9 7h6M9 11h6M9 15h4M5 4h14a1 1 0 011 1v15l-3-2-3 2-3-2-3 2-3-2V5a1 1 0 011-1z" />,
  balances: <path d="M3 3v18h18M7 13l3-3 3 3 5-6" />,
};

const navSections: NavSection[] = [
  {
    label: 'Ventes',
    items: [
      {
        name: 'Point de vente',
        icon: 'pos',
        enabled: true,
        scope: 'shop',
        match: 'pos',
        to: (e, s) => `/enterprises/${e}/console/${s}/pos`,
      },
      { name: 'Caisse', icon: 'cash', enabled: false, scope: 'shop' },
      { name: 'Factures', icon: 'invoice', enabled: false, scope: 'shop' },
      { name: 'Historique', icon: 'history', enabled: false, scope: 'shop' },
    ],
  },
  {
    label: 'Stock',
    items: [
      {
        name: 'Produits',
        icon: 'products',
        enabled: true,
        scope: 'shop',
        match: 'products',
        to: (e, s) => `/enterprises/${e}/console/${s}/products`,
      },
      { name: 'Inventaire', icon: 'inventory', enabled: false, scope: 'shop' },
      { name: 'Transferts', icon: 'transfers', enabled: false, scope: 'shop' },
    ],
  },
  {
    label: 'Relations',
    items: [
      {
        name: 'Clients',
        icon: 'customers',
        enabled: true,
        scope: 'shop',
        match: 'clients',
        to: (e, s) => `/enterprises/${e}/console/${s}/clients`,
      },
      { name: 'Créances', icon: 'receivables', enabled: false, scope: 'shop' },
      {
        name: 'Fournisseurs',
        icon: 'suppliers',
        enabled: true,
        scope: 'shop',
        match: 'suppliers',
        to: (e, s) => `/enterprises/${e}/console/${s}/suppliers`,
      },
      { name: 'Dettes', icon: 'debts', enabled: false, scope: 'shop' },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      {
        name: 'Rapports',
        icon: 'reports',
        enabled: true,
        scope: 'enterprise',
        match: 'reports',
        to: e => `/enterprises/${e}/console/reports`,
      },
      { name: 'Comptabilité', icon: 'accounting', enabled: false, scope: 'enterprise' },
      { name: 'Bilans boutiques', icon: 'balances', enabled: false, scope: 'enterprise' },
    ],
  },
];

const PERIOD_CHIPS = ['Jour', '7j', '30j', 'Mois'] as const;
type PeriodChip = (typeof PERIOD_CHIPS)[number];

function NavGlyph({ name }: { name: string }) {
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

export default function EnterpriseConsoleLayout() {
  const { enterpriseId, shopId } = useParams<{ enterpriseId: string; shopId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [enterprise, setEnterprise] = useState<ConsoleEnterprise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodChip>('Jour');

  useEffect(() => {
    if (!enterpriseId) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = (await adminApi.getEnterpriseDetails(enterpriseId)) as ConsoleEnterprise;
        if (cancelled) return;
        setEnterprise(data);
      } catch {
        if (!cancelled) setError("Impossible de charger l'entreprise.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enterpriseId]);

  const shops = useMemo<ConsoleShop[]>(() => enterprise?.shops ?? [], [enterprise]);
  const shopCount = enterprise?._count?.shops ?? shops.length;

  // Determine the current active matcher from the URL last segment.
  const activeMatch = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  }, [location.pathname]);

  const handleShopChange = (nextShopId: string) => {
    if (!enterpriseId) return;
    // Keep the current shop-scoped view (default to pos) when switching shops.
    const isShopView = ['pos', 'products', 'clients', 'suppliers'].includes(activeMatch);
    const view = isShopView ? activeMatch : 'pos';
    navigate(`/enterprises/${enterpriseId}/console/${nextShopId}/${view}`);
  };

  return (
    <div className="flex h-screen bg-canvas">
      {/* Sidebar marine sombre */}
      <aside className="flex w-[238px] shrink-0 flex-col bg-primary-900 text-primary-100">
        {/* En-tête / marque */}
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-500 shadow-sm">
            <img src="/swalo_icone_ciel.svg" alt="Swalo" className="h-6 w-6 object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-base font-bold text-white">Swalo</p>
            <p className="truncate text-[11px] font-medium text-primary-300">
              {enterprise?.name ?? '…'}
            </p>
          </div>
        </div>

        {/* Pastille plan + nb boutiques */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between rounded-lg bg-action-500/15 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-action-300">
              Plan {enterprise ? (TIER_SHORT[enterprise.license_tier] ?? enterprise.license_tier) : '—'}
            </span>
            <span className="text-[11px] font-medium text-action-200">
              {shopCount} boutique{shopCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Sélecteur de boutique */}
        <div className="px-4 pb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-primary-400">
            Boutique
          </label>
          <select
            value={shopId ?? ''}
            onChange={e => handleShopChange(e.target.value)}
            disabled={shops.length === 0}
            className="w-full rounded-lg border border-primary-700 bg-primary-800 px-3 py-2 text-sm text-white focus:border-action-400 focus:ring-action-400 disabled:opacity-50"
          >
            {shops.length === 0 && <option value="">Aucune boutique</option>}
            {shops.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navSections.map(section => (
            <div key={section.label} className="mt-4 first:mt-1">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-400">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = item.enabled && item.match === activeMatch;
                  const baseClasses =
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors';

                  if (!item.enabled) {
                    return (
                      <div
                        key={item.name}
                        title="Bientôt"
                        aria-disabled="true"
                        className={`${baseClasses} cursor-not-allowed text-primary-400/60`}
                      >
                        <NavGlyph name={item.icon} />
                        <span className="flex-1 truncate">{item.name}</span>
                      </div>
                    );
                  }

                  const canNavigate =
                    item.scope === 'enterprise' || (!!shopId && shops.length > 0);
                  const target =
                    item.to && enterpriseId
                      ? item.to(enterpriseId, shopId ?? '')
                      : '#';

                  if (!canNavigate) {
                    return (
                      <div
                        key={item.name}
                        aria-disabled="true"
                        className={`${baseClasses} cursor-not-allowed text-primary-400/60`}
                      >
                        <NavGlyph name={item.icon} />
                        <span className="flex-1 truncate">{item.name}</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={target}
                      className={`${baseClasses} ${
                        active
                          ? 'bg-action-500 font-medium text-white shadow-sm'
                          : 'text-primary-100 hover:bg-primary-800 hover:text-white'
                      }`}
                    >
                      <NavGlyph name={item.icon} />
                      <span className="flex-1 truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-primary-800 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
            Vue super-admin
          </p>
          <Link
            to="/"
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-action-300 transition-colors hover:text-action-200"
          >
            <span aria-hidden="true">←</span> Console éditeur
          </Link>
        </div>
      </aside>

      {/* Zone contenu */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-canvas px-6">
          {/* Chips période */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {PERIOD_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => setPeriod(chip)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === chip
                    ? 'bg-primary-900 text-white'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex flex-1 items-center justify-end gap-4">
            {/* Recherche */}
            <div className="relative w-full max-w-xs">
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
                placeholder="Rechercher…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-action-400 focus:ring-action-400"
              />
            </div>

            {/* Pastille synchronisé */}
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-sm font-medium text-success-700">
              <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
              Synchronisé
            </span>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-y-auto bg-canvas p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
                <div className="h-48 animate-pulse rounded-2xl bg-white shadow-card" />
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-card">
                <p className="font-medium text-danger-700">{error}</p>
                <Link
                  to="/enterprises"
                  className="mt-4 inline-block rounded-lg bg-action-500 px-4 py-2 text-sm text-white transition-colors hover:bg-action-600"
                >
                  Retour aux entreprises
                </Link>
              </div>
            ) : (
              <Outlet context={{ enterprise, shops, period }} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
