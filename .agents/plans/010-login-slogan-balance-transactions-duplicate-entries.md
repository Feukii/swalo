# Feature: Login UX Improvements, Balance Transaction Integrity, and Duplicate Entry Prevention

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types, and models. Import from the right files, etc.

## Feature Description

This implementation addresses three critical issues in the SWALO mini-ERP system:

1. **Login Page UX Enhancement**: Update the SWALO slogan to be more commercial and appealing to Central African phone shop owners, and implement auto-submit when the user enters the 4th digit of their PIN for a smoother login experience.

2. **Transaction Balance Integrity**: Ensure that cash register transactions correctly and atomically update customer and supplier balances. This is a recurring bug that must be definitively fixed - financial transactions require 100% accuracy.

3. **Customer Details Duplicate Entry Prevention**: When a credit sale is made, ensure only ONE entry appears in the CustomerDetails transaction history, not multiple confusing entries.

## User Story

As a shop employee in Central Africa,
I want to log in quickly with auto-submit on PIN completion, see an appealing commercial slogan, and trust that all financial transactions are correctly recorded without duplicates,
So that I can efficiently manage my shop while maintaining accurate financial records.

## Problem Statement

1. **Login**: The current slogan "Système de Gestion Commerciale" is technical and not commercial. The login process requires manual button press after PIN entry, adding unnecessary friction.

2. **Balance Transactions**: Cash entries with customer_id (payments) or supplier_id (supplier payments) may not be correctly updating balances in all scenarios. The recurring nature of this bug suggests potential race conditions, missing transaction boundaries, or incomplete balance update logic.

3. **Duplicate Entries**: The CustomerDetailsScreen displays transactions from multiple sources (API receivables, API cash_entries, AsyncStorage sales) which can result in the same credit sale appearing multiple times if it's stored in multiple places.

## Solution Statement

1. **Login**: Replace the slogan with a commercial, aspirational message. Add useEffect hook to auto-trigger login when PIN reaches 4 digits, with proper guards against multiple submissions.

2. **Balance Transactions**: Audit and reinforce all balance update logic in cash.service.ts to ensure:
   - All related operations are wrapped in Prisma transactions
   - Balance calculations are atomic
   - Proper status updates (PENDING → PARTIAL → PAID)
   - Add comprehensive logging for transaction debugging

3. **Duplicate Entries**: Implement deduplication logic in CustomerDetailsScreen that identifies and filters duplicate transactions based on source correlation (receivable payments linked to cash entries via cash_entry_id).

## Feature Metadata

**Feature Type**: Bug Fix / Enhancement
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- Mobile Login Screen
- Web Login Page
- Cash Service (API)
- Customer Service (API)
- CustomerDetailsScreen (Mobile)
- CustomerDetails (Web)
**Dependencies**: None (uses existing libraries)

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `apps/mobile/src/screens/LoginPinScreen.tsx` (lines 1-238) - Why: Mobile login screen with current slogan and PIN input - needs auto-submit
- `apps/web/src/pages/LoginPin.tsx` (lines 1-163) - Why: Web login page with current slogan and PIN input - needs auto-submit
- `apps/api/src/modules/cash/cash.service.ts` (lines 1-591) - Why: Contains createEntry() with balance update logic for customers and suppliers
- `apps/api/src/modules/customers/customers.service.ts` (lines 1-548) - Why: Contains customer balance calculation and createRefund()
- `apps/api/src/modules/receivables/receivables.service.ts` (lines 1-241) - Why: Contains addPayment() logic that updates receivable balances
- `apps/mobile/src/screens/CustomerDetailsScreen.tsx` (lines 1-1800) - Why: Mobile screen showing transaction history - potential duplicate entries
- `apps/web/src/pages/CustomerDetails.tsx` (lines 1-746) - Why: Web page showing transaction history - potential duplicate entries

### New Files to Create

- None required - all changes are to existing files

### Relevant Documentation

- Prisma Transaction Documentation: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
- React useEffect Best Practices: https://react.dev/reference/react/useEffect

### Patterns to Follow

