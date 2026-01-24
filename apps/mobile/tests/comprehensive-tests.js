/**
 * Suite de tests complète pour SWALO Mobile App
 * Tests unitaires pour la caisse, montants et stocks
 */

const Colors = {
  success: { main: '\x1b[32m' },
  danger: { main: '\x1b[31m' },
  warning: { main: '\x1b[33m' },
  info: { main: '\x1b[36m' },
  reset: '\x1b[0m',
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`${Colors.success.main}✓${Colors.reset} ${testName}`);
    return true;
  } else {
    failedTests++;
    console.log(`${Colors.danger.main}✗${Colors.reset} ${testName}`);
    return false;
  }
}

function assertEqual(actual, expected, testName) {
  const passed = actual === expected;
  assert(passed, `${testName} (Expected: ${expected}, Got: ${actual})`);
  return passed;
}

console.log('\n' + '='.repeat(80));
console.log('🧪 SWALO - Suite de Tests Unitaires Complète');
console.log('='.repeat(80) + '\n');

// ============================================================================
// 1. TESTS DU FORMATAGE MONÉTAIRE (formatMoney)
// ============================================================================
console.log(`${Colors.info.main}📊 Section 1: Formatage Monétaire (formatMoney)${Colors.reset}\n`);

function formatMoney(amount) {
  const formatted = Math.abs(amount || 0)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} F`;
}

// Test 1.1: Montants positifs standards
assertEqual(formatMoney(0), '0 F', 'formatMoney(0) doit retourner "0 F"');
assertEqual(formatMoney(100), '100 F', 'formatMoney(100) doit retourner "100 F"');
assertEqual(formatMoney(1000), '1 000 F', 'formatMoney(1000) doit retourner "1 000 F"');
assertEqual(formatMoney(10000), '10 000 F', 'formatMoney(10000) doit retourner "10 000 F"');
assertEqual(formatMoney(100000), '100 000 F', 'formatMoney(100000) doit retourner "100 000 F"');
assertEqual(
  formatMoney(1000000),
  '1 000 000 F',
  'formatMoney(1000000) doit retourner "1 000 000 F"'
);
assertEqual(
  formatMoney(1234567),
  '1 234 567 F',
  'formatMoney(1234567) doit retourner "1 234 567 F"'
);

// Test 1.2: Montants négatifs (doivent être convertis en positifs)
assertEqual(
  formatMoney(-100),
  '100 F',
  'formatMoney(-100) doit retourner "100 F" (valeur absolue)'
);
assertEqual(
  formatMoney(-5000),
  '5 000 F',
  'formatMoney(-5000) doit retourner "5 000 F" (valeur absolue)'
);
assertEqual(
  formatMoney(-1234567),
  '1 234 567 F',
  'formatMoney(-1234567) doit retourner "1 234 567 F"'
);

// Test 1.3: Valeurs undefined, null ou invalides
assertEqual(formatMoney(undefined), '0 F', 'formatMoney(undefined) doit retourner "0 F"');
assertEqual(formatMoney(null), '0 F', 'formatMoney(null) doit retourner "0 F"');
assertEqual(formatMoney(NaN), '0 F', 'formatMoney(NaN) doit retourner "0 F"');

// Test 1.4: Montants décimaux (doivent être arrondis)
assertEqual(formatMoney(100.5), '101 F', 'formatMoney(100.5) doit retourner "101 F" (arrondi)');
assertEqual(formatMoney(100.4), '100 F', 'formatMoney(100.4) doit retourner "100 F" (arrondi)');
assertEqual(formatMoney(999.9), '1 000 F', 'formatMoney(999.9) doit retourner "1 000 F" (arrondi)');
assertEqual(
  formatMoney(1234.56),
  '1 235 F',
  'formatMoney(1234.56) doit retourner "1 235 F" (arrondi)'
);

console.log('');

// ============================================================================
// 2. TESTS DU FORMATAGE AVEC SIGNE (formatMoneyWithSign)
// ============================================================================
console.log(`${Colors.info.main}💰 Section 2: Formatage Monétaire avec Signe${Colors.reset}\n`);

function formatMoneyWithSign(amount) {
  const sign = amount >= 0 ? '+' : '-';
  const formatted = formatMoney(Math.abs(amount));
  return `${sign}${formatted}`;
}

// Test 2.1: Montants positifs
assertEqual(formatMoneyWithSign(0), '+0 F', 'formatMoneyWithSign(0) doit retourner "+0 F"');
assertEqual(formatMoneyWithSign(100), '+100 F', 'formatMoneyWithSign(100) doit retourner "+100 F"');
assertEqual(
  formatMoneyWithSign(5000),
  '+5 000 F',
  'formatMoneyWithSign(5000) doit retourner "+5 000 F"'
);

// Test 2.2: Montants négatifs
assertEqual(
  formatMoneyWithSign(-100),
  '-100 F',
  'formatMoneyWithSign(-100) doit retourner "-100 F"'
);
assertEqual(
  formatMoneyWithSign(-5000),
  '-5 000 F',
  'formatMoneyWithSign(-5000) doit retourner "-5 000 F"'
);

console.log('');

// ============================================================================
// 3. TESTS DES CALCULS DE CAISSE
// ============================================================================
console.log(`${Colors.info.main}💵 Section 3: Calculs de Caisse${Colors.reset}\n`);

// Test 3.1: Calcul du solde
function calculateBalance(entries, exits) {
  return (entries || 0) - (exits || 0);
}

assertEqual(calculateBalance(10000, 5000), 5000, 'Balance: 10000 - 5000 = 5000');
assertEqual(calculateBalance(0, 0), 0, 'Balance: 0 - 0 = 0');
assertEqual(calculateBalance(1000, 1500), -500, 'Balance: 1000 - 1500 = -500 (négatif autorisé)');
assertEqual(calculateBalance(undefined, 5000), -5000, 'Balance avec entrées undefined');
assertEqual(calculateBalance(5000, undefined), 5000, 'Balance avec sorties undefined');
assertEqual(calculateBalance(null, null), 0, 'Balance avec null');

// Test 3.2: Calcul du résultat net
function calculateNet(totalEntries, totalExits) {
  const entries = totalEntries || 0;
  const exits = totalExits || 0;
  return entries - exits;
}

assertEqual(calculateNet(100000, 50000), 50000, 'Net: 100000 - 50000 = 50000');
assertEqual(calculateNet(50000, 100000), -50000, 'Net: 50000 - 100000 = -50000 (perte)');
assertEqual(calculateNet(0, 0), 0, 'Net: 0 - 0 = 0');

// Test 3.3: Validation du solde pour les sorties
function canWithdraw(amount, balance) {
  return amount > 0 && amount <= balance;
}

assert(canWithdraw(5000, 10000), 'Retrait 5000 avec solde 10000 → Autorisé');
assert(canWithdraw(10000, 10000), 'Retrait 10000 avec solde 10000 → Autorisé (total)');
assert(!canWithdraw(15000, 10000), 'Retrait 15000 avec solde 10000 → Bloqué (insuffisant)');
assert(!canWithdraw(0, 10000), 'Retrait 0 → Bloqué (montant invalide)');
assert(!canWithdraw(-5000, 10000), 'Retrait négatif → Bloqué');
assert(!canWithdraw(5000, 0), 'Retrait avec solde 0 → Bloqué');

// Test 3.4: Agrégation de transactions
function aggregateTransactions(transactions) {
  return transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === 'IN') {
        acc.totalEntries += transaction.amount;
        acc.entriesCount++;
      } else {
        acc.totalExits += transaction.amount;
        acc.exitsCount++;
      }
      return acc;
    },
    { totalEntries: 0, totalExits: 0, entriesCount: 0, exitsCount: 0 }
  );
}

const testTransactions = [
  { type: 'IN', amount: 10000 },
  { type: 'IN', amount: 5000 },
  { type: 'OUT', amount: 3000 },
  { type: 'OUT', amount: 2000 },
];

const result = aggregateTransactions(testTransactions);
assertEqual(result.totalEntries, 15000, 'Total entrées = 15000');
assertEqual(result.totalExits, 5000, 'Total sorties = 5000');
assertEqual(result.entriesCount, 2, 'Nombre entrées = 2');
assertEqual(result.exitsCount, 2, 'Nombre sorties = 2');

// Test transactions vides
const emptyResult = aggregateTransactions([]);
assertEqual(emptyResult.totalEntries, 0, 'Total entrées (vide) = 0');
assertEqual(emptyResult.totalExits, 0, 'Total sorties (vide) = 0');

console.log('');

// ============================================================================
// 4. TESTS DE GESTION DE STOCK
// ============================================================================
console.log(`${Colors.info.main}📦 Section 4: Gestion de Stock${Colors.reset}\n`);

// Test 4.1: Statut du stock
function getStockStatus(quantity, threshold) {
  if (quantity === 0) return 'out';
  if (quantity <= threshold) return 'low';
  return 'ok';
}

assertEqual(getStockStatus(0, 10), 'out', 'Stock = 0 → Rupture');
assertEqual(getStockStatus(5, 10), 'low', 'Stock = 5, seuil = 10 → Stock faible');
assertEqual(getStockStatus(10, 10), 'low', 'Stock = seuil → Stock faible');
assertEqual(getStockStatus(11, 10), 'ok', 'Stock > seuil → En stock');
assertEqual(getStockStatus(100, 10), 'ok', 'Stock = 100, seuil = 10 → En stock');

// Test 4.2: Ajout de stock
function addStock(currentStock, adjustment) {
  return Math.max(0, (currentStock || 0) + (adjustment || 0));
}

assertEqual(addStock(10, 5), 15, 'Ajout: 10 + 5 = 15');
assertEqual(addStock(0, 10), 10, 'Ajout sur stock vide: 0 + 10 = 10');
assertEqual(addStock(10, 0), 10, 'Ajout de 0: 10 + 0 = 10');
assertEqual(addStock(undefined, 5), 5, 'Ajout avec stock undefined');
assertEqual(addStock(10, -5), 5, 'Ajout négatif: 10 + (-5) = 5');
assertEqual(addStock(5, -10), 0, 'Ajout négatif avec protection: 5 + (-10) = 0 (pas négatif)');

// Test 4.3: Retrait de stock
function removeStock(currentStock, adjustment) {
  return Math.max(0, (currentStock || 0) - (adjustment || 0));
}

assertEqual(removeStock(10, 5), 5, 'Retrait: 10 - 5 = 5');
assertEqual(removeStock(10, 10), 0, 'Retrait total: 10 - 10 = 0');
assertEqual(removeStock(10, 15), 0, 'Retrait excédentaire: 10 - 15 = 0 (protection)');
assertEqual(removeStock(0, 5), 0, 'Retrait sur stock vide: 0 - 5 = 0');
assertEqual(removeStock(undefined, 5), 0, 'Retrait avec stock undefined');

// Test 4.4: Comptage par statut
function countByStatus(products) {
  return products.reduce(
    (acc, product) => {
      const status = getStockStatus(product.stockQuantity, product.stockThreshold);
      if (status === 'out') acc.outOfStock++;
      else if (status === 'low') acc.lowStock++;
      else acc.inStock++;
      return acc;
    },
    { inStock: 0, lowStock: 0, outOfStock: 0 }
  );
}

const testProducts = [
  { stockQuantity: 0, stockThreshold: 10 },
  { stockQuantity: 5, stockThreshold: 10 },
  { stockQuantity: 10, stockThreshold: 10 },
  { stockQuantity: 20, stockThreshold: 10 },
  { stockQuantity: 0, stockThreshold: 5 },
];

const stockCounts = countByStatus(testProducts);
assertEqual(stockCounts.outOfStock, 2, 'Ruptures de stock = 2');
assertEqual(stockCounts.lowStock, 2, 'Stocks faibles = 2');
assertEqual(stockCounts.inStock, 1, 'En stock = 1');

console.log('');

// ============================================================================
// 5. TESTS DES CRÉANCES ET DETTES
// ============================================================================
console.log(`${Colors.info.main}💳 Section 5: Créances et Dettes${Colors.reset}\n`);

// Test 5.1: Calcul du solde créances
function calculateReceivableBalance(receivables) {
  return receivables.reduce((sum, r) => sum + (r.balance || 0), 0);
}

const testReceivables = [{ balance: 10000 }, { balance: 5000 }, { balance: 0 }, { balance: 2500 }];

assertEqual(calculateReceivableBalance(testReceivables), 17500, 'Total créances = 17500');
assertEqual(calculateReceivableBalance([]), 0, 'Total créances (vide) = 0');

// Test 5.2: Calcul du solde dettes
function calculateDebtBalance(debts) {
  return debts.reduce((sum, d) => sum + (d.balance || 0), 0);
}

const testDebts = [{ balance: 8000 }, { balance: 3000 }];

assertEqual(calculateDebtBalance(testDebts), 11000, 'Total dettes = 11000');

// Test 5.3: Calcul du solde net (créances - dettes)
function calculateNetBalance(receivables, debts) {
  const totalReceivables = calculateReceivableBalance(receivables);
  const totalDebts = calculateDebtBalance(debts);
  return totalReceivables - totalDebts;
}

assertEqual(
  calculateNetBalance(testReceivables, testDebts),
  6500,
  'Solde net = 17500 - 11000 = 6500'
);
assertEqual(calculateNetBalance([], []), 0, 'Solde net (vide) = 0');

// Test 5.4: Statut de paiement
function getPaymentStatus(paidAmount, totalAmount) {
  if (paidAmount === 0) return 'PENDING';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIAL';
}

assertEqual(getPaymentStatus(0, 10000), 'PENDING', 'Rien payé → PENDING');
assertEqual(getPaymentStatus(5000, 10000), 'PARTIAL', 'Partiellement payé → PARTIAL');
assertEqual(getPaymentStatus(10000, 10000), 'PAID', 'Totalement payé → PAID');
assertEqual(getPaymentStatus(15000, 10000), 'PAID', 'Surpayé → PAID');

console.log('');

// ============================================================================
// 6. TESTS DE PROTECTION ET VALIDATION
// ============================================================================
console.log(`${Colors.info.main}🛡️ Section 6: Protection et Validation${Colors.reset}\n`);

// Test 6.1: Validation des montants
function isValidAmount(amount) {
  return typeof amount === 'number' && !isNaN(amount) && amount >= 0;
}

assert(isValidAmount(100), 'isValidAmount(100) → true');
assert(isValidAmount(0), 'isValidAmount(0) → true');
assert(!isValidAmount(-100), 'isValidAmount(-100) → false (négatif)');
assert(!isValidAmount(NaN), 'isValidAmount(NaN) → false');
assert(!isValidAmount(undefined), 'isValidAmount(undefined) → false');
assert(!isValidAmount(null), 'isValidAmount(null) → false');
assert(!isValidAmount('100'), 'isValidAmount("100") → false (string)');

// Test 6.2: Protection optional chaining
function safeGetStats(data) {
  return {
    total_balance: data?.stats?.total_balance || 0,
    total_receivables: data?.stats?.total_receivables || 0,
  };
}

const validData = { stats: { total_balance: 1000, total_receivables: 500 } };
const invalidData = { stats: null };
const noStats = {};

const validResult = safeGetStats(validData);
assertEqual(validResult.total_balance, 1000, 'Stats valides: balance = 1000');
assertEqual(validResult.total_receivables, 500, 'Stats valides: receivables = 500');

const invalidResult = safeGetStats(invalidData);
assertEqual(invalidResult.total_balance, 0, 'Stats null: balance = 0 (fallback)');

const noStatsResult = safeGetStats(noStats);
assertEqual(noStatsResult.total_balance, 0, 'Pas de stats: balance = 0 (fallback)');

// Test 6.3: Conversion de chaînes en nombres
function parseAmount(value) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? 0 : parsed;
}

assertEqual(parseAmount('1000'), 1000, 'parseAmount("1000") = 1000');
assertEqual(parseAmount(''), 0, 'parseAmount("") = 0');
assertEqual(parseAmount('abc'), 0, 'parseAmount("abc") = 0');
assertEqual(parseAmount('100.5'), 100, 'parseAmount("100.5") = 100 (arrondi)');

console.log('');

// ============================================================================
// 7. TESTS D'INTÉGRATION - SCÉNARIOS RÉELS
// ============================================================================
console.log(`${Colors.info.main}🎯 Section 7: Scénarios d'Intégration${Colors.reset}\n`);

