# Plan 031 — Refonte totale de la charte graphique & harmonisation (Swalo)

> Direction validée : **Marine + Sky vif** (SaaS moderne, contrasté, énergique). Marine pour nav/en-têtes, Sky-blue vif pour les actions. Cohérent avec le logo Swalo.

## Problème (diagnostic)

1. **Logos jamais remplacés dans l'app mobile.** Les écrans chargent `apps/mobile/assets/full_icon.png` (login) et `assets/logo.png` (en-têtes via `ScreenHeader`) — la refonte précédente (#24) a remplacé `icon/splash/favicon` (icônes système) mais **pas** ces deux assets → ancien logo visible partout dans l'app.
2. **Palette quasi inchangée.** `#102A43` (marine actuel) ≈ ancien `#0F2A44` → impression de « rien n'a changé ».
3. **Pas de design system unique.** Chaque app a ses tokens/composants en silo : mobile `theme-v2.ts` (StyleSheet), web/web-admin `theme.ts` + `tailwind.config`. Pas de source unique → dérive visuelle, navigation et composants incohérents d'une app à l'autre et d'une page à l'autre.

## Objectif

Un **seul design system Swalo**, source unique dans `packages/core`, décliné proprement sur **mobile / web / web-admin**, sur **toutes les pages** : couleurs repensées (Marine + Sky vif), typographie, espacements, composants, navigation fluide, fonctionnalités accessibles, accessibilité (WCAG AA). Logo Swalo corrigé partout.

---

## 1. Design tokens (source unique — `packages/core/src/brand/`)

Étendre `packages/core/src/brand/tokens.ts` en un set complet, consommé par les 3 apps (web/web-admin via preset Tailwind généré depuis les tokens ; mobile via `theme-v2` généré depuis les tokens). **Une seule modif → propagation partout.**

### Couleurs — échelles complètes (contraste AA vérifié)
- **Marine (primary — nav, en-têtes, marque)** : `950 #07223A` · `900 #0B2A45` (base) · `800 #0F3354` · `700 #16456E` · `600 #1E5688` · `500 #2A6CA8` · `100 #DCE8F3` · `50 #EEF4FA`
- **Sky (action — boutons, liens, focus, états interactifs)** : `700 #0369A1` · `600 #0284C7` · `500 #0EA5E9` (base action) · `400 #38BDF8` (accent) · `300 #7DD3FC` · `50 #EFF9FF`
- **Sémantique** : succès `#10B981` · attention `#F59E0B` · erreur `#EF4444` · info = Sky `#0EA5E9` (+ variantes bg/text par couleur)
- **Neutres (slate)** : texte `#0B1220` / secondaire `#475569` / tertiaire `#64748B` / disabled `#94A3B8` · bordures `#E2E8F0` · fond `#F5F8FC` · surface `#FFFFFF`
- **Sur-marine** (texte/icônes sur fond marine) : `#FFFFFF` / `#CBD8E6`
- **(Optionnel Phase 3) Dark mode** : surfaces marine sombres (`#0A1F33` / `#122B45`), texte `#E5EEF7`, action sky identique.

### Typographie
- Police : système (SF / Roboto / system-ui) — déjà dans le kit.
- Échelle : `display 32/700` · `h1 28/700` · `h2 22/600` · `h3 18/600` · `body 15/400` · `bodyStrong 15/600` · `small 13/400` · `caption 12/500`. Line-height 1.3–1.5.

### Espacements / formes / élévation / motion
- Spacing : `4 / 8 / 12 / 16 / 24 / 32 / 48`.
- Radius : `input 10` · `button 10` · `card 14` · `sheet 20` · `pill 999`.
- Élévation : `sm` (cartes), `md` (menus/modals), `lg` (sheets) — ombres douces basées marine.
- Motion : 150ms ease-out (micro-interactions), 250ms (transitions de page).

**Livrable** : `packages/core/src/brand/tokens.ts` (couleurs/typo/spacing/radius/shadow), + `packages/core/src/brand/tailwind-preset.{cjs,ts}` (preset Tailwind dérivé), consommés par web/web-admin ; `apps/mobile/src/constants/theme-v2.ts` régénéré depuis les tokens.

## 2. Logo & assets de marque (corrige le bug visible)

- Remplacer **`apps/mobile/assets/full_icon.png`** (login) et **`apps/mobile/assets/logo.png`** (en-têtes) par les logos du kit (`brand/png/swalo_horizontal_marine`, `swalo_icone_marine`) — **c'est ça qui faisait persister l'ancien logo**.
- Composant `Logo` unifié (déjà sur web/web-admin) → équivalent RN (`apps/mobile/src/components/ui/Logo.tsx`) variantes `icon`/`horizontal`, `marine`/`blanc`.
- Splash mobile + favicon web/web-admin : déjà OK (kit), revérifier la cohérence (marine `#0B2A45`).
- Icône d'app mobile : un **EAS dev build** est nécessaire pour voir la nouvelle icône (Expo Go montre l'icône Expo) — à intégrer au pipeline EAS.

## 3. Système de composants (langage visuel unifié, adapté par plateforme)

Même tokens, mêmes noms, mêmes comportements ; rendu natif par plateforme.

