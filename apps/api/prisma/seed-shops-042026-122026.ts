import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Liste des produits a importer dans les deux boutiques
const PRODUCTS = [
  // GLASSES (6 produits)
  {
    sku: 'GLA01TECSpk4',
    name: 'Glass 3D Tecno Spark 4',
    family: 'GLASSES',
    article_type: 'Glass 3D',
    brand: 'Tecno',
    reference: 'Spark 4',
  },
  {
    sku: 'GLA02SAMA10E',
    name: 'Glass Fume Samsung A10E',
    family: 'GLASSES',
    article_type: 'Glass Fume',
    brand: 'Samsung',
    reference: 'A10E',
  },
  {
    sku: 'GLA03INFH10',
    name: 'Glass Incuve Infinix Hot 10',
    family: 'GLASSES',
    article_type: 'Glass Incuve',
    brand: 'Infinix',
    reference: 'Hot 10',
  },
  {
    sku: 'GLA01IP11P',
    name: 'Glass 3D Iphone 11 Pro',
    family: 'GLASSES',
    article_type: 'Glass 3D',
    brand: 'Iphone',
    reference: '11 Pro',
  },
  {
    sku: 'GLA01PIXPix6',
    name: 'Glass 3D Pixel Pixel 6',
    family: 'GLASSES',
    article_type: 'Glass 3D',
    brand: 'Pixel',
    reference: 'Pixel 6',
  },
  {
    sku: 'GLA01HWP30',
    name: 'Glass 3D Huawei P30',
    family: 'GLASSES',
    article_type: 'Glass 3D',
    brand: 'Huawei',
    reference: 'P30',
  },

  // CHARGEURS (6 produits)
  {
    sku: 'CHAOR1ATC2',
    name: 'Chargeur 1A TC Oraimo 2eme choix',
    family: 'CHARGEURS',
    article_type: 'Chargeur 1A TC',
    brand: 'Oraimo',
    reference: '2eme choix',
  },
  {
    sku: 'CHAOR1AV82',
    name: 'Chargeur 1A V8 Oraimo 2eme choix',
    family: 'CHARGEURS',
    article_type: 'Chargeur 1A V8',
    brand: 'Oraimo',
    reference: '2eme choix',
  },
  {
    sku: 'CHAOR2AV82',
    name: 'Chargeur 2A V8 Oraimo 2eme choix',
    family: 'CHARGEURS',
    article_type: 'Chargeur 2A V8',
    brand: 'Oraimo',
    reference: '2eme choix',
  },
  {
    sku: 'CHAOR2ATC2',
    name: 'Chargeur 2A TC Oraimo 2eme choix',
    family: 'CHARGEURS',
    article_type: 'Chargeur 2A TC',
    brand: 'Oraimo',
    reference: '2eme choix',
  },
  {
    sku: 'CHAITST',
    name: 'Chargeur Simple Itel Standard',
    family: 'CHARGEURS',
    article_type: 'Chargeur Simple',
    brand: 'Itel',
    reference: 'Standard',
  },
  {
    sku: 'CHAINF67W',
    name: 'Chargeur 67W Infinix Fast',
    family: 'CHARGEURS',
    article_type: 'Chargeur 67W',
    brand: 'Infinix',
    reference: 'Fast',
  },

  // KIT BLUETOOTH (8 produits)
  {
    sku: 'KITB29',
    name: 'Casque Tune B29',
    family: 'KIT BLUETOOTH',
    article_type: 'Casque',
    brand: 'Tune',
    reference: 'B29',
  },
  {
    sku: 'KITJBL510',
    name: 'Casque JBL 510',
    family: 'KIT BLUETOOTH',
    article_type: 'Casque',
    brand: 'JBL',
    reference: '510',
  },
  {
    sku: 'KITEQ2',
    name: 'Ecouteur Hoco EQ2',
    family: 'KIT BLUETOOTH',
    article_type: 'Ecouteur',
    brand: 'Hoco',
    reference: 'EQ2',
  },
  {
    sku: 'KITAPRO',
    name: 'Ecouteur Airpod Pro',
    family: 'KIT BLUETOOTH',
    article_type: 'Ecouteur',
    brand: 'Airpod',
    reference: 'Pro',
  },
  {
    sku: 'KITM10',
    name: 'Ecouteur M10 Standard',
    family: 'KIT BLUETOOTH',
    article_type: 'Ecouteur',
    brand: 'M10',
    reference: 'Standard',
  },
  {
    sku: 'KITSAMKL50',
    name: 'Kit Bluetooth Samsung KL50',
    family: 'KIT BLUETOOTH',
    article_type: 'Kit Bluetooth',
    brand: 'Samsung',
    reference: 'KL50',
  },
  {
    sku: 'KITOR241',
    name: 'Kit Bluetooth Oraimo OR-241',
    family: 'KIT BLUETOOTH',
    article_type: 'Kit Bluetooth',
    brand: 'Oraimo',
    reference: 'OR-241',
  },
  {
    sku: 'KITJBL6968',
    name: 'Kit Bluetooth JBL DE 6968',
    family: 'KIT BLUETOOTH',
    article_type: 'Kit Bluetooth',
    brand: 'JBL',
    reference: 'DE 6968',
  },

  // CARTES MEMOIRES (7 produits)
  {
    sku: 'CARFA2GB',
    name: 'Carte memoire Faster 2GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Faster',
    reference: '2GB',
  },
  {
    sku: 'CARFA4GB',
    name: 'Carte memoire Faster 4GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Faster',
    reference: '4GB',
  },
  {
    sku: 'CARFA8GB',
    name: 'Carte memoire Faster 8GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Faster',
    reference: '8GB',
  },
  {
    sku: 'CARCA2GB',
    name: 'Carte memoire Calus 2GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Calus',
    reference: '2GB',
  },
  {
    sku: 'CARCA4GB',
    name: 'Carte memoire Calus 4GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Calus',
    reference: '4GB',
  },
  {
    sku: 'CARSP2GB',
    name: 'Carte memoire Speedar 2GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Speedar',
    reference: '2GB',
  },
  {
    sku: 'CARSP4GB',
    name: 'Carte memoire Speedar 4GB',
    family: 'CARTES MEMOIRES',
    article_type: 'Carte memoire',
    brand: 'Speedar',
    reference: '4GB',
  },
];

