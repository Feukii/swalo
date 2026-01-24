/**
 * Data Fix Script
 * Fixes inconsistencies detected by validate-balances.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixData() {
  console.log('🔧 Fixing data inconsistencies...\n');

  // 1. Fix customer refund cash entries (should be OUT, not IN)
  const fixedRefunds = await prisma.cashEntry.updateMany({
    where: {
      category: 'Remboursement client',
      type: 'IN',
      deleted: false,
    },
    data: {
      type: 'OUT',
    },
  });
  console.log(`✅ Fixed ${fixedRefunds.count} customer refund entries (type IN -> OUT)`);

  // 2. Fix receivables where paid_amount > amount (positive amounts only)
  const badReceivables = await prisma.clientReceivable.findMany({
    where: {
      deleted: false,
      amount: { gt: 0 },
    },
    include: { customer: true },
  });

  let fixedReceivables = 0;
  for (const r of badReceivables) {
    if (r.paid_amount > r.amount) {
      await prisma.clientReceivable.update({
        where: { id: r.id },
        data: {
          paid_amount: r.amount,
          balance: 0,
          status: 'PAID',
        },
      });
      console.log(`  Fixed receivable ${r.id} for customer "${r.customer?.name}"`);
      fixedReceivables++;
    }
  }
  console.log(`✅ Fixed ${fixedReceivables} receivables with paid_amount > amount`);

  // 3. Fix negative amount receivables (refund tracking entries)
  const negativeReceivables = await prisma.clientReceivable.findMany({
    where: {
      amount: { lt: 0 },
      deleted: false,
    },
    include: { customer: true },
  });

  let fixedNegative = 0;
  for (const r of negativeReceivables) {
    if (r.paid_amount !== 0 || r.balance !== r.amount) {
      await prisma.clientReceivable.update({
        where: { id: r.id },
        data: {
          paid_amount: 0,
          balance: r.amount,
          status: 'PAID',
        },
      });
      console.log(`  Fixed negative receivable ${r.id} for customer "${r.customer?.name}"`);
      fixedNegative++;
    }
  }
  console.log(`✅ Fixed ${fixedNegative} negative amount receivables`);

  // 4. Fix supplier debts where paid_amount > amount
  const badDebts = await prisma.supplierDebt.findMany({
    where: {
      deleted: false,
      amount: { gt: 0 },
    },
    include: { supplier: true },
  });

  let fixedDebts = 0;
  for (const d of badDebts) {
    if (d.paid_amount > d.amount) {
      await prisma.supplierDebt.update({
        where: { id: d.id },
        data: {
          paid_amount: d.amount,
          balance: 0,
          status: 'PAID',
        },
      });
      console.log(`  Fixed debt ${d.id} for supplier "${d.supplier?.name}"`);
      fixedDebts++;
    }
  }
  console.log(`✅ Fixed ${fixedDebts} debts with paid_amount > amount`);

  console.log('\n✅ All data fixes complete!');
  await prisma.$disconnect();
}

fixData().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
