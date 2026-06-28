/**
 * Bootstrap minimal d'une entreprise + boutiques + compte BOSS.
 * Provisioning intentionnel (PAS le seed de démo). Idempotent.
 *
 * Usage :
 *   DATABASE_URL='<url>' npx ts-node prisma/bootstrap-prod.ts
 *
 * Crée : Entreprise « France » + boutiques « Paris » (100001) et
 * « Marseille » (100002) + un compte BOSS (PIN 0000, login web par email).
 * enabled_modules = [] sur les boutiques => toutes les fonctionnalités autorisées.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ENTERPRISE_CODE = 'FRANCE';
const BOSS_EMAIL = 'boss@france.swalo';
const BOSS_PASSWORD = 'Swalo2026!';
const BOSS_PIN = '0000';
const SHOPS = [
  { code: '100001', name: 'Paris' },
  { code: '100002', name: 'Marseille' },
];

async function main() {
  const existing = await prisma.enterprise.findUnique({ where: { code: ENTERPRISE_CODE } });
  if (existing) {
    console.log(`⏭️  Entreprise "${ENTERPRISE_CODE}" déjà présente — rien à faire.`);
    return;
  }

  const password_hash = await bcrypt.hash(BOSS_PASSWORD, 10);

  // 1) Compte BOSS (pas de FK).
  const boss = await prisma.user.create({
    data: {
      email: BOSS_EMAIL,
      display_name: 'PDG France',
      password_hash,
      pin_code: BOSS_PIN,
      is_active: true,
    },
  });

  // 2) Entreprise France.
  const enterprise = await prisma.enterprise.create({
    data: {
      code: ENTERPRISE_CODE,
      name: 'France',
      owner_id: boss.id,
      license_tier: 'PREMIUM',
      max_shops: 10,
      max_users_per_shop: 50,
    },
  });

  // 3) Boutiques + 4) rôle BOSS sur chacune.
  for (const s of SHOPS) {
    const shop = await prisma.shop.create({
      data: {
        code: s.code,
        name: s.name,
        owner_id: boss.id,
        enterprise_id: enterprise.id,
        currency: 'EUR',
        shop_type: 'BOUTIQUE',
        enabled_modules: [], // [] = toutes les fonctionnalités autorisées
      },
    });
    await prisma.userRole.create({
      data: { user_id: boss.id, shop_id: shop.id, role: 'BOSS' },
    });
    console.log(`🏬 Boutique "${s.name}" créée — code ${s.code}`);
  }

  console.log('\n✅ Bootstrap terminé');
  console.log(`   Entreprise : France (${ENTERPRISE_CODE})`);
  console.log(`   Connexion mobile (PIN) : code boutique 100001 (Paris) ou 100002 (Marseille) + PIN ${BOSS_PIN}`);
  console.log(`   Connexion web (email)  : ${BOSS_EMAIL} / ${BOSS_PASSWORD}`);
}

main()
  .catch(e => {
    console.error('❌ Échec bootstrap:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
