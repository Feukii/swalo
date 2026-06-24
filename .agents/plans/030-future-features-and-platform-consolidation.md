# Feature: Future Features Batch + Platform Consolidation (Plan 030)

The following plan should be complete, but it is important that you validate documentation and codebase patterns and task sanity before you start implementing. Pay special attention to naming of existing utils, types and models. Import from the right files (`@swalo/core`, `@prisma/client`, the per-module DTOs).

This plan was produced from 8 parallel codebase-analysis agents (ParaThinker pass). Every claim below carries a real `file:line` reference discovered during that audit — verify it still holds before editing.

## Feature Description

A batch of "Futur" features from `docs/specs/features-catalog.md` §16 plus two directly-requested changes and a platform-structure consolidation:

**Directly requested**

1. **Alphanumeric shop code** — the boutique `code` may now contain letters AND digits (was numeric "6 chiffres").
2. **Enterprise PDG consolidated view** — an enterprise owner (PDG) needs a general report across all their shops + a financial-health recap per shop.

**"OK"-flagged features to implement** (the `ok` items in the request): low-stock email alerts, payment reminders, receipt/ticket printing, WhatsApp notifications, tablet mode, web offline (IndexedDB). _(Scan code-barres, Multi-devises, Projections financières are NOT flagged `ok` → out of scope for this plan.)_

**Platform structure to verify/strengthen** (3 surfaces):

- **A** — client mobile app + web duplicate (with client-side self-service admin for access/role autonomy).
- **B** — desktop/web accounting app: enterprise accounting (stock verification, **OHADA accounting**, report exports). **Currently absent.**
- **C** — SWALO super-admin platform (license management, client traceability, connected-users count).

**Mandatory docs update:** `docs/specs/features-catalog.md` and `docs/architecture/overview.md`.

## User Story

- As a **PDG (enterprise owner, role `BOSS`)**, I want a consolidated financial view across all my shops, so that I can monitor each boutique's health from one place.
- As a **shop owner/manager**, I want automatic low-stock email alerts and payment reminders, WhatsApp notifications, and to print a sale receipt, so that I run the shop with less manual effort.
- As a **cashier on a tablet**, I want a layout that uses the larger screen, so that selling is faster.
- As a **web user with flaky internet**, I want the web app to keep working offline, so that I do not lose sales.
- As the **SWALO boss (`SUPERADMIN`)**, I want to manage licenses and see who is connected and what clients are doing, so that I can operate the platform.

## Problem Statement

Several high-value capabilities are listed as "Futur" and not built; the shop code format is too restrictive; enterprise owners have no cross-shop financial view; the accounting (OHADA) surface does not exist; and the super-admin platform lacks live-connection and client-traceability signals. The architecture docs are stale and under-document the as-built system.

## Solution Statement

Build a small **shared foundation first** (notification channel abstraction + `NotificationLog`; shared receipt + sync contracts in `packages/core`), then deliver each feature as an independent workstream that reuses existing modules (`notifications`, `enterprise`, `reports`, `invoices`, `admin`/`admin-controls`, mobile `db/` offline stack). Phase the two large domains (OHADA accounting, full web-offline) as separate tracks. Keep all changes scoped by `shop_id`/`enterprise_id`, FCFA integers, and the existing offline idempotency model `(device_id, client_op_id)`.

## Feature Metadata

**Feature Type**: Mixed — New Capabilities (notifications channels, printing, web-offline, OHADA, PDG report) + Enhancement (shop code, tablet) + Doc refresh.
**Estimated Complexity**: **High** (multi-app, multi-domain; OHADA and web-offline are each large on their own).
**Primary Systems Affected**: `apps/api` (auth, enterprise, reports, notifications, invoices, admin-controls, + new `accounting`), `apps/mobile`, `apps/web`, `apps/web-admin`, new `apps/web-accounting`, `packages/core`.
**Dependencies**: transactional email provider (SMTP — existing), WhatsApp provider (Twilio/Meta), Dexie + vite-plugin-pwa (web), an ESC/POS RN printer lib (mobile dev build), SYSCOHADA chart of accounts (OHADA, accountant validation).

---

## CONTEXT REFERENCES

### Relevant Codebase Files — READ THESE BEFORE IMPLEMENTING

**Shop code (WS-1)**

- `apps/api/prisma/schema.prisma:39` — `Shop.code String @unique @db.VarChar(10)` (already String; no migration needed for charset).
- `apps/api/src/modules/auth/dto/auth.dto.ts:48` — `PinLoginDto.shop_code @Length(6,6)` — **the hard gate that breaks login for non-6-char codes**. Also `RegisterDto.shop_code:19` (only `@IsString()`).
- `apps/api/src/modules/auth/auth.service.ts:229` (`loginWithPin`, exact-match lookup, case-sensitive), `:460` & `:642` & admin `:624` (numeric code generators), `:760` (`verifyShopExists`).
- `apps/api/src/modules/admin/dto/create-shop-admin.dto.ts:10` — `shop_code` optional `@IsString()`.
- `packages/core/src/schemas/shop.ts:10-14` — already `z.string().min(2).max(10).regex(/^[A-Z0-9]+$/)` (latent, not wired into login).
- `apps/mobile/src/screens/LoginPinScreen.tsx:97,174,210,216,217,220,246` — length guards, `keyboardType="numeric"`, `[^0-9]` filter, labels.
- `apps/web/src/pages/LoginPin.tsx:18,36,56,90,94-95,99,134` — same assumptions on web.
- `apps/mobile/src/db/authCache.ts` + `schema.ts:46` — offline PIN cache uses `shop_code` as the **hash salt** (`hashPin(pin, shopCode)`) and as case-sensitive SQL key.
- `apps/web-admin/src/pages/AdminShops.tsx:516-526` — shop_code input `maxLength={6}`, `pattern="[0-9]{6}"`.
- `apps/api/src/modules/invoices/invoices.service.ts:33,47` — invoice number prefix `${shop.code}-${year}-`; do not allow `-` in shop codes.

**PDG enterprise report (WS-2)**

- `apps/api/src/modules/enterprise/enterprise.service.ts:299-363` (`getStats`, enterprise-wide totals only), `:264-294` (`getShops`), `:55-86` & `:314` (ownership check `owner_id === userId`).
- `apps/api/src/modules/enterprise/enterprise.controller.ts:59-64` (`GET /enterprises/:id/stats`).
- `apps/api/src/modules/reports/reports.service.ts:125-191` (`getCashReport` — the per-shop cash_balance/receivables/debts logic to reuse), `:78-94` (`getStockReport` stock value + low-stock), `:12,196` (sales/overview). `reports.module.ts` has **no `exports`** — must export `ReportsService`.
- `apps/api/prisma/schema.prisma` — `Enterprise.owner_id:15,30`, `Shop.enterprise_id:47`, financial entities (Sale `:491`, CashEntry `:632`, ClientReceivable `:330`, SupplierDebt `:399`, StockBatch `:196`); useful indexes `Sale @@index([shop_id, created_at])`, `CashEntry @@index([shop_id,type,created_at])`, `ClientReceivable @@index([shop_id,status])`, `SupplierDebt @@index([shop_id,status])`.
- `apps/api/src/common/strategies/jwt.strategy.ts:7-10,39-43` — JWT carries `{ sub, shopId }` → validate returns `{ userId, shopId, role }`. **No `enterpriseId` in token** → re-verify ownership per request.
- `apps/web/src/pages/EnterpriseDashboard.tsx` + `apps/web/src/lib/api.ts` (~`:589` `enterpriseApi`) — the PDG dashboard host.
- `apps/api/src/common/guards/entitlement.guard.ts` — `@RequireModule('enterprise')` keys off the **active shop's** `enabled_modules` (edge case for a PDG; see GOTCHA in WS-2).

