# Feature: Harmonize Amount Handling & Catalog Hierarchy Integration

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

This plan addresses two critical issues:

1. **Amount Handling Harmonization**: Remove ALL multiplication and division operations on user-entered amounts. The user enters amounts in FCFA, and they should be stored and displayed exactly as entered without any conversion.

2. **Catalog Hierarchy Integration**: Add hierarchy editing functionality directly into the ProductCatalogScreen's "Catalogue" tab, allowing users to edit family/article_type/brand names without navigating to a separate screen.

## User Story

As a SWALO shop employee,
I want to enter amounts exactly as I see them (e.g., 25000 FCFA) and see them displayed the same way,
So that I don't get confused by unexpected conversions.

As a SWALO shop employee,
I want to edit product hierarchy (family, article type, brand) directly from the Catalogue tab,
So that I can quickly fix typos or rename categories without navigating to another screen.

## Problem Statement

### Problem 1: Amount Handling Chaos

The codebase has inconsistent amount handling:
- **Database**: Stores amounts as `Int` (documented as "centimes" in CLAUDE.md)
- **Some screens multiply by 100**: CustomerDetailsScreen (lines 424, 485), SupplierDetailsScreen (lines 202, 234, 475, 535), POSScreen (line 319), SuppliersScreen (line 109)
- **Some screens DON'T multiply**: CashScreen uses `parseFloat(amount)` directly
- **formatMoney()**: Displays amount as-is without division

This creates a situation where:
- If user enters 25000 in CustomerDetailsScreen -> API receives 2500000 -> displays as "2 500 000 F"
- If user enters 25000 in CashScreen -> API receives 25000 -> displays as "25 000 F"

**User's explicit requirement**: NO multiplication or division on any amount input.

### Problem 2: Catalogue Tab is Read-Only

The ProductCatalogScreen has two tabs:
- **Articles tab**: Full CRUD for products (works correctly)
- **Catalogue tab**: Read-only table view - NO editing capability

The user expects to edit hierarchy directly from the Catalogue tab, but the feature is missing. Currently users must:
1. Click "Hierarchie" button in header
2. Navigate to CatalogHierarchyScreen
3. Make changes there

This is the 5th time the user has requested this functionality.

## Solution Statement

### Solution 1: Remove ALL * 100 Operations

Since the user explicitly wants NO conversions, we will:
1. Remove all `* 100` operations from amount inputs
2. Store amounts in FCFA (not centimes) as the user enters them
3. Display amounts exactly as stored
4. Update CLAUDE.md to reflect that amounts are stored in FCFA, not centimes

### Solution 2: Add Hierarchy Editing to Catalogue Tab

Integrate hierarchy editing directly into the Catalogue tab:
1. Add edit buttons next to family names in the table view
2. Add inline editing or modal for renaming families, article types, and brands
3. Call `batchUpdateHierarchy` API when saving changes
4. Refresh the product list after successful update

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- All mobile screens with amount inputs
- ProductCatalogScreen (Catalogue tab)
- Backend DTOs and documentation

**Dependencies**: None (internal changes only)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

#### Amount Handling Files - REMOVE * 100

- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 424, 485) - Why: Contains `* 100` to remove
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` (lines 202, 234, 475, 535) - Why: Contains `* 100` to remove
- `apps/mobile/src/screens/POSScreen.tsx` (line 319) - Why: Contains `* 100` to remove
- `apps/mobile/src/screens/SuppliersScreen.tsx` (line 109) - Why: Contains `* 100` to remove
- `apps/mobile/src/screens/CashScreen.tsx` - Why: Reference for correct pattern (no * 100)
- `apps/mobile/src/utils/money.ts` - Why: formatMoney displays as-is (correct)

#### Catalog Hierarchy Files

- `apps/mobile/src/screens/ProductCatalogScreen.tsx` (lines 484-534) - Why: Catalogue tab to enhance
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - Why: Reference implementation for hierarchy editing
- `apps/mobile/src/lib/api.ts` (batchUpdateHierarchy function) - Why: API to call for updates

#### Backend Reference

- `apps/api/prisma/schema.prisma` - Why: Confirm field types
- `CLAUDE.md` - Why: Documentation to update

### New Files to Create

- None

### Files to Delete

- None

### Patterns to Follow

**Correct Amount Input Pattern (from CashScreen):**
- User enters amount in TextInput
- Parse with `parseFloat(amount)` or `parseInt(amount)`
- Send directly to API without any `* 100`
- API stores the value as-is

**Hierarchy Editing Pattern (from CatalogHierarchyScreen):**
- User clicks edit button on a family/type/brand name
- Modal opens with current value
- User modifies value
- Call `batchUpdateHierarchy` API with level, old_value, new_value
- Refresh product list on success

---

## IMPLEMENTATION PLAN

### Phase 1: Remove Amount Multiplications

Remove all `* 100` operations from amount inputs across the mobile app.

### Phase 2: Add Hierarchy Editing to Catalogue Tab

Enhance the ProductCatalogScreen's Catalogue tab with editing capabilities.

### Phase 3: Update Documentation

Update CLAUDE.md to clarify that amounts are stored in FCFA.

### Phase 4: Testing & Validation

Verify all amount flows and hierarchy editing work correctly.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: REMOVE - * 100 from CustomerDetailsScreen refund

- **IMPLEMENT**: In `apps/mobile/src/screens/CustomerDetailsScreen.tsx`, find line 424 and remove the `* 100` multiplication. Change `Math.round(parseFloat(customerRefundAmount) * 100)` to `Math.round(parseFloat(customerRefundAmount))`
- **PATTERN**: Follow CashScreen pattern where amounts are parsed directly
- **DEPENDENCIES**: None
- **GOTCHA**: Ensure the API can handle FCFA values (not centimes)
- **VALIDATE**: Manual test - create a refund of 25000, verify it displays as 25000
- **TEST_REQUIREMENT**: Refund of 25000 shows as 25000 F (not 2500000 F or 250 F)

### Task 2: REMOVE - * 100 from CustomerDetailsScreen receivable

- **IMPLEMENT**: In `apps/mobile/src/screens/CustomerDetailsScreen.tsx`, find line 485 and remove the `* 100` multiplication. Change `Math.round(parseFloat(receivableAmount) * 100)` to `Math.round(parseFloat(receivableAmount))`
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: None
- **GOTCHA**: None
- **VALIDATE**: Manual test - create a receivable of 25000
- **TEST_REQUIREMENT**: Receivable of 25000 shows as 25000 F

### Task 3: REMOVE - * 100 from SupplierDetailsScreen debt (first occurrence)

- **IMPLEMENT**: In `apps/mobile/src/screens/SupplierDetailsScreen.tsx`, find line 202 and remove the `* 100` multiplication
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: None
- **GOTCHA**: There are 4 occurrences in this file - fix them all
- **VALIDATE**: Manual test
- **TEST_REQUIREMENT**: Debt creation works without multiplication

### Task 4: REMOVE - * 100 from SupplierDetailsScreen payment

- **IMPLEMENT**: In `apps/mobile/src/screens/SupplierDetailsScreen.tsx`, find line 234 and remove the `* 100` multiplication
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: Task 3 completed
- **GOTCHA**: None
- **VALIDATE**: Manual test
- **TEST_REQUIREMENT**: Payment works without multiplication

### Task 5: REMOVE - * 100 from SupplierDetailsScreen refund

- **IMPLEMENT**: In `apps/mobile/src/screens/SupplierDetailsScreen.tsx`, find line 475 and remove the `* 100` multiplication
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: Task 4 completed
- **GOTCHA**: None
- **VALIDATE**: Manual test
- **TEST_REQUIREMENT**: Refund works without multiplication

### Task 6: REMOVE - * 100 from SupplierDetailsScreen createDebt

- **IMPLEMENT**: In `apps/mobile/src/screens/SupplierDetailsScreen.tsx`, find line 535 and remove the `* 100` multiplication
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: Task 5 completed
- **GOTCHA**: None
- **VALIDATE**: Manual test
- **TEST_REQUIREMENT**: Create debt works without multiplication

### Task 7: REMOVE - * 100 from POSScreen

- **IMPLEMENT**: In `apps/mobile/src/screens/POSScreen.tsx`, find line 319 and remove the `* 100` multiplication from `Math.round(parseFloat(amount) * 100)`
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: None
- **GOTCHA**: This affects POS sales
- **VALIDATE**: Manual test - create a sale
- **TEST_REQUIREMENT**: Sale amount matches what user entered

### Task 8: REMOVE - * 100 from SuppliersScreen

- **IMPLEMENT**: In `apps/mobile/src/screens/SuppliersScreen.tsx`, find line 109 and remove the `* 100` multiplication from `Math.round(balance * 100)`
- **PATTERN**: Same as Task 1
- **DEPENDENCIES**: None
- **GOTCHA**: This is for initial balance
- **VALIDATE**: Manual test
- **TEST_REQUIREMENT**: Initial balance works without multiplication

### Task 9: ADD - Hierarchy editing state to ProductCatalogScreen

- **IMPLEMENT**: In `apps/mobile/src/screens/ProductCatalogScreen.tsx`, add state variables for hierarchy editing modal:
  - showHierarchyModal: boolean
  - hierarchyEditLevel: 'family' | 'article_type' | 'brand' | null
  - hierarchyOldValue: string
  - hierarchyNewValue: string
  - isSavingHierarchy: boolean
- **PATTERN**: Follow the pattern used in CatalogHierarchyScreen for modal state
- **DEPENDENCIES**: None
- **GOTCHA**: Add these near other state declarations at the top of the component
- **VALIDATE**: TypeScript compilation passes
- **TEST_REQUIREMENT**: No TypeScript errors

### Task 10: ADD - Hierarchy editing modal to ProductCatalogScreen

- **IMPLEMENT**: Add a Modal component for editing hierarchy values. Include:
  - Text input for the new value
  - Cancel and Save buttons
  - Loading indicator when saving
- **PATTERN**: Copy modal pattern from the existing product modal in the same file
- **DEPENDENCIES**: Task 9 completed
- **GOTCHA**: Place the modal at the end of the component, before the closing SafeAreaView
- **VALIDATE**: Modal renders correctly
- **TEST_REQUIREMENT**: Modal opens and closes

### Task 11: ADD - batchUpdateHierarchy handler to ProductCatalogScreen

- **IMPLEMENT**: Add a handler function `handleSaveHierarchy` that:
  - Validates the new value is not empty
  - Calls `productsApi.batchUpdateHierarchy` with level, old_value, new_value
  - Shows success/error alert
  - Reloads data on success
  - Closes the modal
- **PATTERN**: Follow CatalogHierarchyScreen handleSave pattern
- **DEPENDENCIES**: Tasks 9, 10 completed
- **GOTCHA**: Import productsApi if not already imported (it is)
- **VALIDATE**: Function compiles
- **TEST_REQUIREMENT**: Hierarchy updates save successfully

### Task 12: ADD - Edit buttons to Catalogue tab family headers

- **IMPLEMENT**: In the `renderCatalogueTab` function, add an Edit button next to each family name in the table. When clicked, open the hierarchy modal with level='family' and the family name as old_value
- **PATTERN**: Follow the edit button pattern from CatalogHierarchyScreen
- **DEPENDENCIES**: Tasks 9, 10, 11 completed
- **GOTCHA**: The button should be small and unobtrusive
- **VALIDATE**: Edit buttons appear next to family names
- **TEST_REQUIREMENT**: Clicking edit opens modal with family name

### Task 13: ADD - Edit capability for article_type and brand in Catalogue tab

- **IMPLEMENT**: Extend the table to show article_type and brand columns with edit buttons. When clicked, open the modal with the appropriate level and value
- **PATTERN**: Same as Task 12
- **DEPENDENCIES**: Task 12 completed
- **GOTCHA**: May need to restructure the table slightly
- **VALIDATE**: Edit buttons work for all hierarchy levels
- **TEST_REQUIREMENT**: Can edit family, article_type, and brand from Catalogue tab

### Task 14: UPDATE - CLAUDE.md documentation

- **IMPLEMENT**: Update the "Database (Prisma)" section in CLAUDE.md to clarify that amounts are stored in FCFA, not centimes. Remove or correct the statement "All monetary amounts stored as integers in centimes"
- **PATTERN**: Keep documentation accurate and clear
- **DEPENDENCIES**: Tasks 1-8 completed
- **GOTCHA**: Make sure all references to centimes are removed or corrected
- **VALIDATE**: Read CLAUDE.md to verify
- **TEST_REQUIREMENT**: Documentation is accurate

### Task 15: VALIDATE - Run lint and type-check

- **IMPLEMENT**: Run linting and type checking on the mobile app
- **PATTERN**: Standard validation
- **DEPENDENCIES**: All previous tasks completed
- **GOTCHA**: May have warnings unrelated to these changes
- **VALIDATE**: `cd apps/mobile && pnpm run lint && pnpm run type-check`
- **TEST_REQUIREMENT**: No errors

### Task 16: VALIDATE - Run tests

- **IMPLEMENT**: Run all tests
- **PATTERN**: Standard validation
- **DEPENDENCIES**: Task 15 completed
- **GOTCHA**: None
- **VALIDATE**: `pnpm run validate`
- **TEST_REQUIREMENT**: All tests pass

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Amount parsing and display
**Requirements**:
- Verify formatMoney displays amounts correctly
- Verify amounts are not transformed during API calls

**VALIDATION COMMAND**: `cd apps/api && pnpm run test`

### Integration Tests

**Scope**: Full flow from user input to display
**Requirements**:
- Create a receivable of 25000 -> verify it shows as 25000 F
- Create a debt of 50000 -> verify it shows as 50000 F
- Create a cash entry of 10000 -> verify it shows as 10000 F
- Edit a family name -> verify all products with that family are updated

**VALIDATION COMMAND**: Manual testing

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
- Amount: 1 (smallest)
- Amount: 1000000 (one million)
- Amount: 0 (zero - should be rejected)
- Amount: negative (should be rejected)
- Hierarchy: rename to existing name (should be handled)
- Hierarchy: empty name (should be rejected)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/mobile && pnpm run lint
cd apps/api && pnpm run lint
```

