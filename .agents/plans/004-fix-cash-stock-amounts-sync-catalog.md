# Feature: Fix Cash Screen, Stock Reduction, Amount Handling, Sync & Catalog

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

This plan addresses five critical bugs in the SWALO application:

1. **Remove "Achat Marchandise" Button**: Remove the merchandise purchase button and all related code from the CashScreen as this functionality is not needed.

2. **Fix Stock Reduction on Sale**: Currently when a sale is made, stock INCREASES instead of DECREASES. This is caused by a double-negative bug in the inventory service where subtracting a negative quantity results in addition.

3. **Fix Amount Division by 100**: When entering amounts (e.g., creating a receivable of 25000), the display shows 250 instead of 25000. Remove all erroneous divisions by 100 on input fields.

4. **Synchronize Customer/Supplier Operations**: Ensure all operations (refunds, receivables, debts, payments) are reflected in real-time across all related screens using useFocusEffect.

5. **Fix Product Catalog Hierarchy Batch Update**: The mobile client sends a `filters` wrapper object but the backend DTO expects flat properties.

## User Story

As a SWALO shop employee,
I want sales to correctly reduce stock quantities,
So that my inventory counts remain accurate.

As a SWALO shop employee,
I want amounts I enter to display correctly without being divided,
So that financial records are accurate.

As a SWALO shop employee,
I want all customer/supplier screens to show updated data when I navigate to them,
So that I always see the current state of accounts.

## Problem Statement

1. **Merchandise Button**: The CashScreen contains a merchandise purchase feature (lines 652-658) that is not needed and clutters the interface. Related state, handlers, and modal code should be removed.

2. **Stock Calculation Bug**: In `apps/api/src/modules/inventory/inventory.service.ts`, the stock calculation at lines 56-64 performs `stock -= movement.qty`. Since SALE movements have NEGATIVE quantities (e.g., -5), subtracting a negative adds to stock instead of reducing it.

3. **Amount Division Bug**: Some screens incorrectly assume amounts are in centimes and divide by 100 on display, or fail to multiply by 100 on input. The project uses integers in centimes, so:
   - Input: User enters 25000 FCFA -> API receives 2500000 centimes
   - Display: API returns 2500000 centimes -> Display 25000 FCFA

   Found issues:
   - `CustomerDetailsScreen.tsx` lines 485, 496: createReceivable does NOT multiply by 100 (BUG)
   - Other screens may have similar issues

4. **Sync Issues**: Some screens may not refresh data when navigating back to them after performing operations on related screens.

5. **Catalog Hierarchy**: `batchUpdateHierarchy` in `api.ts` wraps filters in a `filters` object, but the backend `BatchUpdateHierarchyDto` expects flat properties (family, article_type, brand) at the root level.

## Solution Statement

1. **Merchandise Button**: Delete all merchandise-related code from CashScreen.tsx including state variables, handler functions, button JSX, and modal component.

2. **Stock Calculation**: Change the calculation from `stock -= movement.qty` to `stock += movement.qty`. Since SALE movements already have negative quantities, adding them will correctly reduce stock.

3. **Amount Handling**: Standardize that:
   - All API calls receive amounts in centimes (user input \* 100)
   - All displays show amounts in FCFA (API value / 100)
   - Fix CustomerDetailsScreen.tsx createReceivable to multiply by 100

4. **Sync**: Add `useFocusEffect` to all customer/supplier related screens to refresh data on focus.

5. **Catalog Hierarchy**: Update the `batchUpdateHierarchy` function to send flat properties matching the DTO structure.

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Medium
**Primary Systems Affected**: API inventory service, Mobile CashScreen, Mobile CustomerDetailsScreen, Mobile API client
**Dependencies**: None (internal changes only)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

#### Stock Bug

- `apps/api/src/modules/inventory/inventory.service.ts` (lines 50-70) - Why: Contains the CRITICAL stock calculation bug
- `apps/api/src/modules/sales/sales.service.ts` - Why: Creates inventory movements with negative quantities for sales

#### Cash Screen

- `apps/mobile/src/screens/CashScreen.tsx` (lines 115-123, 521-579, 652-658, 1279-1418) - Why: Contains merchandise purchase code to remove

