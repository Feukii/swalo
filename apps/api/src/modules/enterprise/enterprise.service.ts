import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma, ShopType } from '@prisma/client';
import { CreateEnterpriseDto, UpdateEnterpriseDto } from './dto/create-enterprise.dto';

interface FinancialSummaryFilters {
  start_date?: string;
  end_date?: string;
}

export interface PerShopFinancialHealth {
  shop_id: string;
  shop_name: string;
  revenue: number;
  cash_balance: number;
  net_cash_flow: number;
  receivables_outstanding: number;
  supplier_debts: number;
  stock_value: number;
  low_stock_count: number;
  health_score: number;
}

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

    if (shop.enterprise_id === enterpriseId) {
      throw new BadRequestException('Cette boutique fait deja partie de cette entreprise');
    }

    if (shop.enterprise_id !== enterpriseId) {
      throw new BadRequestException(
        'Cette boutique appartient deja a une autre entreprise. Utilisez le deplacement.'
      );
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        enterprise_id: enterpriseId,
        shop_type: shopType ?? shop.shop_type,
        version: { increment: 1 },
      },
    });
  }

  /**
   * Move a shop to another enterprise
   */
  async moveShop(
    fromEnterpriseId: string,
    shopId: string,
    toEnterpriseId: string,
    userId: string,
    isSuperAdmin: boolean
  ) {
    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Seul un SUPERADMIN peut deplacer une boutique entre entreprises'
      );
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId, deleted: false },
    });

    if (!shop) {
      throw new NotFoundException('Boutique non trouvee');
    }

    if (shop.enterprise_id !== fromEnterpriseId) {
      throw new BadRequestException('Cette boutique ne fait pas partie de cette entreprise');
    }

    const targetEnterprise = await this.prisma.enterprise.findUnique({
      where: { id: toEnterpriseId, deleted: false },
      include: { _count: { select: { shops: { where: { deleted: false } } } } },
    });

    if (!targetEnterprise) {
      throw new NotFoundException('Entreprise cible non trouvee');
    }

    if (targetEnterprise._count.shops >= targetEnterprise.max_shops) {
      throw new BadRequestException(
        `Limite de boutiques atteinte pour l'entreprise cible (${String(targetEnterprise.max_shops)})`
      );
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        enterprise_id: toEnterpriseId,
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
      total_revenue: revenueResult._sum.grand_total ?? 0,
      total_customers: totalCustomers,
      total_pending_transfers: pendingTransfers,
    };
  }

  /**
   * Recapitulatif financier consolide pour le PDG (proprietaire d'entreprise).
   *
   * Retourne un rollup au niveau entreprise + une fiche de sante financiere par boutique.
   * Tous les montants sont des entiers FCFA.
   *
   * GOTCHA (entitlement): le decorateur `@RequireModule('enterprise')` sur le controleur
   * verifie le module de la boutique ACTIVE (issue du JWT), pas l'entreprise. Un PDG dont
   * la boutique courante n'a pas le module `enterprise` active pourrait donc etre bloque (403)
   * de son propre tableau de bord. Ce service ne modifie PAS ce comportement de garde : il
   * s'aligne sur `getStats` et verifie la propriete par requete. Decision a trancher cote produit :
   * garder la garde basee sur la propriete OU garantir que les boutiques du PDG ont le module active.
   *
   * GOTCHA (timezone): `new Date(start_date)` est interprete en UTC alors que les boutiques sont
   * en WAT/CAT (UTC+1/+2). On reutilise la meme convention de dates que les rapports existants
   * (`reports.service.ts`). Le `cash_balance` est all-time (non filtre par periode), alors que
   * `revenue` et `net_cash_flow` sont filtres par la periode demandee : l'UI doit les distinguer.
   */
  async getFinancialSummary(
    enterpriseId: string,
    userId: string,
    isSuperAdmin: boolean,
    filters?: FinancialSummaryFilters
  ) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
      include: {
        shops: {
          where: { deleted: false },
          select: { id: true, name: true },
        },
      },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    // shopIds derives UNIQUEMENT de l'entreprise (cote serveur) - on ne fait jamais
    // confiance a une liste de boutiques fournie par le client.
    const shops = enterprise.shops;
    const shopIds = shops.map(s => s.id);

    const period = {
      start_date: filters?.start_date ?? null,
      end_date: filters?.end_date ?? null,
    };

    // Entreprise vide -> tout a zero.
    if (shopIds.length === 0) {
      return {
        enterprise: {
          total_shops: 0,
          revenue: 0,
          cash_balance: 0,
          net_cash_flow: 0,
          receivables_outstanding: 0,
          supplier_debts: 0,
          stock_value: 0,
          low_stock_count: 0,
          health_score: 0,
        },
        per_shop: [] as PerShopFinancialHealth[],
        period,
      };
    }

    // Filtre de periode (meme convention que reports.service.ts)
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (filters?.start_date) {
      createdAtFilter.gte = new Date(filters.start_date);
    }
    if (filters?.end_date) {
      createdAtFilter.lte = new Date(filters.end_date);
    }
    const hasDateFilter = createdAtFilter.gte !== undefined || createdAtFilter.lte !== undefined;
    const periodWhere = hasDateFilter ? { created_at: createdAtFilter } : {};

    // PERF: ~5 requetes groupees au lieu de N x boutiques (cold start Neon/Render).
    const [
      revenueByShop,
      cashByShopType,
      receivablesByShop,
      debtsByShop,
      batchesByShop,
      lowStockProducts,
    ] = await Promise.all([
      // Chiffre d'affaires (ventes COMPLETED) sur la periode
      this.prisma.sale.groupBy({
        by: ['shop_id'],
        where: {
          shop_id: { in: shopIds },
          deleted: false,
          status: 'COMPLETED',
          ...periodWhere,
        },
        _sum: { grand_total: true },
      }),
      // Mouvements de caisse par boutique et par type (IN/OUT), all-time -> cash_balance
      this.prisma.cashEntry.groupBy({
        by: ['shop_id', 'type'],
        where: { shop_id: { in: shopIds }, deleted: false },
        _sum: { amount: true },
      }),
      // Creances clients en cours (PENDING/PARTIAL)
      this.prisma.clientReceivable.groupBy({
        by: ['shop_id'],
        where: {
          shop_id: { in: shopIds },
          deleted: false,
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        _sum: { balance: true },
      }),
      // Dettes fournisseurs en cours (PENDING/PARTIAL)
      this.prisma.supplierDebt.groupBy({
        by: ['shop_id'],
        where: {
          shop_id: { in: shopIds },
          deleted: false,
          status: { in: ['PENDING', 'PARTIAL'] },
        },
        _sum: { balance: true },
      }),
      // Lots de stock restants (une seule requete groupee pour la valeur du stock)
      this.prisma.stockBatch.findMany({
        where: {
          shop_id: { in: shopIds },
          deleted: false,
          remaining_quantity: { gt: 0 },
        },
        select: { shop_id: true, remaining_quantity: true, cost_price: true },
      }),
      // Produits actifs avec leur stock restant (pour le comptage des alertes de stock)
      this.prisma.product.findMany({
        where: { shop_id: { in: shopIds }, deleted: false, is_active: true },
        select: {
          shop_id: true,
          alert_threshold: true,
          stock_batches: {
            where: { deleted: false, remaining_quantity: { gt: 0 } },
            select: { remaining_quantity: true },
          },
        },
      }),
    ]);

    // Indexation par shop_id pour un acces O(1)
    const revenueMap = new Map<string, number>();
    for (const row of revenueByShop) {
      revenueMap.set(row.shop_id, row._sum.grand_total ?? 0);
    }

    const cashInMap = new Map<string, number>();
    const cashOutMap = new Map<string, number>();
    for (const row of cashByShopType) {
      const amount = row._sum.amount ?? 0;
      if (row.type === 'IN') {
        cashInMap.set(row.shop_id, (cashInMap.get(row.shop_id) ?? 0) + amount);
      } else {
        cashOutMap.set(row.shop_id, (cashOutMap.get(row.shop_id) ?? 0) + amount);
      }
    }

    const receivablesMap = new Map<string, number>();
    for (const row of receivablesByShop) {
      receivablesMap.set(row.shop_id, row._sum.balance ?? 0);
    }

    const debtsMap = new Map<string, number>();
    for (const row of debtsByShop) {
      debtsMap.set(row.shop_id, row._sum.balance ?? 0);
    }

    const stockValueMap = new Map<string, number>();
    for (const batch of batchesByShop) {
      const value = batch.remaining_quantity * batch.cost_price;
      stockValueMap.set(batch.shop_id, (stockValueMap.get(batch.shop_id) ?? 0) + value);
    }

    const lowStockMap = new Map<string, number>();
    for (const product of lowStockProducts) {
      const stock = product.stock_batches.reduce((s, b) => s + b.remaining_quantity, 0);
      if (stock <= product.alert_threshold) {
        lowStockMap.set(product.shop_id, (lowStockMap.get(product.shop_id) ?? 0) + 1);
      }
    }

    const perShop: PerShopFinancialHealth[] = shops.map(shop => {
      const revenue = revenueMap.get(shop.id) ?? 0;
      const cashIn = cashInMap.get(shop.id) ?? 0;
      const cashOut = cashOutMap.get(shop.id) ?? 0;
      const cashBalance = cashIn - cashOut;
      const receivables = receivablesMap.get(shop.id) ?? 0;
      const supplierDebts = debtsMap.get(shop.id) ?? 0;
      const stockValue = stockValueMap.get(shop.id) ?? 0;
      const lowStockCount = lowStockMap.get(shop.id) ?? 0;

      return {
        shop_id: shop.id,
        shop_name: shop.name,
        revenue,
        cash_balance: cashBalance,
        // net_cash_flow = solde net all-time (entrees - sorties). Avec une periode active,
        // cela reste base sur tous les mouvements car cash_balance est all-time ; le CA
        // (revenue) porte la dimension periode.
        net_cash_flow: cashBalance,
        receivables_outstanding: receivables,
        supplier_debts: supplierDebts,
        stock_value: stockValue,
        low_stock_count: lowStockCount,
        health_score: cashBalance + receivables + stockValue - supplierDebts,
      };
    });

    // Rollup entreprise = somme des fiches par boutique (sum(per_shop) == enterprise)
    const rollup = perShop.reduce(
      (acc, s) => ({
        revenue: acc.revenue + s.revenue,
        cash_balance: acc.cash_balance + s.cash_balance,
        net_cash_flow: acc.net_cash_flow + s.net_cash_flow,
        receivables_outstanding: acc.receivables_outstanding + s.receivables_outstanding,
        supplier_debts: acc.supplier_debts + s.supplier_debts,
        stock_value: acc.stock_value + s.stock_value,
        low_stock_count: acc.low_stock_count + s.low_stock_count,
        health_score: acc.health_score + s.health_score,
      }),
      {
        revenue: 0,
        cash_balance: 0,
        net_cash_flow: 0,
        receivables_outstanding: 0,
        supplier_debts: 0,
        stock_value: 0,
        low_stock_count: 0,
        health_score: 0,
      }
    );

    return {
      enterprise: {
        total_shops: shopIds.length,
        ...rollup,
      },
      per_shop: perShop,
      period,
    };
  }

  /**
   * Soft delete an enterprise
   */
  async delete(enterpriseId: string, userId: string, isSuperAdmin: boolean) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
      include: { shops: { where: { deleted: false } } },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    if (!isSuperAdmin && enterprise.owner_id !== userId) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }

    // Refuse deletion if enterprise has active shops
    if (enterprise.shops.length > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ${String(enterprise.shops.length)} boutique(s) active(s). Supprimez ou reassignez les boutiques d'abord.`
      );
    }

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
