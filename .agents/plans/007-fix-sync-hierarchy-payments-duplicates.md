# Plan: Fix Sync, Catalog Hierarchy, Payment Methods & Duplicate Names

## Feature Description

This plan addresses 5 interconnected issues in the SWALO system:

1. **Customer/Supplier Refund-Payment Sync**: Balances not updating correctly after refund and payment operations
2. **Catalog Hierarchy Management**: Missing ability to add new families/article_types/brands with proper validation
3. **Remove Orange Money/Mobile Money**: Payment options should only be cash or credit
4. **Supplier Balance Metric Calculation**: "Suppliers owe us" metric doesn't reflect reality
5. **Prevent Duplicate Names**: Case-insensitive name validation for customers/suppliers

## Root Cause Analysis (Synthesized from 8 Strategy Agents)

### Issue 1 & 4: Balance Sync and Metric Calculation

**Root Cause**: Inconsistent debt/receivable filtering between `getAll()` and `getOne()` methods

- `getAll()` in both `customers.service.ts` and `suppliers.service.ts` filters debts by status `['PENDING', 'PARTIAL']`
- `getOne()` includes ALL debts/receivables without any status filter
- This creates a mismatch: summary pages show different totals than detail pages

**Files Affected**:
- `apps/api/src/modules/customers/customers.service.ts` (lines 92-116 for getAll, lines 122-188 for getOne)
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lines 92-116 for getAll, lines 121-187 for getOne)

### Issue 2: Catalog Hierarchy Management

**Root Cause**: Missing UI components and incomplete validation

- `CatalogHierarchyScreen.tsx` has `openAddModal()` function (line 157-162) but no visible button to trigger it
- No validation that a family must contain at least 1 element of each level (article_type, brand)
- API endpoints exist but aren't being called from the UI

**Files Affected**:
- `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`
- Potentially need new API endpoints for creating families with full hierarchy

### Issue 3: Remove Mobile Money Payment Option

**Root Cause**: MOBILE_MONEY enum value present in multiple DTOs and UI components

**Files Affected**:
- `apps/api/src/modules/customers/dto/create-refund.dto.ts` (line 8)
- `apps/api/src/modules/suppliers/dto/claim-refund.dto.ts` (line 8)
- `apps/api/src/modules/cash/dto/create-merchandise-purchase.dto.ts` (lines 15-18)
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 119-121, 1052-1088)
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx` (lines 116-118, 1039-1078)

### Issue 5: Duplicate Name Prevention

**Root Cause**: Only phone uniqueness is validated, not name

- `customers.service.ts` and `suppliers.service.ts` only check for duplicate phone numbers
- No case-insensitive name validation exists in create() or update() methods

**Files Affected**:
- `apps/api/src/modules/customers/customers.service.ts` (lines 14-28 for create, update method)
- `apps/api/src/modules/suppliers/suppliers.service.ts` (lines 14-28 for create, update method)

## Implementation Tasks

### Task 1: Fix Balance Sync (Issue 1 & 4)

#### 1.1 Harmonize debt filtering in suppliers.service.ts
**File**: `apps/api/src/modules/suppliers/suppliers.service.ts`

```typescript
// In getAll() - around line 100
// Change: Include ALL debts for accurate balance calculation, not just PENDING/PARTIAL
// The total_balance should reflect the true financial position

// In getOne() - around line 140
// Keep current behavior (includes all debts)
// Both methods should now be consistent
```

**Action**: Modify `getAll()` to NOT filter by debt status, or alternatively, ensure both methods use the same filtering logic.

#### 1.2 Harmonize receivable filtering in customers.service.ts
**File**: `apps/api/src/modules/customers/customers.service.ts`

Apply same fix pattern - ensure `getAll()` and `getOne()` use consistent filtering for receivables.

#### 1.3 Verify balance calculation logic
Ensure the balance calculation in both services correctly:
- For customers: positive balance = they owe us, negative = we owe them
- For suppliers: positive balance = we owe them, negative = they owe us

### Task 2: Add Catalog Hierarchy Management (Issue 2)

#### 2.1 Add "+ Famille" button to CatalogHierarchyScreen
**File**: `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`

Add a FAB (Floating Action Button) or header button that calls `openAddModal('family')`.

```typescript
// Add in header or as FAB
<Button
  title="+ Famille"
  onPress={() => openAddModal('family')}
/>
```

#### 2.2 Update handleSave with hierarchy validation
**File**: `apps/mobile/src/screens/CatalogHierarchyScreen.tsx`

When saving a new family, validate that:
- At least 1 article_type is provided
- At least 1 brand is provided
- The family name is not empty

```typescript
// In handleSave() around line 172
if (modalType === 'family') {
  // Validate hierarchy completeness
  if (!hasArticleType || !hasBrand) {
    Alert.alert('Erreur', 'Une famille doit contenir au moins 1 type article et 1 marque');
    return;
  }
}
```

#### 2.3 Create multi-step family creation modal
Design a modal flow that allows user to:
1. Enter family name
2. Add at least one article_type
3. Add at least one brand
4. Save the complete hierarchy

### Task 3: Remove Mobile Money Payment Option (Issue 3)

#### 3.1 Update API DTOs
**Files**:
- `apps/api/src/modules/customers/dto/create-refund.dto.ts`
- `apps/api/src/modules/suppliers/dto/claim-refund.dto.ts`
- `apps/api/src/modules/cash/dto/create-merchandise-purchase.dto.ts`

```typescript
// Change from:
@IsIn(['CASH', 'MOBILE_MONEY'])
// To:
@IsIn(['CASH'])
```

Note: CREDIT may need to be added depending on business logic requirements.

#### 3.2 Update Mobile UI Components
**Files**:
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx`
- `apps/mobile/src/screens/SupplierDetailsScreen.tsx`

