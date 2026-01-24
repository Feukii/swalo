import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Création de la boutique de test 010126...');

  // 1. Créer ou récupérer l'utilisateur propriétaire
  const hashedPassword = await bcrypt.hash('test123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'test010126@swalo.com' },
    update: {},
    create: {
      email: 'test010126@swalo.com',
      phone: '+221770101260',
      password_hash: hashedPassword,
      pin_code: '0126',
      display_name: 'Test Owner 010126',
      is_active: true,
    },
  });

  console.log('✅ Utilisateur propriétaire créé:', owner.email);

  // 2. Créer la boutique 010126
  const shop = await prisma.shop.upsert({
    where: { code: '010126' },
    update: {},
    create: {
      code: '010126',
      name: 'Boutique Test 010126',
      address: 'Dakar, Sénégal - Zone Test',
      phone: '+221770101260',
      email: 'test010126@swalo.com',
      currency: 'XOF',
      owner_id: owner.id,
    },
  });

  console.log('✅ Boutique créée:', shop.name, '- Code:', shop.code);

  // 3. Créer le rôle propriétaire
  await prisma.userRole.upsert({
    where: {
      user_id_shop_id: {
        user_id: owner.id,
        shop_id: shop.id,
      },
    },
    update: {},
    create: {
      user_id: owner.id,
      shop_id: shop.id,
      role: 'OWNER',
    },
  });

  console.log('✅ Rôle propriétaire créé');

  // 4. Créer le PIN invite pour le propriétaire
  await prisma.pinInvite.upsert({
    where: { pin_code: '0126' },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      pin_code: '0126',
      shop_id: shop.id,
      role: 'OWNER',
      display_name: 'Test Owner 010126',
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  });

  console.log('✅ PIN 0126 créé pour la boutique 010126');

  // 5. Créer des clients de test
  const customers = [
    { name: 'Diallo', first_name: 'Mamadou', phone: '+221771000001' },
    { name: 'Sow', first_name: 'Fatou', phone: '+221771000002' },
    { name: 'Ndiaye', first_name: 'Ibrahima', phone: '+221771000003' },
    { name: 'Fall', first_name: 'Aminata', phone: '+221771000004' },
    { name: 'Ba', first_name: 'Ousmane', phone: '+221771000005' },
  ];

  const createdCustomers = [];
  for (const customerData of customers) {
    const customer = await prisma.customer.create({
      data: {
        shop_id: shop.id,
        ...customerData,
        is_active: true,
      },
    });
    createdCustomers.push(customer);
    console.log(`✅ Client créé: ${customer.first_name} ${customer.name}`);
  }

  // 6. Créer des fournisseurs de test
  const suppliers = [
    { name: 'Tech Import SARL', phone: '+221771100001' },
    { name: 'Africa Electronics', phone: '+221771100002' },
    { name: 'Mobile Accessoires', phone: '+221771100003' },
  ];

  const createdSuppliers = [];
  for (const supplierData of suppliers) {
    const supplier = await prisma.supplier.create({
      data: {
        shop_id: shop.id,
        ...supplierData,
        is_active: true,
      },
    });
    createdSuppliers.push(supplier);
    console.log(`✅ Fournisseur créé: ${supplier.name}`);
  }

  // 7. Créer des entrées de caisse de test (pour tester les rapports)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Entrées de caisse variées
  const cashEntries = [
    // Entrées (IN)
    { type: 'IN', category: 'ventes', amount: 25000, note: 'Vente coque iPhone' },
    { type: 'IN', category: 'ventes', amount: 15000, note: 'Vente chargeur' },
    { type: 'IN', category: 'ventes', amount: 50000, note: 'Vente écouteurs Bluetooth' },
    {
      type: 'IN',
      category: 'remboursement_client',
      amount: 10000,
      note: 'Remboursement créance client Diallo',
    },
    { type: 'IN', category: 'divers', amount: 5000, note: 'Entrée diverse' },
    // Sorties (OUT)
    { type: 'OUT', category: 'achats_marchandises', amount: 30000, note: 'Achat stock coques' },
    { type: 'OUT', category: 'reglement_fournisseur', amount: 20000, note: 'Paiement Tech Import' },
    { type: 'OUT', category: 'depenses_courantes', amount: 5000, note: 'Électricité' },
    { type: 'OUT', category: 'loyers', amount: 75000, note: 'Loyer mensuel' },
  ];

  for (let i = 0; i < cashEntries.length; i++) {
    const entry = cashEntries[i];
    const entryDate = new Date(today);
    entryDate.setHours(8 + i, i * 10, 0);

    await prisma.cashEntry.create({
      data: {
        shop_id: shop.id,
        type: entry.type as 'IN' | 'OUT',
        category: entry.category,
        amount: entry.amount, // FCFA - pas de centimes
        note: entry.note,
        cashier_id: owner.id,
        device_id: 'test-device-010126',
        client_op_id: `test_010126_${Date.now()}_${i}`,
        created_at: entryDate,
      },
    });
    console.log(`✅ Entrée caisse: ${entry.type} ${entry.amount} FCFA - ${entry.note}`);
  }

  // 8. Créer des créances clients (receivables)
  const receivables = [
    { customer_index: 0, amount: 45000, description: 'Achat téléphone à crédit' },
    { customer_index: 1, amount: 25000, description: 'Accessoires à crédit' },
    { customer_index: 2, amount: 15000, description: 'Réparation à payer' },
  ];

  for (const rec of receivables) {
    const customer = createdCustomers[rec.customer_index];
    const receivable = await prisma.clientReceivable.create({
      data: {
        shop_id: shop.id,
        customer_id: customer.id,
        amount: rec.amount,
        paid_amount: 0,
        balance: rec.amount,
        description: rec.description,
        status: 'PENDING',
      },
    });
    console.log(`✅ Créance: ${customer.first_name} ${customer.name} - ${rec.amount} FCFA`);
  }

  // 9. Créer des dettes fournisseurs
  const debts = [
    { supplier_index: 0, amount: 150000, description: 'Lot de téléphones' },
    { supplier_index: 1, amount: 80000, description: 'Stock accessoires' },
  ];

  for (const debt of debts) {
    const supplier = createdSuppliers[debt.supplier_index];
    await prisma.supplierDebt.create({
      data: {
        shop_id: shop.id,
        supplier_id: supplier.id,
        amount: debt.amount,
        paid_amount: 0,
        balance: debt.amount,
        description: debt.description,
        status: 'PENDING',
      },
    });
    console.log(`✅ Dette: ${supplier.name} - ${debt.amount} FCFA`);
  }

  // 10. Créer des produits de test avec les nouveaux champs
  const products = [
    // GLASSES
    {
      sku: 'GLA01TECSpk4',
      name: 'Glass 3D Tecno Spark 4',
      family: 'GLASSES',
      article_type: 'Glass 3D',
      brand: 'Tecno',
      reference: 'Spark 4',
      cost_price: 800,
      sell_price: 1200,
      unit: 'unit',
    },
    {
      sku: 'GLA02SAMA10E',
      name: 'Glass 3D Samsung A10E',
      family: 'GLASSES',
      article_type: 'Glass 3D',
      brand: 'Samsung',
      reference: 'A10E',
      cost_price: 900,
      sell_price: 1500,
      unit: 'unit',
    },
    {
      sku: 'GLA03INFA12',
      name: 'Glass 3D Infinix Hot 12',
      family: 'GLASSES',
      article_type: 'Glass 3D',
      brand: 'Infinix',
      reference: 'Hot 12',
      cost_price: 750,
      sell_price: 1100,
      unit: 'unit',
    },
    // CHARGEURS
    {
      sku: 'CHA01ORA1ATC',
      name: 'Chargeur 1A TC Oraimo OCD-01',
      family: 'CHARGEURS',
      article_type: 'Chargeur 1A TC',
      brand: 'Oraimo',
      reference: 'OCD-01',
      cost_price: 2000,
      sell_price: 3000,
      unit: 'unit',
    },
    {
      sku: 'CHA02ORA2ATC',
      name: 'Chargeur 2A TC Oraimo OCD-02',
      family: 'CHARGEURS',
      article_type: 'Chargeur 2A TC',
      brand: 'Oraimo',
      reference: 'OCD-02',
      cost_price: 2500,
      sell_price: 3500,
      unit: 'unit',
    },
    {
      sku: 'CHA03SAM2ATC',
      name: 'Chargeur 2A TC Samsung Original',
      family: 'CHARGEURS',
      article_type: 'Chargeur 2A TC',
      brand: 'Samsung',
      reference: 'Original',
      cost_price: 3000,
      sell_price: 4500,
      unit: 'unit',
    },
    // KIT BLUETOOTH
    {
      sku: 'KIT01ORABT',
      name: 'Casque Bluetooth Oraimo FreePods 3',
      family: 'KIT BLUETOOTH',
      article_type: 'Casque',
      brand: 'Oraimo',
      reference: 'FreePods 3',
      cost_price: 5000,
      sell_price: 7500,
      unit: 'unit',
    },
    {
      sku: 'KIT02GENBT',
      name: 'Casque Bluetooth Generic BT-500',
      family: 'KIT BLUETOOTH',
      article_type: 'Casque',
      brand: 'Generic',
      reference: 'BT-500',
      cost_price: 3000,
      sell_price: 5000,
      unit: 'unit',
    },
    // CARTES MEMOIRES
    {
      sku: 'MEM01SAN16GB',
      name: 'Carte Mémoire SanDisk 16GB',
      family: 'CARTES MEMOIRES',
      article_type: 'Carte SD',
      brand: 'SanDisk',
      reference: '16GB',
      cost_price: 2500,
      sell_price: 4000,
      unit: 'unit',
    },
    {
      sku: 'MEM02SAN32GB',
      name: 'Carte Mémoire SanDisk 32GB',
      family: 'CARTES MEMOIRES',
      article_type: 'Carte SD',
      brand: 'SanDisk',
      reference: '32GB',
      cost_price: 4000,
      sell_price: 6000,
      unit: 'unit',
    },
    {
      sku: 'MEM03KIN64GB',
      name: 'Carte Mémoire Kingston 64GB',
      family: 'CARTES MEMOIRES',
      article_type: 'Carte SD',
      brand: 'Kingston',
      reference: '64GB',
      cost_price: 6000,
      sell_price: 9000,
      unit: 'unit',
    },
  ];

  const createdProducts = [];
  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        shop_id: shop.id,
        ...productData,
        is_active: true,
        alert_threshold: 5,
        tax_rate: 0,
        device_id: 'test-device-010126',
        client_op_id: `prod_${productData.sku}_${Date.now()}`,
      },
    });
    createdProducts.push(product);
    console.log(`✅ Produit créé: ${product.sku} - ${product.name}`);
  }

  // 11. Créer des mouvements de stock pour les produits
  for (let i = 0; i < createdProducts.length; i++) {
    const product = createdProducts[i];
    // Entrée initiale de stock
    const initialStock = Math.floor(Math.random() * 30) + 10; // Entre 10 et 40 unités

    await prisma.inventoryMovement.create({
      data: {
        shop_id: shop.id,
        product_id: product.id,
        type: 'PURCHASE',
        qty: initialStock,
        reason: 'Stock initial',
        unit_cost: product.cost_price,
        device_id: 'test-device-010126',
        client_op_id: `inv_${product.sku}_init_${Date.now()}_${i}`,
      },
    });
    console.log(`✅ Stock initial: ${product.sku} - ${initialStock} unités`);

    // Quelques ventes aléatoires pour certains produits
    if (i % 2 === 0) {
      const sold = Math.floor(Math.random() * 5) + 1; // Entre 1 et 5 unités vendues
      await prisma.inventoryMovement.create({
        data: {
          shop_id: shop.id,
          product_id: product.id,
          type: 'SALE',
          qty: -sold,
          reason: 'Vente',
          unit_cost: product.cost_price,
          device_id: 'test-device-010126',
          client_op_id: `inv_${product.sku}_sale_${Date.now()}_${i}`,
        },
      });
      console.log(`✅ Vente: ${product.sku} - ${sold} unités`);
    }
  }

  // 12. Ajouter quelques paiements de créances (pour tester les rapports avec période)
  const customer0 = createdCustomers[0];
  const receivable0 = await prisma.clientReceivable.findFirst({
    where: { customer_id: customer0.id, shop_id: shop.id },
  });

  if (receivable0) {
    await prisma.clientReceivablePayment.create({
      data: {
        receivable_id: receivable0.id,
        amount: 15000,
        payment_date: new Date(),
        notes: 'Premier paiement partiel',
      },
    });

    await prisma.clientReceivable.update({
      where: { id: receivable0.id },
      data: {
        paid_amount: 15000,
        balance: 30000,
        status: 'PARTIAL',
      },
    });

    console.log(`✅ Paiement créance: ${customer0.first_name} ${customer0.name} - 15000 FCFA`);
  }

  // 13. Ajouter un paiement de dette fournisseur
  const supplier0 = createdSuppliers[0];
  const debt0 = await prisma.supplierDebt.findFirst({
    where: { supplier_id: supplier0.id, shop_id: shop.id },
  });

  if (debt0) {
    await prisma.supplierDebtPayment.create({
      data: {
        debt_id: debt0.id,
        amount: 50000,
        payment_date: new Date(),
        notes: 'Premier paiement partiel',
      },
    });

    await prisma.supplierDebt.update({
      where: { id: debt0.id },
      data: {
        paid_amount: 50000,
        balance: 100000,
        status: 'PARTIAL',
      },
    });

    console.log(`✅ Paiement dette: ${supplier0.name} - 50000 FCFA`);
  }

  console.log('\n🎉 Boutique de test 010126 créée avec succès!');
  console.log('\n📌 Données de connexion:');
  console.log('   - Code Boutique: 010126');
  console.log('   - Code PIN: 0126');
  console.log('   - Email: test010126@swalo.com');
  console.log('   - Mot de passe: test123');
  console.log('\n📊 Données de test:');
  console.log('   - 5 clients créés');
  console.log('   - 3 fournisseurs créés');
  console.log(`   - ${createdProducts.length} produits créés`);
  console.log('   - 9 entrées de caisse');
  console.log('   - 3 créances clients (1 partiellement payée)');
  console.log('   - 2 dettes fournisseurs (1 partiellement payée)');
  console.log('\n💰 Résumé financier:');
  console.log('   - Total entrées: 105000 FCFA');
  console.log('   - Total sorties: 130000 FCFA');
  console.log('   - Solde net: -25000 FCFA');
  console.log('   - Créances totales: 70000 FCFA (15000 déjà payé)');
  console.log('   - Dettes totales: 180000 FCFA (50000 déjà payé)');
}

main()
  .catch(e => {
    console.error('❌ Erreur lors de la création:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
