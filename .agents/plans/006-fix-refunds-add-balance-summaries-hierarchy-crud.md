# Feature: Fix Refunds, Add Balance Summaries, Transaction Authors, and Hierarchy CRUD

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files.

## Feature Description

This plan addresses 7 related requirements:
1. Fix customer refund logic (balance should increase toward zero, not decrease further)
2. Add customer balances summary page accessible from CustomersScreen
3. Add supplier balances summary page accessible from SuppliersScreen
4. Fix supplier refund logic (same bug as customer refunds)
5. Display transaction author (role - name) in transaction details
6. Add ability to create new product families and hierarchy values
7. Enable full CRUD for all hierarchy levels (family, article_type, brand, reference) in Catalogue tab

## User Story

As a shop owner/manager
I want refunds to correctly adjust balances, see all customer/supplier balances at a glance, know who performed each transaction, and manage my product catalog hierarchy
So that I can accurately track finances, quickly assess business relationships, maintain accountability, and organize my inventory effectively

## Problem Statement

1. **Refund Bug**: When refunding a customer/supplier with negative balance, the system ADDS a negative amount to the balance instead of moving it toward zero
2. **Balance Overview**: Users must navigate into each customer/supplier detail page to see balances - no summary view exists
3. **Transaction Accountability**: No way to see who performed a transaction
4. **Hierarchy Management**: Limited ability to add new hierarchy values and no reference-level editing in Catalogue tab

## Solution Statement

1. **Refund Fix**: Change refund logic to create positive receivable/debt entries that offset negative balances
2. **Balance Summaries**: Create new screens showing all customer/supplier balances with navigation buttons
3. **Transaction Authors**: Display cashier name and role in transaction detail views
4. **Hierarchy CRUD**: Add "Create New" options in suggestions and enable reference editing in Catalogue tab

## Feature Metadata

**Feature Type**: Bug Fix + New Capability
**Estimated Complexity**: Medium-High
**Primary Systems Affected**: Mobile app screens, API services
**Dependencies**: None (uses existing API endpoints)

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

**Bug Fixes (Requirements 1 & 4):**
- `apps/api/src/modules/customers/customers.service.ts` (lines 301-353) - createRefund method with bug at line 338
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lines 301-353) - claimRefund method with bug at line 338

**Balance Summary Screens (Requirements 2 & 3):**
- `apps/mobile/src/screens/CustomersScreen.tsx` (lines 164-184) - header where button should be added
- `apps/mobile/src/screens/SuppliersScreen.tsx` (lines 164-173) - header where button should be added
- `apps/mobile/App.tsx` (lines 37-56, 140-165) - navigation setup
- `apps/mobile/src/lib/api.ts` (lines 297-346, 404-440) - API endpoints for customers/suppliers

**Transaction Authors (Requirement 5):**
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 734-809) - transaction display
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` (lines 744-819) - transaction display
- `apps/mobile/src/screens/CashScreen.tsx` (lines 596-639) - cash journal display
- `apps/api/src/modules/cash/cash.service.ts` (lines 238-265) - already returns cashier data

**Hierarchy Management (Requirements 6 & 7):**
- `apps/mobile/src/screens/ProductCatalogScreen.tsx` (lines 553-674, 877-1138, 1140-1205) - Catalogue tab and modals
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx` - full hierarchy management reference
- `apps/mobile/src/lib/api.ts` (lines 544-553) - batchUpdateHierarchy endpoint

### New Files to Create

- `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx` - Customer balances overview
- `apps/mobile/src/screens/SupplierBalancesSummaryScreen.tsx` - Supplier balances overview

### Patterns to Follow

**Naming Conventions:**
- Screen components: `{Entity}{Action}Screen.tsx`
- Navigation routes: PascalCase matching screen name
- API methods: camelCase with entity prefix (e.g., `customersApi.getAll()`)

**Error Handling:**
- Use `Alert.alert()` for user feedback
- Try/catch with console.error for debugging
- Show loading indicators during API calls

**Data Validation:**
- Validate amounts are positive before API calls
- Check balance conditions before refund operations

---

## IMPLEMENTATION PLAN

### Phase 1: Bug Fixes (Requirements 1 & 4)

Fix the refund logic in both customer and supplier services to create positive entries that offset negative balances.

**Tasks:**
- Update `createRefund()` in customers.service.ts to use positive amount
- Update `claimRefund()` in suppliers.service.ts to use positive amount
- Update comments to clarify the logic

### Phase 2: Balance Summary Screens (Requirements 2 & 3)

Create new screens to display all customer/supplier balances and add navigation.