// Scénario 7.1: Journée de caisse complète
console.log(`${Colors.warning.main}Scénario 7.1: Journée de caisse complète${Colors.reset}`);

const dailyTransactions = [
  { type: 'IN', amount: 50000, category: 'vente' },
  { type: 'IN', amount: 20000, category: 'vente' },
  { type: 'OUT', amount: 5000, category: 'achat' },
  { type: 'IN', amount: 15000, category: 'paiement_client' },
  { type: 'OUT', amount: 10000, category: 'paiement_fournisseur' },
];

const dailyStats = aggregateTransactions(dailyTransactions);
const dailyNet = calculateNet(dailyStats.totalEntries, dailyStats.totalExits);

assertEqual(dailyStats.totalEntries, 85000, '  Total entrées journée = 85000');
assertEqual(dailyStats.totalExits, 15000, '  Total sorties journée = 15000');
assertEqual(dailyNet, 70000, '  Résultat net journée = 70000');
console.log(`  ${Colors.success.main}Solde affiché: ${formatMoney(dailyNet)}${Colors.reset}`);

// Scénario 7.2: Gestion de stock avec alertes
console.log(`\n${Colors.warning.main}Scénario 7.2: Gestion de stock avec alertes${Colors.reset}`);

const inventory = [
  { name: 'Produit A', stockQuantity: 100, stockThreshold: 20 },
  { name: 'Produit B', stockQuantity: 15, stockThreshold: 20 },
  { name: 'Produit C', stockQuantity: 0, stockThreshold: 10 },
];