**Expected Result**: Zero errors

### Level 2: Type Checking

```bash
cd apps/mobile && pnpm run type-check
cd apps/api && pnpm run type-check
```

**Expected Result**: No type errors (or only pre-existing ones)

### Level 3: Unit Tests

```bash
cd apps/api && pnpm run test
cd apps/mobile && pnpm run test
```

**Expected Result**: All tests pass

### Level 4: Build Verification

```bash
cd apps/api && pnpm run build
cd apps/mobile && npx expo export --platform all
```

**Expected Result**: Builds succeed

### Level 5: Manual Validation

**Amount Flow Tests**:
1. CashScreen: Create entry of 25000 -> verify displays as 25000 F
2. CustomerDetailsScreen: Create receivable of 50000 -> verify displays as 50000 F
3. SupplierDetailsScreen: Create debt of 75000 -> verify displays as 75000 F
4. POSScreen: Make sale of 10000 -> verify displays as 10000 F

**Hierarchy Edit Tests**:
1. Go to ProductCatalogScreen > Catalogue tab
2. Click edit button on a family name
3. Change the name and save
4. Verify all products in that family now show the new name

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] NO multiplication by 100 on any amount input
- [ ] NO division by 100 on any amount display
- [ ] User enters 25000 -> displays as 25000 F everywhere
- [ ] Hierarchy editing works from Catalogue tab (not just CatalogHierarchyScreen)
- [ ] Family names can be edited
- [ ] Article types can be edited
- [ ] Brand names can be edited
- [ ] CLAUDE.md updated to reflect FCFA storage (not centimes)
- [ ] All validation commands pass
- [ ] No TypeScript errors related to changes
- [ ] No ESLint errors

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Task 1: CustomerDetailsScreen refund * 100 removed
- [ ] Task 2: CustomerDetailsScreen receivable * 100 removed
- [ ] Task 3: SupplierDetailsScreen debt * 100 removed (line 202)
- [ ] Task 4: SupplierDetailsScreen payment * 100 removed (line 234)
- [ ] Task 5: SupplierDetailsScreen refund * 100 removed (line 475)
- [ ] Task 6: SupplierDetailsScreen createDebt * 100 removed (line 535)
- [ ] Task 7: POSScreen * 100 removed
- [ ] Task 8: SuppliersScreen * 100 removed
- [ ] Task 9: Hierarchy modal state added to ProductCatalogScreen
- [ ] Task 10: Hierarchy modal UI added
- [ ] Task 11: batchUpdateHierarchy handler added
- [ ] Task 12: Edit buttons added to family headers
- [ ] Task 13: Edit capability for article_type and brand
- [ ] Task 14: CLAUDE.md updated
- [ ] Task 15: Lint and type-check pass
- [ ] Task 16: All tests pass
- [ ] Manual testing: amounts display correctly
- [ ] Manual testing: hierarchy editing works from Catalogue tab
- [ ] All acceptance criteria met

