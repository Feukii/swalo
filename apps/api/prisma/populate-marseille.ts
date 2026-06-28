/**
 * Peuple la boutique Marseille (code 100002) avec des données réalistes :
 * produits (modèle carton gros/détail), clients, ventes (cash/carte/mobile/crédit),
 * créances et mouvements de caisse. Idempotent (skip si la boutique a déjà des produits).
 * Montants en ENTIERS (EUR, pas de décimales — cohérent avec le modèle FCFA).
 *
 * Usage : DATABASE_URL='<url>' npx ts-node prisma/populate-marseille.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const SHOP_CODE = '100002';
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000);

async function main() {
  const shop = await prisma.shop.findUnique({ where: { code: SHOP_CODE } });
  if (!shop) throw new Error(`Boutique ${SHOP_CODE} introuvable`);
  const cashierId = shop.owner_id;

  const already = await prisma.product.count({ where: { shop_id: shop.id, deleted: false } });
  if (already > 0) {
    console.log(`⏭️  Marseille a déjà ${already} produits — rien à faire.`);
    return;
  }

  // ── Produits (carton primaire) : cost = coût/pièce, package_price = gros carton, sell = détail/pièce
  const specs = [
    { sku: 'CABLE-USBC', name: 'Câble USB-C 1m', family: 'Câbles', brand: 'Generic', upp: 50, cost: 2, gros: 130, detail: 5, cartons: 3, seuil: 1 },
    { sku: 'CHAR-20W', name: 'Chargeur secteur 20W', family: 'Chargeurs', brand: 'PowerFast', upp: 20, cost: 8, gros: 200, detail: 18, cartons: 2, seuil: 1 },
    { sku: 'COQUE-SIL', name: 'Coque silicone', family: 'Coques', brand: 'FlexCase', upp: 40, cost: 2, gros: 120, detail: 8, cartons: 5, seuil: 1 },
    { sku: 'ECOU-BT', name: 'Écouteurs Bluetooth', family: 'Audio', brand: 'SoundOne', upp: 10, cost: 18, gros: 250, detail: 39, cartons: 2, seuil: 1 },
    { sku: 'VERRE-TR', name: 'Verre trempé', family: 'Protections', brand: 'GlassPro', upp: 100, cost: 1, gros: 150, detail: 4, cartons: 4, seuil: 1 },
    { sku: 'PB-10000', name: 'Powerbank 10000mAh', family: 'Batteries', brand: 'PowerFast', upp: 12, cost: 12, gros: 200, detail: 25, cartons: 1, seuil: 1 },
  ];
  const P: Record<string, { id: string; name: string; sku: string; detail: number; cost: number; batchId: string }> = {};
  for (const s of specs) {
    const pieces = s.cartons * s.upp;
    const prod = await prisma.product.create({
      data: {
        shop_id: shop.id, sku: s.sku, name: s.name, family: s.family, brand: s.brand,
        category: s.family, unit: 'pièce',
        units_per_package: s.upp, package_price: s.gros,
        cost_price: s.cost, sell_price: s.detail, alert_threshold: s.seuil,
        is_active: true, device_id: 'seed-marseille', created_at: daysAgo(25),
      },
    });
    const batch = await prisma.stockBatch.create({
      data: {
        shop_id: shop.id, product_id: prod.id, quantity: pieces, remaining_quantity: pieces,
        cost_price: s.cost, sell_price: s.detail, created_at: daysAgo(25),
      },
    });
    // Mouvement d'entrée (le stock backend = somme des inventory_movements)
    await prisma.inventoryMovement.create({
      data: {
        shop_id: shop.id, product_id: prod.id, type: 'PURCHASE', qty: pieces,
        reason: 'Stock initial', ref_type: 'PURCHASE', unit_cost: s.cost,
        device_id: 'seed-marseille', client_op_id: randomUUID(), created_at: daysAgo(25),
      },
    });
    P[s.sku] = { id: prod.id, name: prod.name, sku: prod.sku, detail: s.detail, cost: s.cost, batchId: batch.id };
  }
  console.log(`✅ ${specs.length} produits + lots + entrées de stock créés`);

  // ── Clients
  const custSpecs = [
    { name: 'TechStore Marseille', phone: '+33611111111', credit_limit: 5000 },
    { name: 'Jean Dupont', phone: '+33622222222', credit_limit: 1000 },
    { name: 'Marie Martin', phone: '+33633333333', credit_limit: 0 },
    { name: 'Boutique Phone Plus', phone: '+33644444444', credit_limit: 3000 },
    { name: 'Ahmed Benali', phone: '+33655555555', credit_limit: 500 },
  ];
  const C: { id: string }[] = [];
  for (const c of custSpecs) {
    const created = await prisma.customer.create({
      data: { shop_id: shop.id, name: c.name, phone: c.phone, credit_limit: c.credit_limit, is_active: true, created_at: daysAgo(24) },
    });
    C.push({ id: created.id });
  }
  console.log(`✅ ${C.length} clients créés`);

  // ── Ventes (détail). credit => crée une créance.
  type Item = { sku: string; qty: number };
  type SaleSpec = { d: number; pm: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT'; cust?: number; items: Item[]; partialPaid?: number };
  const sales: SaleSpec[] = [
    { d: 18, pm: 'CASH', items: [{ sku: 'CHAR-20W', qty: 2 }, { sku: 'CABLE-USBC', qty: 1 }] },
    { d: 15, pm: 'CASH', items: [{ sku: 'VERRE-TR', qty: 3 }, { sku: 'COQUE-SIL', qty: 1 }] },
    { d: 12, pm: 'CREDIT', cust: 0, items: [{ sku: 'CABLE-USBC', qty: 5 }, { sku: 'COQUE-SIL', qty: 5 }] },
    { d: 9, pm: 'CARD', cust: 2, items: [{ sku: 'ECOU-BT', qty: 1 }] },
    { d: 6, pm: 'CASH', items: [{ sku: 'PB-10000', qty: 2 }] },
    { d: 4, pm: 'MOBILE', cust: 3, items: [{ sku: 'COQUE-SIL', qty: 4 }, { sku: 'VERRE-TR', qty: 2 }] },
    { d: 2, pm: 'CREDIT', cust: 1, items: [{ sku: 'ECOU-BT', qty: 1 }, { sku: 'CHAR-20W', qty: 2 }], partialPaid: 30 },
    { d: 0, pm: 'CASH', items: [{ sku: 'PB-10000', qty: 1 }, { sku: 'VERRE-TR', qty: 3 }] },
  ];

  const soldByProduct: Record<string, number> = {};
  let nbReceivables = 0;
  for (const s of sales) {
    let subtotal = 0;
    const rows = s.items.map(it => {
      const p = P[it.sku];
      const line = p.detail * it.qty;
      subtotal += line;
      soldByProduct[it.sku] = (soldByProduct[it.sku] || 0) + it.qty;
      return { product_id: p.id, product_name: p.name, sku: p.sku, qty: it.qty, unit_price: p.detail, tax_rate: 0, subtotal: line, tax_total: 0, total: line, batch_id: p.batchId };
    });
    const grand = subtotal;
    const paid = s.pm === 'CREDIT' ? (s.partialPaid ?? 0) : grand;
    const createdAt = daysAgo(s.d);
    const sale = await prisma.sale.create({
      data: {
        shop_id: shop.id, cashier_id: cashierId, customer_id: s.cust !== undefined ? C[s.cust].id : null,
        status: 'COMPLETED', payment_method: s.pm, subtotal, discount: 0, tax_total: 0,
        net_total: grand, grand_total: grand, paid_total: paid, change: 0,
        created_at: createdAt, device_id: 'seed-marseille', client_op_id: randomUUID(),
      },
    });
    for (const r of rows) await prisma.saleItem.create({ data: { sale_id: sale.id, ...r } });
    // Mouvements de sortie (stock backend)
    for (const it of s.items) {
      await prisma.inventoryMovement.create({
        data: {
          shop_id: shop.id, product_id: P[it.sku].id, type: 'SALE', qty: -it.qty,
          reason: 'Vente', ref_type: 'SALE', ref_id: sale.id, unit_cost: P[it.sku].cost,
          device_id: 'seed-marseille', client_op_id: randomUUID(), created_at: createdAt,
        },
      });
    }

    if (s.pm === 'CREDIT' && s.cust !== undefined) {
      const balance = grand - paid;
      await prisma.clientReceivable.create({
        data: {
          shop_id: shop.id, customer_id: C[s.cust].id, amount: grand, paid_amount: paid, balance,
          status: paid === 0 ? 'PENDING' : 'PARTIAL', description: `Vente à crédit du ${createdAt.toLocaleDateString('fr-FR')}`,
          due_date: daysAgo(s.d - 30), created_at: createdAt,
        },
      });
      nbReceivables++;
    } else {
      // Encaissement en caisse pour les ventes réglées
      await prisma.cashEntry.create({
        data: { shop_id: shop.id, type: 'IN', amount: grand, category: 'ventes', note: `Vente ${s.pm}`, cashier_id: cashierId, device_id: 'seed-marseille', created_at: createdAt },
      });
    }
  }
  console.log(`✅ ${sales.length} ventes créées (${nbReceivables} créances)`);

  // ── Décrémenter le stock vendu
  for (const [sku, qty] of Object.entries(soldByProduct)) {
    await prisma.stockBatch.update({ where: { id: P[sku].batchId }, data: { remaining_quantity: { decrement: qty } } });
  }

  // ── Caisse : ouverture + quelques charges
  await prisma.cashEntry.create({ data: { shop_id: shop.id, type: 'OPENING', amount: 500, category: null, note: 'Fonds de caisse', cashier_id: cashierId, device_id: 'seed-marseille', created_at: daysAgo(20) } });
  await prisma.cashEntry.create({ data: { shop_id: shop.id, type: 'OUT', amount: 300, category: 'loyers', note: 'Loyer mensuel', cashier_id: cashierId, device_id: 'seed-marseille', created_at: daysAgo(10) } });
  await prisma.cashEntry.create({ data: { shop_id: shop.id, type: 'OUT', amount: 40, category: 'transport', note: 'Transport marchandises', cashier_id: cashierId, device_id: 'seed-marseille', created_at: daysAgo(5) } });
  console.log('✅ Caisse : ouverture + 2 charges');

  console.log('\n🎉 Marseille peuplée avec succès.');
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
