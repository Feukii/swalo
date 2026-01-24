import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Super Admin: Get all shops in the system
   */
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

  /**
   * Super Admin: Get shop details with all users
   */
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
      throw new NotFoundException('Shop not found');
    }

    return shop;
  }

  /**
   * Super Admin or Shop Owner: Get all users in a shop with their devices
   */
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

    // Get devices for each user
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

  /**
   * Shop Owner or Super Admin: Get user devices
   */
  async getUserDevices(userId: string, shopId: string) {
    return this.prisma.userDevice.findMany({
      where: {
        user_id: userId,
        shop_id: shopId,
      },
      orderBy: { last_login_at: 'desc' },
    });
  }

  /**
   * Shop Owner or Super Admin: Revoke device access
   */
  async revokeDeviceAccess(deviceId: string, shopId: string, revokedBy: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: {
        id: deviceId,
        shop_id: shopId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
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

  /**
   * Shop Owner or Super Admin: Revoke all user devices except current one
   */
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

  /**
   * Shop Owner or Super Admin: Update user role and work schedule
   */
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
      throw new NotFoundException('User role not found');
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

  /**
   * Shop Owner or Super Admin: Deactivate user access to shop
   */
  async deactivateUserAccess(userId: string, shopId: string) {
    // Revoke all devices
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

    // Mark user role as deleted
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

  /**
   * Super Admin: Delete shop (soft delete)
   */
  async deleteShop(shopId: string, deletedBy: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      throw new NotFoundException('Shop not found');
    }

    if (shop.deleted) {
      throw new ForbiddenException('Shop already deleted');
    }

    // Use transaction to ensure all related data is marked as deleted
    return this.prisma.$transaction(async tx => {
      // Mark shop as deleted
      await tx.shop.update({
        where: { id: shopId },
        data: {
          deleted: true,
          deleted_at: new Date(),
        },
      });

      // Revoke all user devices for this shop
      await tx.userDevice.updateMany({
        where: { shop_id: shopId, is_active: true },
        data: {
          is_active: false,
          revoked_at: new Date(),
          revoked_by: deletedBy,
        },
      });

      // Mark all user roles as deleted
      await tx.userRole.updateMany({
        where: { shop_id: shopId, deleted: false },
        data: {
          deleted: true,
          deleted_at: new Date(),
        },
      });

      return { success: true, message: 'Shop deleted successfully' };
    });
  }

  /**
   * Super Admin: Get system statistics
   */
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
}