**Notifications foundation + email (WS-0, WS-3)**

- `apps/api/src/modules/notifications/notifications.module.ts:16,17-44` — `ScheduleModule.forRoot()` + `MailerModule.forRootAsync` (SMTP via `@nestjs-modules/mailer` + Handlebars).
- `apps/api/src/modules/notifications/notifications.service.ts:31,65-304,235` — only consumer of `MailerService`; mixes data assembly + delivery; only feature = monthly customer summary.
- `apps/api/src/modules/notifications/notifications.scheduler.ts:15` — single `@Cron('0 8 1 * *')`.
- `apps/api/src/modules/notifications/notifications.controller.ts:31` — `POST /notifications/monthly-summary/trigger` (`@RequireModule('notifications')`, `@Roles(SUPERADMIN, BOSS)`).
- `apps/api/src/modules/notifications/templates/monthly-summary.hbs` — only template.
- `apps/api/.env.example:14-20` — `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`.
- `.github/workflows/keep-alive.yml` — existing external GitHub-Actions cron pattern (pings Render).
- Low-stock read-side already exists: `apps/api/src/modules/products/products.service.ts:202,465,488,538` (`is_low_stock`, `getLowStockProducts`). Stock decrement: `apps/api/src/modules/sales/sales.service.ts:301-332,495`.
- `apps/api/prisma/schema.prisma` — `Product.alert_threshold Int @default(5):172`, `ClientReceivable:330` (**no `due_date`**), `Customer.email/phone/email_notifications_enabled:308,307,313`, `Shop.email/phone/owner_id` (no notification config). **No `NotificationLog` model.**

**WhatsApp (WS-4)**

- Same `notifications` module (no channel abstraction today; `MailerService` hardwired at `notifications.service.ts:235`). No messaging integration anywhere.
- `packages/core/src/utils/phone.ts` + `apps/mobile/src/utils/phone.ts` — duplicated **Cameroon-only** helpers (`+237`, regex `^[62]\d{8}$`); not E.164, not multi-country.
- Phone fields all nullable/unvalidated: `Shop.phone:42`, `User.phone:88`, `Customer.phone:307`, `Supplier.phone:378`.

**Printing (WS-5)**

- `apps/api/src/modules/invoices/pdf-generator.service.ts:15-54,103,139` — pdfmake **A4** invoice; `InvoicePdfData`.
- `apps/api/src/modules/invoices/invoices.service.ts:19,57,297` — invoice number, `createFromSale` (COMPLETED only), PDF base64 in `invoice.pdf_data`.
- `apps/mobile/package.json` — `expo-print`, `expo-sharing` already installed (no Bluetooth/ESC-POS).
- `apps/mobile/src/utils/invoiceTemplate.ts` (`generateInvoiceHTML`, A4), `apps/mobile/src/utils/pdfGenerator.ts` (`printInvoice`/`shareInvoicePDF`/`showInvoiceActions`).
- `apps/mobile/src/screens/SaleScreen.tsx:423,441,467-491` — post-sale `Alert` with "Facture" using a provisional number `${shop.code}-${year}-PROV`; tax/discount hardcoded 0 here.
- `apps/web/src/pages/Invoices.tsx:79-91` — web "print" = open A4 base64 PDF in iframe.
- `Enterprise.logo_url` exists (`schema.prisma:20`); `Shop` has **no `logo_url`**.

**Tablet + web offline (WS-6, WS-7)**

- `apps/mobile/src/constants/theme-v2.ts` — `Spacing/Typography/TouchTargets`, **no `Breakpoints`**; `apps/mobile/app.config.ts:12` orientation locked `portrait`, `ios.supportsTablet:true:22`.
- `apps/mobile/src/navigation/MainTabNavigator.tsx` — 5-tab bar; no master-detail.
- POS/list screens to adapt: `SaleScreen.tsx` (grid `flex:2` width `23%` ~line 931 + cart `flex:1`), `POSScreen.tsx`, `ProductCatalogScreen.tsx`, `CatalogHierarchyScreen.tsx`, customer/supplier list+detail pairs.
- Mobile offline contract to mirror: `apps/mobile/src/db/schema.ts` (SQLite v5, 21 entities, `_sync_status/_mutation_queue/_sync_conflicts/_sync_meta`), `queue.ts` (priority CRITICAL/IMPORTANT/NORMAL), `offlineWrite.ts`, `sync.ts` (`fullSync` push→pull, `POST /sync/push`, `POST /sync/pull`, `GET /sync/status`, batch ≤100, conflict policy), `authCache.ts`, `maintenance.ts`.
- Web data layer: `apps/web/src/lib/api.ts` (Axios; already has `getBrowserDeviceId()` + `generateClientOpId()`; cash/sale POSTs already send `device_id`+`client_op_id`), `apps/web/src/store/authStore.ts` (manual localStorage, no `persist`). **No PWA/IndexedDB/SW anywhere.**
- `packages/core/src/schemas/sync.ts` — shared Zod sync envelopes BUT field-name drift vs REST (`clientID/baseCursor/entityVersions` vs `device_id/base_cursor/last_sync_at/entity_versions`) — **reconcile before sharing**. `schemas/common.ts` `SyncFields`. `utils/{currency,calculations,date,validation,phone}`.

**Super-admin (WS-8)**

- `apps/web-admin/src/App.tsx` + pages (`AdminEnterprises`, `AdminShops`, `AdminGlobalUsers`, `AuditLogs`, `LicenseConfig`, `AdminConfig`, `SuperAdminDashboard`).
- `apps/api/src/modules/admin/admin.controller.ts` (license `PUT enterprises/:id/license:` , license-config `:112-125`, global users `:159-173`, audit CSV `:221-240`, shop-scoped admin `:243-311`).
- `apps/api/src/modules/admin-controls/admin-controls.service.ts:325-362` (`getEnhancedSystemStats` — counts, "active" = flag not session), `.controller.ts:67,90,97-109` (audit, stats, per-shop modules).
- `apps/api/prisma/schema.prisma` — `UserDevice.last_login_at:142` (only "connected" signal; not aggregated), `AuditLog:851-867` (keyed to `admin_id`; SUPERADMIN actions only — **no shop-scoped client trace**), `Enterprise.license_tier/licensed_until/max_shops/max_users_per_shop:21-24`, `Shop.enabled_modules:53`. **No `Session`/`RefreshToken` table.**
- `apps/api/src/modules/payments/` — **stub** (only `payments.module.ts`).
- `packages/core/src/modules/registry.ts` — `MODULE_DEFINITIONS`, tiers, `EntitlementGuard` enforcement.