**Naming Conventions:**
- French for user-facing strings (slogans, labels, error messages)
- English for code identifiers
- Reference: All existing service files follow this pattern

**Error Handling:**
- Use BadRequestException for validation errors
- Use NotFoundException when entity not found
- Wrap all financial operations in try-catch with proper error logging

**Transaction Pattern:**
- Use Prisma's `$transaction()` for all operations that modify multiple records
- Reference: `cash.service.ts:74-202` shows the correct pattern

**State Management Pattern:**
- Use `isLoading` flag to prevent duplicate submissions
- Use refs to track submission state across renders
- Reference: `LoginPinScreen.tsx:29-65` shows loading state pattern

---

## IMPLEMENTATION PLAN

### Phase 1: Login UX Improvements

Update login screens on both mobile and web platforms with:
- New commercial slogan in French
- Auto-submit functionality when PIN reaches 4 digits
- Guards against multiple submission attempts

### Phase 2: Transaction Balance Integrity

Audit and fix balance update logic:
- Review cash.service.ts createEntry() transaction logic
- Ensure all balance updates are atomic
- Add validation that balances are correctly calculated
- Verify the flow: CashEntry → Payment/ReceivablePayment → Balance Update

### Phase 3: Duplicate Entry Prevention

Fix transaction display in customer details:
- Identify the source of duplicate entries
- Implement deduplication based on cash_entry_id correlation
- Ensure each unique transaction appears only once

### Phase 4: Testing & Validation

- Manual testing of all three scenarios
- Verify balance calculations are correct
- Confirm no duplicate entries appear

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `apps/mobile/src/screens/LoginPinScreen.tsx` - Commercial Slogan

- **IMPLEMENT**: Change the slogan text from "Système de Gestion Commerciale" to a more commercial, aspirational message in French such as "Gérez, Vendez, Prospérez" or "Votre succès commercial simplifié"
- **PATTERN**: Reference existing French user-facing strings in the same file
- **DEPENDENCIES**: None
- **GOTCHA**: Keep the text short enough to fit on one line without wrapping
- **VALIDATE**: Visual inspection of the login screen
- **TEST_REQUIREMENT**: Slogan text is visible and properly styled

### Task 2: UPDATE `apps/mobile/src/screens/LoginPinScreen.tsx` - Auto-submit on 4th Digit

- **IMPLEMENT**: Add a useEffect hook that monitors the `pin` state. When pin.length reaches 4 AND shopCode.length is 6 AND not currently loading, automatically call handleSubmit(). Use a ref to track if submission has been triggered to prevent multiple calls.
- **PATTERN**: Follow the existing state management pattern with useState and loading flags
- **DEPENDENCIES**: React useEffect, useRef hooks
- **GOTCHA**:
  1. Must prevent multiple submissions if user rapidly types
  2. Must not trigger if already loading
  3. Must reset submission tracking after error
  4. Consider using a ref (hasSubmittedRef) to track if auto-submit was triggered
- **VALIDATE**: Test by entering shop code then PIN - should auto-submit on 4th digit
- **TEST_REQUIREMENT**: Login triggers automatically when 4th PIN digit is entered; no duplicate API calls

### Task 3: UPDATE `apps/web/src/pages/LoginPin.tsx` - Commercial Slogan

- **IMPLEMENT**: Change the slogan text from "Système de Gestion" to match the mobile app slogan
- **PATTERN**: Reference existing French user-facing strings in the same file
- **DEPENDENCIES**: None
- **GOTCHA**: Keep styling consistent with existing design
- **VALIDATE**: Visual inspection of the web login page
- **TEST_REQUIREMENT**: Slogan text matches mobile app

### Task 4: UPDATE `apps/web/src/pages/LoginPin.tsx` - Auto-submit on 4th Digit

- **IMPLEMENT**: Add a useEffect hook that monitors the `pin` state. When pin.length reaches 4 AND shopCode.length is 6 AND not loading, automatically trigger form submission. Use a ref to prevent duplicate submissions.
- **PATTERN**: Follow the existing React patterns in the file
- **DEPENDENCIES**: React useEffect, useRef hooks
- **GOTCHA**:
  1. Web uses form submit, so may need to programmatically submit
  2. Must handle async state updates properly
  3. Clear submission tracking on error
