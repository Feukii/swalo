# Manual Testing Guide: Balance Management & Product Catalog

This guide provides step-by-step instructions for manually testing all new features implemented in the balance management and product catalog improvements.

## Prerequisites

- Mobile app installed and logged in
- At least one shop with test data
- At least one test customer
- At least one test supplier
- At least one test product

## Test Scenarios

---

## 1. Customer Refund Workflow

### Scenario 1.1: Create Customer with Overpayment

**Objective**: Create a situation where a customer has a negative balance (we owe them money)

**Steps**:
1. Navigate to Customers screen
2. Select or create a customer "Test Customer A"
3. Navigate to their details
4. **Record a payment** of 10,000 FCFA (without any receivable)
   - This creates a negative balance: -10,000
5. Verify:
   - ✅ Balance shows as RED/negative
   - ✅ BalanceIndicator displays "Nous devons au client"
   - ✅ Alert banner appears: "Remboursement dû au client !"
   - ✅ Alert popup appears when loading customer
   - ✅ "Rembourser Client" button is visible

### Scenario 1.2: Refund Customer (Full Amount)

**Objective**: Refund the full amount owed to customer

**Steps**:
1. From Test Customer A details, tap "Rembourser Client"
2. Enter amount: 10,000 FCFA
3. Select payment method: **Espèces**
4. Add note: "Full refund test"
5. Tap "Rembourser"
6. Verify:
   - ✅ Success message appears
   - ✅ Balance updates to 0
   - ✅ BalanceIndicator shows YELLOW (zero balance)
   - ✅ "Solde équilibré" message
   - ✅ Transaction history shows "Remboursement au client" entry with red icon
   - ✅ Cash balance decreased by 10,000

### Scenario 1.3: Refund Customer (Partial Amount)

**Objective**: Test partial refund validation

**Steps**:
1. Create overpayment of 5,000 FCFA for "Test Customer B"
2. Tap "Rembourser Client"
3. Enter amount: 3,000 FCFA
4. Select: **Mobile Money**
5. Tap "Rembourser"
6. Verify:
   - ✅ Success message
   - ✅ Balance shows -2,000 (still negative)
   - ✅ RED BalanceIndicator with alert
   - ✅ "Rembourser Client" button still visible
   - ✅ Can refund remaining 2,000

### Scenario 1.4: Refund Validation (Exceeds Amount)

**Objective**: Test that refund cannot exceed amount owed

**Steps**:
1. Customer has -1,000 balance
2. Tap "Rembourser Client"
3. Enter amount: 5,000 FCFA (more than owed)
4. Tap "Rembourser"
5. Verify:
   - ✅ Error message: "Le montant du remboursement (5000) dépasse le montant dû (1000)"
   - ✅ Modal stays open
   - ✅ No transaction created

### Scenario 1.5: Refund When No Amount Owed

**Objective**: Test that refund button only appears when appropriate

**Steps**:
1. Navigate to customer with 0 or positive balance
2. Verify:
   - ✅ "Rembourser Client" button is NOT visible
   - ✅ Only "Créer créance" and "Recevoir paiement" buttons show

---

## 2. Supplier Refund Claim Workflow

### Scenario 2.1: Create Supplier Overpayment

**Objective**: Create situation where supplier owes us money (negative balance)

**Steps**:
1. Navigate to Suppliers screen
2. Select "Test Supplier A"
3. Create debt of 5,000 FCFA (we owe them)
4. **Pay them** 10,000 FCFA
   - This creates negative balance: -5,000 (they owe us 5,000)
5. Verify:
   - ✅ Balance shows RED/negative: -5,000
   - ✅ BalanceIndicator displays "Fournisseur nous doit"
   - ✅ Alert: "Remboursement dû par le fournisseur !"
   - ✅ Alert popup on load
   - ✅ "Réclamer Remboursement" button visible

### Scenario 2.2: Claim Refund from Supplier

**Objective**: Record receiving money back from supplier