#### Amount Bug

- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 424, 485, 496) - Why: Shows inconsistent amount handling
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Why: May have similar amount handling issues
- `apps/mobile/src/utils/money.ts` - Why: Contains correct money formatting functions

#### Sync

- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Why: Check for useFocusEffect implementation
- `apps/mobile/src/screens/CustomersScreen.tsx` - Why: Check for useFocusEffect implementation
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Why: Check for useFocusEffect implementation
- `apps/mobile/src/screens/SuppliersScreen.tsx` - Why: Check for useFocusEffect implementation

#### Catalog Hierarchy

- `apps/mobile/src/lib/api.ts` (batchUpdateHierarchy function) - Why: Sends incorrect payload structure
- `apps/api/src/modules/products/dto/batch-update-hierarchy.dto.ts` - Why: Defines expected DTO structure
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - Why: Uses the batchUpdateHierarchy function

### New Files to Create

- None

### Files to Delete

- None

### Patterns to Follow

**Amount Conversion Pattern:**

```
User Input (FCFA) -> API (centimes): amount * 100
API (centimes) -> Display (FCFA): amount / 100
```

**useFocusEffect Pattern:**

```typescript
useFocusEffect(
  useCallback(() => {
    fetchData();
  }, [shopId, customerId])
);
```

---

## IMPLEMENTATION PLAN

### Phase 1: Fix Stock Calculation (Critical)

This is the most critical fix. The inventory service must correctly calculate stock.

### Phase 2: Remove Merchandise Purchase Feature

Clean removal of all merchandise-related code from CashScreen.

### Phase 3: Fix Amount Handling

Ensure consistent centimes conversion across all input fields.

### Phase 4: Ensure Screen Sync

Verify useFocusEffect is properly implemented on all relevant screens.

### Phase 5: Fix Catalog Hierarchy API

Correct the payload structure for batchUpdateHierarchy.

### Phase 6: Testing & Validation

Run all tests and manual verification.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: FIX - Stock calculation in inventory.service.ts

- **IMPLEMENT**: In `apps/api/src/modules/inventory/inventory.service.ts`, find the stock calculation loop (around lines 56-64) and change `stock -= movement.qty` to `stock += movement.qty`
- **PATTERN**: SALE movements have negative qty (-5 means sold 5 units). Adding negative = subtracting. Current code subtracts negative = adding (BUG).
- **DEPENDENCIES**: None
- **GOTCHA**: Do NOT change the sign of movement.qty anywhere else - the fix is only in the aggregation logic
- **VALIDATE**: Create a test sale and verify stock decreases
- **TEST_REQUIREMENT**: After selling 5 units of a product with stock 100, stock should be 95 (not 105)

### Task 2: REMOVE - Merchandise purchase state variables from CashScreen

- **IMPLEMENT**: In `apps/mobile/src/screens/CashScreen.tsx`, remove the following state variables (around lines 115-123):
  - `showMerchandiseModal`
  - `merchandiseSupplier`
  - `merchandiseAmount`
  - `merchandiseNote`
  - `merchandisePaymentMethod`
  - `isLoadingMerchandise`
- **PATTERN**: Standard state cleanup
- **DEPENDENCIES**: None
- **GOTCHA**: These variables are used in other parts of the file that will be removed in subsequent tasks
- **VALIDATE**: File should compile after all merchandise code is removed
- **TEST_REQUIREMENT**: No TypeScript errors after full cleanup

### Task 3: REMOVE - Merchandise purchase handler functions from CashScreen

- **IMPLEMENT**: Remove the handler functions (around lines 521-579):
  - `handleMerchandisePurchase`
  - `resetMerchandiseForm`
  - Any other merchandise-related functions
- **PATTERN**: Standard function cleanup
- **DEPENDENCIES**: Task 2 completed
- **GOTCHA**: Functions may call API endpoints - just remove the functions, don't touch the API
- **VALIDATE**: File should compile after all merchandise code is removed
- **TEST_REQUIREMENT**: No TypeScript errors

### Task 4: REMOVE - Merchandise purchase button from CashScreen

