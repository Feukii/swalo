# Feature: Fix Balance Display Division by 100

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Fix the balance display bug on CustomerDetailsScreen and SupplierDetailsScreen where balance values are incorrectly shown divided by 100. For example, a balance of 5000 FCFA displays as 50 instead of the correct value.

## User Story

As a shop owner/cashier
I want to see the correct customer and supplier balance amounts
So that I can accurately track who owes money and make informed business decisions

## Problem Statement

The `formatCurrency()` function in the mobile app divides all amounts by 100, assuming the API returns amounts in centimes. However, SWALO stores and returns all monetary amounts as integers in FCFA (CFA francs), which has no decimal places. This creates a display error where all balances appear as 1/100th of their actual value.

**Root Cause Analysis (8/8 agents agree):**
- Location: `apps/mobile/src/utils/currency.ts` line 8
- Issue: `const amountInMainUnit = amount / 100;` - incorrect division
- Impact: BalanceIndicator component uses this function, affecting both CustomerDetailsScreen and SupplierDetailsScreen

## Solution Statement

Remove the `/100` division from the `formatCurrency()` function since SWALO uses FCFA which is already stored as integers (no centimes conversion needed). Alternatively, replace `formatCurrency()` usage with `formatMoney()` which correctly handles FCFA amounts.

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Low
**Primary Systems Affected**: Mobile app - currency formatting utilities, BalanceIndicator component
**Dependencies**: None

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `apps/mobile/src/utils/currency.ts` (lines 6-10) - Why: Contains the buggy `formatCurrency()` function that divides by 100
- `apps/mobile/src/utils/money.ts` (lines 8-20) - Why: Contains the correct `formatMoney()` function that does NOT divide by 100
- `apps/mobile/src/components/ui/BalanceIndicator.tsx` (line 5, 77) - Why: Imports and uses `formatCurrency()` to display balances
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 680-684) - Why: Uses BalanceIndicator to display customer balance
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` (lines 693-697) - Why: Uses BalanceIndicator to display supplier balance
- `CLAUDE.md` (line 60) - Why: Documents that amounts are stored as integers in FCFA

### New Files to Create

None required - this is a bug fix in existing files.

### Relevant Documentation

- Project documentation in `CLAUDE.md` states: "All monetary amounts stored as integers in FCFA (CFA francs, no decimals needed for this currency)"

### Patterns to Follow

**Currency Formatting Pattern:**
- The correct pattern is demonstrated in `formatMoney()` function in `money.ts`
- Format amounts directly without division, using space separators for thousands
- Return format: `"5 000 F"` for 5000 FCFA

**Naming Conventions:**
- Utility functions use camelCase
- Currency-related functions are in `src/utils/` directory

---

## IMPLEMENTATION PLAN

### Phase 1: Fix Currency Formatting

Update the `formatCurrency()` function to remove the incorrect `/100` division.

**Tasks:**
- Read and understand the current `formatCurrency()` implementation
- Remove the `/100` division
- Update the comment to reflect that amounts are in FCFA, not centimes

### Phase 2: Verify BalanceIndicator

Ensure BalanceIndicator displays correctly after the fix.

**Tasks:**
- Verify BalanceIndicator uses the updated function
- Check that display format is consistent with other money displays in the app

### Phase 3: Testing & Validation

Validate the fix works correctly.

**Tasks:**
- Run linting to ensure no syntax errors
- Verify the fix visually (amounts should display correctly)

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `apps/mobile/src/utils/currency.ts`

- **IMPLEMENT**: Remove the `/100` division from the `formatCurrency()` function. The function should format the amount directly since SWALO stores amounts as integers in FCFA (not centimes). Update the comment to reflect that amounts are already in FCFA.
- **PATTERN**: Follow the `formatMoney()` function in `apps/mobile/src/utils/money.ts` which correctly handles FCFA amounts without division
- **DEPENDENCIES**: None
- **GOTCHA**: The existing comment says "L'API retourne les montants en centimes" which is incorrect - update this comment
- **RESOURCES**: CLAUDE.md documentation on currency storage
- **VALIDATE**: `cd apps/mobile && npx eslint src/utils/currency.ts`
- **TEST_REQUIREMENT**: Function should return "5 000 FCFA" when given input 5000

### Task 2: UPDATE comment in `apps/mobile/src/components/ui/BalanceIndicator.tsx`

- **IMPLEMENT**: Update the JSDoc comment on line 8 from "Balance in centimes" to "Balance in FCFA" to reflect the correct data format
- **PATTERN**: Standard TypeScript documentation comments
- **DEPENDENCIES**: Task 1 must be completed first
- **GOTCHA**: This is a documentation-only change to prevent future confusion
- **VALIDATE**: `cd apps/mobile && npx eslint src/components/ui/BalanceIndicator.tsx`
- **TEST_REQUIREMENT**: No functional change, just documentation accuracy

### Task 3: VERIFY display consistency

- **IMPLEMENT**: Verify that CustomerDetailsScreen and SupplierDetailsScreen now display balances correctly (e.g., 5000 FCFA should show as "5 000 FCFA" not "50 FCFA")
- **PATTERN**: Visual verification against formatMoney() output format
- **DEPENDENCIES**: Tasks 1 and 2 must be completed
- **VALIDATE**: `cd apps/mobile && pnpm run lint`
- **TEST_REQUIREMENT**: Balance display should match the correct FCFA amount without /100 division

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Currency formatting functions
**Requirements**:
- Verify `formatCurrency(5000)` returns a string containing "5 000" (not "50")
- Verify `formatCurrency(100)` returns a string containing "100" (not "1")
- Verify `formatCurrency(0)` handles zero correctly
- **VALIDATION COMMAND**: `cd apps/mobile && pnpm run test`

### Manual Testing

**Test Scenarios**:
1. Open CustomerDetailsScreen for a customer with a known balance
2. Verify the displayed balance matches the expected FCFA amount
3. Open SupplierDetailsScreen for a supplier with a known balance
4. Verify the displayed balance matches the expected FCFA amount

### Edge Cases

- Zero balance should display as "0 FCFA"
- Negative balance should display correctly with minus sign
- Large amounts (e.g., 1,000,000 FCFA) should display with proper thousand separators

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/mobile && npx eslint src/utils/currency.ts
cd apps/mobile && npx eslint src/components/ui/BalanceIndicator.tsx
```

