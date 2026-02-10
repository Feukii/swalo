# Feature: 016-kpi-review-and-mobile-build

## Feature Description

This plan addresses two main concerns:

1. **Build/Deploy Issue**: Products list not visible and catalog import not working in the mobile app - determining if a full rebuild (Database + API + Mobile) is required
2. **KPI Review**: Comprehensive review and correction of all KPI calculations on the Home screen and Business Reports screen

## User Story

As a shop owner
I want to see accurate KPIs on my home screen and reports
So that I can make informed business decisions based on correct financial data

As a shop manager
I want to see and import my product catalog
So that I can manage my inventory effectively

## Problem Statement

1. **Products/Import not visible**: The user cannot see the product list or import catalog functionality in the mobile app. This could be due to:
   - Missing API deployment after recent changes
   - Mobile app not rebuilt after code changes
   - Database schema not migrated
   - Navigation issues

2. **KPI Calculation Issues**: The KPIs displayed need verification and potential correction:
   - Home Screen: Cash balance, entries, exits, sales (cash/credit), purchases (cash/credit)
   - Reports: Total sales, total purchases, customer balances, supplier balances, period calculations

## Solution Statement

1. **Build/Deploy Diagnosis**:
   - Verify database migrations are applied
   - Rebuild and redeploy the API
   - Rebuild the mobile app with Expo
   - Test the products endpoint and import functionality

2. **KPI Review**:
   - Audit all KPI calculation logic in `cash.service.ts`
   - Verify frontend display matches API response
   - Ensure credit sales/purchases are correctly included
   - Fix any calculation inconsistencies

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**: API (cash module), Mobile (HomeScreen, BusinessReportsScreen)
**Dependencies**: None

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

**API KPI Calculation:**

- `apps/api/src/modules/cash/cash.service.ts` (lines 309-467) - Main KPI calculation logic in `getStats()`
- `apps/api/src/modules/cash/cash.controller.ts` - Cash endpoints

**Mobile Home Screen:**

- `apps/mobile/src/screens/HomeScreen.tsx` (lines 64-173) - Data loading and state mapping
- `apps/mobile/src/screens/BusinessReportsScreen.tsx` (lines 227-659) - Reports KPI calculations

**Mobile API Client:**

- `apps/mobile/src/lib/api.ts` (lines 155-231) - Cash API client
- `apps/mobile/src/lib/api.ts` (lines 503-628) - Products API client

**Products and Import:**

- `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Product catalog screen
- `apps/api/src/modules/import/import.service.ts` - Import logic
- `apps/api/src/modules/products/products.controller.ts` - Products endpoints

### New Files to Create

- None required - this is a fix/review task

### Patterns to Follow

**KPI Calculation Pattern:**

- All monetary amounts are integers in FCFA (no decimals)
- Cash transactions use `CashEntry` model with `type: 'IN' | 'OUT'`
- Credit sales are tracked via `ClientReceivable` model
- Credit purchases are tracked via `SupplierDebt` model
- Total sales = salesCash + salesCredit
- Total purchases = purchasesCash + purchasesCredit

**Date Filtering Pattern:**

- API accepts `start_date` and `end_date` as ISO strings
- Frontend converts to Date objects for comparison
- Always filter by `created_at` field

---

## IMPLEMENTATION PLAN

### Phase 1: Diagnosis and Build

Verify the current state and rebuild all components.

**Tasks:**

- Run database migrations to ensure schema is up to date
- Rebuild and redeploy API
- Rebuild mobile app
- Test products endpoint

### Phase 2: KPI Calculation Review

Audit and fix all KPI calculations.

**Tasks:**

- Review `cash.service.ts` getStats() method
- Verify sales calculations (cash + credit)
- Verify purchases calculations (cash + credit)
- Ensure negative amounts (refunds/adjustments) are handled correctly

### Phase 3: Frontend Display Review

Verify the frontend correctly displays the KPI data.

**Tasks:**

- Review HomeScreen.tsx data mapping
- Review BusinessReportsScreen.tsx calculations
- Ensure consistency between API and frontend

### Phase 4: Testing & Validation

Test all functionality end-to-end.

**Tasks:**

- Test products list display
- Test catalog import
- Test KPI calculations with known data
- Verify reports accuracy

---

## STEP-BY-STEP TASKS

### Task 1: RUN Database Migrations

- **IMPLEMENT**: Execute Prisma migrations to ensure the database schema is current
- **DEPENDENCIES**: PostgreSQL database running
- **VALIDATE**: `cd apps/api && pnpm prisma migrate status`
- **ACTION**: If pending migrations exist, run `pnpm prisma migrate deploy`

### Task 2: BUILD and Deploy API

- **IMPLEMENT**: Build the NestJS API and verify it can start
- **DEPENDENCIES**: Node.js, pnpm
- **VALIDATE**: `cd apps/api && pnpm build && pnpm dev`
- **TEST_REQUIREMENT**: API should start without errors and respond to health check

### Task 3: TEST Products Endpoint

- **IMPLEMENT**: Verify the products API endpoint returns data
- **DEPENDENCIES**: API running
- **VALIDATE**: `curl http://localhost:3000/api/products` (with auth header)
- **TEST_REQUIREMENT**: Should return product list or empty array

