import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ShopType } from '@prisma/client';
import { CreateEnterpriseDto, UpdateEnterpriseDto } from './dto/create-enterprise.dto';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new enterprise
   */
  async create(ownerId: string, dto: CreateEnterpriseDto) {
    // Check code uniqueness
    const existing = await this.prisma.enterprise.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException(`Une entreprise avec le code "${dto.code}" existe deja`);
    }

    return this.prisma.enterprise.create({
      data: {
        code: dto.code,
        name: dto.name,
        owner_id: ownerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
          },
        },
        shops: {
          where: { deleted: false },
        },
      },
    });
  }

  /**
   * Get all enterprises (SUPERADMIN) or enterprises owned by user
   */
  async findAll(userId: string, isSuperAdmin: boolean) {
    const where = isSuperAdmin ? { deleted: false } : { owner_id: userId, deleted: false };

    return this.prisma.enterprise.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
          },
        },
        shops: {
          where: { deleted: false },
          select: {
            id: true,
            code: true,
            name: true,
            shop_type: true,
          },
        },
        _count: {
          select: {
            shops: { where: { deleted: false } },
            transfers: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get one enterprise by ID
   */
  async findOne(enterpriseId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
      include: {
        owner: {
          select: {
            id: true,
            display_name: true,
            email: true,
          },
        },
        shops: {
          where: { deleted: false },
          include: {
            _count: {
              select: {
                products: { where: { deleted: false } },
                sales: { where: { deleted: false } },
                customers: { where: { deleted: false } },
                user_roles: { where: { deleted: false } },
              },
            },
          },
        },
      },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    return enterprise;
  }

  /**
   * Update enterprise
   */
  async update(
    enterpriseId: string,
    userId: string,
    isSuperAdmin: boolean,
    dto: UpdateEnterpriseDto
  ) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    return this.prisma.enterprise.update({
      where: { id: enterpriseId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        version: { increment: 1 },
      },
    });
  }

  /**
   * Add a shop to an enterprise
   */
  async addShop(
    enterpriseId: string,
    shopId: string,
    userId: string,
    isSuperAdmin: boolean,
    shopType?: ShopType
  ) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    if (shop.enterprise_id && shop.enterprise_id !== enterpriseId) {
      throw new BadRequestException('Cette boutique appartient deja a une autre entreprise');
    }

    if (shop.enterprise_id === enterpriseId) {
      throw new BadRequestException('Cette boutique fait deja partie de cette entreprise');
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        enterprise_id: enterpriseId,
        shop_type: shopType || shop.shop_type,
        version: { increment: 1 },
      },
    });
  }

  /**
   * Remove a shop from an enterprise
   */
  async removeShop(enterpriseId: string, shopId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    if (shop.enterprise_id !== enterpriseId) {
      throw new BadRequestException('Cette boutique ne fait pas partie de cette entreprise');
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        enterprise_id: null,
        shop_type: 'BOUTIQUE',
        version: { increment: 1 },
      },
    });
  }

  /**
   * Get all shops in an enterprise
   */
  async getShops(enterpriseId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    return this.prisma.shop.findMany({
      where: {
        enterprise_id: enterpriseId,
        deleted: false,
      },
      include: {
        _count: {
          select: {
            products: { where: { deleted: false } },
            sales: { where: { deleted: false } },
            customers: { where: { deleted: false } },
            user_roles: { where: { deleted: false } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get consolidated stats for an enterprise
   */
  async getStats(enterpriseId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
      include: {
        shops: {
          where: { deleted: false },
          select: { id: true },
        },
      },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    const shopIds = enterprise.shops.map(s => s.id);

    if (shopIds.length === 0) {
      return {
        total_shops: 0,
        total_products: 0,
        total_sales: 0,
        total_revenue: 0,
        total_customers: 0,
        total_pending_transfers: 0,
      };
    }

    const [totalProducts, totalSales, revenueResult, totalCustomers, pendingTransfers] =
      await Promise.all([
        this.prisma.product.count({
          where: { shop_id: { in: shopIds }, deleted: false },
        }),
        this.prisma.sale.count({
          where: { shop_id: { in: shopIds }, deleted: false, status: 'COMPLETED' },
        }),
        this.prisma.sale.aggregate({
          where: { shop_id: { in: shopIds }, deleted: false, status: 'COMPLETED' },
          _sum: { grand_total: true },
        }),
        this.prisma.customer.count({
          where: { shop_id: { in: shopIds }, deleted: false },
        }),
        this.prisma.interShopTransfer.count({
          where: {
            enterprise_id: enterpriseId,
            status: { in: ['DRAFT', 'CONFIRMED', 'SHIPPED'] },
            deleted: false,
          },
        }),
      ]);

    return {
      total_shops: shopIds.length,
      total_products: totalProducts,
      total_sales: totalSales,
      total_revenue: revenueResult._sum.grand_total || 0,
      total_customers: totalCustomers,
      total_pending_transfers: pendingTransfers,
    };
  }

  /**
   * Soft delete an enterprise
   */
  async delete(enterpriseId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    // Unlink all shops first
    await this.prisma.shop.updateMany({
      where: { enterprise_id: enterpriseId },
      data: { enterprise_id: null, shop_type: 'BOUTIQUE' },
    });

    return this.prisma.enterprise.update({
      where: { id: enterpriseId },
      data: {
        deleted: true,
        deleted_at: new Date(),
        version: { increment: 1 },
      },
    });
  }
}
