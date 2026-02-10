# Plan 025 - Application Web Admin Independante

## Contexte

L'interface d'administration generale de l'ERP (gestion entreprises, boutiques, licences, utilisateurs, config) etait integree dans l'app web boutique (`apps/web`). L'utilisateur veut une application web separee pour piloter son business, independante de l'app boutique.

## Strategie

Creer `apps/web-admin` comme nouvelle app Vite+React dans le monorepo, y deplacer les pages admin, et nettoyer `apps/web`.

## Structure cible

```
apps/web-admin/              # NOUVELLE APP - port 3002
  package.json               # @swalo/web-admin
  index.html                 # "SWALO Admin"
  vite.config.ts
  tailwind.config.js
  postcss.config.js
  tsconfig.json + .app + .node
  eslint.config.js
  src/
    main.tsx
    App.tsx                  # Routes admin uniquement
    App.css + index.css
    constants/theme.ts
    lib/api.ts               # API client admin-only (admin_access_token)
    store/authStore.ts       # Auth avec enforcement SUPERADMIN
    components/
      AdminLayout.tsx        # Layout admin (sidebar sombre + header)
      AdminRoute.tsx         # Guard: auth + SUPERADMIN obligatoire
    pages/
      AdminLogin.tsx         # Login email/password, branding "SWALO Admin"
      DashboardHome.tsx      # Page d'accueil admin (KPIs + raccourcis)
      AdminEnterprises.tsx   # Deplace depuis apps/web
      AdminShops.tsx         # Deplace depuis apps/web
      AdminGlobalUsers.tsx   # Deplace depuis apps/web
      AdminConfig.tsx        # Deplace depuis apps/web
      AuditLogs.tsx          # Deplace depuis apps/web
      SuperAdminDashboard.tsx # Deplace depuis apps/web
```

## Implementation - COMPLETE

### Phase 1: Scaffold (config files) - DONE
### Phase 2: Infrastructure (auth, API, layout) - DONE
### Phase 3: Pages admin (deplace + DashboardHome) - DONE
### Phase 4: App.tsx routing - DONE
### Phase 5: Nettoyage apps/web - DONE
- Supprime 8 fichiers pages admin de apps/web
- Mis a jour App.tsx: retire imports/routes admin + /login/admin
- Mis a jour MainLayout.tsx: retire items nav SUPERADMIN

### Phase 6: Verification - DONE
- pnpm install: workspace enregistre
- Type-check web-admin: clean
- Type-check web: clean
- features-catalog.md mis a jour (section 12.17 + changelog)

## Decisions techniques
- Port 3002 pour admin app
- Tokens localStorage separes: `admin_access_token` / `admin_refresh_token`
- Sidebar sombre (bg-gray-900) vs sidebar blanche dans app boutique
- SUPERADMIN enforce au login (rejet non-SUPERADMIN)
- Routes plates (pas de prefixe `/admin/` puisque toute l'app est admin)