**OHADA accounting (WS-9) — ABSENT today**

- Confirmed no accounting models/modules anywhere; `reports` module is JSON aggregations only (no CSV/Excel/PDF export); only export in API is the super-admin audit CSV.

**Docs (WS-10)**

- `docs/specs/features-catalog.md` — header version block (top), 19 sections + TOC, §16 "Fonctionnalités planifiées" table, §17 platform matrix, §18 modular classification (licence plan counts STARTER 12 / PRO 17 / ENTERPRISE 18), §19 role matrix, `## Historique des mises à jour` changelog (prepend newest row, `Auteur = Claude Code`), ends `<!-- EOF -->`. Per-feature block format = `### N.M Title` + 2-col property table with `**Description**/**Plateformes**/**Module**/**Fichiers clés**/**Statut**`.
- `docs/architecture/overview.md` — **badly stale**: monorepo tree lists only core/api/mobile/web (mobile/web "(à créer)"), missing `apps/web-admin`; wrong roles (`OWNER,MANAGER,CASHIER`); wrong currency ("centimes"); wrong stacks (WatermelonDB/SQLCipher, RxDB/TanStack/shadcn, Supabase/Cloudflare).

### New Files to Create

- `apps/api/src/modules/notifications/channels/notification-channel.interface.ts`, `email.channel.ts`, `whatsapp.channel.ts` — channel abstraction (WS-0/3/4).
- `apps/api/src/modules/notifications/providers/whatsapp.provider.ts` — Twilio/Meta adapter (WS-4).
- `apps/api/src/modules/notifications/templates/low-stock-alert.hbs`, `payment-reminder.hbs` (WS-3).
- `apps/api/src/modules/notifications/whatsapp-webhook.controller.ts` — delivery status / verify token (WS-4).
- `apps/api/prisma/migrations/<ts>_notifications_due_date_alphanum/*` — `NotificationLog` model, Shop notification settings, `ClientReceivable.due_date`, notification opt-in fields (WS-0/3/4).
- `packages/core/src/receipts/receipt-template.ts` (+ `ReceiptData` type) — shared narrow ticket template (WS-5).
- `apps/mobile/src/utils/escposPrinter.ts` — Bluetooth ESC/POS builder (WS-5, dev-build only).
- `apps/mobile/src/hooks/useResponsive.ts` + `apps/mobile/src/components/layout/MasterDetail.tsx` (WS-6).
- `apps/web/src/db/*` (Dexie schema, repositories, offlineWrite, sync adapter), `apps/web/src/hooks/useOnlineStatus.ts`, `useSyncStatus.ts`, `apps/web/public/manifest.json`, `apps/web/src/pages/SyncConflicts.tsx` (WS-7).
- `packages/core/src/sync/*` — storage-agnostic sync engine core + adapter interface (WS-7).
- `apps/api/src/modules/accounting/*` + `apps/web-accounting/` (new app) + accounting Prisma models (WS-9, separate track).

### Relevant Documentation — READ BEFORE IMPLEMENTING

- @nestjs-modules/mailer: https://nest-modules.github.io/mailer/ (WS-3)
- @nestjs/schedule (cron): https://docs.nestjs.com/techniques/task-scheduling (WS-3)
- Resend SMTP (recommended email provider): https://resend.com/docs/send-with-smtp (WS-3)
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api ; send messages: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages ; templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates ; pricing: https://developers.facebook.com/docs/whatsapp/pricing (WS-4)
- Twilio WhatsApp + sandbox: https://www.twilio.com/docs/whatsapp ; https://www.twilio.com/docs/whatsapp/sandbox ; Content API (templates): https://www.twilio.com/docs/content (WS-4)
- expo-print: https://docs.expo.dev/versions/latest/sdk/print/ ; expo-sharing: https://docs.expo.dev/versions/latest/sdk/sharing/ (WS-5)
- react-native-esc-pos-printer (Epson, maintained): https://github.com/tr3v3r/react-native-esc-pos-printer ; generic ESC/POS: https://github.com/januslo/react-native-bluetooth-escpos-printer (WS-5)
- Dexie.js (IndexedDB): https://dexie.org/ ; MDN IndexedDB (quotas/eviction): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API (WS-7)
- vite-plugin-pwa (Workbox): https://vite-pwa-org.netlify.app/ (WS-7)
- expo-screen-orientation: https://docs.expo.dev/versions/latest/sdk/screen-orientation/ (WS-6)
- OHADA / SYSCOHADA Révisé (plan comptable, Acte uniforme 2018): https://www.ohada.org/ (WS-9 — validate seeded plan with a CEMAC accountant)
- Prisma migrations: https://www.prisma.io/docs/orm/prisma-migrate (all DB work)

### Patterns to Follow

**Naming Conventions** — English code identifiers, French user-facing strings/comments (CLAUDE.md). Endpoints kebab/REST under module prefix (`/enterprises/:id/...`, `/notifications/...`). DTOs in `module/dto/*.dto.ts` with class-validator. Mirror the typed-request pattern already used in controllers (`@CurrentUser()` / `Request & { user: {...} }`) — established across `admin`, `import`, `cash` controllers.

**Money** — ALWAYS integer FCFA, never floats/centimes. Reuse `packages/core/src/utils/currency`. Divisions (averages) use `Math.round` (see `reports.service.ts:47`). `SaleItem.qty` is `Float` (units) — fine; stock value uses Int `cost_price`.

**Multi-tenancy / scoping** — every query scoped by `shop_id` (from JWT) or, for enterprise endpoints, by `enterprise_id` derived server-side from an ownership-verified `Enterprise` (never trust client-supplied shop lists). Soft-delete pattern `deleted=false`.

**RBAC** — actual `Role` enum = `EMPLOYEE | MANAGER | BOSS | SUPERADMIN` (`schema.prisma:778`). PDG = `BOSS`. `@Roles(...)` + `RolesGuard`; `@RequireModule(...)` + `EntitlementGuard` for licensed modules; SUPERADMIN bypasses both. **Fix the `OWNER` vs `BOSS` inconsistency** in `apps/web/src/App.tsx:255,263`.

**Offline idempotency** — `(device_id, client_op_id)` unique; optimistic local write → mutation queue → sync. Reuse exact format `{prefix}_{deviceId}_{Date.now()}_{rand}`. Web already generates both keys.