**Steps**:
1. From Test Supplier A details, tap "Réclamer Remboursement"
2. Enter amount: 5,000 FCFA
3. Select: **Espèces**
4. Add note: "Refund for overpayment"
5. Tap "Réclamer"
6. Verify:
   - ✅ Success message
   - ✅ Balance updates to 0
   - ✅ YELLOW BalanceIndicator (equilibré)
   - ✅ Transaction history shows "Remboursement du fournisseur" with red icon
   - ✅ Cash balance INCREASED by 5,000 (we received money)

### Scenario 2.3: Claim Refund Validation

**Objective**: Test validation when claiming more than owed

**Steps**:
1. Supplier has -2,000 balance (owes us 2,000)
2. Try to claim 5,000
3. Verify:
   - ✅ Error: amount exceeds what's owed
   - ✅ No transaction created

---

## 3. Merchandise Purchase Workflow

### Scenario 3.1: Cash Purchase Without Debt

**Objective**: Record merchandise purchase paid immediately in cash

**Steps**:
1. Navigate to Cash/Caisse screen
2. Note current cash balance
3. Tap "Achat Marchandise" button
4. Select supplier: "Test Supplier B"
5. Enter amount: 25,000 FCFA
6. Description: "Stock purchase test"
7. Payment method: **Espèces**
8. Create debt: **Unchecked** ❌
9. Tap "Valider"
10. Verify:
    - ✅ Success: "Achat enregistré avec succès"
    - ✅ Cash balance decreased by 25,000
    - ✅ Cash journal shows "Achats Marchandises" entry
    - ✅ Supplier balance unchanged (no debt created)

### Scenario 3.2: Cash Purchase With Debt Creation

**Objective**: Record purchase and create supplier debt simultaneously

**Steps**:
1. Cash screen → "Achat Marchandise"
2. Supplier: "Test Supplier C"
3. Amount: 50,000 FCFA
4. Description: "Large stock order"
5. Payment: **Espèces**
6. Create debt: **Checked** ✅
7. Tap "Valider"
8. Verify:
    - ✅ Success: "Achat enregistré avec succès et dette créée"
    - ✅ Cash balance decreased by 50,000
    - ✅ Navigate to Supplier C details
    - ✅ Supplier balance shows +50,000 (we owe them)
    - ✅ GREEN BalanceIndicator: "Nous devons au fournisseur"
    - ✅ Debt entry in transaction history

### Scenario 3.3: Mobile Money Purchase

**Objective**: Test non-cash payment method

**Steps**:
1. Note: Cash balance is LOW (< 10,000)
2. "Achat Marchandise" → Supplier D
3. Amount: 30,000 FCFA (more than cash balance)
4. Payment: **Mobile Money**
5. No debt creation
6. Verify:
    - ✅ Transaction succeeds (not blocked by low cash)
    - ✅ Cash journal entry created
    - ✅ Supplier balance unchanged

### Scenario 3.4: Insufficient Cash Balance

**Objective**: Test validation for insufficient funds

**Steps**:
1. Cash balance: 5,000 FCFA
2. Try to purchase 20,000 FCFA with **Espèces**
3. Verify:
    - ✅ Error: "Solde insuffisant"
    - ✅ Shows current balance in error
    - ✅ No transaction created

---

## 4. Product Catalog Hierarchy

### Scenario 4.1: Add New Family

**Objective**: Create new product family

**Steps**:
1. Navigate to Catalogue → "Hiérarchie" button
2. Tap "+" (top right)
3. Enter family name: "ACCESSORIES"
4. Tap "Ajouter"
5. Verify:
    - ✅ Success message
    - ✅ ACCESSORIES appears in hierarchy list
    - ✅ Can expand to see placeholder article

### Scenario 4.2: Batch Rename Family

**Objective**: Test bulk update of hierarchy level

**Steps**:
1. Hierarchy screen → tap EDIT icon next to "ACCESSORIES"
2. Change to: "PHONE ACCESSORIES"
3. Tap "Enregistrer"
4. Verify:
    - ✅ Success: "X produit(s) mis à jour"
    - ✅ All products with old family now show new name
    - ✅ Hierarchy rebuilds correctly

