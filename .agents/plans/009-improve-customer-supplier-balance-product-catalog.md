# Feature: Amélioration Gestion Soldes Clients/Fournisseurs et Catalogue Produits

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Ce plan implémente trois améliorations majeures pour le système SWALO:

1. **Meilleure Gestion du Solde Client**: Clarification de la signification des soldes négatifs (remboursement dû au client) et positifs (créance client), avec alertes visuelles et amélioration des méthodes de diminution (remboursement, paiement) et d'augmentation (vente à crédit, création créance).

2. **Meilleure Gestion du Solde Fournisseur**: Application de la même logique que les clients - solde négatif signifie que le fournisseur doit rembourser, solde positif signifie dette envers le fournisseur, avec gestion des achats marchandises à crédit depuis la caisse.

3. **Amélioration du Catalogue Produits**: Amélioration de l'interface de gestion du catalogue avec la hiérarchie complète (Famille → Type Article → Marque → Référence → Code Article) accessible depuis un onglet dédié.

## User Story

**En tant que** gérant de boutique de téléphonie
**Je veux** voir clairement quand je dois de l'argent à un client/fournisseur (solde négatif avec alerte) versus quand ils me doivent de l'argent (solde positif)
**Afin de** gérer correctement mes remboursements, paiements, et avoir une visibilité complète sur ma trésorerie

**En tant que** employé de boutique
**Je veux** gérer facilement mon catalogue de produits avec une structure hiérarchique claire
**Afin de** retrouver rapidement les produits et maintenir un catalogue organisé

## Problem Statement

### Problèmes Actuels:

1. **Soldes Client/Fournisseur Ambigus**:
   - La signification des soldes négatifs/positifs n'est pas claire pour l'utilisateur final
   - Manque d'alertes visuelles fortes quand un remboursement est dû
   - Pas de workflow clair pour les remboursements clients
   - Pas de lien direct entre achats marchandises et dette fournisseur depuis la caisse

2. **Interface Catalogue Produits Insuffisante**:
   - L'écran CatalogHierarchyScreen existe mais n'est pas accessible facilement
   - Le ProductCatalogScreen a deux onglets mais l'onglet "Catalogue" est peu développé
   - Manque de fonctionnalités CRUD complètes sur la hiérarchie
   - Pas d'interface web pour gérer le catalogue

## Solution Statement

### Solutions Proposées:

1. **Amélioration Soldes Client**:
   - Ajout d'indicateurs visuels clairs (badges colorés) pour distinguer soldes positifs (vert) et négatifs (rouge)
   - Alertes modales proéminentes lors de soldes négatifs
   - Ajout d'un bouton "Rembourser Client" pour créer une sortie de caisse dédiée
   - Amélioration des messages d'aide et tooltips
   - Ajout d'un historique de remboursements distinct

2. **Amélioration Soldes Fournisseur**:
   - Application des mêmes patterns visuels que clients
   - Ajout d'un workflow "Achat Marchandise" depuis la caisse (CashScreen)
   - Création automatique de dette fournisseur lors d'achats à crédit
   - Ajout d'un bouton "Réclamer Remboursement" pour soldes négatifs

3. **Amélioration Catalogue Produits**:
   - Ajout d'un onglet "Catalogue" amélioré dans ProductCatalogScreen
   - Interface complète pour gérer la hiérarchie (Famille → Article → Marque → Référence)
   - Amélioration de CatalogHierarchyScreen avec CRUD complet
   - Ajout de filtres en cascade basés sur la hiérarchie
   - Synchronisation automatique avec le schéma Zod dans @swalo/core

## Feature Metadata

**Feature Type**: Enhancement
**Estimated Complexity**: Medium-High
**Primary Systems Affected**:
- API Backend (Customers, Suppliers, Receivables, Debts, Products, Cash modules)
- Mobile Frontend (CustomerDetailsScreen, SupplierDetailsScreen, ProductCatalogScreen, CatalogHierarchyScreen, CashScreen)
- Shared Core (@swalo/core schemas)

**Dependencies**:
- Prisma ORM (existing)
- React Native (existing)
- Zod validation (existing)
- NestJS (existing)
- Expo (existing)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

**Backend API**:
- `apps/api/prisma/schema.prisma` (lines 231-367) - Customer, ClientReceivable, Supplier, SupplierDebt models
- `apps/api/src/modules/customers/customers.service.ts` (lines 1-295) - Customer balance calculation logic
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lines 1-295) - Supplier balance calculation logic
- `apps/api/src/modules/receivables/receivables.service.ts` (lines 1-237) - Payment processing for receivables
- `apps/api/src/modules/debts/debts.service.ts` (lines 1-237) - Payment processing for debts
- `apps/api/src/modules/cash/cash.service.ts` - Cash register operations
- `apps/api/src/modules/products/products.service.ts` - Product CRUD and catalog operations