interface ShopConfig {
  code: string;
  name: string;
  email: string;
  phone: string;
  pin: string;
}

const SHOPS: ShopConfig[] = [
  {
    code: '042026',
    name: 'Boutique 042026',
    email: 'shop042026@swalo.com',
    phone: '+221770420260',
    pin: '0426',
  },
  {
    code: '122026',
    name: 'Boutique 122026',
    email: 'shop122026@swalo.com',
    phone: '+221771220260',
    pin: '1226',
  },
];

async function createShopWithProducts(shopConfig: ShopConfig, enterpriseId: string) {
  console.log(`\n--- Creation de la boutique ${shopConfig.code} ---`);

  // 1. Creer ou recuperer l'utilisateur proprietaire
  const hashedPassword = await bcrypt.hash('swalo2026', 10);

  const owner = await prisma.user.upsert({
    where: { email: shopConfig.email },
    update: {},
    create: {
      email: shopConfig.email,
      phone: shopConfig.phone,
      password_hash: hashedPassword,
      pin_code: shopConfig.pin,
      display_name: `Owner ${shopConfig.code}`,
      is_active: true,
    },
  });

  console.log(`[OK] Utilisateur proprietaire cree: ${owner.email}`);

  // 2. Creer la boutique
  const shop = await prisma.shop.upsert({
    where: { code: shopConfig.code },
    update: {},
    create: {
      code: shopConfig.code,
      name: shopConfig.name,
      address: 'Dakar, Senegal',
      phone: shopConfig.phone,
      email: shopConfig.email,
      currency: 'XOF',
      owner_id: owner.id,
      enterprise_id: enterpriseId,
    },
  });

  console.log(`[OK] Boutique creee: ${shop.name} - Code: ${shop.code}`);

  // 3. Creer le role proprietaire
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
      role: 'BOSS',
    },
  });

  console.log(`[OK] Role proprietaire cree`);

  // 4. Creer le PIN invite
  await prisma.pinInvite.upsert({
    where: { pin_code: shopConfig.pin },
    update: {
      is_active: true,
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      pin_code: shopConfig.pin,
      shop_id: shop.id,
      role: 'BOSS',
      display_name: `Owner ${shopConfig.code}`,
      created_by: owner.id,
      valid_from: new Date(),
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      is_active: true,
    },
  });

  console.log(`[OK] PIN ${shopConfig.pin} cree pour la boutique ${shopConfig.code}`);

  // 5. Inserer les produits
  let created = 0;
  let skipped = 0;

  for (const product of PRODUCTS) {
    // Verifier si le produit existe deja
    const existing = await prisma.product.findFirst({
      where: {
        shop_id: shop.id,
        sku: product.sku,
        deleted: false,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.product.create({
      data: {
        shop_id: shop.id,
        sku: product.sku,
        name: product.name,
        family: product.family,
        article_type: product.article_type,
        brand: product.brand,
        reference: product.reference,
        cost_price: 0, // Prix a definir ulterieurement
        sell_price: 0, // Prix a definir ulterieurement
        unit: 'unit',
        is_active: true,
        alert_threshold: 5,
      },
    });
    created++;
  }

  console.log(`[OK] Produits: ${created} crees, ${skipped} ignores (deja existants)`);

  return { shop, owner, created, skipped };
}

async function main() {
  console.log('===========================================');
  console.log('   SEED: Boutiques 042026 et 122026');
  console.log('===========================================');

  // Recuperer l'entreprise existante (creee par le seed principal)
  const enterprise = await prisma.enterprise.findFirst({
    where: { code: 'ENT-Swalo' },
  });

  if (!enterprise) {
    console.error('Erreur: Entreprise ENT-Swalo non trouvee. Lancez le seed principal d abord.');
    process.exit(1);
  }

  console.log(`[OK] Entreprise trouvee: ${enterprise.name}`);

  const results = [];

  for (const shopConfig of SHOPS) {
    const result = await createShopWithProducts(shopConfig, enterprise.id);
    results.push(result);
  }

  console.log('\n===========================================');
  console.log('   RESUME');
  console.log('===========================================');

  for (const result of results) {
    console.log(`\nBoutique: ${result.shop.code}`);
    console.log(`  - Produits crees: ${result.created}`);
    console.log(`  - Produits ignores: ${result.skipped}`);
    console.log(`  - Email: ${result.owner.email}`);
    console.log(`  - PIN: ${SHOPS.find(s => s.code === result.shop.code)?.pin}`);
  }

  console.log('\n[TERMINE] Seed execute avec succes!');
}

main()
  .catch(e => {
    console.error('Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