**Tasks:**
- Create CustomerBalancesSummaryScreen component
- Create SupplierBalancesSummaryScreen component
- Add navigation routes to App.tsx
- Add navigation buttons to CustomersScreen and SuppliersScreen headers

### Phase 3: Transaction Author Display (Requirement 5)

Display the transaction author (cashier name and role) in transaction details.

**Tasks:**
- Update transaction rendering in CustomerDetailsScreen to show author
- Update transaction rendering in SupplierDetailsScreen to show author
- Update CashScreen journal entries to show cashier name

### Phase 4: Hierarchy CRUD Enhancement (Requirements 6 & 7)

Add ability to create new hierarchy values and enable reference editing.

**Tasks:**
- Add "Create New" indicator in family/type/brand suggestions
- Add reference-level editing to Catalogue tab hierarchy edit modal
- Add "Add New" buttons for each hierarchy level in Catalogue tab

### Phase 5: Testing & Validation

**Tasks:**
- Run linting on all modified files
- Test refund operations with negative balances
- Verify balance summary screens display correctly
- Verify transaction authors appear in details
- Test hierarchy creation and editing

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `apps/api/src/modules/customers/customers.service.ts`

- **IMPLEMENT**: In the `createRefund()` method (lines 334-345), change the receivable creation to use POSITIVE amounts instead of negative. When a customer has balance -10000 and we refund 5000, we create a receivable with `amount: 5000` and `balance: 5000`. The total balance calculation (-10000 + 5000 = -5000) will correctly show we still owe 5000.
- **PATTERN**: Follow the same transaction pattern used in existing code
- **DEPENDENCIES**: None
- **GOTCHA**: The comment says "negative receivable" but should say "positive receivable to offset negative balance"
- **VALIDATE**: `cd apps/api && pnpm run lint`
- **TEST_REQUIREMENT**: Refund of 5000 on balance -10000 should result in -5000

### Task 2: UPDATE `apps/api/src/modules/suppliers/suppliers.service.ts`

- **IMPLEMENT**: In the `claimRefund()` method (lines 334-345), change the debt creation to use POSITIVE amounts instead of negative. When a supplier has balance -10000 (they owe us) and they refund 5000, we create a debt with `amount: 5000` and `balance: 5000`. The total balance calculation (-10000 + 5000 = -5000) will correctly show they still owe 5000.
- **PATTERN**: Mirror the fix from Task 1
- **DEPENDENCIES**: None
- **GOTCHA**: Same issue as customers - change negative to positive
- **VALIDATE**: `cd apps/api && pnpm run lint`
- **TEST_REQUIREMENT**: Supplier refund of 5000 on balance -10000 should result in -5000

### Task 3: CREATE `apps/mobile/src/screens/CustomerBalancesSummaryScreen.tsx`

- **IMPLEMENT**: Create a new screen that displays all customers with their current balances. Include: screen header with back button, list of customers with name/phone and balance (using BalanceIndicator or formatMoney), color-coded balance status (positive=green meaning they owe us, negative=red meaning we owe them, zero=gray), tap to navigate to CustomerDetails, sort by balance (highest debt first).
- **PATTERN**: Follow CustomersScreen.tsx structure and styling
- **DEPENDENCIES**: BalanceIndicator component, formatMoney utility, customersApi
- **GOTCHA**: Need to fetch all customers - API already returns balance in stats
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/CustomerBalancesSummaryScreen.tsx`
- **TEST_REQUIREMENT**: Screen should load and display all customers with balances

### Task 4: CREATE `apps/mobile/src/screens/SupplierBalancesSummaryScreen.tsx`

- **IMPLEMENT**: Create a new screen that displays all suppliers with their current balances. Same structure as CustomerBalancesSummaryScreen but for suppliers. Include balance status (positive=red meaning we owe them, negative=green meaning they owe us).
- **PATTERN**: Mirror CustomerBalancesSummaryScreen structure
- **DEPENDENCIES**: BalanceIndicator component, formatMoney utility, suppliersApi
- **GOTCHA**: Supplier balance semantics are opposite of customer (positive = we owe them)
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/SupplierBalancesSummaryScreen.tsx`
- **TEST_REQUIREMENT**: Screen should load and display all suppliers with balances

### Task 5: UPDATE `apps/mobile/App.tsx` - Navigation Routes

- **IMPLEMENT**: Add two new routes to RootStackParamList: `CustomerBalancesSummary: undefined` and `SupplierBalancesSummary: undefined`. Add corresponding Stack.Screen entries for both new screens. Import the new screen components.
- **PATTERN**: Follow existing screen registration pattern (lines 140-165)
- **DEPENDENCIES**: Tasks 3 and 4 completed
- **GOTCHA**: Maintain alphabetical order in type definition for consistency
- **VALIDATE**: `cd apps/mobile && npx eslint App.tsx`
- **TEST_REQUIREMENT**: Navigation to new screens should work