**Frontend Mobile**:
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 1-800) - Customer balance display and payment UI
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` (lines 1-800) - Supplier balance display and payment UI
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` (lines 1-1533) - Product management with tabs
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` (lines 1-864) - Hierarchical catalog view
- `apps/mobile/src/screens/CashScreen.tsx` - Cash register screen
- `apps/mobile/src/lib/api.ts` (lines 1-700) - API client implementations
- `apps/mobile/src/utils/cashRegister.ts` - Cash register utilities
- `apps/mobile/src/constants/theme.ts` - Theme constants for consistent styling

**Shared Core**:
- `packages/core/src/schemas/customer.ts` - Customer Zod schema
- `packages/core/src/schemas/supplier.ts` - Supplier Zod schema
- `packages/core/src/schemas/product.ts` - Product Zod schema (needs update)
- `packages/core/src/constants/cashCategories.ts` - Cash entry categories

### New Files to Create

**Backend**:
- `apps/api/src/modules/cash/dto/create-merchandise-purchase.dto.ts` - DTO for merchandise purchases
- `apps/api/src/modules/products/dto/batch-update-hierarchy.dto.ts` - DTO for bulk hierarchy updates

**Frontend Mobile**:
- `apps/mobile/src/components/ui/BalanceIndicator.tsx` - Reusable balance display component
- `apps/mobile/src/components/ui/HierarchyManager.tsx` - Reusable hierarchy management component

**Shared**:
- None required - will update existing schemas

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- [NestJS Documentation - Controllers](https://docs.nestjs.com/controllers)
  - Section: Request payloads, validation
  - Why: DTOs and validation patterns

- [Prisma Documentation - Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
  - Section: Interactive transactions
  - Why: Atomic operations for complex balance updates

- [React Native Documentation - Modal](https://reactnative.dev/docs/modal)
  - Section: Modal presentation
  - Why: Alert modals for negative balances

- [Expo Documentation - Icons](https://docs.expo.dev/guides/icons/)
  - Section: Icon families
  - Why: Visual indicators for balance status

- [Zod Documentation](https://zod.dev/)
  - Section: Schema definition, validation
  - Why: Shared schema validation patterns

### Patterns to Follow

**Naming Conventions:**
- Service methods: camelCase (e.g., `addPayment`, `calculateBalance`)
- DTOs: PascalCase with suffix (e.g., `CreateReceivableDto`)
- Components: PascalCase (e.g., `BalanceIndicator`)
- API endpoints: kebab-case (e.g., `/api/customers/:id/refund`)
- Database fields: snake_case (e.g., `paid_amount`, `balance`)
- Reference files: `apps/api/src/modules/receivables/dto/create-receivable.dto.ts`

**Error Handling:**
- Backend: Throw NestJS HttpException with appropriate status codes
- Frontend: Try-catch with Alert.alert for user-friendly error messages
- Reference: `apps/api/src/modules/receivables/receivables.service.ts` (lines 108-170)
- Pattern: Validate business rules before database operations

**Logging Pattern:**
- Use NestJS Logger for all service operations
- Log format: `[ServiceName] Operation: details`
- Reference: Check existing service files for Logger injection
- Frontend: console.log for development, structured logging for production

**Data Validation:**
- Backend: Use class-validator decorators in DTOs
- Shared: Define Zod schemas in @swalo/core
- Frontend: Validate before API calls using Zod schemas
- Reference: `apps/api/src/modules/receivables/dto/create-receivable.dto.ts`

**Transaction Patterns:**
- Use Prisma `$transaction()` for multi-step operations
- Include version increment for optimistic concurrency
- Reference: `apps/api/src/modules/customers/customers.service.ts` (lines 14-62)

**UI Patterns:**
- Use theme constants from `apps/mobile/src/constants/theme.ts`
- Follow existing modal patterns from CustomerDetailsScreen
- Use formatMoney utility for currency display
- Color coding: Green for positive/good, Red for negative/warning, Yellow for partial

**Multi-tenancy Pattern:**
- Always filter by `shop_id` from JWT context
- Reference: All service methods in `customers.service.ts`, `suppliers.service.ts`

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

**Description**: Prepare backend infrastructure and shared schemas for enhanced balance management and product catalog features.

**Tasks:**

1. Update Prisma schema if needed for additional fields
2. Update Zod schemas in @swalo/core to include product catalog hierarchy fields
3. Create new DTOs for merchandise purchases and hierarchy management
4. Add new cash entry categories for customer refunds and supplier purchases
5. Create reusable UI components for balance indicators

### Phase 2: Backend - Customer Balance Improvements

**Description**: Enhance customer balance calculation, add refund operations, improve transaction history.

**Tasks:**

1. Add dedicated refund endpoint to customers controller
2. Enhance receivables service with detailed refund logic
3. Update balance calculation to include refund tracking
4. Add stats endpoint for refund summaries
5. Improve transaction history aggregation

### Phase 3: Backend - Supplier Balance Improvements

**Description**: Enhance supplier balance calculation, add merchandise purchase operations, improve debt tracking.

**Tasks:**

1. Add merchandise purchase endpoint to cash controller
2. Create service method to link cash exits with supplier debts
3. Enhance supplier balance calculation with purchase tracking
4. Add supplier refund claim workflow
5. Improve transaction history aggregation for suppliers

### Phase 4: Backend - Product Catalog Enhancements

**Description**: Improve product catalog API with better hierarchy management and batch operations.

**Tasks:**

1. Add batch update endpoint for hierarchy modifications
2. Enhance filter endpoints with cascade logic
3. Add validation for hierarchy consistency
4. Improve search functionality across hierarchy fields
5. Add catalog statistics endpoints

### Phase 5: Frontend - Customer Balance UI

**Description**: Enhance customer balance display with visual indicators, alerts, and refund workflow.

**Tasks:**

1. Create BalanceIndicator component with color coding
2. Add prominent alerts for negative balances
3. Implement refund modal and workflow
4. Enhance transaction history display
5. Add help tooltips and explanatory text

### Phase 6: Frontend - Supplier Balance UI

**Description**: Enhance supplier balance display with visual indicators, alerts, and purchase workflow.

**Tasks:**

1. Apply BalanceIndicator component to supplier screens
2. Add prominent alerts for negative supplier balances
3. Implement merchandise purchase workflow from CashScreen
4. Add refund claim button and modal
5. Enhance transaction history display

### Phase 7: Frontend - Product Catalog UI

**Description**: Enhance product catalog screens with improved hierarchy management and navigation.

**Tasks:**

1. Improve ProductCatalogScreen tabs with enhanced Catalogue tab
2. Enhance CatalogHierarchyScreen with full CRUD operations
3. Add cascade filters based on hierarchy selections
4. Improve visual design and usability
5. Add help documentation and onboarding

### Phase 8: Testing & Validation

**Description**: Comprehensive testing of all new features across balance management and catalog improvements.

**Tasks:**

1. Test customer balance scenarios (positive, negative, zero, overpayment)
2. Test supplier balance scenarios (positive, negative, purchases)
3. Test product catalog hierarchy operations
4. Validate transaction atomicity and data consistency
5. Perform end-to-end user workflow testing

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task Format Guidelines

Use information-dense keywords for clarity:

- **CREATE**: New files or components
- **UPDATE**: Modify existing files
- **ADD**: Insert new functionality into existing code
- **REMOVE**: Delete deprecated code
- **REFACTOR**: Restructure without changing behavior
- **MIRROR**: Copy pattern from elsewhere in codebase

---

### 1. UPDATE `packages/core/src/schemas/product.ts`

- **IMPLEMENT**: Add missing catalog hierarchy fields (family, article_type, brand, reference) to Product Zod schema to match Prisma model
- **PATTERN**: Follow existing Zod schema patterns in same file
- **DEPENDENCIES**: Zod library (already installed)
- **GOTCHA**: Ensure field names match exactly with Prisma schema snake_case convention
- **RESOURCES**:
  - [Zod Documentation](https://zod.dev/)
  - Reference: `apps/api/prisma/schema.prisma` lines 109-147
- **VALIDATE**: `pnpm --filter @swalo/core run lint && pnpm --filter @swalo/core run build`
- **TEST_REQUIREMENT**: Schema should validate products with all hierarchy fields

---

### 2. UPDATE `packages/core/src/constants/cashCategories.ts`

- **IMPLEMENT**: Add new cash entry categories: "CUSTOMER_REFUND" (for customer refunds) and "MERCHANDISE_PURCHASE" (for supplier purchases)
- **PATTERN**: Mirror existing category structure in same file
- **DEPENDENCIES**: None
- **GOTCHA**: Ensure category names are consistent with existing naming convention (uppercase with underscores)
- **RESOURCES**: Reference existing file structure
- **VALIDATE**: `pnpm --filter @swalo/core run lint && pnpm --filter @swalo/core run build`
- **TEST_REQUIREMENT**: New categories should be exportable and usable in API/mobile apps

---

### 3. CREATE `apps/api/src/modules/cash/dto/create-merchandise-purchase.dto.ts`

- **IMPLEMENT**: Create DTO for merchandise purchase from supplier with fields: supplier_id, amount, description, payment_method (CASH | MOBILE_MONEY), create_debt (boolean flag)
- **PATTERN**: Mirror structure from `apps/api/src/modules/cash/dto/create-cash-entry.dto.ts`
- **DEPENDENCIES**: class-validator decorators (@IsUUID, @IsInt, @Min, @IsString, @IsBoolean, @IsEnum, @IsOptional)
- **GOTCHA**: Amount should be validated as positive integer (in centimes)
- **RESOURCES**:
  - [NestJS Validation](https://docs.nestjs.com/techniques/validation)
  - Reference: `apps/api/src/modules/cash/dto/create-cash-entry.dto.ts`
- **VALIDATE**: `pnpm --filter @swalo/api run lint`
- **TEST_REQUIREMENT**: DTO validation should reject invalid supplier_id, negative amounts, invalid payment methods

---

### 4. CREATE `apps/api/src/modules/products/dto/batch-update-hierarchy.dto.ts`

- **IMPLEMENT**: Create DTO for batch updating hierarchy level (family, article_type, brand, or reference) across multiple products with fields: level (enum), old_value, new_value, filters (optional shop_id, family, article_type, brand)
- **PATTERN**: Use class-validator decorators and enum validation
- **DEPENDENCIES**: class-validator
- **GOTCHA**: Validate that level enum matches allowed hierarchy levels
- **RESOURCES**: Reference existing DTOs in products module
- **VALIDATE**: `pnpm --filter @swalo/api run lint`
- **TEST_REQUIREMENT**: DTO should validate enum values and required fields

---

### 5. ADD endpoint `POST /api/customers/:id/refund` to `apps/api/src/modules/customers/customers.controller.ts`

- **IMPLEMENT**: Add controller method to create customer refund, accepting body: amount, payment_method, note. Delegates to customersService.createRefund method. Protected by @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
- **PATTERN**: Mirror payment endpoint pattern from receivables.controller.ts
- **DEPENDENCIES**: @Roles decorator, RolesGuard
- **GOTCHA**: Must validate customer exists and amount is positive before processing
- **RESOURCES**: Reference `apps/api/src/modules/receivables/receivables.controller.ts` (payment endpoints)
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should return 404 if customer not found, 400 if amount invalid

---

### 6. ADD method `createRefund()` to `apps/api/src/modules/customers/customers.service.ts`

- **IMPLEMENT**: Create service method that creates a cash exit entry with category CUSTOMER_REFUND and creates a negative receivable to track the refund owed. Use Prisma transaction for atomicity.
- **PATTERN**: Mirror transaction pattern from create() method in same file (lines 14-62)
- **DEPENDENCIES**: Prisma client, Logger
- **GOTCHA**: Must use negative amount for receivable to indicate refund owed TO customer
- **RESOURCES**:
  - [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
  - Reference pattern in `customers.service.ts` lines 14-62
- **VALIDATE**: `pnpm --filter @swalo/api run test -- customers.service`
- **TEST_REQUIREMENT**: Method should create both cash entry and negative receivable atomically, update customer balance

---

### 7. ADD method `getRefundHistory()` to `apps/api/src/modules/customers/customers.service.ts`

- **IMPLEMENT**: Create service method that retrieves all customer refunds by filtering CashEntry records with category CUSTOMER_REFUND and customer_id, ordered by date descending
- **PATTERN**: Follow query pattern from getOne() method
- **DEPENDENCIES**: Prisma client
- **GOTCHA**: Must filter by shop_id for multi-tenancy
- **RESOURCES**: Reference existing query methods in same service
- **VALIDATE**: `pnpm --filter @swalo/api run test -- customers.service`
- **TEST_REQUIREMENT**: Method should return only refund entries for specific customer in shop

---

### 8. ADD endpoint `GET /api/customers/:id/refunds` to `apps/api/src/modules/customers/customers.controller.ts`

- **IMPLEMENT**: Add controller method that returns refund history by calling customersService.getRefundHistory()
- **PATTERN**: Mirror existing GET endpoints in same controller
- **DEPENDENCIES**: JwtAuthGuard
- **GOTCHA**: Extract shop_id from JWT request context
- **RESOURCES**: Reference existing controller methods
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should return paginated refund history for customer

---

### 9. ADD endpoint `POST /api/cash/merchandise-purchase` to `apps/api/src/modules/cash/cash.controller.ts`

- **IMPLEMENT**: Add controller method accepting CreateMerchandisePurchaseDto, creating cash exit for merchandise purchase and optionally creating supplier debt if create_debt flag is true. Protected by @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
- **PATTERN**: Mirror existing POST endpoints in cash controller
- **DEPENDENCIES**: CreateMerchandisePurchaseDto, @Roles decorator
- **GOTCHA**: Must validate supplier exists before creating debt
- **RESOURCES**: Reference existing methods in `cash.controller.ts`
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should create cash exit and optionally debt, return 404 if supplier not found

---

### 10. ADD method `createMerchandisePurchase()` to `apps/api/src/modules/cash/cash.service.ts`

- **IMPLEMENT**: Create service method that creates cash exit entry with category MERCHANDISE_PURCHASE, and if create_debt is true, creates SupplierDebt record linked to the purchase. Use Prisma transaction.
- **PATTERN**: Follow transaction pattern from existing cash operations
- **DEPENDENCIES**: Prisma client, Logger, DebtService (for creating debt)
- **GOTCHA**: Cash entry should have negative amount (exit), debt should have positive amount (what we owe)
- **RESOURCES**:
  - [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
  - Reference `apps/api/src/modules/debts/debts.service.ts` create method
- **VALIDATE**: `pnpm --filter @swalo/api run test -- cash.service`
- **TEST_REQUIREMENT**: Method should atomically create cash exit and supplier debt, link them via cash_exit_id

---

### 11. ADD method `claimRefund()` to `apps/api/src/modules/suppliers/suppliers.service.ts`

- **IMPLEMENT**: Create service method that handles supplier refund claim when balance is negative, creating a cash entry to record the refund received and updating debt balance
- **PATTERN**: Mirror refund logic from customer service
- **DEPENDENCIES**: Prisma client, Logger
- **GOTCHA**: Validate supplier balance is actually negative before allowing refund claim
- **RESOURCES**: Reference `customers.service.ts` createRefund method
- **VALIDATE**: `pnpm --filter @swalo/api run test -- suppliers.service`
- **TEST_REQUIREMENT**: Method should only succeed if supplier balance is negative, create cash entry and update debt

---

### 12. ADD endpoint `POST /api/suppliers/:id/claim-refund` to `apps/api/src/modules/suppliers/suppliers.controller.ts`

- **IMPLEMENT**: Add controller method for supplier to claim refund, accepting amount, payment_method, note. Calls suppliersService.claimRefund(). Protected by @Roles(Role.OWNER, Role.MANAGER)
- **PATTERN**: Mirror customer refund endpoint
- **DEPENDENCIES**: @Roles decorator
- **GOTCHA**: Validate amount does not exceed negative balance (absolute value)
- **RESOURCES**: Reference `customers.controller.ts` refund endpoint
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should return 400 if balance not negative or amount exceeds refund owed

---

### 13. ADD endpoint `POST /api/products/batch-update-hierarchy` to `apps/api/src/modules/products/products.controller.ts`

- **IMPLEMENT**: Add controller method for batch updating hierarchy level (family, article_type, brand, reference) across products, accepting BatchUpdateHierarchyDto. Protected by @Roles(Role.OWNER, Role.MANAGER)
- **PATTERN**: Mirror existing POST endpoints
- **DEPENDENCIES**: BatchUpdateHierarchyDto, @Roles decorator
- **GOTCHA**: Use Prisma updateMany for efficiency, increment version for all updated products
- **RESOURCES**: [Prisma Update Many](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#updatemany)
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should update multiple products atomically, return count of updated records

---

### 14. ADD method `batchUpdateHierarchy()` to `apps/api/src/modules/products/products.service.ts`

- **IMPLEMENT**: Create service method that updates specified hierarchy level across filtered products using Prisma updateMany, incrementing version field
- **PATTERN**: Use Prisma where clause with filters, updateMany for bulk operation
- **DEPENDENCIES**: Prisma client, Logger
- **GOTCHA**: Must filter by shop_id, validate old_value exists before updating
- **RESOURCES**: Reference existing update methods in products service
- **VALIDATE**: `pnpm --filter @swalo/api run test -- products.service`
- **TEST_REQUIREMENT**: Method should update only products matching filters, return count of affected rows

---

### 15. ENHANCE method `getFilters()` in `apps/api/src/modules/products/products.service.ts`

- **IMPLEMENT**: Modify existing getFilters method to accept optional filter parameters (family, article_type, brand) and return cascade-filtered options (e.g., if family selected, return only article_types within that family)
- **PATTERN**: Add conditional where clauses based on provided filters
- **DEPENDENCIES**: Prisma client
- **GOTCHA**: Maintain backwards compatibility - filters should be optional
- **RESOURCES**: Reference existing getFilters implementation
- **VALIDATE**: `pnpm --filter @swalo/api run test -- products.service`
- **TEST_REQUIREMENT**: Method should return full options when no filters provided, filtered options when filters applied

---

### 16. UPDATE endpoint `GET /api/products/filters` in `apps/api/src/modules/products/products.controller.ts`

- **IMPLEMENT**: Modify endpoint to accept query parameters: family, article_type, brand for cascade filtering
- **PATTERN**: Use @Query() decorator to extract parameters
- **DEPENDENCIES**: None
- **GOTCHA**: All parameters should be optional
- **RESOURCES**: Reference existing query parameter usage in same controller
- **VALIDATE**: `pnpm --filter @swalo/api run lint && pnpm --filter @swalo/api run test`
- **TEST_REQUIREMENT**: Endpoint should support cascade filtering, return filtered options based on hierarchy

---

### 17. CREATE `apps/mobile/src/components/ui/BalanceIndicator.tsx`

- **IMPLEMENT**: Create reusable component that displays balance with color coding: green badge for positive balance (debt to us), red badge for negative balance (refund owed), yellow for zero. Include icon and formatted amount. Accept props: balance (number), type ('customer' | 'supplier'), showAlert (boolean)
- **PATTERN**: Mirror existing UI component patterns from `apps/mobile/src/components/ui/` (e.g., IconButton, ListItem)
- **DEPENDENCIES**: React Native (View, Text, StyleSheet), theme constants, formatMoney utility
- **GOTCHA**: Use absolute value for display with appropriate prefix (+/-)
- **RESOURCES**:
  - [React Native Docs](https://reactnative.dev/)
  - Reference `apps/mobile/src/constants/theme.ts` for colors
  - Reference `apps/mobile/src/utils/date.ts` for formatMoney pattern
- **VALIDATE**: Manual testing in Expo dev client
- **TEST_REQUIREMENT**: Component should render correctly for positive, negative, and zero balances

---

### 18. UPDATE `apps/mobile/src/lib/api.ts` - Add customer refund methods

- **IMPLEMENT**: Add methods to customersApi: createRefund(customerId, data: {amount, payment_method, note}), getRefunds(customerId)
- **PATTERN**: Mirror existing API methods in same file
- **DEPENDENCIES**: Axios instance
- **GOTCHA**: Amounts should be in centimes before sending to API
- **RESOURCES**: Reference existing API methods (lines 218-350)
- **VALIDATE**: `pnpm --filter @swalo/mobile run lint`
- **TEST_REQUIREMENT**: Methods should construct correct URLs and request bodies

---

### 19. UPDATE `apps/mobile/src/lib/api.ts` - Add supplier refund and purchase methods

- **IMPLEMENT**: Add methods to suppliersApi: claimRefund(supplierId, data: {amount, payment_method, note}). Add methods to cashApi: createMerchandisePurchase(data: {supplier_id, amount, description, payment_method, create_debt})
- **PATTERN**: Mirror existing API methods
- **DEPENDENCIES**: Axios instance
- **GOTCHA**: Ensure create_debt is boolean
- **RESOURCES**: Reference existing supplier and cash API methods
- **VALIDATE**: `pnpm --filter @swalo/mobile run lint`
- **TEST_REQUIREMENT**: Methods should match API endpoint signatures

---

### 20. UPDATE `apps/mobile/src/lib/api.ts` - Add product hierarchy methods

- **IMPLEMENT**: Add methods to productsApi: batchUpdateHierarchy(data: {level, old_value, new_value, filters}), getFilters(params?: {family, article_type, brand})
- **PATTERN**: Mirror existing products API methods
- **DEPENDENCIES**: Axios instance
- **GOTCHA**: Handle optional query parameters correctly
- **RESOURCES**: Reference existing products API (lines 398-496)
- **VALIDATE**: `pnpm --filter @swalo/mobile run lint`
- **TEST_REQUIREMENT**: Methods should serialize query params correctly for cascade filtering

---

### 21. UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Add BalanceIndicator

- **IMPLEMENT**: Replace existing balance display KPICard with new BalanceIndicator component, passing balance, type='customer', showAlert=true
- **PATTERN**: Import and use BalanceIndicator component
- **DEPENDENCIES**: BalanceIndicator component (created in task 17)
- **GOTCHA**: Ensure balance value is in centimes
- **RESOURCES**: Reference existing KPICard usage (lines 591-614)
- **VALIDATE**: Manual testing in Expo dev client
- **TEST_REQUIREMENT**: Balance indicator should show correct color and icon for positive/negative balances

---

### 22. UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Add prominent negative balance alert

- **IMPLEMENT**: Enhance existing overpayment warning (lines 603-611) with more prominent modal-style alert using Alert.alert when balance is negative, showing amount to refund with actionable button
- **PATTERN**: Use React Native Alert.alert for prominent warnings
- **DEPENDENCIES**: Alert from react-native
- **GOTCHA**: Only show once per screen load to avoid annoyance
- **RESOURCES**: [React Native Alert](https://reactnative.dev/docs/alert)
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Alert should appear automatically when balance is negative, dismissable by user

---

### 23. UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Add refund modal and workflow

- **IMPLEMENT**: Add new "Rembourser Client" button that opens modal to record customer refund, with fields: amount, payment_method, note. On submit, calls customersApi.createRefund and updates local state
- **PATTERN**: Mirror existing payment modal pattern (lines 239-374)
- **DEPENDENCIES**: Modal component, TextInput, customersApi
- **GOTCHA**: Validate amount does not exceed refund owed (absolute value of negative balance)
- **RESOURCES**: Reference existing refund modal code (lines 239-374)
- **VALIDATE**: Manual testing in Expo dev client
- **TEST_REQUIREMENT**: Modal should prevent refund amount exceeding owed amount, show success message, refresh customer data

---

### 24. UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Enhance transaction history

- **IMPLEMENT**: Update transaction history to include refund entries with distinct icon and label "Remboursement", showing negative amounts in red
- **PATTERN**: Mirror existing transaction history rendering (lines 160-225)
- **DEPENDENCIES**: Transaction type discrimination
- **GOTCHA**: Filter out refunds that are already linked via cash_entry_id to avoid duplication
- **RESOURCES**: Reference existing transaction rendering
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Refunds should appear in chronological order with correct icon and amount sign

---

### 25. UPDATE `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Add BalanceIndicator