### Scenario 4.3: Cascade Filtering

**Objective**: Test that filters narrow progressively

**Steps**:
1. Catalogue tab → Articles view
2. Tap filter icon
3. Select Family: "GLASSES"
4. Verify:
    - ✅ Only products from GLASSES family shown
    - ✅ Brand filter shows only brands within GLASSES
    - ✅ Type filter shows only types within GLASSES
5. Now also select Brand: "Samsung"
6. Verify:
    - ✅ Product list further filtered
    - ✅ Type filter shows only types for GLASSES + Samsung
7. Clear filters
8. Verify:
    - ✅ All products shown again
    - ✅ All filters reset

### Scenario 4.4: Navigate Between Tabs

**Objective**: Test tab switching

**Steps**:
1. Catalogue → Articles tab (default)
2. Add filter: Family = CASES
3. Switch to "Catalogue" tab
4. Verify:
    - ✅ Hierarchical view shown
    - ✅ Products grouped by Family → Type → Brand
5. Switch back to "Articles"
6. Verify:
    - ✅ Filter still applied
    - ✅ Product list matches filter

---

## 5. Integration Tests (Cross-Feature)

### Scenario 5.1: Complete Customer Credit Cycle

**Objective**: Test full workflow from credit sale to refund

**Steps**:
1. Create credit sale to Customer E: 20,000 FCFA
2. Customer pays 25,000 FCFA (overpayment)
3. Refund excess 5,000 FCFA
4. Verify:
    - ✅ Final balance: 0
    - ✅ All transactions recorded correctly
    - ✅ Cash movements match

### Scenario 5.2: Supplier Purchase and Refund

**Objective**: Full supplier transaction cycle

**Steps**:
1. Purchase from Supplier F: 100,000 with debt
2. Pay supplier 120,000 (overpayment)
3. Claim refund of 20,000
4. Verify:
    - ✅ Supplier balance: 0
    - ✅ Cash balance net change: -100,000

---

## 6. Edge Cases & Error Handling

### Test 6.1: Concurrent Transactions
- Open customer details on 2 devices
- Create refund on both simultaneously
- Verify: Optimistic locking prevents double-refund

### Test 6.2: Offline/Online Sync
- Create refund while offline
- Go online
- Verify: Transaction syncs correctly

### Test 6.3: Very Large Amounts
- Test with amounts > 1,000,000 FCFA
- Verify: UI handles formatting, calculations correct

### Test 6.4: Special Characters
- Add notes with emojis, accents, quotes
- Verify: Saved and displayed correctly

---

## Validation Checklist

After completing all scenarios, verify:

### Data Integrity
- [ ] All customer balances match sum of receivables
- [ ] All supplier balances match sum of debts
- [ ] Cash balance equals sum of IN - OUT entries
- [ ] No orphaned transactions

### UI Consistency
- [ ] Colors correct: GREEN (positive), RED (negative), YELLOW (zero)
- [ ] Icons appropriate for transaction types
- [ ] All French labels correct and consistent
- [ ] Loading states work (spinners, disabled buttons)

### Business Rules
- [ ] Cannot refund more than owed
- [ ] Cannot refund when no balance owed
- [ ] Insufficient cash prevents CASH purchases
- [ ] All transactions atomic (either fully complete or rollback)

### Performance
- [ ] Screens load within 2 seconds
- [ ] Large lists scroll smoothly
- [ ] Filters apply quickly
- [ ] No memory leaks on repeated operations

---

## Reporting Issues

If you find any issues during testing:

1. **Document**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Device/OS information

2. **Categorize**:
   - Critical: Data loss, incorrect calculations
   - Major: Feature unusable, poor UX
   - Minor: Cosmetic issues, typos

3. **Log Location**:
   - Check console logs for errors
   - Review validation script output
   - Check API response codes

---

## Success Criteria

Testing is complete when:
- ✅ All 25+ scenarios pass
- ✅ No critical or major issues found
- ✅ Edge cases handled gracefully
- ✅ Data integrity validated
- ✅ Performance meets requirements
- ✅ User experience is intuitive