### Task 4: BUILD Mobile App

- **IMPLEMENT**: Rebuild the Expo mobile app
- **DEPENDENCIES**: Expo CLI, Node.js
- **VALIDATE**: `cd apps/mobile && npx expo start --clear`
- **TEST_REQUIREMENT**: App should start and navigate to ProductCatalog screen

### Task 5: REVIEW cash.service.ts getStats() Method

- **IMPLEMENT**: Audit the KPI calculation logic for correctness
- **PATTERN**: Reference existing calculation at lines 309-467
- **VERIFY**:
  - `todayEntries` sums all CashEntry where type='IN' in date range
  - `todayExits` sums all CashEntry where type='OUT' in date range
  - `salesCash` sums CashEntry where type='IN' AND category in ['ventes', 'vente']
  - `salesCredit` sums ClientReceivable.amount in date range
  - `purchasesCash` sums CashEntry where type='OUT' AND category='achats_marchandises'
  - `purchasesCredit` sums SupplierDebt.amount in date range
  - `totalSales` = salesCash + salesCredit
  - `totalPurchases` = purchasesCash + purchasesCredit
- **GOTCHA**: Negative amounts in receivables/debts are adjustments, not actual sales/purchases
- **VALIDATE**: Review code and compare with expected calculations

### Task 6: VERIFY KPI Formulas - Entries Section

- **IMPLEMENT**: Confirm the Entries KPI formulas are correct
- **EXPECTED LOGIC**:
  - **Entrées Totales** = Sum of all CashEntry type='IN' (all categories)
  - **Total Ventes** = salesCash + salesCredit
  - **Ventes Cash** = Sum of CashEntry type='IN', category in ['ventes', 'vente']
  - **Ventes Crédit** = Sum of ClientReceivable.amount created in period (positive amounts only)
- **ISSUE CHECK**: Verify that refunds (negative ClientReceivable) are NOT counted as sales

### Task 7: VERIFY KPI Formulas - Exits Section

- **IMPLEMENT**: Confirm the Exits KPI formulas are correct
- **EXPECTED LOGIC**:
  - **Sorties Totales** = Sum of all CashEntry type='OUT' (all categories)
  - **Total Achats** = purchasesCash + purchasesCredit
  - **Achats Cash** = Sum of CashEntry type='OUT', category='achats_marchandises'
  - **Achats Crédit** = Sum of SupplierDebt.amount created in period (positive amounts only)
- **ISSUE CHECK**: Verify that refunds (negative SupplierDebt) are NOT counted as purchases

### Task 8: FIX KPI Calculation for Credit Sales/Purchases (if needed)

- **IMPLEMENT**: If issues found in tasks 5-7, fix the calculation logic
- **PATTERN**: Filter positive amounts only for sales/purchases totals
- **GOTCHA**: Negative receivables/debts are balance adjustments, should be excluded from totals
- **VALIDATE**: Run tests after changes

### Task 9: VERIFY HomeScreen Data Mapping

- **IMPLEMENT**: Confirm HomeScreen correctly maps API response to display
- **PATTERN**: Reference HomeScreen.tsx lines 150-167
- **VERIFY**:
  - `stats.totalEntries` maps to `statsData.todayEntries`
  - `stats.totalSales` maps to `statsData.totalSales`
  - `stats.salesCash` maps to `statsData.salesCash`
  - `stats.salesCredit` maps to `statsData.salesCredit`
  - Same for exits/purchases
- **VALIDATE**: Console.log both API response and mapped state

### Task 10: VERIFY BusinessReportsScreen Calculations

- **IMPLEMENT**: Confirm reports screen calculations match API
- **PATTERN**: Reference BusinessReportsScreen.tsx lines 283-300
- **VERIFY**:
  - Sales stats from API stats endpoint are used directly
  - Period filtering is applied correctly
  - Customer/Supplier balance calculations are correct
- **VALIDATE**: Compare displayed values with raw API responses

### Task 11: RUN Full Validation Suite

- **IMPLEMENT**: Execute complete validation
- **VALIDATE**: `pnpm run validate`
- **TEST_REQUIREMENT**: All tests pass, no lint errors

### Task 12: TEST End-to-End

- **IMPLEMENT**: Manual testing of all features
- **TEST CASES**:
  1. Open ProductCatalog screen - should show products list
  2. Try to add a new product - should succeed
  3. View Home screen - verify all KPIs show correct values
  4. View Reports screen - verify all sections show correct data
  5. Create a cash entry - verify it appears in today's entries
  6. Create a credit sale (receivable) - verify it appears in sales credit
  7. Create a credit purchase (debt) - verify it appears in purchases credit

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Cash service KPI calculations
**Requirements**:

