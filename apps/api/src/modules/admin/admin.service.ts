import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { CreateShopAdminDto } from './dto/create-shop-admin.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { UpdateSystemConfigDto } from './dto/system-config.dto';
import { getAvailableModulesForLicense, type LicenseTier } from '@swalo/core/modules/registry';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // SHOPS (existing)
  // ============================================

  async getAllShops() {
    return this.prisma.shop.findMany({
      where: { deleted: false },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
          },
        },
        enterprise: {
          select: {
            id: true,
            name: true,
            code: true,
            license_tier: true,
          },
        },
        _count: {
          select: {
            user_roles: true,
            products: true,
            sales: true,
            customers: true,
            suppliers: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getShopDetails(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
            created_at: true,
          },
        },
        enterprise: {
          select: {
            id: true,
            name: true,
            license_tier: true,
          },
        },
        user_roles: {
          where: { deleted: false },
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                email: true,
                phone: true,
                pin_code: true,
                is_active: true,
                created_at: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            sales: true,
            customers: true,
            suppliers: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    return shop;
  }

  // ============================================
  // SHOP USERS & DEVICES (existing)
  // ============================================

  async getShopUsers(shopId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
            pin_code: true,
            is_active: true,
            created_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const usersWithDevices = await Promise.all(
      userRoles.map(async role => {
        const devices = await this.prisma.userDevice.findMany({
          where: {
            user_id: role.user_id,
            shop_id: shopId,
          },
          orderBy: { last_login_at: 'desc' },
        });

        return {
          ...role,
          user: {
            ...role.user,
            devices,
          },
        };
      })
    );

    return usersWithDevices;
  }

  async getUserDevices(userId: string, shopId: string) {
    return this.prisma.userDevice.findMany({
      where: {
        user_id: userId,
        shop_id: shopId,
      },
      orderBy: { last_login_at: 'desc' },
    });
  }

  async revokeDeviceAccess(deviceId: string, shopId: string, revokedBy: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: {
        id: deviceId,
        shop_id: shopId,
      },
    });

    if (!device) {
      throw new NotFoundException('Appareil non trouve');
    }

    return this.prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_by: revokedBy,
      },
    });
  }

  async revokeAllUserDevices(
    userId: string,
    shopId: string,
    currentDeviceId: string,
    revokedBy: string
  ) {
    return this.prisma.userDevice.updateMany({
      where: {
        user_id: userId,
        shop_id: shopId,
        device_id: { not: currentDeviceId },
        is_active: true,
      },
      data: {
        is_active: false,
        revoked_at: new Date(),
        revoked_by: revokedBy,
      },
    });
  }

  async updateUserRole(
    userId: string,
    shopId: string,
    data: {
      role?: Role;
      work_start_time?: string;
      work_end_time?: string;
      work_days?: string;
    }
  ) {
    const userRole = await this.prisma.userRole.findUnique({
      where: {
        user_id_shop_id: {
          user_id: userId,
          shop_id: shopId,
        },
      },
    });

    if (!userRole) {
      throw new NotFoundException('Role utilisateur non trouve');
    }

    return this.prisma.userRole.update({
      where: {
        user_id_shop_id: {
          user_id: userId,
          shop_id: shopId,
        },
      },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  async deactivateUserAccess(userId: string, shopId: string) {
    await this.prisma.userDevice.updateMany({
      where: {
        user_id: userId,
        shop_id: shopId,
        is_active: true,
      },
      data: {
        is_active: false,
        revoked_at: new Date(),
      },
    });

    return this.prisma.userRole.update({
      where: {
        user_id_shop_id: {
          user_id: userId,
          shop_id: shopId,
        },
      },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });
  }

  async deleteShop(shopId: string, deletedBy: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    if (shop.deleted) {
      throw new ForbiddenException('Boutique deja supprimee');
    }

    return this.prisma.$transaction(async tx => {
      await tx.shop.update({
        where: { id: shopId },
        data: {
          deleted: true,
          deleted_at: new Date(),
        },
      });

      await tx.userDevice.updateMany({
        where: { shop_id: shopId, is_active: true },
        data: {
          is_active: false,
          revoked_at: new Date(),
          revoked_by: deletedBy,
        },
      });

      await tx.userRole.updateMany({
        where: { shop_id: shopId, deleted: false },
        data: {
          deleted: true,
          deleted_at: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: deletedBy,
          action: 'DELETE_SHOP',
          entity_type: 'SHOP',
          entity_id: shopId,
          old_value: { name: shop.name, code: shop.code },
          new_value: { deleted: true },
        },
      });

      return { success: true, message: 'Boutique supprimee' };
    });
  }

  async getSystemStats() {
    const [totalShops, totalUsers, activeShops, totalSales, totalProducts] = await Promise.all([
      this.prisma.shop.count({ where: { deleted: false } }),
      this.prisma.user.count({ where: { deleted: false } }),
      this.prisma.shop.count({ where: { deleted: false } }),
      this.prisma.sale.count(),
      this.prisma.product.count({ where: { deleted: false } }),
    ]);

    return {
      totalShops,
      totalUsers,
      activeShops,
      totalSales,
      totalProducts,
    };
  }

  // ============================================
  // ENTERPRISE CRUD (new)
  // ============================================

  async createEnterprise(adminId: string, dto: CreateEnterpriseDto) {
    const code = dto.code || 'ENT-' + Math.floor(100000 + Math.random() * 900000).toString();

    // Verify unique code
    const existing = await this.prisma.enterprise.findFirst({
      where: { code, deleted: false },
    });
    if (existing) {
      throw new BadRequestException('Ce code entreprise existe deja');
    }

    // If owner_id provided, verify user exists
    if (dto.owner_id) {
      const owner = await this.prisma.user.findUnique({
        where: { id: dto.owner_id, deleted: false },
      });
      if (!owner) {
        throw new NotFoundException('Proprietaire non trouve');
      }
    }

    return this.prisma.$transaction(async tx => {
      const createData: any = {
        code,
        name: dto.name,
        license_tier: dto.license_tier || 'STARTER',
        max_shops: dto.max_shops || 1,
        max_users_per_shop: dto.max_users_per_shop || 5,
        licensed_until: dto.licensed_until ? new Date(dto.licensed_until) : null,
        logo_url: dto.logo_url || null,
      };
      if (dto.owner_id) {
        createData.owner = { connect: { id: dto.owner_id } };
      }

      const enterprise = await tx.enterprise.create({ data: createData });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'CREATE_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: enterprise.id,
          new_value: {
            name: enterprise.name,
            code: enterprise.code,
            license_tier: enterprise.license_tier,
          },
        },
      });

      return enterprise;
    });
  }

  async getAllEnterprises() {
    return this.prisma.enterprise.findMany({
      where: { deleted: false },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
          },
        },
        shops: {
          where: { deleted: false },
          select: {
            id: true,
            name: true,
            code: true,
            is_blocked: true,
            shop_type: true,
          },
        },
        _count: {
          select: {
            shops: { where: { deleted: false } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getEnterpriseDetails(id: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id, deleted: false },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
            phone: true,
          },
        },
        shops: {
          where: { deleted: false },
          include: {
            owner: {
              select: { id: true, display_name: true },
            },
            _count: {
              select: {
                user_roles: { where: { deleted: false } },
                products: { where: { deleted: false } },
                sales: true,
              },
            },
          },
        },
      },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    // Get recent audit logs for this enterprise
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entity_type: 'ENTERPRISE',
        entity_id: id,
      },
      include: {
        admin: {
          select: { id: true, display_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return { ...enterprise, audit_logs: auditLogs };
  }

  async updateEnterprise(id: string, adminId: string, dto: UpdateEnterpriseDto) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    const oldValue: any = {};
    const updateData: any = {};

    if (dto.name !== undefined) {
      oldValue.name = enterprise.name;
      updateData.name = dto.name;
    }
    if (dto.license_tier !== undefined) {
      oldValue.license_tier = enterprise.license_tier;
      updateData.license_tier = dto.license_tier;
    }
    if (dto.max_shops !== undefined) {
      oldValue.max_shops = enterprise.max_shops;
      updateData.max_shops = dto.max_shops;
    }
    if (dto.max_users_per_shop !== undefined) {
      oldValue.max_users_per_shop = enterprise.max_users_per_shop;
      updateData.max_users_per_shop = dto.max_users_per_shop;
    }
    if (dto.licensed_until !== undefined) {
      oldValue.licensed_until = enterprise.licensed_until;
      updateData.licensed_until = new Date(dto.licensed_until);
    }
    if (dto.logo_url !== undefined) {
      oldValue.logo_url = enterprise.logo_url;
      updateData.logo_url = dto.logo_url;
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.enterprise.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UPDATE_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: id,
          old_value: oldValue,
          new_value: updateData,
        },
      });

      return updated;
    });
  }

  async deleteEnterprise(id: string, adminId: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id },
      include: { shops: { where: { deleted: false } } },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (enterprise.deleted) {
      throw new ForbiddenException('Entreprise deja supprimee');
    }

    // Refuse deletion if enterprise has active shops
    if (enterprise.shops.length > 0) {
      throw new BadRequestException(
        `Impossible de supprimer cette entreprise : ${enterprise.shops.length} boutique(s) active(s). Supprimez ou reassignez les boutiques d'abord.`
      );
    }

    return this.prisma.$transaction(async tx => {
      // Soft delete enterprise
      await tx.enterprise.update({
        where: { id },
        data: {
          deleted: true,
          deleted_at: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'DELETE_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: id,
          old_value: { name: enterprise.name },
          new_value: { deleted: true },
        },
      });

      return { success: true, message: 'Entreprise supprimee' };
    });
  }

  // ============================================
  // SHOP CREATION (admin-side)
  // ============================================

  async createShopAdmin(adminId: string, dto: CreateShopAdminDto) {
    // Generate shop code if not provided
    let shopCode: string = dto.shop_code || '';
    if (!shopCode) {
      let isUnique = false;
      while (!isUnique) {
        shopCode = Math.floor(100000 + Math.random() * 900000).toString();
        const existing = await this.prisma.shop.findUnique({
          where: { code: shopCode },
        });
        if (!existing) isUnique = true;
      }
    } else {
      const existing = await this.prisma.shop.findUnique({
        where: { code: shopCode },
      });
      if (existing) {
        throw new BadRequestException('Ce code boutique existe deja');
      }
    }

    // Verify enterprise exists (required)
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: dto.enterprise_id, deleted: false },
      include: { _count: { select: { shops: { where: { deleted: false } } } } },
    });
    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }
    if (enterprise._count.shops >= enterprise.max_shops) {
      throw new BadRequestException(`Limite de boutiques atteinte (${enterprise.max_shops})`);
    }

    return this.prisma.$transaction(async tx => {
      let ownerId = dto.owner_id;
      let ownerPin: string | null = null;

      // If no owner_id, create a new owner user
      if (!ownerId && dto.owner_name) {
        let isPinUnique = false;
        while (!isPinUnique) {
          ownerPin = Math.floor(1000 + Math.random() * 9000).toString();
          const existing = await tx.user.findFirst({
            where: { pin_code: ownerPin, deleted: false },
          });
          if (!existing) isPinUnique = true;
        }

        const owner = await tx.user.create({
          data: {
            display_name: dto.owner_name,
            phone: dto.owner_phone || null,
            pin_code: ownerPin,
            is_active: true,
          },
        });
        ownerId = owner.id;
      }

      const shopData: any = {
        code: shopCode,
        name: dto.shop_name,
        shop_type: dto.shop_type || 'BOUTIQUE',
        address: dto.address || null,
        phone: dto.phone || null,
        email: dto.email || null,
        currency: dto.currency || 'XOF',
        enabled_modules: dto.enabled_modules || [
          'auth',
          'products',
          'customers',
          'sales',
          'cash',
          'inventory',
        ],
      };
      if (ownerId) {
        shopData.owner = { connect: { id: ownerId } };
      }
      shopData.enterprise = { connect: { id: dto.enterprise_id } };

      const shop = await tx.shop.create({ data: shopData });

      // Create OWNER role if we have an owner
      if (ownerId) {
        await tx.userRole.create({
          data: {
            user_id: ownerId,
            shop_id: shop.id,
            role: 'BOSS',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'CREATE_SHOP',
          entity_type: 'SHOP',
          entity_id: shop.id,
          new_value: {
            name: shop.name,
            code: shopCode,
            enterprise_id: dto.enterprise_id || null,
          },
        },
      });

      return {
        shop: {
          id: shop.id,
          code: shopCode,
          name: shop.name,
          shop_type: shop.shop_type,
          enterprise_id: shop.enterprise_id,
        },
        owner: ownerId ? { id: ownerId, pin_code: ownerPin } : null,
      };
    });
  }

  // ============================================
  // LICENSE MANAGEMENT
  // ============================================

  async updateLicense(enterpriseId: string, adminId: string, dto: UpdateLicenseDto) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    const oldValue = {
      license_tier: enterprise.license_tier,
      licensed_until: enterprise.licensed_until,
      max_shops: enterprise.max_shops,
      max_users_per_shop: enterprise.max_users_per_shop,
    };

    const updateData: any = {
      license_tier: dto.license_tier,
    };

    if (dto.licensed_until) {
      updateData.licensed_until = new Date(dto.licensed_until);
    }
    if (dto.max_shops !== undefined) {
      updateData.max_shops = dto.max_shops;
    }
    if (dto.max_users_per_shop !== undefined) {
      updateData.max_users_per_shop = dto.max_users_per_shop;
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.enterprise.update({
        where: { id: enterpriseId },
        data: updateData,
      });

      // Auto-sync: remove modules no longer allowed by new license tier
      if (dto.license_tier && dto.license_tier !== oldValue.license_tier) {
        const allowedModules = getAvailableModulesForLicense(dto.license_tier as LicenseTier);
        const allowedCodes = allowedModules.map(m => m.code);

        const shops = await tx.shop.findMany({
          where: { enterprise_id: enterpriseId, deleted: false },
          select: { id: true, enabled_modules: true },
        });

        for (const shop of shops) {
          if (shop.enabled_modules.length === 0) continue; // [] = all allowed, skip
          const filtered = shop.enabled_modules.filter(m => allowedCodes.includes(m));
          if (filtered.length !== shop.enabled_modules.length) {
            await tx.shop.update({
              where: { id: shop.id },
              data: { enabled_modules: filtered },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UPDATE_LICENSE',
          entity_type: 'ENTERPRISE',
          entity_id: enterpriseId,
          old_value: oldValue,
          new_value: updateData,
          reason: `Licence: ${oldValue.license_tier} -> ${dto.license_tier}`,
        },
      });

      return updated;
    });
  }

  // ============================================
  // ENTERPRISE <-> SHOP ASSIGNMENT
  // ============================================

  async addShopToEnterprise(enterpriseId: string, shopId: string, adminId: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
      include: { _count: { select: { shops: { where: { deleted: false } } } } },
    });
    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (enterprise._count.shops >= enterprise.max_shops) {
      throw new BadRequestException(`Limite de boutiques atteinte (${enterprise.max_shops})`);
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
    });
    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    if (shop.enterprise_id === enterpriseId) {
      throw new BadRequestException('Cette boutique est deja dans cette entreprise');
    }
    if (shop.enterprise_id) {
      throw new BadRequestException(
        'Cette boutique est deja rattachee a une autre entreprise. Utilisez le deplacement.'
      );
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.shop.update({
        where: { id: shopId },
        data: { enterprise_id: enterpriseId },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'ADD_SHOP_TO_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: enterpriseId,
          new_value: { shop_id: shopId, shop_name: shop.name },
        },
      });

      return updated;
    });
  }

  async moveShopToEnterprise(shopId: string, newEnterpriseId: string, adminId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
    });
    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    const oldEnterpriseId = shop.enterprise_id;

    if (oldEnterpriseId === newEnterpriseId) {
      throw new BadRequestException('La boutique est deja dans cette entreprise');
    }

    const newEnterprise = await this.prisma.enterprise.findUnique({
      where: { id: newEnterpriseId, deleted: false },
      include: { _count: { select: { shops: { where: { deleted: false } } } } },
    });
    if (!newEnterprise) {
      throw new NotFoundException('Entreprise cible non trouvee');
    }
    if (newEnterprise._count.shops >= newEnterprise.max_shops) {
      throw new BadRequestException(`Limite de boutiques atteinte (${newEnterprise.max_shops})`);
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.shop.update({
        where: { id: shopId },
        data: { enterprise_id: newEnterpriseId },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'MOVE_SHOP_TO_ENTERPRISE',
          entity_type: 'SHOP',
          entity_id: shopId,
          old_value: { enterprise_id: oldEnterpriseId, shop_name: shop.name },
          new_value: { enterprise_id: newEnterpriseId },
        },
      });

      return updated;
    });
  }

  // ============================================
  // GLOBAL USERS
  // ============================================

  async getGlobalUsers(params: { search?: string; role?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { deleted: false };

    if (params.search) {
      where.OR = [
        { display_name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.role) {
      where.user_roles = {
        some: {
          role: params.role as Role,
          deleted: false,
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          display_name: true,
          email: true,
          phone: true,
          is_active: true,
          is_blocked: true,
          blocked_reason: true,
          created_at: true,
          user_roles: {
            where: { deleted: false },
            select: {
              role: true,
              shop: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // SYSTEM CONFIG
  // ============================================

  async getSystemConfigs() {
    return this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getSystemConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!config) {
      throw new NotFoundException(`Configuration "${key}" non trouvee`);
    }
    return config;
  }

  async setSystemConfig(key: string, dto: UpdateSystemConfigDto, adminId: string) {
    const existing = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    const result = await this.prisma.$transaction(async tx => {
      const config = await tx.systemConfig.upsert({
        where: { key },
        create: {
          key,
          value: dto.value,
          description: dto.description || null,
        },
        update: {
          value: dto.value,
          description: dto.description !== undefined ? dto.description : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: existing ? 'UPDATE_SYSTEM_CONFIG' : 'CREATE_SYSTEM_CONFIG',
          entity_type: 'SYSTEM_CONFIG',
          entity_id: key,
          old_value: existing ? { value: existing.value } : undefined,
          new_value: { value: dto.value },
        },
      });

      return config;
    });

    return result;
  }

  async deleteSystemConfig(key: string, adminId: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    if (!config) {
      throw new NotFoundException(`Configuration "${key}" non trouvee`);
    }

    return this.prisma.$transaction(async tx => {
      await tx.systemConfig.delete({ where: { key } });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'DELETE_SYSTEM_CONFIG',
          entity_type: 'SYSTEM_CONFIG',
          entity_id: key,
          old_value: { key, value: config.value },
        },
      });

      return { success: true, message: `Configuration "${key}" supprimee` };
    });
  }

  // ============================================
  // AUDIT LOG EXPORT
  // ============================================

  async exportAuditLogs(filters: {
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const where: any = {};

    if (filters.action) where.action = filters.action;
    if (filters.entity_type) where.entity_type = filters.entity_type;

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) where.created_at.gte = new Date(filters.start_date);
      if (filters.end_date) where.created_at.lte = new Date(filters.end_date);
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        admin: { select: { display_name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10000,
    });

    // Generate CSV
    const header = 'Date,Admin,Action,Type Entite,ID Entite,Raison\n';
    const rows = logs
      .map(log => {
        const date = log.created_at.toISOString();
        const admin = log.admin?.display_name || 'N/A';
        const reason = (log.reason || '').replace(/"/g, '""');
        return `"${date}","${admin}","${log.action}","${log.entity_type}","${log.entity_id}","${reason}"`;
      })
      .join('\n');

    return header + rows;
  }
}