- **IMPLEMENT**: Remove the merchandise purchase button JSX (around lines 652-658):
  - Find the TouchableOpacity or Button component for "Achat Marchandise"
  - Remove the entire button component
- **PATTERN**: Standard JSX cleanup
- **DEPENDENCIES**: Tasks 2, 3 completed
- **GOTCHA**: May be wrapped in a View or other container - only remove the button, not the container if it has other buttons
- **VALIDATE**: `cd apps/mobile && pnpm run lint`
- **TEST_REQUIREMENT**: Button no longer appears on CashScreen

### Task 5: REMOVE - Merchandise purchase modal from CashScreen

- **IMPLEMENT**: Remove the merchandise modal component (around lines 1279-1418):
  - Find the Modal component for merchandise purchase
  - Remove the entire modal JSX
- **PATTERN**: Standard JSX cleanup
- **DEPENDENCIES**: Tasks 2, 3, 4 completed
- **GOTCHA**: Ensure you're removing the correct modal (there may be multiple modals on this screen)
- **VALIDATE**: `cd apps/mobile && pnpm run type-check`
- **TEST_REQUIREMENT**: No errors, merchandise functionality completely removed

### Task 6: FIX - Amount handling in CustomerDetailsScreen createReceivable

- **IMPLEMENT**: In `apps/mobile/src/screens/CustomerDetailsScreen.tsx`, find the createReceivable API call (around lines 485, 496) and ensure the amount is multiplied by 100 before sending to API
- **PATTERN**: `amount: parseFloat(amountInput) * 100` or similar
- **DEPENDENCIES**: None
- **GOTCHA**: Check if the amount is already being multiplied somewhere - don't double-multiply. Look at how refund (line 424) does it correctly.
- **VALIDATE**: Create a receivable of 25000 FCFA and verify it shows as 25000 (not 250)
- **TEST_REQUIREMENT**: Creating a receivable of 25000 displays as 25000 FCFA

### Task 7: VERIFY - Amount handling in SupplierDetailsScreen

- **IMPLEMENT**: Check `apps/mobile/src/screens/SupplierDetailsScreen.tsx` for similar amount handling issues with createDebt and other operations
- **PATTERN**: Same as Task 6 - amounts to API should be \* 100
- **DEPENDENCIES**: None
- **GOTCHA**: May already be correct - only fix if there's an issue
- **VALIDATE**: Create a debt and verify amount displays correctly
- **TEST_REQUIREMENT**: All supplier amounts display correctly

### Task 8: VERIFY - useFocusEffect on CustomerDetailsScreen

- **IMPLEMENT**: Verify `apps/mobile/src/screens/CustomerDetailsScreen.tsx` uses useFocusEffect to refresh data on screen focus
- **PATTERN**:
  ```typescript
  useFocusEffect(
    useCallback(() => {
      fetchCustomerDetails();
    }, [customerId])
  );
  ```
- **DEPENDENCIES**: None
- **GOTCHA**: May already be implemented - only add if missing
- **VALIDATE**: Navigate away and back - data should refresh
- **TEST_REQUIREMENT**: Screen refreshes data when navigating back to it

### Task 9: VERIFY - useFocusEffect on CustomersScreen

- **IMPLEMENT**: Verify `apps/mobile/src/screens/CustomersScreen.tsx` uses useFocusEffect to refresh the customer list on screen focus
- **PATTERN**: Same as Task 8
- **DEPENDENCIES**: None
- **GOTCHA**: May already be implemented
- **VALIDATE**: Create a customer on another screen, navigate back - should appear
- **TEST_REQUIREMENT**: Customer list refreshes on focus

### Task 10: VERIFY - useFocusEffect on SupplierDetailsScreen

- **IMPLEMENT**: Verify `apps/mobile/src/screens/SupplierDetailsScreen.tsx` uses useFocusEffect
- **PATTERN**: Same as Task 8
- **DEPENDENCIES**: None
- **GOTCHA**: May already be implemented
- **VALIDATE**: Navigate away and back - data should refresh
- **TEST_REQUIREMENT**: Screen refreshes data when navigating back