---

## EXTERNAL RESOURCES AND REFERENCES

### Internal Resources
- Amount utilities: `apps/mobile/src/utils/money.ts`
- API client: `apps/mobile/src/lib/api.ts`
- Hierarchy screen reference: `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`
- Database schema: `apps/api/prisma/schema.prisma`
- Project documentation: `CLAUDE.md`

---

## NOTES

**Root Cause Analysis:**

1. **Amount Problem**: The codebase was originally designed to store amounts in centimes (hence `Int` in Prisma and `* 100` operations). However, this was never consistently applied:
   - Some screens multiply by 100
   - Some screens don't
   - formatMoney doesn't divide by 100

   The simplest fix is to remove all * 100 operations and store amounts in FCFA directly. This matches user expectations and the display logic.

2. **Catalogue Tab Problem**: The feature was simply never implemented. The Catalogue tab was created as a read-only view, and the editing functionality was put in a separate screen (CatalogHierarchyScreen). The user expects inline editing, which requires adding the feature.

**Risk Assessment:**
- Amount fix: LOW (removing code is safer than adding)
- Catalogue editing: MEDIUM (new feature, but copying existing pattern)

**Important Reminders**:
- Do NOT add any new * 100 or / 100 operations
- Test ALL amount flows after changes
- The user has asked for Catalogue editing 5 times - make sure it works
- ALL tests must pass before feature is considered complete

<!-- EOF -->