**Primitives à standardiser (web/web-admin = Tailwind classes + composants React ; mobile = composants RN) :**
- `Button` (variants : primary=sky plein, secondary=marine outline, ghost, danger ; tailles sm/md/lg ; état loading ; ≥44px)
- `Input` / `Select` / `SearchableSelect` (focus ring sky, erreur, label, hint)
- `Card` (radius 14, ombre sm, en-tête optionnel)
- `Badge` / `Chip` (sémantique + neutre)
- `ScreenHeader` / `TopBar` (marine, titre + actions + logo)
- `TabBar` (mobile, bottom) / `Sidebar` (web/web-admin)
- `ListItem` / `DataTable` (web)
- `Modal` / `BottomSheet` (mobile)
- `EmptyState`, `Toast`/`Alert`, `KPICard`, `StatCard`
- Icônes : un seul set (lucide / SimpleIcons existant) avec tailles + couleurs tokenisées.

## 4. Navigation & UX (fluidité + accessibilité des fonctionnalités)

- **Mobile** : bottom tab bar repensée (5 onglets max, icône + label, état actif sky sur marine), en-têtes cohérents (retour, titre, action), accès rapides aux fonctionnalités clés (POS, caisse, stock) ; regrouper le reste dans « Plus » avec sections claires.
- **Web** : sidebar marine + topbar, sections regroupées, breadcrumbs, état actif sky.
- **Web-admin** : déjà aligné (#30) → re-tokeniser sur le nouveau système.
- **Découvrabilité** : libellés FR clairs, icônes cohérentes, modules désactivés grisés + cadenas (déjà en place), CTA primaires en sky.
- **Accessibilité** : contraste AA (texte/sur-marine vérifiés), cibles ≥44px, focus visibles (ring sky), labels/aria (web) + accessibilityLabel (mobile), tailles de police respectant les réglages système.

## 5. Harmonisation — matrice page par page

> Chaque écran/page passe sur les primitives + tokens. Aucun `#hex` en dur, aucun style ad hoc : tout via le thème.

**Mobile (`apps/mobile/src/screens/`)** — Login, Home, POS/Sale, Cash/POSScreen, Stock/StockManagement, Catalog/ProductCatalog/CatalogHierarchy, ProductDetails/Batches, Customers(+Details/Balances), Suppliers(+Details/Balances), Receivables, Debts, Invoices, Transfers, Reports/BusinessReports, ShopAdmin/UserManagement/ShopSettings/ShopSwitcher, Sync(Status/Conflicts), More, settings/*.
**Web (`apps/web/src/pages/`)** — Login, Home/Dashboard, Sale, POS, Products, ProductBatches, Catalog, Stock, Customers(+Details), Suppliers(+Details), Receivables, Debts, Invoices, TransactionHistory, BusinessReports, PackagingTypes, UserManagement, EnterpriseDashboard, ShopSettings, CreateShop.
**Web-admin (`apps/web-admin/src/pages/`)** — Login, DashboardHome, SuperAdminDashboard, AdminEnterprises, AdminShops, AdminGlobalUsers, AuditLogs, LicenseConfig, AdminConfig.

Pour chaque : remplacer couleurs/typo/espacements par tokens, remplacer composants ad hoc par les primitives, vérifier nav + contraste + cibles tactiles.

## 6. Architecture (pour que tout reste harmonisé)

```
packages/core/src/brand/
  tokens.ts            ← source unique (couleurs/typo/spacing/radius/shadow)
  tailwind-preset.cjs  ← dérivé pour web + web-admin (tailwind.config extends preset)
apps/mobile/src/constants/theme-v2.ts  ← dérivé/aligné sur tokens
apps/web /apps/web-admin tailwind.config ← extends le preset
```
Règle : **toute couleur/typo provient des tokens**. Un changement de charte = 1 modif dans `tokens.ts` + rebuild.

---

## Phasage (livrable, à valider page par page)

- **Phase 0 — Fondations + correctif visible (rapide)** : tokens complets dans `packages/core` + preset Tailwind ; **remplacement des logos in-app mobile** (`full_icon.png`, `logo.png`) ; régénération `theme-v2` ; brancher web/web-admin sur le preset. → l'ancien logo disparaît, la palette « Marine + Sky vif » s'applique globalement.
- **Phase 1 — Primitives** : composants partagés (Button/Input/Card/Header/TabBar/Badge/…) dans chaque app, sur tokens.
- **Phase 2 — Déploiement page par page** : mobile screens → web pages → web-admin pages (matrice §5).
- **Phase 3 — Nav & UX & a11y** : refonte navigation (tab bar / sidebar), accessibilité AA, micro-interactions, (option) dark mode.

## Validation
- Builds verts (web, web-admin, mobile type-check), 0 nouvelle warning lint, Prettier OK.
- Revue visuelle sur **téléphone** (Expo) + navigateur, par page.
- Contraste AA (outil), cibles ≥44px, focus visibles.
- `features-catalog.md` §14 (Design) + `docs/design/` mis à jour ; changelog.

## Découpage en PRs (proposé)
1. `feat(design): design tokens + tailwind preset (packages/core)` + correctif logos mobile (Phase 0)
2. `feat(design): primitives mobile` / `feat(design): primitives web` (Phase 1)
3. `refactor(ui): harmonisation pages mobile` · `…web` · `…web-admin` (Phase 2, par lots)
4. `feat(ux): navigation + accessibilité (+ dark mode option)` (Phase 3)

<!-- EOF -->
