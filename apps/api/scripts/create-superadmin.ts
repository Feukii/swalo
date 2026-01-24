import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  console.log("🔧 Création d'un compte Super Admin...\n");

  const email = process.env.ADMIN_EMAIL || 'admin@swalo.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@2025!';
  const displayName = process.env.ADMIN_NAME || 'Super Administrateur';

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`❌ Un utilisateur avec l'email ${email} existe déjà.`);
      console.log('   Voulez-vous le mettre à jour? (modifier le script)');
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur d'abord (nécessaire pour owner_id de Shop)
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        display_name: displayName,
        phone: '+221000000001', // Numéro unique pour SUPERADMIN
        is_active: true,
        deleted: false,
      },
    });

    console.log('✅ Utilisateur créé:', {
      id: user.id,
      email: user.email,
      name: user.display_name,
    });

    // Créer ou récupérer la boutique "Admin"
    let adminShop = await prisma.shop.findFirst({
      where: { code: 'ADMIN001' },
    });

    if (!adminShop) {
      adminShop = await prisma.shop.create({
        data: {
          code: 'ADMIN001',
          name: 'Administration Swalo',
          address: 'Siège Social',
          phone: '+221000000000',
          email: 'admin@swalo.com',
          currency: 'XOF',
          owner_id: user.id,
          deleted: false,
        },
      });
      console.log('✅ Boutique admin créée');
    }

    // Créer le rôle SUPERADMIN pour cet utilisateur
    const userRole = await prisma.userRole.create({
      data: {
        user_id: user.id,
        shop_id: adminShop.id,
        role: 'SUPERADMIN',
        deleted: false,
      },
    });

    console.log('✅ Rôle SUPERADMIN assigné');

    console.log('\n🎉 Super Admin créé avec succès!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Mot de passe:', password);
    console.log('🏪 Boutique:', adminShop.name, '(Code:', adminShop.code + ')');
    console.log('\n🌐 Connexion:');
    console.log('   Web: http://localhost:5173/login/admin');
    console.log('   OU: https://votre-app.com/login/admin');
    console.log('\n⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
  } catch (error) {
    console.error('❌ Erreur lors de la création:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
createSuperAdmin();
