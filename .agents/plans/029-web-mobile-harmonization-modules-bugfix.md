# Feature: Web/Mobile UI Harmonization, Module Gating & Bug Fixes

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Comprehensive harmonization of the SWALO web and mobile applications across three axes:

1. **UI/Branding Harmonization** - Align the web visual identity with mobile (logo, colors, login page, Cash page)
2. **Module/License Gating** - Complete the entitlement system so disabled modules are properly gated in API and gracefully shown/hidden in frontend
3. **Bug Fix** - Fix the mobile SQLite `auth_cache.name` NOT NULL constraint error

## User Story

As a **shop owner/manager** using SWALO on both web and mobile,
I want the **same visual identity and feature experience** on both platforms,
So that my team recognizes the brand and only sees features included in our license.

As a **SUPERADMIN** managing licenses,
I want modules excluded from a shop's license to be **grayed out with a clear message**,
So that users understand why a feature is unavailable without getting confusing errors.

## Problem Statement

1. **Visual inconsistency**: Web uses sky-blue/purple colors while mobile uses navy (bleu petrole #0F2A44). Web has no SWALO logo (uses gradient "S" placeholder). Login pages look completely different.
2. **Broken module gating**: 6 premium controllers lack `@RequireModule` decorators. The `/auth/me` response omits `enabled_modules` and `license_tier`. Neither web nor mobile filter navigation based on modules -- users see all features and get raw 403 errors.
3. **Cash page gap**: Web POS.tsx is ~60% feature-complete vs mobile CashScreen.tsx -- missing credit transactions, payment mode toggle, transaction detail modal, and has an amount unit bug.
4. **Mobile SQLite error**: `auth_cache` table doesn't exist in current schema -- legacy artifact causing crashes on devices with stale databases.

## Solution Statement

- **Phase 1 (Branding)**: Fix Tailwind primary colors to navy, copy logo assets to web, update Login/Sidebar/favicon
- **Phase 2 (API Security)**: Add missing `@RequireModule` decorators, extend `/auth/me` with module/license data
- **Phase 3 (Frontend Gating)**: Filter web sidebar and mobile MoreScreen by enabled_modules, add 403 error handler with user-friendly modal, show disabled modules as grayed out with license messaging
- **Phase 4 (Cash Harmonization)**: Add credit transaction integration, payment mode toggle, transaction detail modal, fix amount unit bug
- **Phase 5 (Bug Fix)**: Add DB migration/reset logic to handle stale `auth_cache` table on mobile

## Feature Metadata

**Feature Type**: Enhancement + Bug Fix
**Estimated Complexity**: High
**Primary Systems Affected**: Web theme/Tailwind, API guards/auth, Web pages (LoginPin, POS, MainLayout), Mobile screens (MoreScreen, CashScreen), Mobile DB
**Dependencies**: None (all internal changes)

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

#### Theme & Branding

- `apps/mobile/src/constants/theme-v2.ts` - Mobile theme (source of truth for colors)
- `apps/web/src/constants/theme.ts` - Web theme (defines correct colors but underused)
- `apps/web/tailwind.config.js` - Tailwind config (WRONG primary colors: sky-blue instead of navy)
- `apps/web/src/index.css` - CSS utility classes (buttons use wrong primary)
- `apps/web/index.html` - Favicon (vite.svg) and page title ("web")

#### Logo Assets

- `apps/mobile/assets/logo.png` - Icon logo (48x48)
- `apps/mobile/assets/logo.svg` - Icon logo (vector)
- `apps/mobile/assets/full_icon.png` - Full branding (200x80)
- `apps/mobile/assets/full_icon.svg` - Full branding (vector)
- `apps/web/src/assets/` - Only has react.svg (NO SWALO assets)

#### Login Pages

- `apps/mobile/src/screens/LoginPinScreen.tsx` - Mobile login (navy, logo asset, light bg)
- `apps/web/src/pages/LoginPin.tsx` - Web login (purple gradient, hardcoded "S")

#### Layout & Navigation

- `apps/web/src/components/Layout/MainLayout.tsx` (lines 19-33: navItems, lines 63-87: sidebar header)
- `apps/mobile/src/screens/MoreScreen.tsx` (lines 56-107: menu items)
- `apps/mobile/src/navigation/MainTabNavigator.tsx`

#### Module/Entitlement System

- `packages/core/src/modules/registry.ts` - 18 modules, 3 tiers, dependency graph
- `apps/api/src/common/guards/entitlement.guard.ts` - EntitlementGuard logic
- `apps/api/src/common/decorators/require-module.decorator.ts` - @RequireModule decorator
- `apps/api/src/modules/auth/auth.service.ts` - getUserWithRoles() (missing modules data)
- `apps/api/src/modules/admin-controls/admin-controls.service.ts` - updateShopModules()

#### Controllers Missing @RequireModule

- `apps/api/src/modules/transfers/transfers.controller.ts`
- `apps/api/src/modules/invoices/invoices.controller.ts`
- `apps/api/src/modules/import/import.controller.ts`
- `apps/api/src/modules/enterprise/enterprise.controller.ts`
- `apps/api/src/modules/notifications/notifications.controller.ts`
- `apps/api/src/modules/packaging-types/packaging-types.controller.ts`

#### Cash Pages

- `apps/mobile/src/screens/CashScreen.tsx` (1625 lines - comprehensive)
- `apps/web/src/pages/POS.tsx` (619 lines - incomplete)

#### API Clients

- `apps/web/src/lib/api.ts` - Web Axios client (no 403 handling)
- `apps/mobile/src/lib/api.ts` - Mobile Axios client (no 403 handling)

#### Auth Stores

- `apps/web/src/store/authStore.ts` - Zustand (missing enabled_modules)

#### Mobile Database

- `apps/mobile/src/db/schema.ts` - SQLite schema (NO auth_cache table)
- `apps/mobile/src/db/index.ts` - DB initialization

### New Files to Create

- `apps/web/src/components/ui/Logo.tsx` - Reusable Logo component for web
- `apps/web/src/components/ui/ModuleGate.tsx` - Module-disabled wrapper/UI component
- `apps/web/src/hooks/useModules.ts` - Hook to check module availability
- `apps/web/public/logo.svg` - Copy from mobile assets

### Patterns to Follow

**Naming Conventions:**

- NestJS decorators: PascalCase (`@RequireModule()`)
- React components: PascalCase files (`Logo.tsx`, `ModuleGate.tsx`)
- Zustand stores: camelCase (`authStore.ts`)
- Tailwind custom colors: kebab-case (`primary-900`)

**Error Handling:**

- API guards throw `ForbiddenException` with descriptive French message
- Web API client uses Axios response interceptor for 401/403
- Mobile uses same pattern with AsyncStorage cleanup on 401

**Module Gating Pattern:**

- `@RequireModule('module-code')` on controller class level
- Guard reads metadata via Reflector
- Empty `enabled_modules[]` = all allowed (backwards compat)
- SUPERADMIN bypasses all checks

---

## IMPLEMENTATION PLAN

### Phase 1: Branding & Color Harmonization (Web)

Fix the visual identity of the web app to match mobile's navy/bleu petrole theme.

**Tasks:**

- Update Tailwind primary colors from sky-blue to navy palette based on #0F2A44
- Remove/fix secondary purple palette to complement navy
- Copy SWALO logo assets from mobile to web
- Create reusable Logo component
- Update MainLayout sidebar to use Logo component
- Update LoginPin page: replace purple with navy, use logo asset
- Fix favicon and page title in index.html
- Update CSS button classes to use correct primary shade

### Phase 2: API Module Security

Complete the backend entitlement system.

**Tasks:**

- Add `@RequireModule` decorator to 6 unprotected premium controllers
- Extend `/auth/me` and `/auth/pin` responses to include `shop.enabled_modules` and `enterprise.license_tier`
- Improve entitlement guard error message to include license tier info

### Phase 3: Frontend Module Gating

Implement module awareness in web and mobile navigation.

**Tasks:**

- Extend web authStore to track `enabled_modules` and `license_tier`
- Create `useModules()` hook for checking module availability
- Filter web sidebar navItems by enabled modules
- Show disabled modules as grayed-out with tooltip message
- Add 403 response interceptor in web API client with module-specific modal
- Create ModuleGate component for wrapping protected pages
- Filter mobile MoreScreen menu items by enabled modules
- Add 403 handler in mobile API client

### Phase 4: Cash Page Harmonization (Web)

Bring web POS.tsx to feature parity with mobile CashScreen.tsx.

**Tasks:**

- Fix amount unit bug (remove centimes conversion -- FCFA is integers)
- Add receivables/debts API calls to data loading
- Merge cash entries + receivables + debts into unified transaction list
- Add payment mode toggle (cash/credit) for entry and exit forms
- Implement credit transaction creation logic (receivables for credit sales, debts for credit purchases)
- Add transaction detail modal on item click
- Add KPI breakdown cards (cash sales, credit sales, cash purchases, credit purchases)
- Add credit transaction visual indicators (badges, warning banners)

### Phase 5: Mobile SQLite Bug Fix

Fix the `auth_cache.name` NOT NULL constraint error.

**Tasks:**

- Add database initialization logic to detect and drop stale `auth_cache` table
- Ensure `initDatabase()` handles legacy tables gracefully
- Add version check to prevent schema mismatch crashes

---

## STEP-BY-STEP TASKS

### Phase 1: Branding & Color Harmonization

#### Task 1.1: UPDATE `apps/web/tailwind.config.js`

- **IMPLEMENT**: Replace the `primary` color palette from sky-blue defaults to a navy palette derived from #0F2A44 (bleu petrole). Generate a complete 50-950 scale with #0F2A44 as the 900 shade. Remove or replace `secondary` purple palette with a complementary navy shade. Update `success-600` from #16a34a to #1EB980 to match mobile theme.
- **PATTERN**: Reference `apps/mobile/src/constants/theme-v2.ts` for exact color values (primary.900=#0F2A44, primary.700=#183B5A, primary.50=#EEF5FB, success.main=#1EB980)
- **GOTCHA**: Many pages use `primary-600`, `primary-700` etc. in gradients and buttons -- ensure the new scale provides good contrast at each shade. Also used in `index.css` for `.btn-primary`, `.btn-secondary` etc.
- **VALIDATE**: `cd apps/web && pnpm dev` -- visually check sidebar, buttons, and cards use navy instead of sky-blue

#### Task 1.2: COPY logo assets to web

- **IMPLEMENT**: Copy `logo.svg` from `apps/mobile/assets/` to `apps/web/public/logo.svg`. This will serve as favicon and sidebar icon.
- **GOTCHA**: Verify SVG renders correctly in browser (no React Native specific attributes)
- **VALIDATE**: Open `http://localhost:3001/logo.svg` in browser

#### Task 1.3: UPDATE `apps/web/index.html`

- **IMPLEMENT**: Change favicon from `vite.svg` to `logo.svg`. Change page title from "web" to "SWALO - Gestion de Boutique".
- **PATTERN**: Standard HTML `<link rel="icon">` and `<title>` tags
- **VALIDATE**: Reload web app -- browser tab should show SWALO logo and title

#### Task 1.4: CREATE `apps/web/src/components/ui/Logo.tsx`

- **IMPLEMENT**: Create a reusable Logo component accepting `size` (sm/md/lg) and `variant` (icon/full) props. `icon` variant shows just the S icon image. `full` variant shows icon + "SWALO" text. Import the logo SVG from `/logo.svg` (public directory). Use img tag, not inline SVG.
- **PATTERN**: Follow existing web component patterns (functional component, TypeScript interface for props)
- **VALIDATE**: Import and render in a test page to verify both variants

#### Task 1.5: UPDATE `apps/web/src/components/Layout/MainLayout.tsx` sidebar header

- **IMPLEMENT**: Replace the hardcoded gradient "S" div (lines ~66-70) with the Logo component. When sidebar is open, show `<Logo variant="full" size="md" />`. When collapsed, show `<Logo variant="icon" size="sm" />`. Replace `text-gradient` class on SWALO text with `text-primary-900`.
- **PATTERN**: Reference `apps/mobile/src/components/ui/ScreenHeader.tsx` for how mobile uses the logo
- **GOTCHA**: Collapsed sidebar state uses `sidebarOpen` boolean -- ensure logo renders correctly in both states
- **VALIDATE**: Toggle sidebar collapse -- logo should show/hide text appropriately

#### Task 1.6: UPDATE `apps/web/src/pages/LoginPin.tsx`

- **IMPLEMENT**: Replace ALL purple hardcoded classes with navy primary classes. Specifically:
  - Background: replace `from-purple-600 via-purple-700 to-purple-800` with `from-primary-900 via-primary-800 to-primary-700`
  - Logo area: replace gradient "S" div with `<Logo variant="icon" size="lg" />`
  - Submit button: replace `from-purple-600 to-purple-700` with `from-primary-900 to-primary-700`
  - Focus rings: replace `ring-purple-200`, `focus:ring-purple-500` with `ring-primary-200`, `focus:ring-primary-500`
  - Text colors: replace `text-purple-700`, `text-purple-600` with `text-primary-900`, `text-primary-700`
- **PATTERN**: Reference `apps/mobile/src/screens/LoginPinScreen.tsx` for the visual approach (light bg, logo asset, navy buttons)
- **GOTCHA**: Search for ALL occurrences of "purple" in the file -- there are many scattered references
- **VALIDATE**: Navigate to `/login` -- should show navy branding matching mobile

#### Task 1.7: UPDATE `apps/web/src/index.css`

- **IMPLEMENT**: Update `.btn-primary` to use `bg-primary-900` instead of `bg-primary-600`. Update hover to `hover:bg-primary-700`. Update `.btn-secondary` to use a complementary navy shade. Verify all badge classes use correct colors.
- **PATTERN**: Reference `apps/web/src/constants/theme.ts` for semantic color mapping
- **VALIDATE**: Check button colors across several pages

---

### Phase 2: API Module Security

#### Task 2.1: ADD @RequireModule to 6 unprotected controllers

- **IMPLEMENT**: Add `@RequireModule('transfers')` to TransfersController, `@RequireModule('invoices')` to InvoicesController, `@RequireModule('import')` to ImportController, `@RequireModule('enterprise')` to EnterpriseController, `@RequireModule('notifications')` to NotificationsController, `@RequireModule('packaging-types')` to PackagingTypesController. Import the decorator from `../../common/decorators/require-module.decorator`.
- **PATTERN**: Reference `apps/api/src/modules/suppliers/suppliers.controller.ts` for exact import path and decorator placement (class level, above @Controller)
- **GOTCHA**: Import path varies -- some controllers use `../../common/decorators/`, verify the relative path for each file. The decorator goes on the class, NOT on individual methods.
- **VALIDATE**: `cd apps/api && pnpm lint && pnpm test`

#### Task 2.2: UPDATE `/auth/me` and `/auth/pin` to include module data

- **IMPLEMENT**: In `apps/api/src/modules/auth/auth.service.ts`, modify `getUserWithRoles()` (used by GET /auth/me) to include `shop.enabled_modules` and `enterprise.license_tier` and `enterprise.licensed_until` in the response. Also modify the PIN login response to include the same fields. The shop query should include `enabled_modules` field, and the enterprise query should include `license_tier` and `licensed_until`.
- **PATTERN**: Follow existing response structure -- add fields to existing shop/enterprise objects in response
- **GOTCHA**: Ensure backwards compatibility -- existing clients that don't use these fields should not break. Use `user.userId` NOT `user.sub` for JWT payload access.
- **VALIDATE**: `cd apps/api && pnpm test` and manually test `curl http://localhost:3000/api/auth/me` with valid token

#### Task 2.3: IMPROVE entitlement guard error message

- **IMPLEMENT**: In `apps/api/src/common/guards/entitlement.guard.ts`, enhance the ForbiddenException message to include the module's display name (from registry) and a structured error response with `code: 'MODULE_DISABLED'`, `module: requiredModule`, `moduleName: displayName`. Import `MODULE_REGISTRY` from `@swalo/core` to get display names.
- **PATTERN**: The guard already throws ForbiddenException -- enhance the message object
- **GOTCHA**: Keep backward compatibility with the string message for existing error handlers
- **VALIDATE**: `cd apps/api && pnpm test`

---

### Phase 3: Frontend Module Gating

#### Task 3.1: UPDATE `apps/web/src/store/authStore.ts`

- **IMPLEMENT**: Add `enabledModules: string[]` and `licenseTier: string | null` to the AuthState interface. Populate these from the `/auth/me` and `/auth/pin` responses (from `shop.enabled_modules` and `enterprise.license_tier`). Update `loginWithPin()` and `loadUser()` to store these values.
- **PATTERN**: Follow existing store pattern -- add to interface, default to `[]` and `null`, set in login/loadUser methods
- **GOTCHA**: `enabled_modules = []` means all allowed -- the hook/check should handle this case
- **VALIDATE**: Login and check browser devtools for Zustand state

#### Task 3.2: CREATE `apps/web/src/hooks/useModules.ts`

- **IMPLEMENT**: Create a hook `useModules()` that returns `{ isModuleEnabled(moduleCode: string): boolean, enabledModules: string[], licenseTier: string | null }`. It reads from authStore. `isModuleEnabled()` returns `true` if `enabledModules` is empty (backwards compat) or if the module is in the array. Import `MODULE_REGISTRY` from `@swalo/core` to get module display names. Also export `getModuleDisplayName(code: string): string`.
- **PATTERN**: Standard React custom hook using `useAuthStore`
- **VALIDATE**: Use in a test component to verify module checks

#### Task 3.3: UPDATE `apps/web/src/components/Layout/MainLayout.tsx` sidebar filtering

- **IMPLEMENT**: Add a `module` optional field to the NavItem type. Map each nav item to its required module (e.g., `{ name: 'Fournisseurs', path: '/suppliers', icon: '...', module: 'suppliers' }`, `{ name: 'Creances', path: '/receivables', icon: '...', module: 'receivables' }`, etc.). Use `useModules()` hook to filter/style items. Items for disabled modules should render with `opacity-50 cursor-not-allowed` and show a tooltip: "Module non disponible avec votre licence [TIER]". Core modules have no `module` field and are always visible.
- **PATTERN**: Use existing `isActive()` pattern for styling, add module check layer
- **GOTCHA**: SUPERADMIN should see all items (check role from authStore). Items for disabled modules should NOT navigate -- prevent default click and show tooltip instead.
- **VALIDATE**: Login as STARTER user -- Fournisseurs, Creances, Dettes should appear grayed out

#### Task 3.4: ADD 403 response interceptor in `apps/web/src/lib/api.ts`

- **IMPLEMENT**: In the Axios response error interceptor, add a check for `status === 403`. If the error response contains `code: 'MODULE_DISABLED'`, dispatch a custom event or call a callback to show a user-friendly modal with the message: "Module non disponible. Vous avez une licence [tier]. Le module '[moduleName]' necessite une licence superieure. Contactez votre administrateur." If it's a generic 403 (not module-related), show "Acces refuse".
- **PATTERN**: Follow existing 401 handler pattern in the same interceptor
- **GOTCHA**: Don't auto-logout on 403 (that's 401 only). Use a global event or toast system.
- **VALIDATE**: Manually disable a module via Prisma Studio, try to access it on web

#### Task 3.5: UPDATE `apps/mobile/src/screens/MoreScreen.tsx`

- **IMPLEMENT**: Add module awareness to menu items. Each menu item should have an optional `module` field. Read `enabled_modules` from AsyncStorage (stored during login). Items for disabled modules should show with reduced opacity and a lock icon, and tapping them should show an Alert with the message: "Module non disponible. Vous avez une licence [tier]. Ce module n'est pas inclus dans votre licence actuelle."
- **PATTERN**: Reference existing menu item rendering pattern in MoreScreen
- **GOTCHA**: AsyncStorage data may not include `enabled_modules` for users logged in before this update -- treat missing data as "all allowed". Module-to-menu mapping: Fournisseurs=suppliers, Transferts=transfers, Rapports=reports.
- **VALIDATE**: Login as STARTER user on mobile -- disabled items should show lock icon

#### Task 3.6: ADD 403 handler in `apps/mobile/src/lib/api.ts`

- **IMPLEMENT**: In the Axios response error interceptor, add handling for `status === 403` similar to the web implementation. When the error contains module-disabled info, throw a typed error that screens can catch and display appropriately.
- **PATTERN**: Follow existing 401 handler
- **VALIDATE**: Test by disabling a module and accessing it on mobile

---

### Phase 4: Cash Page Harmonization

#### Task 4.1: FIX amount unit bug in `apps/web/src/pages/POS.tsx`

- **IMPLEMENT**: Remove the centimes conversion (`Math.round(parseFloat(amount) * 100)`). FCFA amounts are stored as integers -- send the amount directly as `Math.round(parseFloat(amount))`. Search for ALL occurrences of `* 100` in POS.tsx.
- **PATTERN**: Reference `CLAUDE.md`: "All monetary amounts stored as integers in FCFA (CFA francs, no decimals needed)"
- **GOTCHA**: Also check if display formatting divides by 100 anywhere -- if so, remove that too
- **VALIDATE**: Create a cash entry of 5000 FCFA -- verify it shows as 5000 (not 500000) in the list

#### Task 4.2: ADD credit transaction integration to `apps/web/src/pages/POS.tsx`

- **IMPLEMENT**: In the data loading function, add calls to `receivablesApi.getAll()` and `debtsApi.getAll()` alongside existing cash entry/stats calls using `Promise.all`. Merge receivables into the transaction list as entries with `type='IN'` and `isCredit=true`. Merge debts as exits with `type='OUT'` and `isCredit=true`. Sort the merged list by `created_at` descending.
- **PATTERN**: Reference `apps/mobile/src/screens/CashScreen.tsx` for the exact merge logic (how it creates the unified transaction array)
- **GOTCHA**: Receivables and debts may not have all the same fields as cash entries -- normalize the structure. Filter by today's date for consistency.
- **VALIDATE**: Create a credit sale on mobile, verify it appears in web cash journal

#### Task 4.3: ADD payment mode toggle to POS.tsx entry/exit forms

- **IMPLEMENT**: When category is "Ventes" (entry) or "Achats marchandises" (exit), show a toggle between "Especes" and "Credit". When "Credit" is selected for entry, show customer selection and create a receivable instead of a cash entry. When "Credit" is selected for exit, show supplier selection and create a debt instead of a cash exit.
- **PATTERN**: Reference `apps/mobile/src/screens/CashScreen.tsx` for the exact conditional logic and form field visibility
- **DEPENDENCIES**: Requires receivablesApi.create() and debtsApi.create() from web api.ts
- **GOTCHA**: "Remboursement client" entry requires creating BOTH a negative receivable AND a cash entry. "Reglement fournisseur" exit requires creating BOTH a negative debt AND a cash exit.
- **VALIDATE**: Create credit sale on web -- verify no cash entry created, only receivable

#### Task 4.4: ADD transaction detail modal to POS.tsx

- **IMPLEMENT**: Add state for `selectedTransaction` and `showDetailModal`. Add click handler on each transaction item in the list. Create a modal that displays: type (Entree/Sortie), credit indicator, category label, payment mode, amount with color coding, date/time, client/supplier name, cashier name, note. For credit transactions, show a warning banner: "Transaction a credit - Pas d'impact sur la caisse".
- **PATTERN**: Reference `apps/mobile/src/screens/CashScreen.tsx` transaction detail modal rendering
- **VALIDATE**: Click a transaction in the list -- modal should appear with all details

#### Task 4.5: ADD KPI breakdown cards to POS.tsx

- **IMPLEMENT**: Below the existing balance/entries/exits cards, add a section showing: Total ventes (cash + credit), Ventes especes, Ventes credit, Total achats, Achats especes, Achats credit. Use the stats from the merged data.
- **PATTERN**: Reference mobile CashScreen for the KPI layout
- **VALIDATE**: Verify KPIs match between web and mobile for the same shop/date

---

### Phase 5: Mobile SQLite Bug Fix

#### Task 5.1: UPDATE `apps/mobile/src/db/index.ts` or schema initialization

- **IMPLEMENT**: In the database initialization function (`initDatabase`), add a check that drops the `auth_cache` table if it exists (it's a legacy artifact not in current schema). Use `DROP TABLE IF EXISTS auth_cache` as part of the initialization SQL. This is safe because auth data is stored in AsyncStorage, NOT SQLite.
- **PATTERN**: Reference existing schema initialization in `apps/mobile/src/db/schema.ts`
- **GOTCHA**: Only drop `auth_cache` -- don't touch other tables. This is a one-time cleanup for devices with stale databases from earlier development.
- **VALIDATE**: `cd apps/mobile && pnpm test`

---

## TESTING STRATEGY

### Unit Tests

**Scope**: API guards, module registry validation, auth service responses
**Requirements**:

- Test EntitlementGuard with new decorators on all 6 controllers
- Test /auth/me response includes enabled_modules and license_tier
- Test module-disabled error message format
- **VALIDATION COMMAND**: `cd apps/api && pnpm test`

**Test Categories Required**:

- Happy path: Access enabled module -> 200
- Error case: Access disabled module -> 403 with MODULE_DISABLED code
- Edge case: Empty enabled_modules -> all allowed
- Edge case: SUPERADMIN bypasses all checks

### Integration Tests

**Scope**: End-to-end module gating flow
**Requirements**:

- E2E test: Login -> check sidebar -> access disabled module -> verify 403 handling
- **VALIDATION COMMAND**: `cd apps/api && pnpm test:e2e`

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:

- Shop with `enabled_modules = []` (empty array) -> all modules accessible
- Shop with `enabled_modules = ['auth', 'products']` (STARTER minimal) -> only those accessible
- SUPERADMIN accessing disabled module -> should bypass
- User logging in before this update (no enabled_modules in stored data) -> treat as all allowed
- Credit transaction amount = 0 -> should be rejected
- Cash exit amount > balance -> should be rejected

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/web run lint
pnpm --filter @swalo/mobile run lint
pnpm run format:check
```

**Expected Result**: Zero errors, zero warnings (warnings acceptable)

### Level 2: Type Checking

```bash
pnpm --filter @swalo/api run type-check
pnpm --filter @swalo/mobile run type-check
```

**Expected Result**: No TypeScript errors

### Level 3: Unit Tests

```bash
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
```

**Expected Result**: All tests pass

### Level 4: E2E Tests

```bash
docker compose --profile local up -d postgres
pnpm --filter @swalo/api run test:e2e
```

**Expected Result**: All E2E tests pass

### Level 5: Full Validation

```bash
pnpm run validate
```

**Expected Result**: All 10 tasks pass across all packages

### Level 6: Manual Validation

**Branding:**

- Open web at localhost:3001 -- sidebar shows SWALO logo (not gradient S)
- Open login page -- navy theme, SWALO logo (not purple)
- Check browser tab -- SWALO favicon and title
- Compare with mobile -- visual identity should match

**Module Gating:**

- Login as STARTER user on web -- Fournisseurs/Creances/Dettes grayed out
- Click grayed item -- tooltip/message appears, no navigation
- Login as PROFESSIONAL user -- all items visible
- Login as SUPERADMIN -- all items visible regardless

**Cash Page:**

- Create cash entry on web -- amount correct (not multiplied by 100)
- Create credit sale on web -- receivable created, no cash entry
- Click transaction -- detail modal appears
- Compare journal with mobile -- same transactions visible

---

## ACCEPTANCE CRITERIA

- [ ] Web app uses navy (#0F2A44) as primary color throughout (not sky-blue or purple)
- [ ] SWALO logo displays on web sidebar, login page, and favicon
- [ ] Web login page visually matches mobile login (navy theme, logo, tagline)
- [ ] All 6 premium controllers have @RequireModule decorator
- [ ] /auth/me response includes shop.enabled_modules and enterprise.license_tier
- [ ] Web sidebar grays out modules not in shop's enabled_modules
- [ ] Clicking disabled module shows "licence X ne comprend pas ce module" message
- [ ] Web and mobile 403 errors for disabled modules show user-friendly message
- [ ] Web Cash page supports credit transactions (receivables/debts)
- [ ] Web Cash page has payment mode toggle (cash/credit)
- [ ] Web Cash page has transaction detail modal
- [ ] Web Cash page amounts use integer FCFA (no centimes conversion)
- [ ] Mobile SQLite auth_cache error is fixed
- [ ] ALL validation commands pass with zero errors
- [ ] ALL existing tests still pass (no regressions)
- [ ] Features catalog updated with new implementations

---

## COMPLETION CHECKLIST

- [ ] Phase 1: All branding tasks completed (1.1-1.7)
- [ ] Phase 2: All API security tasks completed (2.1-2.3)
- [ ] Phase 3: All frontend gating tasks completed (3.1-3.6)
- [ ] Phase 4: All cash page tasks completed (4.1-4.5)
- [ ] Phase 5: SQLite bug fix completed (5.1)
- [ ] All validation commands pass (Level 1-5)
- [ ] Manual testing completed and documented
- [ ] `docs/specs/features-catalog.md` updated with module gating and cash page changes
- [ ] Code committed on feature branch and PR created to develop

---

## NOTES

**Architectural Decisions:**

- We keep `enabled_modules = []` as "all allowed" for backwards compatibility -- this avoids a data migration
- Logo is copied as static asset (not inline SVG) to keep it simple and maintainable
- Module gating is done at navigation level (hide/gray items) + API level (403 guard) for defense in depth
- The Cash page centimes bug suggests other pages may have the same issue -- worth auditing after this plan

**Trade-offs:**

- We gray out disabled modules instead of hiding them -- this teaches users about available features and encourages upgrades
- We don't create a shared design token package yet -- that's a larger refactor for later
- Mobile MoreScreen gets basic module filtering, not a full redesign

**Risks:**

- Tailwind color change affects ALL pages -- need thorough visual testing
- Credit transaction logic in Cash page is complex -- risk of amount calculation bugs
- Module gating depends on /auth/me returning new fields -- existing sessions may not have this data until re-login

<!-- EOF -->
