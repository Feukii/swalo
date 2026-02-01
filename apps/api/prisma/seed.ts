import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Protection: empêcher l'exécution du seed en production
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERREUR: Le seed ne peut pas être exécuté en production!');
    console.error('   Cette opération créerait des données de test dans la base de production.');
    console.error('   Si vous avez vraiment besoin de seeder en production, utilisez un script dédié.');
    process.exit(1);
  }

  console.log('🌱 Début du seed...');

  // Nettoyer les données existantes (optionnel, commenté pour sécurité)
  // await prisma.pinInvite.deleteMany();
  // await prisma.userRole.deleteMany();
  // await prisma.user.deleteMany();
  // await prisma.shop.deleteMany();

  // 1. Créer un utilisateur propriétaire
  const hashedPassword = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@swalo.com' },
    update: {},
    create: {
      email: 'owner@swalo.com',
      phone: '+221771234567',
      password_hash: hashedPassword,
      display_name: 'Propriétaire Test',
      is_active: true,
    },
  });

  console.log('✅ Utilisateur propriétaire créé:', owner.email);

  // 2. Créer les boutiques
  const shop1 = await prisma.shop.upsert({
    where: { code: '011225' },
    update: {},
    create: {
      code: '011225',
      name: 'SWALO Boutique 01',
      address: 'Dakar, Sénégal',
      phone: '+221771234567',
      email: 'shop01@swalo.com',
      currency: 'XOF',
      owner_id: owner.id,
    },
  });

  console.log('✅ Boutique créée:', shop1.name);

  const shop2 = await prisma.shop.upsert({
    where: { code: '251225' },
    update: {},
    create: {
      code: '251225',
      name: 'SWALO Boutique 02',
      address: 'Dakar, Sénégal',
      phone: '+221771234568',
      email: 'shop02@swalo.com',
      currency: 'XOF',
      owner_id: owner.id,
    },
  });

  console.log('✅ Boutique créée:', shop2.name);

  const shop = shop1; // Use shop1 for remaining seed data

  // 3. Créer les rôles propriétaire pour les deux boutiques
  await prisma.userRole.upsert({
    where: {
      user_id_shop_id: {
        user_id: owner.id,
        shop_id: shop1.id,
      },
    },
    update: {},
    create: {
      user_id: owner.id,
      shop_id: shop1.id,
      role: 'OWNER',
    },
  });

  await prisma.userRole.upsert({
    where: {
      user_id_shop_id: {
        user_id: owner.id,
        shop_id: shop2.id,
      },
    },
    update: {},
    create: {
      user_id: owner.id,
      shop_id: shop2.id,
      role: 'OWNER',
    },
  });

  console.log('✅ Rôles propriétaire créés pour les deux boutiques');

  // 3.5 Créer des utilisateurs test avec PIN codes
  const employeeUser = await prisma.user.upsert({
    where: { phone: '+221771111111' },
    update: {},
    create: {
      phone: '+221771111111',
      pin_code: '1234',
      display_name: 'Employé Test',
      is_active: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      user_id_shop_id: {
        user_id: employeeUser.id,
        shop_id: shop.id,
      },
    },
    update: {},
    create: {
      user_id: employeeUser.id,
      shop_id: shop.id,
      role: 'EMPLOYEE',
    },
  });

  console.log('✅ Employé avec PIN 1234 créé');

  const adminUser = await prisma.user.upsert({
    where: { phone: '+221772222222' },
    update: {},
    create: {
      phone: '+221772222222',
      pin_code: '9999',
      display_name: 'Admin Test',
      is_active: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      user_id_shop_id: {
        user_id: adminUser.id,
        shop_id: shop.id,
      },
    },
    update: {},
    create: {
      user_id: adminUser.id,
      shop_id: shop.id,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin avec PIN 9999 créé');

  // Ajouter PIN au propriétaire existant
  await prisma.user.update({
    where: { id: owner.id },
    data: { pin_code: '0000' },
  });

  console.log('✅ PIN Propriétaire (0000) ajouté');

  // 4. Créer un code PIN de test (1234)
  const pinInvite = await prisma.pinInvite.upsert({
    where: { pin_code: '1234' },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an
    },
    create: {
      pin_code: '1234',
      shop_id: shop.id,
      role: 'EMPLOYEE',
      display_name: 'Employé Test',
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an
      is_active: true,
    },
  });

  console.log('✅ Code PIN créé: 1234 (Employé)');

  // 5. Créer un autre PIN pour un admin (code: 9999)
  const adminPinInvite = await prisma.pinInvite.upsert({
    where: { pin_code: '9999' },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      pin_code: '9999',
      shop_id: shop.id,
      role: 'ADMIN',
      display_name: 'Admin Test',
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  });

  console.log('✅ Code PIN Admin créé: 9999 (Admin)');

  await prisma.pinInvite.upsert({
    where: { pin_code: '0000' },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      pin_code: '0000',
      shop_id: shop.id,
      role: 'OWNER',
      display_name: 'Propri?taire',
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  });
  console.log('? Code PIN Propri?taire cr??: 0000');

  await prisma.pinInvite.upsert({
    where: { pin_code: '2222' },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      pin_code: '2222',
      shop_id: shop.id,
      role: 'MANAGER',
      display_name: 'Manager Test',
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  });
  console.log('? Code PIN Manager cr??: 2222');

  // 5.5 Initialiser les conditionnements par défaut pour les deux boutiques
  const defaultPackagingTypes = [
    { name: 'Pièce', symbol: 'pce', is_default: true },
    { name: 'Carton', symbol: 'ctn', is_default: false },
    { name: 'Douzaine', symbol: 'dz', is_default: false },
    { name: 'Paquet', symbol: 'pqt', is_default: false },
    { name: 'Boîte', symbol: 'bte', is_default: false },
    { name: 'Unité', symbol: 'u', is_default: false },
    { name: 'Kilogramme', symbol: 'kg', is_default: false },
    { name: 'Gramme', symbol: 'g', is_default: false },
    { name: 'Litre', symbol: 'l', is_default: false },
  ];

  for (const shopItem of [shop1, shop2]) {
    for (const pt of defaultPackagingTypes) {
      const existing = await prisma.packagingType.findFirst({
        where: {
          shop_id: shopItem.id,
          name: { equals: pt.name, mode: 'insensitive' },
        },
      });
      if (!existing) {
        await prisma.packagingType.create({
          data: { shop_id: shopItem.id, ...pt },
        });
      }
    }
  }

  console.log('✅ Conditionnements par défaut initialisés pour les deux boutiques');

  // 6. Créer quelques produits de test
  const products = [
    {
      shop_id: shop.id,
      sku: 'CASE001',
      name: 'Coque iPhone 13',
      description: 'Coque de protection transparente',
      category: 'Coques',
      unit: 'pièce',
      cost_price: 500000, // 5000 FCFA en centimes
      sell_price: 1000000, // 10000 FCFA
      alert_threshold: 10,
    },
    {
      shop_id: shop.id,
      sku: 'CHAR001',
      name: 'Chargeur USB-C',
      description: 'Chargeur rapide 20W',
      category: 'Chargeurs',
      unit: 'pièce',
      cost_price: 200000, // 2000 FCFA
      sell_price: 350000, // 3500 FCFA
      alert_threshold: 15,
    },
    {
      shop_id: shop.id,
      sku: 'ECOU001',
      name: 'Écouteurs Bluetooth',
      description: 'Écouteurs sans fil',
      category: 'Audio',
      unit: 'pièce',
      cost_price: 1500000, // 15000 FCFA
      sell_price: 2500000, // 25000 FCFA
      alert_threshold: 5,
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.upsert({
      where: {
        shop_id_sku: {
          shop_id: shop.id,
          sku: productData.sku,
        },
      },
      update: {},
      create: productData,
    });
    console.log(`✅ Produit créé: ${product.name}`);
  }

  console.log('\n🎉 Seed terminé avec succès!');
  console.log('\n📌 Données de test:');
  console.log('   - Email/Password: owner@swalo.com / password123');
  console.log('   - Code Boutique 1: 011225');
  console.log('   - Code Boutique 2: 251225');
  console.log('   - Code PIN Employé: 1234');
  console.log('   - Code PIN Admin: 9999');
  console.log('   - Code PIN Propriétaire: 0000');
  console.log('   - Code PIN Manager: 2222');
}

main()
  .catch(e => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
