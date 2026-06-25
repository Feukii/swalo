import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  MODULE_DEFINITIONS,
  validateModuleDependencies,
  type LicenseTier,
} from '@swalo/core/modules/registry';

@Injectable()
export class AdminControlsService {
  constructor(private prisma: PrismaService) {}

  // ==================== SHOP BLOCKING ====================

  async blockShop(shopId: string, adminId: string, reason: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');

    const oldValue = { is_blocked: shop.is_blocked, blocked_reason: shop.blocked_reason };

    const updated = await this.prisma.$transaction(async tx => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: {
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date(),
          blocked_by: adminId,
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'BLOCK_SHOP',
          entity_type: 'SHOP',
          entity_id: shopId,
          old_value: oldValue,
          new_value: { is_blocked: true, blocked_reason: reason },
          reason,
        },
      });

      return updatedShop;
    });

    return updated;
  }

  async unblockShop(shopId: string, adminId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique non trouvée');

    const updated = await this.prisma.$transaction(async tx => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: {
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          blocked_by: null,
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UNBLOCK_SHOP',
          entity_type: 'SHOP',
          entity_id: shopId,
          old_value: { is_blocked: true, blocked_reason: shop.blocked_reason },
          new_value: { is_blocked: false },
          reason: 'Déblocage',
        },
      });

      return updatedShop;
    });

    return updated;
  }

  // ==================== USER BLOCKING ====================

  async blockUser(userId: string, adminId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const updated = await this.prisma.$transaction(async tx => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date(),
          blocked_by: adminId,
        },
      });

      // Révoquer tous les appareils de l'utilisateur
      await tx.userDevice.updateMany({
        where: { user_id: userId, is_active: true },
        data: {
          is_active: false,
          revoked_at: new Date(),
          revoked_by: adminId,
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'BLOCK_USER',
          entity_type: 'USER',
          entity_id: userId,
          old_value: { is_blocked: false },
          new_value: { is_blocked: true, blocked_reason: reason },
          reason,
        },
      });

      return updatedUser;
    });

    return updated;
  }

  async unblockUser(userId: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const updated = await this.prisma.$transaction(async tx => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          blocked_by: null,
        },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UNBLOCK_USER',
          entity_type: 'USER',
          entity_id: userId,
          old_value: { is_blocked: true, blocked_reason: user.blocked_reason },
          new_value: { is_blocked: false },
          reason: 'Déblocage',
        },
      });

      return updatedUser;
    });

    return updated;
  }

  // ==================== ENTERPRISE BLOCKING ====================

  async blockEnterprise(enterpriseId: string, adminId: string, reason: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: { shops: { select: { id: true, is_blocked: true } } },
    });
    if (!enterprise) throw new NotFoundException('Entreprise non trouvée');

    const updated = await this.prisma.$transaction(async tx => {
      const updatedEnterprise = await tx.enterprise.update({
        where: { id: enterpriseId },
        data: {
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date(),
          blocked_by: adminId,
        },
      });

      // Bloquer en cascade toutes les boutiques de l'entreprise (qui ne sont pas déjà bloquées individuellement)
      for (const shop of enterprise.shops) {
        if (!shop.is_blocked) {
          await tx.shop.update({
            where: { id: shop.id },
            data: {
              is_blocked: true,
              blocked_reason: `Cascade : ${reason}`,
              blocked_at: new Date(),
              blocked_by: adminId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'BLOCK_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: enterpriseId,
          old_value: { is_blocked: false },
          new_value: {
            is_blocked: true,
            blocked_reason: reason,
            shops_blocked: enterprise.shops.filter(s => !s.is_blocked).length,
          },
          reason,
        },
      });

      return updatedEnterprise;
    });

    return updated;
  }

  async unblockEnterprise(enterpriseId: string, adminId: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      include: { shops: { select: { id: true, is_blocked: true, blocked_by: true } } },
    });
    if (!enterprise) throw new NotFoundException('Entreprise non trouvée');

    const updated = await this.prisma.$transaction(async tx => {
      const updatedEnterprise = await tx.enterprise.update({
        where: { id: enterpriseId },
        data: {
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          blocked_by: null,
        },
      });

      // Débloquer uniquement les boutiques bloquées par cascade (blocked_by == adminId de l'entreprise)
      // Ne pas débloquer celles bloquées individuellement
      for (const shop of enterprise.shops) {
        if (shop.is_blocked && shop.blocked_by === enterprise.blocked_by) {
          await tx.shop.update({
            where: { id: shop.id },
            data: {
              is_blocked: false,
              blocked_reason: null,
              blocked_at: null,
              blocked_by: null,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UNBLOCK_ENTERPRISE',
          entity_type: 'ENTERPRISE',
          entity_id: enterpriseId,
          old_value: { is_blocked: true, blocked_reason: enterprise.blocked_reason },
          new_value: { is_blocked: false },
          reason: 'Déblocage',
        },
      });

      return updatedEnterprise;
    });

    return updated;
  }

  // ==================== AUDIT LOGS ====================

  async getAuditLogs(filters?: {
    action?: string;
    entity_type?: string;
    admin_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.action) where.action = filters.action;
    if (filters?.entity_type) where.entity_type = filters.entity_type;
    if (filters?.admin_id) where.admin_id = filters.admin_id;

    if (filters?.start_date || filters?.end_date) {
      where.created_at = {};
      if (filters?.start_date) where.created_at.gte = new Date(filters.start_date);
      if (filters?.end_date) where.created_at.lte = new Date(filters.end_date);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          admin: {
            select: { id: true, display_name: true, email: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== SYSTEM STATS ====================

  async getEnhancedSystemStats() {
    const now = new Date();
    const last15min = new Date(Date.now() - 15 * 60 * 1000);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const next7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalShops,
      blockedShops,
      totalEnterprises,
      blockedEnterprises,
      devicesLast15min,
      devicesLast24h,
      devicesLast7d,
      expiredLicenses,
      expiringSoonLicenses,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deleted: false } }),
      this.prisma.user.count({ where: { deleted: false, is_active: true, is_blocked: false } }),
      this.prisma.user.count({ where: { deleted: false, is_blocked: true } }),
      this.prisma.shop.count({ where: { deleted: false } }),
      this.prisma.shop.count({ where: { deleted: false, is_blocked: true } }),
      this.prisma.enterprise.count({ where: { deleted: false } }),
      this.prisma.enterprise.count({ where: { deleted: false, is_blocked: true } }),
      this.prisma.userDevice.count({
        where: { is_active: true, last_login_at: { gte: last15min } },
      }),
      this.prisma.userDevice.count({
        where: { is_active: true, last_login_at: { gte: last24h } },
      }),
      this.prisma.userDevice.count({
        where: { is_active: true, last_login_at: { gte: last7d } },
      }),
      this.prisma.enterprise.count({
        where: {
          deleted: false,
          is_blocked: false,
          licensed_until: { not: null, lt: now },
        },
      }),
      this.prisma.enterprise.count({
        where: {
          deleted: false,
          is_blocked: false,
          licensed_until: { gte: now, lt: next7d },
        },
      }),
      this.prisma.auditLog.findMany({
        include: {
          admin: { select: { id: true, display_name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, blocked: blockedUsers },
      shops: { total: totalShops, blocked: blockedShops, active: totalShops - blockedShops },
      enterprises: {
        total: totalEnterprises,
        blocked: blockedEnterprises,
        active: totalEnterprises - blockedEnterprises,
      },
      connectedDevices: {
        last15min: devicesLast15min,
        last24h: devicesLast24h,
        last7d: devicesLast7d,
      },
      licenses: {
        expired: expiredLicenses,
        expiringSoon: expiringSoonLicenses,
      },
      recentAuditLogs,
    };
  }

  // ==================== MODULE MANAGEMENT ====================

  async getShopModules(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, enabled_modules: true },
    });
    if (!shop) throw new NotFoundException('Boutique non trouvée');
    return shop;
  }

  async updateShopModules(shopId: string, adminId: string, modules: string[]) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        enabled_modules: true,
        enterprise: { select: { license_tier: true } },
      },
    });
    if (!shop) throw new NotFoundException('Boutique non trouvée');

    // Validate modules against enterprise license tier (with overrides)
    const licenseTier = shop.enterprise.license_tier as LicenseTier;
    const allowedCodes = await this.getEffectiveAllowedCodes(licenseTier);

    const unauthorized = modules.filter(m => !allowedCodes.includes(m));
    if (unauthorized.length > 0) {
      throw new BadRequestException(
        `Modules non autorisés pour la licence ${licenseTier} : ${unauthorized.join(', ')}`
      );
    }

    // Validate module dependencies
    const depsCheck = validateModuleDependencies(modules);
    if (!depsCheck.valid) {
      const details = depsCheck.missingDependencies
        .map(d => `${d.module} requiert ${d.missing.join(', ')}`)
        .join('; ');
      throw new BadRequestException(`Dépendances manquantes : ${details}`);
    }

    const updated = await this.prisma.$transaction(async tx => {
      const updatedShop = await tx.shop.update({
        where: { id: shopId },
        data: { enabled_modules: modules },
      });

      await tx.auditLog.create({
        data: {
          admin_id: adminId,
          action: 'UPDATE_SHOP_MODULES',
          entity_type: 'SHOP',
          entity_id: shopId,
          old_value: { enabled_modules: shop.enabled_modules },
          new_value: { enabled_modules: modules },
          reason: 'Mise à jour des modules',
        },
      });

      return updatedShop;
    });

    return updated;
  }

  // ==================== HELPERS ====================

  private readonly LICENSE_TIER_ORDER: Record<string, number> = {
    STARTER: 0,
    PROFESSIONAL: 1,
    ENTERPRISE: 2,
  };

  /**
   * Get allowed module codes for a license tier, respecting SystemConfig overrides.
   */
  private async getEffectiveAllowedCodes(licenseTier: LicenseTier): Promise<string[]> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'license_tier_overrides' },
    });

    const overrides: Record<string, string> = {};
    if (config) {
      try {
        const parsed = JSON.parse(config.value);
        if (Array.isArray(parsed)) {
          for (const o of parsed) {
            overrides[o.code] = o.minimumLicenseTier;
          }
        }
      } catch {
        // ignore
      }
    }

    const tierLevel = this.LICENSE_TIER_ORDER[licenseTier];
    return MODULE_DEFINITIONS.filter(m => {
      const minTier = overrides[m.code] || m.minimumLicenseTier;
      return this.LICENSE_TIER_ORDER[minTier] <= tierLevel;
    }).map(m => m.code);
  }
}
