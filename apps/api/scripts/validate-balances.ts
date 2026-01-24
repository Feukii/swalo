/**
 * Balance Validation Script
 *
 * This script validates that customer and supplier balance calculations are correct
 * by comparing database aggregates with the displayed stats.
 *
 * Usage: ts-node scripts/validate-balances.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalCustomers: number;
    totalSuppliers: number;
    customersWithIssues: number;
    suppliersWithIssues: number;
  };
}

async function validateCustomerBalances(shopId: string): Promise<{
  errors: string[];
  warnings: string[];
  totalCustomers: number;
  customersWithIssues: number;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let customersWithIssues = 0;

  const customers = await prisma.customer.findMany({
    where: { shop_id: shopId, deleted: false },
    include: {
      receivables: {
        where: { deleted: false },
      },
    },
  });

  console.log(`\n📊 Validating ${customers.length} customers...`);

  for (const customer of customers) {
    const calculatedBalance = customer.receivables.reduce((sum, r) => sum + r.balance, 0);

    // Get stats via aggregate
    const stats = await prisma.clientReceivable.aggregate({
      where: {
        customer_id: customer.id,
        deleted: false,
      },
      _sum: {
        amount: true,
        balance: true,
        paid_amount: true,
      },
    });

    const aggregateBalance = stats._sum.balance || 0;

    if (calculatedBalance !== aggregateBalance) {
      errors.push(
        `Customer "${customer.name}" (${customer.id}): Balance mismatch! ` +
          `Calculated: ${calculatedBalance}, Aggregate: ${aggregateBalance}`
      );
      customersWithIssues++;
    }

    // Check for negative balances (we owe customer a refund)
    if (aggregateBalance < 0) {
      warnings.push(
        `Customer "${customer.name}": Negative balance ${aggregateBalance / 100} FCFA - refund may be owed`
      );
    }

    // Verify individual receivables
    for (const receivable of customer.receivables) {
      if (receivable.balance < 0 && receivable.status !== 'PAID') {
        warnings.push(
          `Customer "${customer.name}": Receivable ${receivable.id} has negative balance but status is ${receivable.status}`
        );
      }

      // Only check paid_amount > amount for positive amounts (not refunds)
      if (receivable.amount > 0 && receivable.paid_amount > receivable.amount) {
        errors.push(
          `Customer "${customer.name}": Receivable ${receivable.id} has paid_amount (${receivable.paid_amount}) > amount (${receivable.amount})`
        );
        customersWithIssues++;
      }

      const expectedBalance = receivable.amount - receivable.paid_amount;
      if (Math.abs(receivable.balance - expectedBalance) > 1) {
        // Allow 1 centime rounding
        errors.push(
          `Customer "${customer.name}": Receivable ${receivable.id} balance inconsistent. ` +
            `Expected: ${expectedBalance}, Actual: ${receivable.balance}`
        );
        customersWithIssues++;
      }
    }
  }

  return {
    errors,
    warnings,
    totalCustomers: customers.length,
    customersWithIssues,
  };
}

async function validateSupplierBalances(shopId: string): Promise<{
  errors: string[];
  warnings: string[];
  totalSuppliers: number;
  suppliersWithIssues: number;
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let suppliersWithIssues = 0;

  const suppliers = await prisma.supplier.findMany({
    where: { shop_id: shopId, deleted: false },
    include: {
      debts: {
        where: { deleted: false },
      },
    },
  });

  console.log(`\n📊 Validating ${suppliers.length} suppliers...`);

  for (const supplier of suppliers) {
    const calculatedBalance = supplier.debts.reduce((sum, d) => sum + d.balance, 0);

    // Get stats via aggregate
    const stats = await prisma.supplierDebt.aggregate({
      where: {
        supplier_id: supplier.id,
        deleted: false,
      },
      _sum: {
        amount: true,
        balance: true,
        paid_amount: true,
      },
    });

    const aggregateBalance = stats._sum.balance || 0;

    if (calculatedBalance !== aggregateBalance) {
      errors.push(
        `Supplier "${supplier.name}" (${supplier.id}): Balance mismatch! ` +
          `Calculated: ${calculatedBalance}, Aggregate: ${aggregateBalance}`
      );
      suppliersWithIssues++;
    }

    // Check for negative balances (supplier owes us a refund)
    if (aggregateBalance < 0) {
      warnings.push(
        `Supplier "${supplier.name}": Negative balance ${aggregateBalance / 100} FCFA - supplier owes us money`
      );
    }

    // Verify individual debts
    for (const debt of supplier.debts) {
      if (debt.balance < 0 && debt.status !== 'PAID') {
        warnings.push(
          `Supplier "${supplier.name}": Debt ${debt.id} has negative balance but status is ${debt.status}`
        );
      }

      if (debt.paid_amount > debt.amount && debt.amount > 0) {
        // Only check for positive debts
        errors.push(
          `Supplier "${supplier.name}": Debt ${debt.id} has paid_amount (${debt.paid_amount}) > amount (${debt.amount})`
        );
        suppliersWithIssues++;
      }

      const expectedBalance = debt.amount - debt.paid_amount;
      if (Math.abs(debt.balance - expectedBalance) > 1) {
        // Allow 1 centime rounding
        errors.push(
          `Supplier "${supplier.name}": Debt ${debt.id} balance inconsistent. ` +
            `Expected: ${expectedBalance}, Actual: ${debt.balance}`
        );
        suppliersWithIssues++;
      }
    }
  }

  return {
    errors,
    warnings,
    totalSuppliers: suppliers.length,
    suppliersWithIssues,
  };
}

async function validateCashEntries(shopId: string): Promise<{
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for customer refunds
  const customerRefunds = await prisma.cashEntry.findMany({
    where: {
      shop_id: shopId,
      category: 'Remboursement client',
      deleted: false,
    },
  });

  console.log(`\n💰 Found ${customerRefunds.length} customer refund entries`);

  for (const refund of customerRefunds) {
    if (refund.type !== 'OUT') {
      errors.push(
        `Cash entry ${refund.id}: Customer refund should be type OUT, got ${refund.type}`
      );
    }

    if (!refund.customer_id) {
      warnings.push(`Cash entry ${refund.id}: Customer refund missing customer_id`);
    }
  }

  // Check for supplier refunds
  const supplierRefunds = await prisma.cashEntry.findMany({
    where: {
      shop_id: shopId,
      category: 'Remboursement fournisseur',
      deleted: false,
    },
  });

  console.log(`💰 Found ${supplierRefunds.length} supplier refund entries`);

  for (const refund of supplierRefunds) {
    if (refund.type !== 'IN') {
      errors.push(`Cash entry ${refund.id}: Supplier refund should be type IN, got ${refund.type}`);
    }

    if (!refund.supplier_id) {
      warnings.push(`Cash entry ${refund.id}: Supplier refund missing supplier_id`);
    }
  }

  return { errors, warnings };
}

async function main() {
  console.log('🔍 Starting Balance Validation...\n');

  // Get all shops
  const shops = await prisma.shop.findMany({
    where: { deleted: false },
  });

  console.log(`Found ${shops.length} active shop(s)\n`);

  const allResults: ValidationResult[] = [];

  for (const shop of shops) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Validating Shop: ${shop.name} (${shop.id})`);
    console.log('='.repeat(60));

    const [customerResult, supplierResult, cashResult] = await Promise.all([
      validateCustomerBalances(shop.id),
      validateSupplierBalances(shop.id),
      validateCashEntries(shop.id),
    ]);

    const result: ValidationResult = {
      passed:
        customerResult.errors.length === 0 &&
        supplierResult.errors.length === 0 &&
        cashResult.errors.length === 0,
      errors: [...customerResult.errors, ...supplierResult.errors, ...cashResult.errors],
      warnings: [...customerResult.warnings, ...supplierResult.warnings, ...cashResult.warnings],
      summary: {
        totalCustomers: customerResult.totalCustomers,
        totalSuppliers: supplierResult.totalSuppliers,
        customersWithIssues: customerResult.customersWithIssues,
        suppliersWithIssues: supplierResult.suppliersWithIssues,
      },
    };

    allResults.push(result);

    // Print shop results
    console.log('\n📊 Summary:');
    console.log(
      `  Customers: ${result.summary.totalCustomers} (${result.summary.customersWithIssues} with issues)`
    );
    console.log(
      `  Suppliers: ${result.summary.totalSuppliers} (${result.summary.suppliersWithIssues} with issues)`
    );
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    if (result.passed && result.warnings.length === 0) {
      console.log('\n✅ All validations passed for this shop!');
    }
  }

  // Overall summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 OVERALL VALIDATION SUMMARY');
  console.log('='.repeat(60));

  const totalErrors = allResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = allResults.reduce((sum, r) => sum + r.warnings.length, 0);
  const shopsWithIssues = allResults.filter(r => !r.passed).length;

  console.log(`\nShops validated: ${shops.length}`);
  console.log(`Shops with errors: ${shopsWithIssues}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Total warnings: ${totalWarnings}`);

  if (totalErrors === 0) {
    console.log('\n✅ ALL BALANCE VALIDATIONS PASSED! 🎉');
  } else {
    console.log('\n❌ VALIDATION FAILED - Please review errors above');
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('❌ Validation script error:', error);
  process.exit(1);
});
