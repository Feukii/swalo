import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  PinLoginDto,
  CreateShopDto,
  UpdateShopCodeDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService
  ) {}

  /**
   * Valide les credentials de l'utilisateur
   */
  async validateUser(emailOrPhone: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
        deleted: false,
        is_active: true,
      },
      include: {
        user_roles: {
          where: { deleted: false },
          include: {
            shop: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Vérifier que l'utilisateur a un password_hash
    if (!user.password_hash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    // Ne pas retourner le hash du mot de passe
    const { password_hash: _passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Inscription d'un nouveau propriétaire de boutique
   */
  async register(dto: RegisterDto) {
    // Vérifier si l'email ou téléphone existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
        deleted: false,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ou téléphone déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Créer l'utilisateur et la boutique dans une transaction
    const result = await this.prisma.$transaction(async tx => {
      // Créer l'utilisateur
      const user = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          password_hash: hashedPassword,
          display_name: dto.display_name,
        },
      });

      // Créer la boutique
      const shop = await tx.shop.create({
        data: {
          code: dto.shop_code,
          name: dto.shop_name,
          currency: dto.currency || 'XOF',
          owner_id: user.id,
        },
      });

      // Créer le rôle OWNER
      await tx.userRole.create({
        data: {
          user_id: user.id,
          shop_id: shop.id,
          role: 'OWNER',
        },
      });

      return { user, shop };
    });

    // Retourner les tokens
    const tokens = await this.generateTokens(result.user.id, result.shop.id);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        phone: result.user.phone,
        display_name: result.user.display_name,
      },
      shop: {
        id: result.shop.id,
        code: result.shop.code,
        name: result.shop.name,
      },
      ...tokens,
    };
  }

  /**
   * Connexion d'un utilisateur
   */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email_or_phone, dto.password);

    if (!user) {
      throw new UnauthorizedException('Email/téléphone ou mot de passe incorrect');
    }

    // Sélectionner la boutique (première par défaut)
    const shopId = dto.shop_id || user.user_roles[0]?.shop_id;

    if (!shopId) {
      throw new UnauthorizedException('Aucune boutique associée à cet utilisateur');
    }

    // Vérifier que l'utilisateur a accès à cette boutique
    const userRole = user.user_roles.find(role => role.shop_id === shopId);
    if (!userRole) {
      throw new UnauthorizedException('Accès non autorisé à cette boutique');
    }

    // Générer les tokens
    const tokens = await this.generateTokens(user.id, shopId);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        display_name: user.display_name,
      },
      shop: {
        id: userRole.shop.id,
        code: userRole.shop.code,
        name: userRole.shop.name,
      },
      role: userRole.role,
      ...tokens,
    };
  }

  /**
   * Authentification par code Boutique + PIN (6 chiffres + 4 chiffres)
   * Conforme au CDC SWALO - Section 2 & 3.8
   * Avec vérification d'appareil pour les employés
   */
  async loginWithPin(
    dto: PinLoginDto,
    deviceInfo?: { device_id: string; device_name?: string; device_type?: string }
  ) {
    // 1. Vérifier que la boutique existe
    const shop = await this.prisma.shop.findUnique({
      where: {
        code: dto.shop_code,
        deleted: false,
      },
    });

    if (!shop) {
      throw new UnauthorizedException('Code boutique invalide');
    }

    // 2. Rechercher l'utilisateur par PIN dans cette boutique
    const user = await this.prisma.user.findFirst({
      where: {
        pin_code: dto.pin_code,
        deleted: false,
        is_active: true,
        user_roles: {
          some: {
            shop_id: shop.id,
            deleted: false,
          },
        },
      },
      include: {
        user_roles: {
          where: {
            shop_id: shop.id,
            deleted: false,
          },
          include: {
            shop: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Code PIN invalide pour cette boutique');
    }

    // Vérifier les horaires de travail (si définis)
    const userRole = user.user_roles[0];
    if (userRole.work_start_time && userRole.work_end_time && userRole.work_days) {
      const now = new Date();
      const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const workDays = JSON.parse(userRole.work_days);
      if (!workDays.includes(currentDay)) {
        throw new UnauthorizedException('Accès refusé : hors jour de travail');
      }

      if (currentTime < userRole.work_start_time || currentTime > userRole.work_end_time) {
        throw new UnauthorizedException('Accès refusé : hors horaires de travail');
      }
    }

    // Vérifier et gérer l'appareil pour les employés (un seul appareil autorisé)
    if (deviceInfo && userRole.role === 'EMPLOYEE') {
      // Vérifier si cet appareil est déjà enregistré et actif
      const existingDevice = await this.prisma.userDevice.findUnique({
        where: {
          user_id_shop_id_device_id: {
            user_id: user.id,
            shop_id: shop.id,
            device_id: deviceInfo.device_id,
          },
        },
      });

      if (existingDevice && !existingDevice.is_active) {
        throw new UnauthorizedException(
          'Cet appareil a été révoqué. Contactez votre administrateur.'
        );
      }

      if (!existingDevice) {
        // Vérifier s'il y a déjà un autre appareil actif
        const activeDevices = await this.prisma.userDevice.findMany({
          where: {
            user_id: user.id,
            shop_id: shop.id,
            is_active: true,
          },
        });

        if (activeDevices.length > 0) {
          throw new UnauthorizedException(
            'Ce code PIN est déjà utilisé sur un autre appareil. Un seul appareil est autorisé par employé.'
          );
        }

        // Enregistrer le nouvel appareil
        await this.prisma.userDevice.create({
          data: {
            user_id: user.id,
            shop_id: shop.id,
            device_id: deviceInfo.device_id,
            device_name: deviceInfo.device_name,
            device_type: deviceInfo.device_type || 'mobile',
            last_login_at: new Date(),
            is_active: true,
          },
        });
      } else {
        // Mettre à jour la date de dernière connexion
        await this.prisma.userDevice.update({
          where: { id: existingDevice.id },
          data: { last_login_at: new Date() },
        });
      }
    }

    // Générer les tokens JWT
    const tokens = await this.generateTokens(user.id, shop.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        display_name: user.display_name,
      },
      shop: {
        id: userRole.shop.id,
        code: userRole.shop.code,
        name: userRole.shop.name,
      },
      role: userRole.role,
      ...tokens,
    };
  }

  /**
   * Rafraîchissement du token
   */
  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refresh_token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const tokens = await this.generateTokens(payload.sub, payload.shopId);
      return tokens;
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  /**
   * Génère les tokens JWT (access + refresh)
   */
  private async generateTokens(userId: string, shopId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, shopId },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '24h'),
        }
      ),
      this.jwtService.signAsync(
        { sub: userId, shopId },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        }
      ),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Création rapide d'une boutique avec propriétaire (Admin Web uniquement)
   * Génère automatiquement shop_code (6 chiffres) et PIN propriétaire (4 chiffres)
   */
  async createShop(dto: CreateShopDto) {
    // Générer un code boutique unique (6 chiffres)
    let shopCode: string;
    let isUnique = false;

    while (!isUnique) {
      shopCode = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.shop.findUnique({
        where: { code: shopCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Générer un PIN propriétaire unique (4 chiffres)
    let ownerPin: string;
    let isPinUnique = false;

    while (!isPinUnique) {
      ownerPin = Math.floor(1000 + Math.random() * 9000).toString();
      const existing = await this.prisma.user.findFirst({
        where: { pin_code: ownerPin, deleted: false },
      });
      if (!existing) {
        isPinUnique = true;
      }
    }

    // Créer la boutique et le propriétaire dans une transaction
    const result = await this.prisma.$transaction(async tx => {
      // Créer l'utilisateur propriétaire
      const owner = await tx.user.create({
        data: {
          display_name: dto.owner_name,
          phone: dto.phone,
          pin_code: ownerPin,
          is_active: true,
        },
      });

      // Créer la boutique
      const shop = await tx.shop.create({
        data: {
          code: shopCode,
          name: dto.shop_name,
          currency: dto.currency || 'XOF',
          owner_id: owner.id,
        },
      });

      // Créer le rôle OWNER
      await tx.userRole.create({
        data: {
          user_id: owner.id,
          shop_id: shop.id,
          role: 'OWNER',
        },
      });

      return { owner, shop, shopCode, ownerPin };
    });

    return {
      shop: {
        id: result.shop.id,
        code: result.shopCode,
        name: result.shop.name,
        currency: result.shop.currency,
      },
      owner: {
        id: result.owner.id,
        name: result.owner.display_name,
        phone: result.owner.phone,
        pin_code: result.ownerPin,
      },
    };
  }

  /**
   * Récupère l'utilisateur avec ses rôles
   */
  async getUserWithRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },

      include: {
        user_roles: {
          where: { deleted: false },

          include: {
            shop: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvAc');
    }

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvAc');
    }

    const primaryRole = user.user_roles[0] ?? null;
    const { password_hash: _passwordHash2, user_roles, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      shop: primaryRole ? primaryRole.shop : null,
      role: primaryRole ? primaryRole.role : null,
      roles: user_roles.map(role => ({
        role: role.role,
        shop: role.shop,
      })),
    };
  }

  /**
   * Modification du code boutique par le propriétaire
   * Requiert confirmation du PIN du propriétaire
   */
  async updateShopCode(shopId: string, userId: string, dto: UpdateShopCodeDto) {
    // 1. Vérifier que l'utilisateur existe et récupérer son rôle
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted: false },
      include: {
        user_roles: {
          where: {
            shop_id: shopId,
            deleted: false,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    const userRole = user.user_roles[0];
    if (!userRole) {
      throw new UnauthorizedException("Vous n'avez pas accès à cette boutique");
    }

    // 2. Vérifier que l'utilisateur est propriétaire de la boutique
    if (userRole.role !== 'OWNER') {
      throw new UnauthorizedException('Seul le propriétaire peut modifier le code boutique');
    }

    // 3. Vérifier le PIN du propriétaire
    if (user.pin_code !== dto.pin_code) {
      throw new UnauthorizedException('Code PIN incorrect');
    }

    // 4. Générer un nouveau code boutique unique (6 chiffres)
    let newShopCode = '';
    let isUnique = false;

    while (!isUnique) {
      newShopCode = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.shop.findUnique({
        where: { code: newShopCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // 5. Mettre à jour le code boutique
    const updatedShop = await this.prisma.shop.update({
      where: { id: shopId },
      data: { code: newShopCode },
    });

    return {
      shop: {
        id: updatedShop.id,
        code: newShopCode,
        name: updatedShop.name,
      },
      message: 'Code boutique modifié avec succès',
    };
  }
}