- **VALIDATE**: Test on web browser - should auto-submit on 4th PIN digit
- **TEST_REQUIREMENT**: Login triggers automatically when 4th PIN digit is entered

### Task 5: AUDIT `apps/api/src/modules/cash/cash.service.ts` - Transaction Integrity

- **IMPLEMENT**: Review the createEntry() method (lines 15-205) to ensure:
  1. The Prisma transaction ($transaction) properly wraps ALL related operations
  2. Supplier payment logic (lines 99-148) correctly updates SupplierDebt balance and status
  3. Customer payment logic (lines 150-199) correctly updates ClientReceivable balance and status
  4. Payment amount distribution uses correct FIFO ordering (oldest debts first)
  5. Status transitions are correct: PENDING → PARTIAL (if partial payment) → PAID (if fully paid)
- **PATTERN**: Follow existing Prisma transaction pattern in the file
- **DEPENDENCIES**: Prisma ORM
- **GOTCHA**:
  1. Ensure the transaction doesn't commit partial state on error
  2. Verify balance calculation: newBalance = receivable.balance - paymentAmount
  3. Check status logic: newBalance === 0 → 'PAID', else 'PARTIAL'
- **VALIDATE**: Run API lint and type checks: `cd apps/api && pnpm lint`
- **TEST_REQUIREMENT**: Balance updates are atomic and correct

### Task 6: VERIFY `apps/api/src/modules/cash/cash.service.ts` - Customer IN Transaction Creates Payment Record

- **IMPLEMENT**: Verify that when a CashEntry of type IN is created with a customer_id, it:
  1. Finds unpaid receivables (PENDING or PARTIAL) for that customer
  2. Creates ClientReceivablePayment records linking to the CashEntry
  3. Updates the receivable balance and status correctly
  4. The payment has cash_entry_id set correctly (this is critical for deduplication)
- **PATTERN**: Review lines 150-199 in cash.service.ts
- **DEPENDENCIES**: None
- **GOTCHA**: The payment MUST have cash_entry_id set so CustomerDetails can deduplicate
- **VALIDATE**: Create a test cash entry with customer_id and verify payment records are created with cash_entry_id populated
- **TEST_REQUIREMENT**: ClientReceivablePayment.cash_entry_id is correctly set

### Task 7: UPDATE `apps/mobile/src/screens/CustomerDetailsScreen.tsx` - Fix Duplicate Entries

- **IMPLEMENT**: In the loadAllTransactions() function (lines 178-245), fix the duplicate entry logic:
  1. Currently, receivable payments WITHOUT cash_entry_id are shown (line 200-210)
  2. Cash entries from API are shown separately (lines 214-221)
  3. The issue: A payment received via cash register creates BOTH a cash_entry AND a receivable_payment with cash_entry_id
  4. FIX: When iterating cash_entries, check if this cash_entry is already represented by a payment in a receivable. If so, show a unified "Paiement reçu" entry that combines the information.
  5. Alternative approach: Instead of showing cash_entries directly, derive payment information from receivable.payments and only show cash_entries that are NOT linked to any receivable payment.
- **PATTERN**: Follow existing transaction mapping pattern in the function
- **DEPENDENCIES**: None
- **GOTCHA**:
  1. Payments with cash_entry_id should NOT be shown twice (once as payment, once as cash entry)
  2. Cash entries used for customer refunds (OUT type with customer_id) should still be shown
  3. Maintain proper sorting by date
- **VALIDATE**: Create a credit sale, then make a payment. Verify only ONE entry appears for the payment.
- **TEST_REQUIREMENT**: Each unique transaction appears exactly once in the history

### Task 8: UPDATE `apps/web/src/pages/CustomerDetails.tsx` - Fix Duplicate Entries