**Error handling / logging** — NestJS exceptions (`BadRequestException`, `ForbiddenException`, `NotFoundException`); narrow `catch (error: unknown)` with `instanceof Error`. Notifications must not throw into the sale/transaction path — use scheduled scans + `NotificationLog`, not inline hooks.

**Validation** — class-validator DTOs (server) + Zod in `packages/core` (shared). Single source for shop-code rule: align `packages/core/src/schemas/shop.ts` and wire it.

---

## IMPLEMENTATION PLAN

### Phase 0 — Foundation (shared, do first)

Notification channel abstraction + `NotificationLog` + opt-in/config fields + multi-country phone E.164 in `packages/core`. Reconcile `packages/core/src/schemas/sync.ts` field names with live `/sync/*` endpoints. Fix the role-string inconsistency (`OWNER`→`BOSS`) and correct stale role list in CLAUDE.md/MEMORY.

### Phase 1 — Quick, low-risk wins

WS-1 Alphanumeric shop code; WS-2 PDG enterprise financial-summary; WS-6 Tablet mode; WS-3 email alerts + reminders (build on existing SMTP + scheduler).

### Phase 2 — Channel + device features

WS-4 WhatsApp channel (provider-agnostic, Twilio sandbox first); WS-5 receipt printing (Phase A: shared template + expo-print/web `window.print` fallbacks that work in Expo Go; Phase B: ESC/POS Bluetooth in an EAS dev build, Android-first).

### Phase 3 — Large tracks (separate, phased)

WS-7 Web offline (PWA shell → read cache → sales/cash writes → rest); WS-8 super-admin gaps (connected-users metric, shop-scoped client trace, license-expiry job); WS-9 OHADA accounting (new app + module; plan comptable → auto-posted journals → grand-livre/balance → états/exports).

### Phase 4 — Docs

WS-10 update `features-catalog.md` (move §16 rows to their sections + §17 matrix + §18/§19) and refresh `overview.md`.

---

## STEP-BY-STEP TASKS

Execute in order. Each task is functional only (NO code). `VALIDATE` commands assume Docker Postgres is up: `docker compose --profile local up -d postgres`.

### WS-0 — FOUNDATION

#### UPDATE apps/api/prisma/schema.prisma (+ migration)

- **IMPLEMENT**: Add `NotificationLog` model (`shop_id`, `type` enum `LOW_STOCK|PAYMENT_REMINDER|MONTHLY_SUMMARY|RECEIPT`, `channel` enum `EMAIL|WHATSAPP`, `target_type`, `target_id`, `recipient`, `status`, `sent_at`, dedup key + index). Add per-shop notification settings (fields on `Shop` or a `ShopNotificationSettings` table: `low_stock_alerts_enabled`, `payment_reminders_enabled`, `notification_email`, reminder cadence days). Add `ClientReceivable.due_date DateTime?`. Add `Customer.whatsapp_notifications_enabled` (+ optional consent fields).
- **PATTERN**: existing soft-delete + index conventions in `schema.prisma`; migrations in `apps/api/prisma/migrations/`.
- **DEPENDENCIES**: Prisma. **GOTCHA**: never run migrate against production (seed/migrate guards exist). Generate client after.
- **VALIDATE**: `cd apps/api && pnpm prisma:migrate && pnpm prisma:generate && pnpm run type-check`
- **TEST_REQUIREMENT**: schema compiles; client types include new fields.

#### CREATE notification channel abstraction

- **IMPLEMENT**: A `NotificationChannel` interface (`send(recipient, payload) → DeliveryResult`); refactor `NotificationsService` to split **content assembly** (build channel-neutral payloads) from **delivery** (dispatch to enabled channels per recipient opt-in), writing a `NotificationLog` row per attempt (dedup). Implement `EmailChannel` wrapping the existing `MailerService` so current monthly summary keeps working unchanged.
- **PATTERN**: `notifications.service.ts:65-304` (existing assembly); `notifications.module.ts` providers.
- **GOTCHA**: do not regress the monthly-summary behavior/tests.
- **VALIDATE**: `cd apps/api && pnpm jest path/to/notifications*.spec.ts && pnpm run lint`
- **TEST_REQUIREMENT**: existing monthly-summary test still passes; new dispatch unit test with a mock channel.

#### UPDATE packages/core phone utils → multi-country E.164

- **IMPLEMENT**: Generalize the Cameroon-only helpers to E.164 across Central-African codes (237/241/242/243/235/236/240); de-duplicate the mobile copy to import from core; keep display formatting separate from API-ready digits.
- **DEPENDENCIES**: consider `libphonenumber-js`. **GOTCHA**: do not infer country from currency (`XOF` default ≠ Central Africa).
- **VALIDATE**: `pnpm --filter @swalo/core run test` (add cases per country code).

#### UPDATE packages/core/src/schemas/sync.ts field-name reconciliation

- **IMPLEMENT**: Align the Zod sync envelopes with the live REST payloads (`device_id`, `base_cursor`, `last_sync_at`, `entity_versions`) so both mobile and a future web client validate the real contract.
- **PATTERN**: live shapes in `apps/mobile/src/db/sync.ts`; server `apps/api/src/modules/sync/*`.
- **VALIDATE**: `pnpm --filter @swalo/core run type-check && pnpm --filter @swalo/api run type-check`

#### UPDATE role-string consistency

- **IMPLEMENT**: Replace stray `OWNER` with `BOSS` in `apps/web/src/App.tsx:255,263` (and audit web/web-admin for other `OWNER` literals). Correct the stale role list in `CLAUDE.md` and `MEMORY.md` to `EMPLOYEE|MANAGER|BOSS|SUPERADMIN`.
- **VALIDATE**: `pnpm --filter @swalo/web run lint && pnpm --filter @swalo/web run build`

### WS-1 — ALPHANUMERIC SHOP CODE

#### UPDATE shop-code validation (server + core, single source)

- **IMPLEMENT**: Define policy `^[A-Z0-9]{4,10}$`, uppercase-normalized. Apply in `PinLoginDto` (replace `@Length(6,6)`), `RegisterDto`, `CreateShopAdminDto`, and align `packages/core/src/schemas/shop.ts`. Add a shared `shopCode` normalizer/regex in `packages/core` and reuse it.
- **GOTCHA**: disallow `-` (protects invoice-number parsing at `invoices.service.ts:47`).
- **VALIDATE**: `cd apps/api && pnpm run type-check && pnpm jest` (add DTO + login specs; none exist for auth yet).

#### UPDATE server normalization + generators

- **IMPLEMENT**: Uppercase the code at every lookup (`loginWithPin:236`, `verifyShopExists:760`) and before persisting/generating. Switch generators (`auth.service.ts:460,642`, `admin.service.ts:624`) to an `[A-Z0-9]` alphabet, keep the `while(!isUnique)` loop.
- **GOTCHA**: **case sensitivity is the #1 risk** — Postgres `@unique` and offline SQLite lookups are case-sensitive; uppercase-on-write everywhere prevents login failures and case-duplicate rows.
- **VALIDATE**: `cd apps/api && pnpm run test && pnpm run lint`