Remove the Mobile Money option from payment method pickers:

```typescript
// Remove MOBILE_MONEY from state initialization
const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT'>('CASH');

// Remove Mobile Money option from picker UI
// Keep only CASH and CREDIT options where applicable
```

### Task 4: Prevent Duplicate Names (Issue 5)

#### 4.1 Add name validation in customers.service.ts
**File**: `apps/api/src/modules/customers/customers.service.ts`

```typescript
// In create() method - around line 14
const existingByName = await this.prisma.customer.findFirst({
  where: {
    shop_id: user.shop_id,
    name: {
      equals: dto.name,
      mode: 'insensitive'
    },
    deleted: false
  }
});

if (existingByName) {
  throw new BadRequestException('Un client avec ce nom existe déjà. Veuillez choisir un autre nom.');
}

// Apply same logic in update() method
```

#### 4.2 Add name validation in suppliers.service.ts
**File**: `apps/api/src/modules/suppliers/suppliers.service.ts`

Apply same pattern for suppliers.

```typescript
// In create() method
const existingByName = await this.prisma.supplier.findFirst({
  where: {
    shop_id: user.shop_id,
    name: {
      equals: dto.name,
      mode: 'insensitive'
    },
    deleted: false
  }
});

if (existingByName) {
  throw new BadRequestException('Un fournisseur avec ce nom existe déjà. Veuillez choisir un autre nom.');
}
```

#### 4.3 Handle combination of first_name + name
Consider if uniqueness should check `first_name + name` combination or just `name`:

```typescript
// Option: Check full name combination
const existingByFullName = await this.prisma.customer.findFirst({
  where: {
    shop_id: user.shop_id,
    AND: [
      { name: { equals: dto.name, mode: 'insensitive' } },
      { first_name: { equals: dto.first_name || '', mode: 'insensitive' } }
    ],
    deleted: false
  }
});
```

## Testing Strategy

### Unit Tests

1. **Balance Sync Tests** (`customers.service.spec.ts`, `suppliers.service.spec.ts`):
   - Test that `getAll()` and `getOne()` return consistent balance totals
   - Test balance calculation after refund operations
   - Test balance calculation after payment operations

2. **Duplicate Name Tests**:
   - Test that creating customer with existing name (same case) fails
   - Test that creating customer with existing name (different case) fails
   - Test that updating to an existing name fails
   - Test that creating with unique name succeeds

3. **Payment Method Tests**:
   - Test that DTOs reject MOBILE_MONEY
   - Test that DTOs accept CASH

### Integration Tests

1. **End-to-end balance flow**:
   - Create customer → Create sale with credit → Create payment → Verify balance
   - Create supplier → Create purchase with credit → Create payment → Verify balance
   - Create refund → Verify balance updates correctly

2. **Catalog hierarchy creation**:
   - Create family with article_type and brand → Verify structure
   - Attempt to create family without article_type → Verify validation error

### Manual Testing

1. **Customer Balance Flow**:
   - Go to CustomerBalancesSummaryScreen
   - Note a customer's balance
   - Navigate to CustomerDetailsScreen for that customer
   - Verify balance matches
   - Create a refund/payment
   - Return to summary → Verify updated balance

2. **Supplier Balance Flow**:
   - Same flow as customer but for suppliers

3. **Catalog Hierarchy**:
   - Navigate to CatalogHierarchyScreen
   - Click "+ Famille" button
   - Attempt to save without article_type/brand → Verify error
   - Add complete hierarchy → Verify success

4. **Duplicate Names**:
   - Create customer "Jean Dupont"
   - Attempt to create "jean dupont" → Verify error message
   - Attempt to create "JEAN DUPONT" → Verify error message

## Validation Commands

```bash
# Run all tests
pnpm run validate

# Run API tests only
cd apps/api && pnpm test

# Run specific service tests
cd apps/api && pnpm jest customers.service.spec.ts
cd apps/api && pnpm jest suppliers.service.spec.ts

# Lint check
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/mobile run lint

# Type check (if available)
cd apps/api && pnpm tsc --noEmit
cd apps/mobile && pnpm tsc --noEmit
```

## Implementation Order

1. **Issue 5** (Duplicate Names) - Quick win, isolated change
2. **Issue 3** (Remove Mobile Money) - Quick win, isolated change
3. **Issue 1 & 4** (Balance Sync) - Core fix, affects multiple screens
4. **Issue 2** (Catalog Hierarchy) - Most complex, requires UI work

## Risk Assessment

| Issue | Risk Level | Mitigation |
|-------|------------|------------|
| Balance Sync | Medium | Test with existing data, ensure no data loss |
| Catalog Hierarchy | Low | New feature, doesn't affect existing data |
| Remove Mobile Money | Low | Check no pending Mobile Money transactions |
| Duplicate Names | Low | Only affects new records, existing duplicates preserved |

## Rollback Plan

If issues arise:
1. All changes can be reverted via git
2. Database schema unchanged - no migrations needed
3. Mobile app can be rolled back via Expo

## Confidence Levels (from Agent Analysis)

| Issue | Confidence | Notes |
|-------|------------|-------|
| Issue 1 (Refund Sync) | 8/10 | Clear code path identified |
| Issue 2 (Catalog Hierarchy) | 7/10 | UI work needed, may require design decisions |
| Issue 3 (Mobile Money) | 9/10 | Straightforward removal |
| Issue 4 (Supplier Metric) | 8/10 | Same root cause as Issue 1 |
| Issue 5 (Duplicate Names) | 9/10 | Clear Prisma pattern available |