- **IMPLEMENT**: In the getAllTransactions() function (lines 269-329), apply the same deduplication logic:
  1. Receivable payments that have a corresponding cash_entry (linked via cash_entry_id) should only show once
  2. Cash entries that are the source of receivable payments should not be shown separately
  3. Create a unified view where each transaction appears once with proper context
- **PATTERN**: Follow existing transaction mapping pattern in the function
- **DEPENDENCIES**: None
- **GOTCHA**:
  1. Web version currently shows ALL payments from receivables without checking cash_entry_id
  2. Need to coordinate the display so users see consistent information on mobile and web
- **VALIDATE**: Test on web browser with same scenario as mobile
- **TEST_REQUIREMENT**: Each unique transaction appears exactly once in the history

### Task 9: VERIFY End-to-End Transaction Flow

- **IMPLEMENT**: Manually verify the complete flow:
  1. Create a customer
  2. Create a receivable (credit sale) for that customer
  3. Make a payment via cash register (Cash IN with customer_id)
  4. Verify: Customer balance is updated correctly
  5. Verify: Only ONE entry appears in CustomerDetails for the payment
  6. Verify: The payment shows in the transaction history with correct amount
- **PATTERN**: Follow existing manual testing procedures
- **DEPENDENCIES**: Running API and mobile/web app
- **GOTCHA**: Test both partial payments and full payments
- **VALIDATE**: Manual end-to-end test
- **TEST_REQUIREMENT**: Complete flow works correctly without duplicate entries

---

## TESTING STRATEGY

### Unit Tests

**Scope**: API service methods for balance updates
**Requirements**:
- Test createEntry() with customer_id creates correct payment records
- Test balance calculation after payment
- Test status transitions (PENDING → PARTIAL → PAID)
- **VALIDATION COMMAND**: `cd apps/api && pnpm test`

**Test Categories Required**:
- Happy path: Full payment clears balance
- Partial payment: Updates balance and status to PARTIAL
- Overpayment: Creates negative balance (refund owed)
- Multiple receivables: FIFO distribution works correctly

### Integration Tests

**Scope**: End-to-end transaction flow
**Requirements**:
- Test complete flow from cash entry to balance update
- Verify database state after transactions
- **VALIDATION COMMAND**: `cd apps/api && pnpm test:e2e`

**Test Scenarios Required**:
- Credit sale followed by full payment
- Credit sale followed by multiple partial payments
- Supplier debt payment flow (for parity)

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:
1. Auto-login triggered multiple times (rapid typing)
2. Payment amount exactly equals balance
3. Payment amount exceeds balance (overpayment)
4. Multiple receivables with same customer
5. Network failure during transaction
6. Concurrent payments to same customer

### Test Resources

**Testing Documentation Links**:
- NestJS Testing: https://docs.nestjs.com/fundamentals/testing
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

**Required Commands**:
```bash
cd apps/api && pnpm lint
cd apps/mobile && pnpm lint
cd apps/web && pnpm lint
```

**Expected Result**: Zero errors, zero warnings

### Level 2: Type Checking

**Required Commands**:
```bash
cd apps/api && pnpm build
cd apps/web && pnpm build
```

**Expected Result**:
- All builds succeed
- No TypeScript errors

### Level 3: Unit Tests

**Required Commands**:
```bash
cd apps/api && pnpm test
cd apps/mobile && pnpm test
```

**Expected Result**:
- All tests pass
- No test failures or skipped tests

### Level 4: Manual Validation

**Feature-specific manual testing steps**:

**Login Auto-Submit Test (Mobile)**:
1. Open mobile app
2. Enter valid 6-digit shop code
3. Enter 4-digit PIN
4. Verify login triggers automatically on 4th digit
5. Verify only ONE login attempt is made (check API logs)

**Login Auto-Submit Test (Web)**:
1. Open web app at /login-pin
2. Enter valid 6-digit shop code
3. Enter 4-digit PIN
4. Verify login triggers automatically on 4th digit