#### UPDATE clients (mobile + web + web-admin)

- **IMPLEMENT**: Mobile `LoginPinScreen.tsx` — `keyboardType` `numeric`→`default`/`visible-password`, filter `[^A-Za-z0-9]`+uppercase, `maxLength=10`, relax `length===6` guards/auto-submit (trigger on explicit submit / PIN completion), update labels. Web `LoginPin.tsx` — drop `inputMode/pattern` numeric, uppercase+filter, `maxLength=10`, relax guards/labels. `AdminShops.tsx` create-shop input — label/`maxLength=10`/pattern alphanumeric, don't strip letters. Ensure mobile uppercases **identically before caching and before offline verify** (`authCache.ts`) so the PIN-hash salt matches.
- **GOTCHA**: offline login breaks if client normalization differs between cache-write and offline-verify.
- **VALIDATE**: `pnpm --filter @swalo/mobile run type-check && lint`; `pnpm --filter @swalo/web run build`; manual: log in with a mixed-case alphanumeric code, online and offline.

### WS-2 — PDG ENTERPRISE FINANCIAL SUMMARY

#### REFACTOR reports for reuse + UPDATE enterprise module

- **IMPLEMENT**: `export ReportsService` from `reports.module.ts`; import `ReportsModule` into `EnterpriseModule`. Add `getFinancialSummary(enterpriseId, userId, isSuperAdmin, {start_date,end_date})` returning `{ enterprise: <rollup>, per_shop: [{shop, revenue, cash_balance, net_cash_flow, receivables_outstanding, supplier_debts, stock_value, low_stock_count, health_score}], period }`. Health metrics defined in agent-2 findings; `health_score = cash_balance + receivables + stock_value − debts` (FCFA Int). Add `GET /enterprises/:id/financial-summary` (`@Roles(BOSS, SUPERADMIN)`, `@RequireModule('enterprise')`).
- **PATTERN**: reuse `getCashReport`/`getStockReport`/`getSalesReport`; ownership check mirrors `getStats` (`enterprise.service.ts:314`); derive `shopIds` from `enterprise.shops`.
- **GOTCHA (entitlement)**: `@RequireModule('enterprise')` keys off the **active shop**; a PDG whose current shop lacks the module would be 403'd from their own dashboard. Decide: key the check off enterprise ownership, OR ensure owner shops have the module. Flag in PR.
- **PERF**: prefer `groupBy(['shop_id'])` over `{shop_id:{in:shopIds}}` (≈5 queries total) rather than N×queries; indexes are favorable. Mind Neon/Render cold start.
- **GOTCHA (timezone)**: `new Date(start_date)` is UTC; shops are WAT/CAT (UTC+1/+2). Define a date convention (recommend client sends explicit ISO instants); label all-time `cash_balance` vs period metrics clearly.
- **VALIDATE**: `cd apps/api && pnpm jest enterprise*.spec.ts && pnpm run test:e2e` (with Postgres up).
- **TEST_REQUIREMENT**: ownership rejection (403 cross-tenant), shopIds derived server-side, per-shop math, sum(per_shop)==rollup, empty-enterprise zeros, entitlement fix verified.

#### UPDATE web EnterpriseDashboard

- **IMPLEMENT**: Add `enterpriseApi.getFinancialSummary(id, filters)` in `apps/web/src/lib/api.ts`; render a per-shop financial-health table + date-range filter on `EnterpriseDashboard.tsx`.
- **VALIDATE**: `pnpm --filter @swalo/web run build`; manual: PDG sees only their enterprise's shops with health metrics.

### WS-3 — EMAIL: LOW-STOCK ALERTS + PAYMENT REMINDERS

#### ADD low-stock scan + reminder scan to notifications

- **IMPLEMENT**: `scanLowStockForAllShops` — per shop with alerts enabled, find products with on-hand ≤ `alert_threshold` (reuse `getLowStockProducts`), send ONE digest email to the resolved recipient (`Shop.notification_email` → `Shop.email` → owner `User.email`); dedup via `NotificationLog` (one alert per product per low-episode; clear when stock recovers). `scanPaymentRemindersForAllShops` — receivables `status IN (PENDING,PARTIAL)`, `balance>0`, `deleted=false`, past `due_date`; email `customer.email` gated by `email_notifications_enabled`; cadence (due+1, then every 7d, max N) via `NotificationLog`; skip customers without email. Add `low-stock-alert.hbs` + `payment-reminder.hbs`. Add manual-trigger endpoints mirroring the monthly pattern.
- **PATTERN**: `notifications.scheduler.ts` `@Cron`, `notifications.controller.ts:31` trigger pattern, `@RequireModule('notifications')`.
- **GOTCHA (Render cron)**: in-process `@Cron` does NOT fire while the free dyno sleeps. Trigger the scans via an **external GitHub-Actions cron** (mirror `.github/workflows/keep-alive.yml`) hitting secured trigger endpoints.
- **DEPENDENCIES**: existing SMTP mailer. **RESOURCES**: Resend SMTP (deliverability), @nestjs/schedule.
- **VALIDATE**: `cd apps/api && pnpm jest notifications*.spec.ts && pnpm run test:e2e`
- **TEST_REQUIREMENT**: correct selection, recipient resolution order, dedup (no second send when log exists), opt-in gating, missing-email skip; e2e on trigger endpoints with mocked mailer asserts `NotificationLog` rows + role/module guards.

### WS-4 — WHATSAPP CHANNEL

#### CREATE WhatsApp channel + provider adapter + opt-in