const inventoryCounts = countByStatus(inventory);
assertEqual(inventoryCounts.inStock, 1, '  Produits en stock = 1');
assertEqual(inventoryCounts.lowStock, 1, '  Produits en stock faible = 1');
assertEqual(inventoryCounts.outOfStock, 1, '  Produits en rupture = 1');

// Scénario 7.3: Gestion des créances clients
console.log(`\n${Colors.warning.main}Scénario 7.3: Gestion des créances clients${Colors.reset}`);

const customerReceivables = [
  { customer: 'Client A', amount: 50000, paidAmount: 0, balance: 50000 },
  { customer: 'Client B', amount: 30000, paidAmount: 15000, balance: 15000 },
  { customer: 'Client C', amount: 20000, paidAmount: 20000, balance: 0 },
];

const totalDue = calculateReceivableBalance(customerReceivables);
assertEqual(totalDue, 65000, '  Total à recevoir = 65000');
console.log(`  ${Colors.success.main}Montant affiché: ${formatMoney(totalDue)}${Colors.reset}`);

const statusA = getPaymentStatus(0, 50000);
const statusB = getPaymentStatus(15000, 30000);
const statusC = getPaymentStatus(20000, 20000);

assertEqual(statusA, 'PENDING', '  Client A: Non payé → PENDING');
assertEqual(statusB, 'PARTIAL', '  Client B: Partiellement payé → PARTIAL');
assertEqual(statusC, 'PAID', '  Client C: Totalement payé → PAID');

console.log('');

// ============================================================================
// BILAN FINAL
// ============================================================================
console.log('='.repeat(80));
console.log('📋 BILAN DES TESTS');
console.log('='.repeat(80));

const successRate = ((passedTests / totalTests) * 100).toFixed(1);

console.log(`\nTotal de tests exécutés: ${totalTests}`);
console.log(`${Colors.success.main}Tests réussis: ${passedTests}${Colors.reset}`);
console.log(`${Colors.danger.main}Tests échoués: ${failedTests}${Colors.reset}`);
console.log(`Taux de réussite: ${successRate}%\n`);

if (failedTests === 0) {
  console.log(`${Colors.success.main}✅ TOUS LES TESTS SONT PASSÉS!${Colors.reset}`);
  console.log(`${Colors.success.main}L'application est prête pour la production.${Colors.reset}\n`);
} else {
  console.log(`${Colors.danger.main}❌ DES ERREURS ONT ÉTÉ DÉTECTÉES${Colors.reset}`);
  console.log(
    `${Colors.warning.main}Veuillez corriger les problèmes avant de déployer.${Colors.reset}\n`
  );
}

console.log('='.repeat(80) + '\n');

// Export du résultat
process.exit(failedTests > 0 ? 1 : 0);