**Balance Transaction Test**:
1. Create a new customer
2. Create a receivable of 10,000 FCFA
3. Record a cash entry (IN) of 5,000 FCFA with customer_id
4. Verify customer balance is now 5,000 FCFA
5. Verify receivable status is PARTIAL
6. Record another payment of 5,000 FCFA
7. Verify customer balance is 0 FCFA
8. Verify receivable status is PAID

**Duplicate Entry Test**:
1. Follow Balance Transaction Test steps
2. Navigate to Customer Details screen
3. Count entries in transaction history
4. Verify: ONE receivable entry (10,000 FCFA credit sale)
5. Verify: ONE payment entry (5,000 FCFA)
6. Verify: NO duplicate entries for the same payment

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Commercial slogan updated on both mobile and web login screens
- [ ] Auto-submit triggers when 4th PIN digit is entered (both platforms)
- [ ] No duplicate login API calls on auto-submit
- [ ] Cash transactions with customer_id correctly update customer balance
- [ ] Cash transactions with supplier_id correctly update supplier balance
- [ ] All balance updates are atomic (wrapped in Prisma transactions)
- [ ] Payment records have cash_entry_id set when created via cash entry
- [ ] CustomerDetails shows each transaction exactly once (no duplicates)
- [ ] Transaction history correctly shows credit sales and payments
- [ ] **ALL validation commands pass with zero errors**
- [ ] **Manual testing scenarios pass**
- [ ] No regressions in existing functionality

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Task 1: Mobile slogan updated
- [ ] Task 2: Mobile auto-submit implemented
- [ ] Task 3: Web slogan updated
- [ ] Task 4: Web auto-submit implemented
- [ ] Task 5: Cash service transaction integrity audited and fixed
- [ ] Task 6: Customer payment creates correct records with cash_entry_id
- [ ] Task 7: Mobile CustomerDetails deduplication implemented
- [ ] Task 8: Web CustomerDetails deduplication implemented
- [ ] Task 9: End-to-end flow verified
- [ ] All lint commands pass
- [ ] All builds succeed
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] No duplicate entries in customer transaction history

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation
- Prisma Transactions: https://www.prisma.io/docs/concepts/components/prisma-client/transactions
- React useEffect: https://react.dev/reference/react/useEffect
- React useRef: https://react.dev/reference/react/useRef
- NestJS Documentation: https://docs.nestjs.com/

### Internal Resources
- Project CLAUDE.md: Contains architecture overview and patterns
- Existing cash.service.ts: Reference for transaction patterns
- Existing CustomerDetailsScreen: Reference for transaction display patterns

## NOTES

**Key Findings from Analysis**:

1. **Auto-Submit Implementation**: The current login screens use standard React state. Adding a useEffect that watches `pin` state and calls handleSubmit when length === 4 is straightforward, but requires careful handling of the loading state and error cases to prevent multiple submissions.

2. **Balance Transaction Issue Root Cause**: The cash.service.ts correctly wraps operations in a Prisma transaction. However, the key issue may be in how payments are distributed across receivables. The current logic finds unpaid receivables and distributes payments in FIFO order. Need to verify:
   - The status transition logic is correct
   - The balance calculation is correct (balance = balance - payment, not amount - payment)
   - The cash_entry_id is being set on ClientReceivablePayment records

3. **Duplicate Entry Root Cause**: In CustomerDetailsScreen.tsx, the loadAllTransactions() function:
   - Adds receivables and their payments (filtering out payments WITH cash_entry_id)
   - Adds cash_entries from API separately
   - Adds sales from AsyncStorage

   The deduplication relies on `if (!payment.cash_entry_id)` at line 202, which SHOULD filter out payments linked to cash entries. If duplicates still appear, either:
   - cash_entry_id is not being set on payments created via cash entry
   - The cash_entries being shown are different from the ones linked to payments

   The fix may require ensuring cash_entry_id is properly set in cash.service.ts when creating ClientReceivablePayment records.

**Important Considerations**:
- This handles money - every calculation must be precise
- Use integer math (FCFA has no decimals)
- Test edge cases: exact payments, overpayments, multiple receivables
- Ensure transaction atomicity - partial state should never be committed

<!-- EOF -->