**Expected Result**: Zero errors

### Level 2: Full Lint

```bash
cd apps/mobile && pnpm run lint
```

**Expected Result**: No new errors introduced (existing warnings may remain)

### Level 3: Type Check

```bash
cd apps/mobile && pnpm run type-check
```

**Expected Result**: No new type errors introduced

### Level 4: Tests

```bash
cd apps/mobile && pnpm run test
```

**Expected Result**: All tests pass

---

## ACCEPTANCE CRITERIA

- [ ] `formatCurrency()` function no longer divides by 100
- [ ] Comment in `currency.ts` updated to reflect FCFA (not centimes)
- [ ] Comment in `BalanceIndicator.tsx` updated from "centimes" to "FCFA"
- [ ] CustomerDetailsScreen displays correct balance amounts
- [ ] SupplierDetailsScreen displays correct balance amounts
- [ ] All linting passes with no new errors
- [ ] All existing tests still pass
- [ ] Balance of 5000 FCFA displays as "5 000 FCFA" (not "50 FCFA")

---

## COMPLETION CHECKLIST

- [ ] Task 1 completed: `formatCurrency()` fixed in currency.ts
- [ ] Task 2 completed: Comment updated in BalanceIndicator.tsx
- [ ] Task 3 completed: Display verified
- [ ] All validation commands executed successfully
- [ ] Manual testing confirms correct balance display
- [ ] No regressions in existing functionality

---

## NOTES

**Why This Bug Occurred:**
The `formatCurrency()` function was written with an incorrect assumption that the API returns amounts in centimes. However, SWALO uses FCFA (CFA francs) which is a currency with no decimal places - amounts are stored directly as integers representing the actual FCFA value.

**Recent Context:**
The codebase recently had `* 100` multiplications removed from input handlers (CustomerDetailsScreen, SupplierDetailsScreen, POSScreen, SuppliersScreen) because inputs were already in FCFA. However, the corresponding display function (`formatCurrency`) still divided by 100, creating an asymmetry.

**Alternative Fix Considered:**
Instead of fixing `formatCurrency()`, we could replace its usage in BalanceIndicator with `formatMoney()`. However, fixing `formatCurrency()` is cleaner as it corrects the root cause and ensures consistency if the function is used elsewhere in the future.

<!-- EOF -->