- **IMPLEMENT**: Replace existing balance display KPICard with new BalanceIndicator component, passing balance, type='supplier', showAlert=true
- **PATTERN**: Import and use BalanceIndicator component
- **DEPENDENCIES**: BalanceIndicator component
- **GOTCHA**: Ensure balance value is in centimes
- **RESOURCES**: Reference existing KPICard usage (lines 605-627)
- **VALIDATE**: Manual testing in Expo dev client
- **TEST_REQUIREMENT**: Balance indicator should show correct color and icon for supplier balances

---

### 26. UPDATE `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Add prominent negative balance alert

- **IMPLEMENT**: Enhance existing overpayment warning (lines 616-624) with Alert.alert modal when supplier balance is negative (we overpaid), showing amount supplier owes back with actionable "Réclamer Remboursement" button
- **PATTERN**: Use Alert.alert for prominent warnings
- **DEPENDENCIES**: Alert from react-native
- **GOTCHA**: Alert should explain supplier owes us money
- **RESOURCES**: [React Native Alert](https://reactnative.dev/docs/alert)
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Alert should appear for negative supplier balances with clear explanation

---

### 27. UPDATE `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Add refund claim modal

- **IMPLEMENT**: Add new "Réclamer Remboursement" button that opens modal to record refund received from supplier, with fields: amount, payment_method, note. On submit, calls suppliersApi.claimRefund and updates local state
- **PATTERN**: Mirror customer refund modal pattern
- **DEPENDENCIES**: Modal component, TextInput, suppliersApi
- **GOTCHA**: Validate amount does not exceed refund owed (absolute value of negative balance)
- **RESOURCES**: Reference customer refund modal implementation
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Modal should validate amounts, show success message, refresh supplier data

---

### 28. UPDATE `apps/mobile/src/screens/CashScreen.tsx` - Add merchandise purchase workflow

- **IMPLEMENT**: Add new "Achat Marchandise" button in cash screen that opens modal for recording merchandise purchases from suppliers. Modal includes: supplier selection (SearchableSelect), amount, description, payment_method, create_debt checkbox. On submit, calls cashApi.createMerchandisePurchase
- **PATTERN**: Mirror existing cash entry patterns in CashScreen
- **DEPENDENCIES**: SearchableSelect component, Modal, cashApi, suppliersApi (to list suppliers)
- **GOTCHA**: Fetch active suppliers for selection dropdown
- **RESOURCES**: Reference `CashScreen.tsx` existing cash entry modals
- **VALIDATE**: Manual testing in Expo dev client
- **TEST_REQUIREMENT**: Modal should create cash exit and optionally supplier debt, update cash register balance

---

### 29. UPDATE `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Enhance Catalogue tab

- **IMPLEMENT**: Improve the "Catalogue" tab (currently basic) to show enhanced hierarchical view with expandable sections for Family → Article Type → Brand, each showing product count. Add "Gérer Hiérarchie" button that navigates to CatalogHierarchyScreen
- **PATTERN**: Use FlatList with sections, expandable/collapsible pattern
- **DEPENDENCIES**: React Native FlatList, navigation prop
- **GOTCHA**: Calculate product counts per category dynamically
- **RESOURCES**: Reference existing tab implementation, `CatalogHierarchyScreen.tsx` for patterns
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Tab should show organized hierarchy with accurate counts, navigation button should work

---

### 30. UPDATE `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - Add full CRUD operations

- **IMPLEMENT**: Enhance existing screen to support full CRUD: Add new family/article/brand/reference at any level, delete entries (only if no products exist), edit/rename with confirmation dialog. Add search/filter bar for quick navigation
- **PATTERN**: Mirror existing modal patterns from other screens
- **DEPENDENCIES**: Alert for confirmations, Modal for add/edit forms
- **GOTCHA**: Validate deletion is only allowed when no products reference that hierarchy level
- **RESOURCES**: Reference existing CatalogHierarchyScreen structure (lines 1-864)
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: CRUD operations should work at all hierarchy levels, show appropriate confirmations and validations

---

### 31. UPDATE `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - Add cascade filters

- **IMPLEMENT**: Add filter dropdowns at top of screen: Family filter → Article Type filter → Brand filter, where each filter dynamically updates options for next level (cascade effect). Uses productsApi.getFilters with params
- **PATTERN**: Use SearchableSelect or custom dropdown component
- **DEPENDENCIES**: productsApi.getFilters method (updated in task 20)
- **GOTCHA**: Clear dependent filters when parent filter changes
- **RESOURCES**: Reference `ProductCatalogScreen.tsx` filter implementations
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Filters should cascade correctly, updating available options based on selections

---

### 32. UPDATE `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Add cascade filters to Articles tab

- **IMPLEMENT**: Enhance existing filter functionality in Articles tab to use cascade filters: Family → Article Type → Brand → Reference, where selecting a filter updates available options for subsequent filters
- **PATTERN**: Use state management for filter values, call getFilters API with params
- **DEPENDENCIES**: productsApi.getFilters
- **GOTCHA**: Clear search when filters change, refresh product list
- **RESOURCES**: Reference existing filter implementation in ProductCatalogScreen
- **VALIDATE**: Manual testing
- **TEST_REQUIREMENT**: Filters should work in cascade, narrowing product list progressively

---

### 33. ADD unit tests for customer refund service method

- **IMPLEMENT**: Create unit test file `apps/api/test/unit/customers.service.spec.ts` (if not exists) and add test cases for createRefund method: successful refund, invalid customer, negative amount, transaction rollback on error
- **PATTERN**: Follow NestJS testing patterns with TestingModule
- **DEPENDENCIES**: @nestjs/testing, Jest
- **GOTCHA**: Mock Prisma client and transaction behavior
- **RESOURCES**:
  - [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
  - Reference existing test files in `apps/api/test/`
- **VALIDATE**: `pnpm --filter @swalo/api run test -- customers.service.spec`
- **TEST_REQUIREMENT**: All test cases should pass, coverage for createRefund should be >80%

---

### 34. ADD unit tests for supplier refund claim service method

- **IMPLEMENT**: Create unit test file `apps/api/test/unit/suppliers.service.spec.ts` and add test cases for claimRefund method: successful claim, invalid supplier, balance not negative, amount exceeds refund owed
- **PATTERN**: Follow NestJS testing patterns
- **DEPENDENCIES**: @nestjs/testing, Jest
- **GOTCHA**: Mock balance calculation and validation
- **RESOURCES**: Reference customer refund tests
- **VALIDATE**: `pnpm --filter @swalo/api run test -- suppliers.service.spec`
- **TEST_REQUIREMENT**: All test cases should pass, coverage >80%

---

### 35. ADD unit tests for merchandise purchase service method

- **IMPLEMENT**: Create unit test file `apps/api/test/unit/cash.service.spec.ts` and add test cases for createMerchandisePurchase: successful purchase with debt, purchase without debt, invalid supplier, transaction atomicity
- **PATTERN**: Follow NestJS testing patterns
- **DEPENDENCIES**: @nestjs/testing, Jest
- **GOTCHA**: Mock both CashEntry and SupplierDebt creation
- **RESOURCES**: Reference existing service tests
- **VALIDATE**: `pnpm --filter @swalo/api run test -- cash.service.spec`
- **TEST_REQUIREMENT**: All test cases should pass, verify transaction atomicity

---

### 36. ADD unit tests for product hierarchy batch update

- **IMPLEMENT**: Create unit test file `apps/api/test/unit/products.service.spec.ts` and add test cases for batchUpdateHierarchy: successful update, no matching products, invalid level, filter validation
- **PATTERN**: Follow NestJS testing patterns
- **DEPENDENCIES**: @nestjs/testing, Jest
- **GOTCHA**: Mock Prisma updateMany and verify where clause construction
- **RESOURCES**: Reference existing test files
- **VALIDATE**: `pnpm --filter @swalo/api run test -- products.service.spec`
- **TEST_REQUIREMENT**: All test cases should pass, verify correct SQL generation

---

### 37. ADD integration tests for customer refund workflow

- **IMPLEMENT**: Create e2e test file `apps/api/test/e2e/customers-refund.e2e-spec.ts` testing full workflow: create customer with negative balance, call refund endpoint, verify cash entry created, verify balance updated, verify transaction history
- **PATTERN**: Use NestJS e2e testing with real database (test instance)
- **DEPENDENCIES**: @nestjs/testing, supertest
- **GOTCHA**: Use test database, seed test data, cleanup after tests
- **RESOURCES**:
  - [NestJS E2E Testing](https://docs.nestjs.com/fundamentals/testing#end-to-end-testing)
  - Reference existing e2e tests
- **VALIDATE**: `pnpm --filter @swalo/api run test:e2e`
- **TEST_REQUIREMENT**: Full workflow should complete successfully, database state should be consistent

---

### 38. ADD integration tests for supplier purchase workflow

- **IMPLEMENT**: Create e2e test file `apps/api/test/e2e/suppliers-purchase.e2e-spec.ts` testing full workflow: create supplier, create merchandise purchase with debt, verify cash exit, verify debt created, verify balance updated
- **PATTERN**: Use NestJS e2e testing
- **DEPENDENCIES**: @nestjs/testing, supertest
- **GOTCHA**: Test both create_debt true and false scenarios
- **RESOURCES**: Reference customer refund e2e tests
- **VALIDATE**: `pnpm --filter @swalo/api run test:e2e`
- **TEST_REQUIREMENT**: Full workflow should work, verify linked records via cash_exit_id

---

### 39. ADD integration tests for product hierarchy batch update

- **IMPLEMENT**: Create e2e test file `apps/api/test/e2e/products-hierarchy.e2e-spec.ts` testing: batch update family name, batch update brand, verify filter cascade behavior, verify product count updates
- **PATTERN**: Use NestJS e2e testing
- **DEPENDENCIES**: @nestjs/testing, supertest
- **GOTCHA**: Seed diverse product catalog for testing
- **RESOURCES**: Reference existing e2e tests
- **VALIDATE**: `pnpm --filter @swalo/api run test:e2e`
- **TEST_REQUIREMENT**: Batch updates should affect correct products, filters should cascade correctly

---

### 40. ADD mobile UI tests for BalanceIndicator component

- **IMPLEMENT**: Create test file `apps/mobile/__tests__/components/BalanceIndicator.test.tsx` with Jest and React Native Testing Library, testing: positive balance displays green, negative balance displays red, zero balance displays yellow, correct amount formatting
- **PATTERN**: Use React Native Testing Library
- **DEPENDENCIES**: @testing-library/react-native, Jest
- **GOTCHA**: Mock formatMoney utility
- **RESOURCES**:
  - [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
  - Reference existing component tests
- **VALIDATE**: `pnpm --filter @swalo/mobile run test -- BalanceIndicator`
- **TEST_REQUIREMENT**: All test cases should pass, verify correct styles and text rendering

---

### 41. PERFORM manual end-to-end testing - Customer refund workflow

- **IMPLEMENT**: Manually test complete customer refund workflow in mobile app: Create customer, add receivable, record overpayment (negative balance), verify alert appears, click "Rembourser Client" button, complete refund, verify balance updates, check transaction history
- **PATTERN**: Follow user journey from start to finish
- **DEPENDENCIES**: Running API server, mobile app in Expo
- **GOTCHA**: Test with realistic amounts (in FCFA centimes)
- **RESOURCES**: Test plan checklist document
- **VALIDATE**: Manual verification checklist
- **TEST_REQUIREMENT**: Complete workflow should work smoothly, all UI elements respond correctly, data persists correctly

---

### 42. PERFORM manual end-to-end testing - Supplier purchase workflow

- **IMPLEMENT**: Manually test complete supplier purchase workflow: Navigate to CashScreen, click "Achat Marchandise", select supplier, enter amount, toggle create_debt, submit, verify cash register updated, navigate to SupplierDetailsScreen, verify debt appears, verify balance updated
- **PATTERN**: Follow user journey
- **DEPENDENCIES**: Running API server, mobile app
- **GOTCHA**: Test both debt creation scenarios (true/false)
- **RESOURCES**: Test plan checklist
- **VALIDATE**: Manual verification checklist
- **TEST_REQUIREMENT**: Complete workflow works, cash and debt properly linked

---

### 43. PERFORM manual end-to-end testing - Product catalog hierarchy

- **IMPLEMENT**: Manually test product catalog improvements: Navigate to ProductCatalogScreen Catalogue tab, verify hierarchy display, click "Gérer Hiérarchie", navigate to CatalogHierarchyScreen, add new family, add article type, add brand, batch rename family, verify filter cascade, verify product count updates
- **PATTERN**: Follow user journey
- **DEPENDENCIES**: Running API server, mobile app
- **GOTCHA**: Test with existing and new hierarchy values
- **RESOURCES**: Test plan checklist
- **VALIDATE**: Manual verification checklist
- **TEST_REQUIREMENT**: All CRUD operations work, filters cascade correctly, counts accurate

---

### 44. VALIDATE balance calculation accuracy across all scenarios

- **IMPLEMENT**: Create validation script that tests balance calculations for edge cases: customer with multiple receivables, partial payments, overpayments, refunds; supplier with multiple debts, purchases, partial payments, negative balances. Verify totals match expected values.
- **PATTERN**: Create standalone Node.js script in `apps/api/scripts/validate-balance-calculations.ts`
- **DEPENDENCIES**: Prisma client, test data fixtures
- **GOTCHA**: Test with realistic transaction volumes
- **RESOURCES**: Reference existing scripts in apps/api/scripts/
- **VALIDATE**: `npx tsx apps/api/scripts/validate-balance-calculations.ts`
- **TEST_REQUIREMENT**: All balance calculations should be mathematically correct, no rounding errors

---

### 45. UPDATE API documentation with new endpoints

- **IMPLEMENT**: Update API documentation (if exists in docs/ or README) to include new endpoints: customer refund, customer refund history, supplier refund claim, merchandise purchase, product batch update, enhanced filter endpoints with parameters
- **PATTERN**: Follow existing documentation format
- **DEPENDENCIES**: Markdown documentation files
- **GOTCHA**: Include request/response examples
- **RESOURCES**: Reference existing API docs
- **VALIDATE**: Manual review for completeness
- **TEST_REQUIREMENT**: Documentation should be clear, complete, with examples

---

### 46. ADD user help documentation for balance management

- **IMPLEMENT**: Create help/onboarding content explaining balance concepts: positive vs negative balances, refund workflow, overpayment handling. Can be inline tooltips or separate help screen.
- **PATTERN**: Use Modal or tooltip components
- **DEPENDENCIES**: React Native components
- **GOTCHA**: Keep explanations concise and clear for non-technical users
- **RESOURCES**: Reference existing UI patterns
- **VALIDATE**: Manual review for clarity
- **TEST_REQUIREMENT**: Help text should be easy to understand for target users (shop owners/employees in Central Africa)

---

### 47. RUN full test suite to verify no regressions

- **IMPLEMENT**: Execute complete test suite for API and mobile: unit tests, integration tests, e2e tests, linting, type checking
- **PATTERN**: Use pnpm workspace commands
- **DEPENDENCIES**: All testing infrastructure
- **GOTCHA**: Ensure test database is clean before running
- **RESOURCES**: Reference CLAUDE.md for test commands
- **VALIDATE**: `pnpm run validate` (runs lint + test for all packages)
- **TEST_REQUIREMENT**: All tests must pass, zero lint errors, zero type errors

---

### 48. PERFORM performance testing with realistic data volume

- **IMPLEMENT**: Test system performance with realistic data volumes: 1000+ customers with receivables, 500+ suppliers with debts, 5000+ products with hierarchy. Measure API response times, mobile app responsiveness, balance calculation speed.
- **PATTERN**: Use load testing tools (artillery, k6) or manual testing with seeded data
- **DEPENDENCIES**: Large dataset seed script
- **GOTCHA**: Test on device similar to target hardware (mid-range Android phone)
- **RESOURCES**: Create seed script if needed
- **VALIDATE**: Manual performance measurement
- **TEST_REQUIREMENT**: API responses <2s for list queries, <500ms for single entity queries, mobile app remains responsive

---

### 49. CONDUCT user acceptance testing with stakeholders

- **IMPLEMENT**: Have actual users (shop owners/employees) test the new features: balance indicators, refund workflows, merchandise purchases, product catalog management. Gather feedback on usability, clarity, workflow efficiency.
- **PATTERN**: Structured UAT sessions with checklist
- **DEPENDENCIES**: Test environment with realistic data
- **GOTCHA**: Document all feedback for iteration
- **RESOURCES**: UAT checklist and feedback form
- **VALIDATE**: UAT feedback document
- **TEST_REQUIREMENT**: Users can complete all workflows without assistance, understand balance indicators without explanation

---

### 50. FINALIZE and document implementation completion

- **IMPLEMENT**: Create final implementation report documenting: all completed features, test results, performance metrics, known limitations, deployment notes, migration guide (if schema changes)
- **PATTERN**: Markdown document in project root or docs/
- **DEPENDENCIES**: All previous task outputs
- **GOTCHA**: Include any database migration scripts needed
- **RESOURCES**: Project documentation standards
- **VALIDATE**: Manual review of completeness
- **TEST_REQUIREMENT**: Report should be comprehensive, accurate, ready for production deployment

---

## TESTING STRATEGY

**MANDATORY REQUIREMENT**: All implementation tasks MUST have corresponding tests that validate functionality.

### Unit Tests

**Scope**: Service methods for balance calculations, refund operations, hierarchy updates

**Requirements**:
- Minimum coverage: 80% for new code
- Testing framework: Jest (already configured in NestJS and React Native)
- Fixtures and mocking: Mock Prisma client, mock API responses
- **VALIDATION COMMAND**: `pnpm --filter @swalo/api run test --coverage`

**Test Categories Required**:
- Happy path: Successful refund, successful purchase, successful hierarchy update
- Error handling: Invalid customer/supplier, negative amounts, insufficient balance
- Edge cases: Zero balances, overpayments exceeding balance, empty hierarchy
- Business logic: Balance calculation accuracy, transaction atomicity

### Integration Tests

**Scope**: End-to-end workflows from API endpoint to database persistence

**Requirements**:
- Test complete workflows: customer refund flow, supplier purchase flow, product hierarchy management
- Database transaction handling: Verify atomicity, rollback on error
- **VALIDATION COMMAND**: `pnpm --filter @swalo/api run test:e2e`

**Test Scenarios Required**:
- Customer refund: Create customer → negative balance → refund → verify cash entry + balance update
- Supplier purchase: Create supplier → merchandise purchase → verify cash exit + debt creation
- Product hierarchy: Batch update family → verify all products updated
- Cascade filters: Select family → verify filtered article types → select article type → verify filtered brands

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
- Customer balance exactly zero after refund
- Supplier balance goes from positive to negative after overpayment
- Refund amount exceeds owed amount (should fail validation)
- Merchandise purchase with invalid supplier_id (should return 404)
- Batch hierarchy update with no matching products (should return count: 0)
- Cascade filter with empty results (should return empty array)
- Transaction rollback on partial failure (debt created but cash entry fails)
- Concurrent balance updates (optimistic concurrency with version field)

### Test Resources

**Testing Documentation Links**:
- Jest Documentation: https://jestjs.io/docs/getting-started
- NestJS Testing: https://docs.nestjs.com/fundamentals/testing
- React Native Testing Library: https://callstack.github.io/react-native-testing-library/
- Prisma Testing: https://www.prisma.io/docs/guides/testing/integration-testing
- Supertest (for e2e API tests): https://github.com/visionmedia/supertest

---

## VALIDATION COMMANDS

**CRITICAL REQUIREMENT**: Execute EVERY validation command and ALL tests MUST PASS before considering the feature complete.

### Level 1: Syntax & Style

**Required Commands**:
```bash
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/mobile run lint
pnpm --filter @swalo/core run lint
pnpm run format:check  # If prettier configured
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Unit Tests

**Required Commands**:
```bash
# API unit tests
pnpm --filter @swalo/api run test --coverage
pnpm --filter @swalo/api run test -- customers.service.spec
pnpm --filter @swalo/api run test -- suppliers.service.spec
pnpm --filter @swalo/api run test -- cash.service.spec
pnpm --filter @swalo/api run test -- products.service.spec

# Mobile unit tests
pnpm --filter @swalo/mobile run test --coverage
pnpm --filter @swalo/mobile run test -- BalanceIndicator.test
```

**Expected Result**:
- All unit tests pass
- Coverage ≥80% for new code
- No test failures or skipped tests

### Level 3: Integration Tests

**Required Commands**:
```bash
# API e2e tests
pnpm --filter @swalo/api run test:e2e
pnpm --filter @swalo/api run test:e2e -- customers-refund.e2e-spec
pnpm --filter @swalo/api run test:e2e -- suppliers-purchase.e2e-spec
pnpm --filter @swalo/api run test:e2e -- products-hierarchy.e2e-spec
```

**Expected Result**:
- All integration tests pass
- End-to-end workflows validated
- Database state consistent after tests

### Level 4: Database Validation

**MANDATORY REQUIREMENT**: Verify database schema consistency and migration success

**Required Validations**:
- Run Prisma migrations: `cd apps/api && pnpm prisma migrate dev`
- Verify schema integrity: `cd apps/api && pnpm prisma validate`
- Check seed data: `cd apps/api && pnpm prisma:seed`
- Inspect database: `cd apps/api && pnpm prisma studio` (manual verification)

### Level 5: Manual Validation

**Feature-specific manual testing steps**:

**Customer Refund Workflow**:
1. Open mobile app, navigate to Customers
2. Create customer with initial balance of 10000 (100 FCFA)
3. Record payment of 15000 (150 FCFA) - creates negative balance
4. Verify red badge appears with -5000 (-50 FCFA)
5. Verify alert modal appears explaining refund owed
6. Click "Rembourser Client" button
7. Enter refund amount: 5000 (50 FCFA)
8. Submit refund
9. Verify balance returns to 0
10. Verify refund appears in transaction history

**Supplier Purchase Workflow**:
1. Navigate to Cash screen
2. Click "Achat Marchandise" button
3. Select supplier from dropdown
4. Enter amount: 50000 (500 FCFA)
5. Enter description: "Achat stock Tecno"
6. Select payment method: CASH
7. Check "Créer Dette" checkbox
8. Submit purchase
9. Verify cash register balance decreased by 50000
10. Navigate to Supplier Details
11. Verify debt appears with amount 50000
12. Verify supplier balance is 50000

**Product Catalog Hierarchy**:
1. Navigate to ProductCatalogScreen
2. Click "Catalogue" tab
3. Verify hierarchical display of families
4. Click "Gérer Hiérarchie" button
5. Navigate to CatalogHierarchyScreen
6. Expand family "GLASSES"
7. Click "+" to add new article type "Glass Premium"
8. Verify article type added
9. Select family filter: "GLASSES"
10. Verify article type filter only shows types within GLASSES
11. Select article type: "Glass 3D"
12. Verify brand filter only shows brands with Glass 3D articles

### Level 6: Performance Validation

**Required Performance Tests**:
- Measure API response time for GET /api/customers (list with balance calculation)
- Expected: <2 seconds for 1000 customers
- Measure API response time for GET /api/products/filters
- Expected: <500ms for 5000 products
- Measure mobile app render time for CustomerDetailsScreen with 100 receivables
- Expected: <1 second initial render

**Commands**:
```bash
# API performance testing (if tools available)
# artillery quick --count 10 --num 100 http://localhost:3000/api/customers
# k6 run performance-tests/customers-list.js

# Manual measurement using curl
time curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/api/customers
```

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] **Customer Balance Improvements**:
  - [ ] Positive balances display in green badge (customer owes us)
  - [ ] Negative balances display in red badge (we owe customer)
  - [ ] Alert modal appears automatically for negative balances
  - [ ] "Rembourser Client" button creates cash exit and updates balance
  - [ ] Refund workflow validates amount doesn't exceed owed amount
  - [ ] Transaction history includes refunds with distinct icon
  - [ ] API endpoint POST /api/customers/:id/refund works correctly
  - [ ] API endpoint GET /api/customers/:id/refunds returns refund history

- [ ] **Supplier Balance Improvements**:
  - [ ] Positive balances display in green badge (we owe supplier)
  - [ ] Negative balances display in red badge (supplier owes us)
  - [ ] Alert modal appears for negative supplier balances
  - [ ] "Réclamer Remboursement" button creates cash entry and updates debt
  - [ ] Merchandise purchase workflow creates cash exit and optional debt
  - [ ] API endpoint POST /api/cash/merchandise-purchase works correctly
  - [ ] API endpoint POST /api/suppliers/:id/claim-refund works correctly
  - [ ] Supplier debt linked to cash exit via cash_exit_id

- [ ] **Product Catalog Improvements**:
  - [ ] Product Zod schema includes family, article_type, brand, reference fields
  - [ ] ProductCatalogScreen Catalogue tab shows hierarchical view
  - [ ] CatalogHierarchyScreen supports full CRUD operations
  - [ ] Batch hierarchy update endpoint works correctly
  - [ ] Cascade filters work: Family → Article Type → Brand → Reference
  - [ ] API endpoint POST /api/products/batch-update-hierarchy updates multiple products
  - [ ] API endpoint GET /api/products/filters accepts cascade filter params
  - [ ] Product count per hierarchy level is accurate

- [ ] **Testing & Quality**:
  - [ ] **ALL validation commands executed and pass with zero errors**
  - [ ] **ALL unit tests pass** - coverage meets 80% minimum for new code
  - [ ] **ALL integration tests pass** - end-to-end workflows verified
  - [ ] No regressions in existing functionality (existing tests still pass)
  - [ ] Manual UAT completed with positive feedback
  - [ ] Performance meets requirements (<2s list queries, <500ms single entity)

- [ ] **Code Quality**:
  - [ ] Code follows project conventions (service/controller/dto patterns)
  - [ ] Multi-tenancy maintained (all queries filter by shop_id)
  - [ ] Transaction atomicity verified (Prisma $transaction used correctly)
  - [ ] Optimistic concurrency maintained (version field incremented)
  - [ ] Role-based access control applied (appropriate @Roles decorators)
  - [ ] Error handling consistent (HttpException with proper status codes)

- [ ] **Documentation**:
  - [ ] API documentation updated with new endpoints
  - [ ] User help documentation added for balance concepts
  - [ ] Implementation report completed
  - [ ] Migration guide provided (if schema changes required)

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] All 50 tasks completed in order
- [ ] **Each task validation command executed and passed immediately**
- [ ] **All unit tests written and passing** (no skipped tests)
- [ ] **All integration tests written and passing**
- [ ] All validation commands executed successfully (Level 1-6)
- [ ] Full test suite passes (unit + integration + existing tests)
- [ ] No linting or type checking errors
- [ ] Manual testing completed and documented (UAT checklist)
- [ ] Performance testing completed, meets requirements
- [ ] All acceptance criteria met and verified
- [ ] Code reviewed for quality and maintainability
- [ ] **Test coverage report generated and meets 80% minimum**
- [ ] API documentation updated
- [ ] User help documentation added
- [ ] Implementation report finalized
- [ ] Database migrations tested and documented

---

## EXTERNAL RESOURCES AND REFERENCES

**MANDATORY SECTION - Include ALL relevant resources**:

### Official Documentation

- NestJS Documentation: https://docs.nestjs.com/
  - Controllers: https://docs.nestjs.com/controllers
  - Providers/Services: https://docs.nestjs.com/providers
  - Testing: https://docs.nestjs.com/fundamentals/testing
  - Validation: https://docs.nestjs.com/techniques/validation

- Prisma Documentation: https://www.prisma.io/docs
  - Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
  - Migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate
  - Testing: https://www.prisma.io/docs/guides/testing/integration-testing

- React Native Documentation: https://reactnative.dev/
  - Components: https://reactnative.dev/docs/components-and-apis
  - Modal: https://reactnative.dev/docs/modal
  - Alert: https://reactnative.dev/docs/alert

- Expo Documentation: https://docs.expo.dev/
  - Icons: https://docs.expo.dev/guides/icons/
  - Development: https://docs.expo.dev/workflow/development-mode/

- Zod Documentation: https://zod.dev/
  - Schema definition: https://zod.dev/?id=basic-usage
  - Validation: https://zod.dev/?id=parsing

### API References

- NestJS HTTP Exception Reference: https://docs.nestjs.com/exception-filters#built-in-http-exceptions
- Prisma Client API Reference: https://www.prisma.io/docs/reference/api-reference/prisma-client-reference
- React Native Component API: https://reactnative.dev/docs/components-and-apis

### Tutorials and Guides

- NestJS CRUD Tutorial: https://docs.nestjs.com/recipes/crud-generator
- Prisma Transaction Guide: https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide
- React Native Testing Guide: https://reactnative.dev/docs/testing-overview
- Expo Development Workflow: https://docs.expo.dev/workflow/overview/

### Internal Resources

- Project architecture: `CLAUDE.md` in project root
- Existing service patterns: `apps/api/src/modules/customers/customers.service.ts`
- Existing controller patterns: `apps/api/src/modules/customers/customers.controller.ts`
- Existing mobile screen patterns: `apps/mobile/src/screens/CustomerDetailsScreen.tsx`
- Existing DTO patterns: `apps/api/src/modules/receivables/dto/create-receivable.dto.ts`
- Theme constants: `apps/mobile/src/constants/theme.ts`
- API client patterns: `apps/mobile/src/lib/api.ts`
- Database schema: `apps/api/prisma/schema.prisma`

### Testing Resources

- Jest Documentation: https://jestjs.io/docs/getting-started
- Testing Library (React Native): https://callstack.github.io/react-native-testing-library/
- Supertest Documentation: https://github.com/visionmedia/supertest

---

## NOTES

### Design Decisions

**Balance Sign Convention**:
- Positive balance = Money owed TO us (receivable/debt exists)
- Negative balance = Money we owe (refund/overpayment)
- This convention is consistent across customers and suppliers
- UI uses color coding: Green (positive, good for us), Red (negative, we owe)

**Transaction Atomicity**:
- All refund operations use Prisma $transaction to ensure cash entry and balance update are atomic
- Merchandise purchases similarly use transactions to link cash exits with supplier debts
- Version field incremented on all updates for optimistic concurrency control

**Multi-tenancy**:
- All queries automatically filter by shop_id from JWT context
- No cross-shop data leakage possible
- Shop_id extracted in service layer, not controller

**Monetary Values**:
- All amounts stored as integers in centimes (FCFA cents)
- 1 FCFA = 100 centimes
- Display formatting uses formatMoney utility
- Validation ensures amounts are always positive integers

**Hierarchy Management**:
- Product catalog hierarchy: Family → Article Type → Brand → Reference
- Batch updates use Prisma updateMany for efficiency
- Cascade filters provide progressive narrowing of options
- Empty hierarchy levels allowed (optional fields in schema)

### Trade-offs

**Performance vs Consistency**:
- Balance calculation is performed on-demand (not cached) to ensure consistency
- For high-volume scenarios, consider adding denormalized balance fields with triggers
- Current approach prioritizes data integrity over speed

**UI Complexity vs Usability**:
- Added prominent alerts for negative balances may feel intrusive
- Alternative: Less prominent visual indicators (considered but rejected for clarity)
- Target users prefer explicit warnings over subtle indicators

**Flexibility vs Validation**:
- Product hierarchy fields are optional to allow gradual catalog build-up
- Strict validation would prevent incomplete products but reduce flexibility
- Chosen approach: Allow incomplete hierarchy, validate only when required for operations

### Important Reminders

- This plan contains ONLY functional specifications - NO code examples
- ALL tests must be written and passing before feature is considered complete
- ALL validation commands must execute successfully
- ALL acceptance criteria must be met
- Manual UAT with actual users is MANDATORY before production deployment
- Database migrations must be tested in staging environment before production
- Performance testing with realistic data volumes is REQUIRED

<!-- EOF -->