- **IMPLEMENT**: `WhatsAppChannel` implementing `NotificationChannel`, backed by `WhatsAppProvider` (env-selected Twilio vs Meta). Add config/secrets to `.env.example` + Render (Meta: `WHATSAPP_PROVIDER/PHONE_NUMBER_ID/ACCESS_TOKEN/WABA_ID/VERIFY_TOKEN`; Twilio: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM`). Add a delivery-status/verify webhook controller. Register a fixed catalog of approved **templates** (e.g. `payment_reminder_fr`, `receipt_fr`, `monthly_summary_fr`) — business-initiated messages REQUIRE pre-approved templates. Use the multi-country E.164 normalizer for recipients. Add `whatsapp_notifications_enabled` opt-in to customer forms (mobile/web).
- **PATTERN**: channel abstraction from WS-0; secret handling mirrors SMTP env.
- **GOTCHA**: template approval lead time (hours–days); 24h session window; per-message cost; new-WABA daily caps; verify Meta/Twilio current pricing & limits against the linked docs at build time.
- **DEPENDENCIES/RESOURCES**: Meta Cloud API + Twilio WhatsApp docs (links above).
- **VALIDATE**: `cd apps/api && pnpm jest` (provider fully mocked); manual end-to-end via Twilio sandbox before any prod number.
- **TEST_REQUIREMENT**: E.164 normalizer across all country codes; channel-selection/opt-in logic; webhook signature/verify-token handling with fixtures; NO real messages in CI.

### WS-5 — RECEIPT / TICKET PRINTING

#### CREATE shared receipt template in packages/core

- **IMPLEMENT**: `ReceiptData` type + `generateReceiptHTML(data, {widthMm})` (58/80mm), monospace/ASCII-friendly so the same data also drives an ESC/POS command builder. Distinct from the A4 invoice. Header (shop name/address/phone, optional enterprise logo), datetime, cashier, optional customer, line items, totals, payment method, footer. Reuse `currency`/`calculations` from core.
- **VALIDATE**: `pnpm --filter @swalo/core run test` (58mm + 80mm, with/without customer/discount/credit).

#### Phase A — UPDATE mobile + web fallback printing (works in Expo Go now)

- **IMPLEMENT**: Split `SaleScreen.tsx` post-sale action into "Imprimer le reçu" (ticket, client-side/offline) vs "Générer une facture" (invoice, server). Add ticket print/share entry points in `pdfGenerator.ts` using `expo-print` of the new narrow template. Web: add `window.print()` of the HTML ticket (`@page size: 80mm`) alongside the existing A4 PDF popup.
- **VALIDATE**: `pnpm --filter @swalo/mobile run test`; manual print-to-PDF on device; web print preview.

#### Phase B — CREATE ESC/POS Bluetooth (EAS dev build, Android-first)

- **IMPLEMENT**: `escposPrinter.ts` (pairing + ESC/POS commands from `ReceiptData`); register the printer lib config-plugin + Bluetooth permissions in `app.config.ts`; optional printer-settings screen (paper width, selected printer).
- **GOTCHA**: ESC/POS Bluetooth is a **native module — NOT available in Expo Go**; needs EAS/dev client. iOS Bluetooth printing needs the currently-absent Apple credentials (commit `3e21357`, branch `fix/ci-mobile-android-only`) → ship **Android-first**. Cheap clone printers vary in ESC/POS dialect (may need the generic lib as a 2nd adapter); 58 vs 80mm differ in chars/line; logo needs bitmap conversion + offline caching.
- **DEPENDENCIES/RESOURCES**: react-native-esc-pos-printer / januslo generic (links above).
- **VALIDATE**: physical 58/80mm Bluetooth printer via EAS dev build (cannot test in CI/Expo Go): connect, reprint, airplane-mode (offline), long item list.

### WS-6 — TABLET MODE

#### ADD responsive foundation + master-detail layouts (mobile)

- **IMPLEMENT**: Add `Breakpoints` to `theme-v2.ts` (phone 0 / tablet ≥768 / large ≥1024); a single `useResponsive()` hook on `useWindowDimensions()` → `{width, isTablet, isLandscape, columns}`. Unlock orientation in `app.config.ts` (`portrait`→`default`/`sensor`; optionally lock phones via `expo-screen-orientation` keyed on `isTablet`); add Android large-screen support. Branch layout inside existing screens on `isTablet` (reuse item components): `SaleScreen` products|cart side-by-side (60/40) + more columns; Catalog/Products and Customers/Suppliers as list+detail two-pane; `POSScreen`/Reports wider grids. Optional later: tab bar → side rail on tablet.
- **GOTCHA**: unlocking orientation exposes layout bugs on ALL phone screens; mid-sale rotation in POS risks state/scroll resets. Keep ≥44 touch targets.
- **VALIDATE**: `pnpm --filter @swalo/mobile run type-check && lint && test`; manual on iPad + large Android emulator + split-screen + rotation.

### WS-7 — WEB OFFLINE (PWA + IndexedDB) — phased

#### Phase A — PWA shell

- **IMPLEMENT**: Add `vite-plugin-pwa` + `manifest.json` + SW registration; precache app shell; installable; offline route handling (no data sync yet). Adopt `zustand/middleware persist` for auth/UI state.
- **GOTCHA**: SW only over HTTPS; handle stale-shell-after-deploy (skipWaiting/clientsClaim + update prompt); NEVER cache `/sync/*` or auth POSTs.
- **VALIDATE**: `pnpm --filter @swalo/web run build`; Lighthouse PWA audit; SW update flow across a redeploy.

#### Phase B — Dexie read cache → Phase C — offline writes

- **IMPLEMENT**: `apps/web/src/db/*` Dexie stores mirroring the mobile tables + sync metadata + `_mutation_queue/_sync_conflicts/_sync_meta`, indexed by `[shop_id]`, `_sync_status`, `[device_id+client_op_id]`. Read-cache reference data first (products/customers/suppliers/packaging_types/stock_batches). Then offline writes for the CRITICAL set first (sales + cash), then IMPORTANT (receivables/debts/payments), then NORMAL. Reuse `getBrowserDeviceId()`/`generateClientOpId()` already present. Add `useOnlineStatus`, `useSyncStatus`, a `SyncConflicts.tsx` page mirroring mobile.
- **CRITICAL**: factor the sync engine (queue, push/pull orchestration, LWW-vs-manual policy, priority, batch ≤100) into `packages/core/src/sync/*` with a storage-adapter interface; mobile keeps the SQLite adapter, web adds a Dexie adapter — so the two clients stay lockstep. Reconcile `sync.ts` field names first (WS-0).
- **GOTCHA**: IndexedDB is best-effort (use `navigator.storage.persist()`, push aggressively, surface pending count); web must apply the SAME `calculations`/`currency` math + conflict policy as mobile/server. Defer offline-login on web (security tradeoff) — support offline operations only within an already-authenticated session.
- **VALIDATE**: `pnpm --filter @swalo/web run build`; unit (fake-indexeddb) + Playwright offline E2E (make a sale offline → reload → online → assert single server record via idempotency + conflict UI on forced conflict); contract test that web & mobile produce identical `/sync/push` payloads against the core Zod schemas.

### WS-8 — SUPER-ADMIN GAPS

#### ADD connected-users metric + shop-scoped client trace + license-expiry job

- **IMPLEMENT**: Aggregate `UserDevice.last_login_at` into "active in last N min/days" in `getEnhancedSystemStats` (and/or add a `Session`/`RefreshToken` table for true live counts). Generalize audit to a shop-scoped client-activity trace (who sold/edited what) distinct from the `admin_id`-keyed `AuditLog`. Add a scheduled license-expiry check reading `Enterprise.licensed_until` → cascade block (reuse admin-controls blocking). Optionally build SWALO license billing on the empty `payments` module (only if monetization is in scope — confirm).
- **PATTERN**: `admin-controls.service.ts`, `admin.controller.ts` SUPERADMIN gating, blocking cascade (memory: enterprise→shops).
- **VALIDATE**: `cd apps/api && pnpm jest admin*.spec.ts && pnpm run test:e2e`; verify SUPERADMIN-only gating, blocking cascade, entitlement per tier, the new connected-users aggregation.

### WS-9 — OHADA ACCOUNTING (SEPARATE TRACK — large, phased)

#### CREATE accounting module + app (phased; requires accountant validation)

- **IMPLEMENT (phased)**: (1) Seed SYSCOHADA Révisé plan comptable (classes 1-8) as `Account` models; map operations to default accounts (ventes→7, achats→6, caisse/banque→5, clients→411, fournisseurs→401, TVA→44). (2) Auto-post `JournalEntry`/`JournalLine` from existing Sale/Payment/CashEntry/Invoice/Debt events into journaux (VT/AC/CA/BQ/OD) with double-entry validation. (3) Grand-livre per account + balance générale/auxiliaire per `FiscalYear`. (4) FEC-style/CSV/Excel/PDF exports, later états financiers (Bilan, Compte de résultat, flux). Host in a new `apps/web-accounting` (or gated section of `apps/web`); register an `accounting` module in `packages/core/src/modules/registry.ts` (ENTERPRISE tier); strictly `enterprise_id`/`shop_id`-scoped.
- **GOTCHA**: regulated domain — validate the seeded plan + operation→account mapping with a CEMAC/OHADA accountant BEFORE building états financiers. Keep separate from `web-admin` (different tenant boundary).
- **DEPENDENCIES/RESOURCES**: ohada.org (SYSCOHADA Révisé).
- **VALIDATE**: `cd apps/api && pnpm jest accounting*.spec.ts` — double-entry invariant (debits==credits), operation→account mapping snapshots vs validated fixture, balance reconciliation (grand-livre==balance), fiscal-year isolation, export-format conformance.

### WS-10 — DOCUMENTATION (mandatory, last)

#### UPDATE docs/specs/features-catalog.md

- **IMPLEMENT**: Bump header `Dernière mise à jour`. For each implemented feature, DELETE its §16 row and ADD a `### N.M` property block in its section with `**Statut**: **Implémenté** (Plan 030)`: low-stock email + reminders + WhatsApp → §11 Notifications (Module `Premium (notifications)`, `Plateformes` incl. `API (CRON)`); receipt printing → §4 (`Plateformes: Mobile` (+Web)); tablet → §14; web offline → §9 + flip §17 matrix Web/Offline cells; PDG report → §8 (and/or extend §10.3). Edit alphanumeric shop code IN PLACE (§2.2, §2.9 title/desc, §19 row "Modification code boutique (6 chiffres)"). Update §1 stack table to show `web-admin` (+ future `web-accounting`); keep `Web` vs `Web Admin` tokens consistent. Update §18 module classification + licence plan counts if a new module (`accounting`) is added. Prepend ONE changelog row (French, `Auteur = Claude Code`, "Validation complète OK").
- **GOTCHA**: synchronized edits — moving a feature out of §16 also touches §17 (and maybe §18/§19). Keep French + accents.
- **VALIDATE**: `pnpm -w run format:check`; manual review that §16/§17/§18/§19 agree.

#### UPDATE docs/architecture/overview.md

- **IMPLEMENT**: Fix monorepo tree to 4 apps (+ `web-admin`, + future `web-accounting`); remove "(à créer)" markers. Fix roles → `BOSS, MANAGER, EMPLOYEE, SUPERADMIN`. Fix money → "entiers FCFA (pas de décimales)". Replace stacks: mobile = expo-sqlite (WAL) + Zustand; web = React+Vite+Tailwind+Zustand (+ IndexedDB/PWA offline as delivered). Add web-admin (super-admin), Notifications (channels: email + WhatsApp), and the new accounting surfaces. Update Déploiement → Neon + Render + Vercel + Expo EAS. Refresh "Prochaines étapes".
- **VALIDATE**: `pnpm -w run format:check`; manual accuracy pass.

---

## TESTING STRATEGY

**MANDATORY**: every implementation task ships with tests. Frameworks: API & mobile use **Jest** (`apps/api/test/*.spec.ts`, `apps/mobile/__tests__`); API e2e Supertest (`pnpm --filter @swalo/api run test:e2e`); web add **Playwright** for offline E2E. Local DB via `docker compose --profile local up -d postgres`.

### Unit Tests

- **Scope**: shop-code policy/normalizer; phone E.164; notification dispatch + dedup + opt-in; enterprise financial math; receipt template (58/80mm); Dexie repos + shared sync engine (fake-indexeddb); accounting double-entry.
- **Requirements**: mock `MailerService` and the WhatsApp provider (no real sends); reuse existing spec patterns (`apps/api/test/invoices.spec.ts`, notifications monthly-summary spec).
- **VALIDATION COMMAND**: `pnpm --filter @swalo/api run test` ; `pnpm --filter @swalo/mobile run test` ; `pnpm --filter @swalo/core run test`
- **Categories**: happy path, error/edge, input validation, business-logic correctness (money reconciliation, idempotency).

### Integration / E2E Tests

- **Scope**: enterprise financial-summary cross-tenant isolation + rollup==sum; notification trigger endpoints (mocked mailer) → `NotificationLog` rows + guards; web offline make-sale-offline → online → single server record.
- **LOCAL VALIDATION (replaces MCP-Saleor — this is SWALO, not Saleor)**: `docker compose --profile local up -d postgres && pnpm --filter @swalo/api run test:e2e`; for web, Playwright with `context.setOffline(true)`.
- **Scenarios**: complete sale + receipt; PDG dashboard load; offline sale replay; license-expiry cascade block.

### Edge Cases (MANDATORY)

- Shop code: mixed-case, existing numeric codes still valid, invalid chars/`-` rejected, offline-login round-trip with case differences.
- Notifications: missing recipient email/phone, duplicate-send prevention, dyno-asleep cron (external trigger), WhatsApp 24h window / template required.
- Enterprise: empty enterprise (zeros), cross-tenant 403, entitlement edge for PDG, timezone day-boundaries.
- Printing: 58 vs 80mm, offline print, long item list, Expo Go vs dev build.
- Web offline: IndexedDB eviction, SW stale shell after deploy, conflict resolution parity with mobile.

### Test Resources

- Jest: https://jestjs.io/ ; NestJS testing: https://docs.nestjs.com/fundamentals/testing ; Playwright: https://playwright.dev/ ; fake-indexeddb: https://github.com/dumbmatter/fakeIndexedDB
- Project workflow: `CLAUDE.md` (mandatory `pnpm run validate` before PR; feature branch off `develop`).

---

## VALIDATION COMMANDS

Execute every level; all must pass before a workstream is complete (per workstream, scoped to the apps it touches).

### Level 1: Syntax & Style

```
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/api run type-check
pnpm --filter @swalo/mobile run lint
pnpm --filter @swalo/mobile run type-check
pnpm --filter @swalo/web run lint
pnpm -w run format:check
```

**Expected**: zero errors, zero warnings (the repo is currently at 0 lint warnings — keep it there).

### Level 2: Unit Tests

```
pnpm --filter @swalo/api run test
pnpm --filter @swalo/mobile run test
pnpm --filter @swalo/core run test
```

**Expected**: all pass; new tests added for new functionality.

### Level 3: Integration / E2E

```
docker compose --profile local up -d postgres
cd apps/api && pnpm prisma:migrate && pnpm run test:e2e
# web offline:
pnpm --filter @swalo/web exec playwright test
```

**Expected**: all pass; offline workflow + idempotency verified.

### Level 4: Local Build/Docker Validation (replaces MCP-Saleor — N/A here)

```
docker compose --profile local up -d postgres
pnpm --filter @swalo/api run build
pnpm --filter @swalo/web run build
# mobile dev build for ESC/POS (WS-5 Phase B): EAS dev client (Android)
```

**Expected**: builds succeed; API boots against local Postgres; mobile native printing validated on a physical device via dev build.

### Level 5: Manual Validation

- Login with a mixed-case alphanumeric shop code (online + offline).
- PDG dashboard shows only own-enterprise shops with health metrics.
- Trigger low-stock + reminder scans → emails arrive (or mock asserts) and `NotificationLog` rows created; no duplicates on re-run.
- WhatsApp via Twilio sandbox; print a 58mm ticket on a paired printer; rotate a tablet in POS.
- Web: go offline, make a sale, reload, go online → one server record.

### Level 6: Full Suite

```
pnpm run validate
```

**Expected**: all workspaces pass lint + test (CI mirrors this on `develop`/`main`).

---

## ACCEPTANCE CRITERIA

- [ ] All in-scope (`ok` + shop-code + PDG) features implemented per their workstream.
- [ ] ALL validation commands pass with zero errors; **0 lint warnings preserved**.
- [ ] ALL unit + integration/e2e tests pass; new tests added per feature.
- [ ] Local Docker/build validation green (API boots, web builds; mobile printing validated on device for WS-5 Phase B).
- [ ] Code follows project conventions (FCFA Int, French UI strings, scoping, RBAC, offline idempotency).
- [ ] No regressions (existing 104 API unit + 16 e2e + mobile tests still pass).
- [ ] `docs/specs/features-catalog.md` + `docs/architecture/overview.md` updated (mandatory).
- [ ] Decisions in NOTES resolved with the user before building the affected workstream.
- [ ] Security: cross-tenant isolation on enterprise/accounting endpoints; secrets only in env; WhatsApp/email opt-in respected.

## COMPLETION CHECKLIST

- [ ] Foundation (WS-0) merged before dependent workstreams.
- [ ] Each task's VALIDATE command run and passed.
- [ ] Unit + integration/e2e tests written and passing (no skips).
- [ ] `pnpm run validate` + `pnpm -w run format:check` pass.
- [ ] Manual testing done and documented.
- [ ] Docs updated; changelog row prepended.
- [ ] Each workstream on its own `feature/*` or `fix/*` branch → PR to `develop` (never direct to `develop`/`main`).
- [ ] Resource links verified at implementation time (provider pricing/limits change).

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation

- NestJS testing/scheduling: https://docs.nestjs.com/fundamentals/testing , https://docs.nestjs.com/techniques/task-scheduling
- @nestjs-modules/mailer: https://nest-modules.github.io/mailer/ ; Resend SMTP: https://resend.com/docs/send-with-smtp
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api ; Twilio WhatsApp: https://www.twilio.com/docs/whatsapp
- expo-print: https://docs.expo.dev/versions/latest/sdk/print/ ; expo-screen-orientation: https://docs.expo.dev/versions/latest/sdk/screen-orientation/
- Dexie: https://dexie.org/ ; vite-plugin-pwa: https://vite-pwa-org.netlify.app/ ; MDN IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Prisma Migrate: https://www.prisma.io/docs/orm/prisma-migrate
- OHADA / SYSCOHADA: https://www.ohada.org/

### Internal Resources

- `CLAUDE.md` (workflow, money/RBAC/multi-tenancy rules), `docs/specs/features-catalog.md` (source of truth), `docs/specs/cahier-des-charges-unifie.md` + `implementation-plan.md` (note: these still list these features as "À venir" — reconcile after implementation).
- Existing offline-first implementation: `apps/mobile/src/db/*` (the contract to mirror on web).
- Module entitlements: `packages/core/src/modules/registry.ts`.

### Local Validation (replaces MCP Saleor)

- This is **SWALO**, not Saleor — there is no Saleor MCP. Validate against local Postgres via `docker compose --profile local up -d postgres` + Prisma migrate, the Jest/Supertest suites, and app builds.

## NOTES

### Decision points for the user (resolve before building the affected workstream)

1. **Email provider** (WS-3): keep Gmail SMTP vs switch SMTP credentials to a transactional provider (recommend **Resend** — code-free, just env). _Recommended: switch credentials._
2. **WhatsApp provider** (WS-4): start on **Twilio** (sandbox, fastest) behind a provider-agnostic adapter, migrate to **Meta Cloud API** later for cost. _Recommended: adapter + Twilio first._ Note template-approval lead time.
3. **Receipt printing** (WS-5): ship Phase A (expo-print + web `window.print`, works in Expo Go) first; Phase B ESC/POS Bluetooth needs an **EAS dev build and is Android-only** (iOS needs the absent Apple credentials). _Confirm you want to leave Expo Go for the mobile app._
4. **Payment reminders** (WS-3): add `ClientReceivable.due_date` (recommended, cleaner) vs `created_at + N days` grace convention. _Recommended: add due_date._
5. **PDG** (WS-2): use the existing `BOSS` role (no new role) and host the dashboard on **web**. _Recommended: yes._ (Mobile consolidated view = later.)
6. **OHADA accounting** (WS-9): this is a **large, regulated, multi-phase domain** — recommend treating it as a **separate initiative** (its own plan) with accountant validation, not bundled into the `ok`-features delivery. Confirm whether to scaffold Phase 1 (plan comptable + auto-posting) now or defer entirely.
7. **License billing** (WS-8): build on the `payments` stub only if SWALO monetization is in scope now.

### Cross-cutting corrections discovered (worth fixing regardless)

- Role enum is `EMPLOYEE|MANAGER|BOSS|SUPERADMIN` — CLAUDE.md/MEMORY/overview.md are stale; `OWNER` is used by mistake in `apps/web/src/App.tsx`.
- `packages/core/src/schemas/sync.ts` Zod field names drift from the live `/sync/*` REST payloads — reconcile (blocks safe web-offline reuse).
- `overview.md` is largely fiction (wrong stacks/roles/currency/deploy) — refresh is overdue.

### Scope realism

This plan spans 4 existing apps + 1 new app and several large domains. Deliver in the phase order above (Foundation → quick wins → channel/device → large tracks → docs), one workstream per PR. OHADA (WS-9) and full web-offline (WS-7) each dwarf the others — do not attempt them in a single pass.

<!-- EOF -->