- Test `getStats()` with various date ranges
- Test with mix of cash and credit transactions
- Test with negative amounts (adjustments)
  **VALIDATION COMMAND**: `cd apps/api && pnpm jest cash.service`

### Integration Tests

**Scope**: Full API endpoints
**Requirements**:

- Test cash/stats endpoint returns correct structure
- Test products endpoint returns data
  **VALIDATION COMMAND**: `cd apps/api && pnpm test`

### Manual Testing

**Test Scenarios**:

1. Products list visible after fresh build
2. KPIs match expected calculations
3. Reports show accurate data for selected periods

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
pnpm run validate
```

**Expected Result**: All lint checks pass

### Level 2: Unit Tests

```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

**Expected Result**: All tests pass

### Level 3: Build Verification

```bash
cd apps/api && pnpm build
cd apps/mobile && npx expo start --clear
```

**Expected Result**: Both apps build and start without errors

### Level 4: Manual Validation

1. Start API: `cd apps/api && pnpm dev`
2. Start Mobile: `cd apps/mobile && npx expo start`
3. Navigate to:
   - Home screen (verify KPIs)
   - More > Catalogue Articles (verify products list)
   - More > Rapports (verify reports)

---

## ACCEPTANCE CRITERIA

- [ ] Database migrations are applied
- [ ] API builds and starts without errors
- [ ] Mobile app builds and starts without errors
- [ ] Products list is visible in ProductCatalog screen
- [ ] Catalog import functionality works
- [ ] Home screen KPIs are accurate:
  - [ ] Solde de caisse = total IN - total OUT
  - [ ] Entrées = sum of all IN transactions in period
  - [ ] Total Ventes = salesCash + salesCredit
  - [ ] Ventes Cash matches CashEntry ventes category
  - [ ] Ventes Crédit matches positive ClientReceivable amounts
  - [ ] Sorties = sum of all OUT transactions in period
  - [ ] Total Achats = purchasesCash + purchasesCredit
  - [ ] Achats Cash matches CashEntry achats_marchandises category
  - [ ] Achats Crédit matches positive SupplierDebt amounts
- [ ] Business Reports show accurate data
- [ ] All validation commands pass

---

## COMPLETION CHECKLIST

- [ ] Task 1: Database migrations verified
- [ ] Task 2: API built and deployed
- [ ] Task 3: Products endpoint tested
- [ ] Task 4: Mobile app rebuilt
- [ ] Task 5: cash.service.ts reviewed
- [ ] Task 6: Entries KPIs verified
- [ ] Task 7: Exits KPIs verified
- [ ] Task 8: Fixes applied if needed
- [ ] Task 9: HomeScreen mapping verified
- [ ] Task 10: BusinessReportsScreen verified
- [ ] Task 11: Validation suite passed
- [ ] Task 12: End-to-end testing completed

---

## NOTES

### Key KPI Definitions

**Solde de Caisse (Cash Balance)**:

- Formula: Sum(CashEntry.amount where type='IN') - Sum(CashEntry.amount where type='OUT')
- This is ALL-TIME balance, not period-specific

**Entrées (Entries)**:

- Period-specific sum of all CashEntry where type='IN'
- Includes: ventes, remboursement_client, divers

**Total Ventes (Total Sales)**:

- salesCash + salesCredit
- salesCash: CashEntry type='IN', category in ['ventes', 'vente']
- salesCredit: ClientReceivable.amount created in period (POSITIVE only)

**Sorties (Exits)**:

- Period-specific sum of all CashEntry where type='OUT'
- Includes: achats_marchandises, loyers, reglement_fournisseur, depenses_courantes

**Total Achats (Total Purchases)**:

- purchasesCash + purchasesCredit
- purchasesCash: CashEntry type='OUT', category='achats_marchandises'
- purchasesCredit: SupplierDebt.amount created in period (POSITIVE only)

### Important Considerations

1. **Negative amounts**: ClientReceivable with negative amount = customer refund adjustment, NOT a sale
2. **Negative amounts**: SupplierDebt with negative amount = supplier refund adjustment, NOT a purchase
3. **Balance vs Period**: Cash balance is ALL-TIME, KPIs are PERIOD-specific
4. **Build requirement**: Changes to API code require rebuild/redeploy to see effects
5. **Mobile build**: Changes to mobile code require Expo rebuild

### Debugging Tips

If products don't appear:

1. Check API is running: `curl http://localhost:3000/api/health`
2. Check auth token: Look at API logs for 401 errors
3. Check console logs in ProductCatalogScreen for errors

If KPIs seem wrong:

1. Console.log the raw API response in HomeScreen
2. Compare with direct database queries
3. Check date filtering is correct