### Task 6: UPDATE `apps/mobile/src/screens/CustomersScreen.tsx` - Add Balance Button

- **IMPLEMENT**: In the screen header rightAction (lines 178-184), wrap the existing Plus button in a View with flexDirection row and add a second IconButton for viewing balances. Use Eye or BarChart3 icon. Add handler function that navigates to CustomerBalancesSummary screen.
- **PATTERN**: Follow existing IconButton usage pattern
- **DEPENDENCIES**: Task 5 completed
- **GOTCHA**: Import Eye or BarChart3 icon from lucide-react-native
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/CustomersScreen.tsx`
- **TEST_REQUIREMENT**: Button should appear and navigate to balance summary

### Task 7: UPDATE `apps/mobile/src/screens/SuppliersScreen.tsx` - Add Balance Button

- **IMPLEMENT**: Same as Task 6 but for suppliers. Add balance summary button to header that navigates to SupplierBalancesSummary screen.
- **PATTERN**: Mirror Task 6 implementation
- **DEPENDENCIES**: Task 5 completed
- **GOTCHA**: Same as Task 6
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/SuppliersScreen.tsx`
- **TEST_REQUIREMENT**: Button should appear and navigate to balance summary

### Task 8: UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Show Transaction Author

- **IMPLEMENT**: In the transaction list rendering (lines 734-809), add the cashier/author name to each transaction display. Format as "Par: [Name]" or include in the subtitle. The API already returns cashier data with cash entries - just need to display it.
- **PATTERN**: Follow existing ListItem subtitle pattern
- **DEPENDENCIES**: None - API already returns data
- **GOTCHA**: Some transactions may not have cashier data - handle null gracefully
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/CustomerDetailsScreen.tsx`
- **TEST_REQUIREMENT**: Transaction author should appear when available

### Task 9: UPDATE `apps/mobile/src/screens/SupplierDetailsScreen.tsx` - Show Transaction Author

- **IMPLEMENT**: Same as Task 8 but for supplier transactions. Add cashier/author display to transaction list items.
- **PATTERN**: Mirror Task 8 implementation
- **DEPENDENCIES**: None - API already returns data
- **GOTCHA**: Same as Task 8
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/SupplierDetailsScreen.tsx`
- **TEST_REQUIREMENT**: Transaction author should appear when available

### Task 10: UPDATE `apps/mobile/src/screens/CashScreen.tsx` - Show Cashier in Journal

- **IMPLEMENT**: In the cash journal entries display (lines 596-639), add the cashier name to each entry. The API returns cashier.display_name - display it in the entry subtitle or as a separate line.
- **PATTERN**: Follow existing entry rendering pattern
- **DEPENDENCIES**: None - API already returns data
- **GOTCHA**: Handle entries without cashier data
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/CashScreen.tsx`
- **TEST_REQUIREMENT**: Cashier name should appear in journal entries

### Task 11: UPDATE `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Add Reference Editing

- **IMPLEMENT**: Extend the hierarchy edit modal (lines 1140-1205) to support reference level. Update the hierarchyEditType state type to include 'reference'. Add reference editing buttons to the table rows in renderCatalogueTab. When a reference is clicked, open the edit modal with type='reference'.
- **PATTERN**: Follow existing family/article_type/brand editing pattern
- **DEPENDENCIES**: API already supports reference level in batchUpdateHierarchy
- **GOTCHA**: Reference editing should include product context filters
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/ProductCatalogScreen.tsx`
- **TEST_REQUIREMENT**: Should be able to edit/rename references

### Task 12: UPDATE `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Add "Create New" Option