### Task 11: VERIFY - useFocusEffect on SuppliersScreen

- **IMPLEMENT**: Verify `apps/mobile/src/screens/SuppliersScreen.tsx` uses useFocusEffect
- **PATTERN**: Same as Task 8
- **DEPENDENCIES**: None
- **GOTCHA**: May already be implemented
- **VALIDATE**: Create a supplier on another screen, navigate back - should appear
- **TEST_REQUIREMENT**: Supplier list refreshes on focus

### Task 12: FIX - batchUpdateHierarchy API payload structure

- **IMPLEMENT**: In `apps/mobile/src/lib/api.ts`, find the `batchUpdateHierarchy` function and change the payload structure from:
  ```typescript
  { level, old_value, new_value, filters: { family, article_type, brand } }
  ```
  to:
  ```typescript
  {
    (level, old_value, new_value, family, article_type, brand);
  }
  ```
- **PATTERN**: Flat object structure matching BatchUpdateHierarchyDto
- **DEPENDENCIES**: None
- **GOTCHA**: The backend DTO expects family, article_type, brand at root level, not nested in filters
- **VALIDATE**: Call batchUpdateHierarchy and verify it works without 400 error
- **TEST_REQUIREMENT**: Batch update hierarchy API call succeeds

### Task 13: VALIDATE - Run API tests

- **IMPLEMENT**: Run all API unit tests to ensure nothing is broken
- **PATTERN**: Standard test execution
- **DEPENDENCIES**: Tasks 1-12 completed
- **GOTCHA**: Some tests may need updating if they tested the old (buggy) behavior
- **VALIDATE**: `cd apps/api && pnpm run test`
- **TEST_REQUIREMENT**: All tests pass

### Task 14: VALIDATE - Run mobile lint and type-check

- **IMPLEMENT**: Run linting and type checking on mobile app
- **PATTERN**: Standard validation
- **DEPENDENCIES**: Tasks 1-12 completed
- **GOTCHA**: May have warnings unrelated to this change - focus on errors
- **VALIDATE**: `cd apps/mobile && pnpm run lint && pnpm run type-check`
- **TEST_REQUIREMENT**: No errors

### Task 15: VALIDATE - Run full validation

- **IMPLEMENT**: Run the full validation script
- **PATTERN**: Standard validation
- **DEPENDENCIES**: Tasks 13, 14 completed
- **GOTCHA**: None
- **VALIDATE**: `pnpm run validate`
- **TEST_REQUIREMENT**: All validations pass

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Inventory stock calculation
**Requirements**:

- Test that SALE movements (negative qty) reduce stock
- Test that PURCHASE movements (positive qty) increase stock
- Test stock calculation with mixed movement types

**Test Cases**:

- Initial stock 100, SALE of -5 = stock 95
- Initial stock 100, PURCHASE of +10 = stock 110
- Initial stock 100, SALE -5, PURCHASE +10 = stock 105

**VALIDATION COMMAND**: `cd apps/api && pnpm run test`

### Integration Tests

**Scope**: Full sale flow with stock reduction
**Requirements**:

- Create a product with stock 100
- Make a sale of 5 units
- Verify stock is now 95 (not 105)

**Scope**: Customer receivable amount handling
**Requirements**:

- Create receivable of 25000 FCFA
- Verify API receives 2500000 centimes
- Verify display shows 25000 FCFA

**VALIDATION COMMAND**: Manual testing via mobile app

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:

- Stock reduction to exactly 0
- Stock reduction that would go negative (should be blocked or allowed based on business rules)
- Large amounts: 1,000,000 FCFA
- Small amounts: 1 FCFA
- Batch hierarchy update with all filter levels

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
```

**Expected Result**: Zero errors

### Level 2: Type Checking

```bash
cd apps/api && pnpm run type-check
cd apps/mobile && pnpm run type-check
```

**Expected Result**: No type errors

### Level 3: Unit Tests

```bash
cd apps/api && pnpm run test
cd apps/mobile && pnpm run test
```

**Expected Result**: All tests pass

### Level 4: Manual Verification

1. **Stock Test**:
   - Note current stock of a product (e.g., 100)
   - Make a sale of 5 units
   - Verify stock is now 95

2. **Amount Test**:
   - Go to customer details
   - Create receivable of 25000
   - Verify it shows as 25000 FCFA (not 250)

3. **Sync Test**:
   - Go to customer list
   - Go to customer details
   - Create a receivable
   - Go back to customer list
   - Verify balance is updated

4. **Catalog Test**:
   - Go to catalog hierarchy
   - Try batch update
   - Verify it works without error

### Level 5: Full Validation

```bash
pnpm run validate
```

**Expected Result**: All lint and test steps pass

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Stock DECREASES when a sale is made (not increases)
- [ ] "Achat Marchandise" button is completely removed from CashScreen
- [ ] All merchandise-related state, handlers, and modal code removed
- [ ] Creating a receivable of 25000 displays as 25000 (not 250)
- [ ] All customer/supplier screens refresh data on focus
- [ ] Batch update hierarchy API works correctly
- [ ] **ALL validation commands executed and pass with zero errors**
- [ ] No TypeScript errors
- [ ] No ESLint errors

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Task 1: Stock calculation fixed (stock += movement.qty)
- [ ] Task 2: Merchandise state variables removed
- [ ] Task 3: Merchandise handler functions removed
- [ ] Task 4: Merchandise button removed
- [ ] Task 5: Merchandise modal removed
- [ ] Task 6: CustomerDetailsScreen amount handling fixed
- [ ] Task 7: SupplierDetailsScreen amount handling verified
- [ ] Task 8: CustomerDetailsScreen useFocusEffect verified
- [ ] Task 9: CustomersScreen useFocusEffect verified
- [ ] Task 10: SupplierDetailsScreen useFocusEffect verified
- [ ] Task 11: SuppliersScreen useFocusEffect verified
- [ ] Task 12: batchUpdateHierarchy payload fixed
- [ ] Task 13: API tests pass
- [ ] Task 14: Mobile lint and type-check pass
- [ ] Task 15: Full validation passes
- [ ] Manual testing: stock reduction works
- [ ] Manual testing: amounts display correctly
- [ ] Manual testing: screens sync properly
- [ ] Manual testing: catalog hierarchy works
- [ ] All acceptance criteria met

---

## EXTERNAL RESOURCES AND REFERENCES

### Internal Resources

- Stock movements: `apps/api/src/modules/inventory/inventory.service.ts`
- Sales flow: `apps/api/src/modules/sales/sales.service.ts`
- Money utilities: `apps/mobile/src/utils/money.ts`
- API client: `apps/mobile/src/lib/api.ts`

### Patterns Reference

- useFocusEffect: https://reactnavigation.org/docs/use-focus-effect/

---

## NOTES

**Critical Bug Priority:**

1. Stock calculation (CRITICAL - data integrity)
2. Amount handling (HIGH - financial accuracy)
3. Merchandise removal (MEDIUM - cleanup)
4. Sync (MEDIUM - UX)
5. Catalog hierarchy (LOW - feature completion)

**Root Cause Analysis:**

1. **Stock Bug**: The inventory service calculates stock by iterating over movements and doing `stock -= movement.qty`. Since SALE movements have negative quantities (e.g., -5 for selling 5 units), subtracting a negative results in addition: `100 - (-5) = 105`. The fix is to use `stock += movement.qty` so that: `100 + (-5) = 95`.

2. **Amount Bug**: The project uses centimes (integers) for all monetary storage. Some screens were not multiplying user input by 100 before sending to API, causing amounts to be 100x smaller than intended.

3. **Catalog Bug**: The mobile client was wrapping filter properties in a `filters` object, but the backend DTO validates properties at the root level.

**Risk Assessment:**

- Stock fix: Medium (affects inventory calculations)
- Merchandise removal: Low (removing unused code)
- Amount fix: Medium (affects financial data)
- Sync fix: Low (UX improvement)
- Catalog fix: Low (simple payload change)

**Important Reminders**:

- Test stock calculation thoroughly before and after fix
- Verify no other code depends on the buggy stock behavior
- Check all screens for amount handling consistency
- ALL tests must pass before feature is considered complete

<!-- EOF -->