- **IMPLEMENT**: In the suggestion dropdowns for family, article_type, and brand (lines 898-994), add a "Create New" option that appears when the typed value doesn't match any existing suggestion. This visually confirms to the user they are creating a new hierarchy value. Style it differently (e.g., with Plus icon and different background).
- **PATTERN**: Follow existing suggestion item styling
- **DEPENDENCIES**: Plus icon from lucide-react-native
- **GOTCHA**: Only show "Create New" when typed value is non-empty and not in suggestions
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/ProductCatalogScreen.tsx`
- **TEST_REQUIREMENT**: "Create New" should appear when typing a new value

### Task 13: UPDATE `apps/mobile/src/screens/ProductCatalogScreen.tsx` - Add Hierarchy Add Buttons

- **IMPLEMENT**: In the Catalogue tab hierarchy display (lines 553-674), add "+" buttons to add new article types under a family, new brands under an article type. When clicked, open a modal to enter the new value. Use the existing product creation flow to create a placeholder product with the new hierarchy value.
- **PATTERN**: Follow CatalogHierarchyScreen.tsx implementation (lines 260-300)
- **DEPENDENCIES**: productsApi.create for creating placeholder products
- **GOTCHA**: Placeholder products should be inactive and named appropriately
- **VALIDATE**: `cd apps/mobile && npx eslint src/screens/ProductCatalogScreen.tsx`
- **TEST_REQUIREMENT**: Should be able to add new hierarchy values from Catalogue tab

---

## TESTING STRATEGY

### Unit Tests

**Scope**: API service methods for refund logic
**Requirements**:
- Test refund with negative balance results in correct new balance
- Test validation errors for invalid refund amounts
- **VALIDATION COMMAND**: `cd apps/api && pnpm run test`

### Integration Tests

**Scope**: Full refund flow from mobile to API
**Requirements**:
- Create customer with negative balance, perform refund, verify balance
- Create supplier with negative balance, claim refund, verify balance
- **VALIDATION COMMAND**: `cd apps/api && pnpm run test`

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
- Refund amount equals exact balance (should result in zero)
- Refund amount exceeds balance (should be rejected)
- Zero balance refund attempt (should be rejected)
- Customer/supplier with no transactions
- Transactions without cashier data (null handling)

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/api && pnpm run lint
cd apps/mobile && pnpm run lint
```

**Expected Result**: Zero new errors

### Level 2: Type Check

```bash
cd apps/api && pnpm run type-check
cd apps/mobile && pnpm run type-check
```

**Expected Result**: No new type errors

### Level 3: Tests

```bash
cd apps/api && pnpm run test
cd apps/mobile && pnpm run test
```

**Expected Result**: All tests pass

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Customer refund on balance -10000 with amount 5000 results in balance -5000
- [ ] Supplier refund on balance -10000 with amount 5000 results in balance -5000
- [ ] CustomerBalancesSummary screen accessible from CustomersScreen header
- [ ] SupplierBalancesSummary screen accessible from SuppliersScreen header
- [ ] Both balance summary screens display all entities with current balances
- [ ] Transaction details show author name when available
- [ ] Cash journal entries show cashier name
- [ ] Can edit reference values in Catalogue tab
- [ ] "Create New" option appears when typing new hierarchy values
- [ ] Can add new article types and brands from Catalogue tab
- [ ] All linting passes with no new errors
- [ ] All existing tests still pass

---

## COMPLETION CHECKLIST

- [ ] Task 1: Customer refund fix implemented
- [ ] Task 2: Supplier refund fix implemented
- [ ] Task 3: CustomerBalancesSummaryScreen created
- [ ] Task 4: SupplierBalancesSummaryScreen created
- [ ] Task 5: Navigation routes added
- [ ] Task 6: CustomersScreen balance button added
- [ ] Task 7: SuppliersScreen balance button added
- [ ] Task 8: CustomerDetailsScreen author display added
- [ ] Task 9: SupplierDetailsScreen author display added
- [ ] Task 10: CashScreen cashier display added
- [ ] Task 11: Reference editing added
- [ ] Task 12: "Create New" option added
- [ ] Task 13: Hierarchy add buttons added
- [ ] All validation commands pass
- [ ] Manual testing completed

---

## NOTES

**Refund Logic Explanation:**
The bug occurs because when a customer has a negative balance (we owe them), the system creates a NEGATIVE receivable to track the refund. But since total_balance is calculated as SUM(all receivable balances), adding a negative value to an already negative balance makes it MORE negative instead of moving toward zero.

**Correct Approach:**
Create a POSITIVE receivable/debt entry. When summed with the existing negative balance, it offsets correctly:
- Initial: -10000 (we owe 10000)
- Refund entry: +5000 (we paid 5000)
- New total: -10000 + 5000 = -5000 (we still owe 5000)

**Balance Summary Screen Data:**
The existing `customersApi.getAll()` and `suppliersApi.getAll()` return entities but may not include computed balance. Use the stats endpoints or fetch individual details if needed. Alternatively, modify the API to include balance in the list response.

**Transaction Author Data:**
The API already returns `cashier` with `id` and `display_name` for cash entries. The mobile UI just needs to display this data. Some older transactions may not have cashier data - handle null gracefully.

**Hierarchy Management:**
The Catalogue tab already has edit functionality for family, article_type, and brand. Adding reference editing follows the same pattern. Creating NEW values requires either using the product form or creating placeholder products (as done in CatalogHierarchyScreen).

<!-- EOF -->
