import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

/**
 * Input shape for a bulk hierarchy update. `level` is the name of the product
 * field to rewrite (family, article_type, brand, reference); the optional
 * fields further restrict which products are affected.
 */
interface BatchUpdateHierarchyInput {
  level: string;
  old_value: string;
  new_value: string;
  family?: string;
  article_type?: string;
  brand?: string;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau produit
   */
  async create(shopId: string, dto: CreateProductDto, deviceId?: string) {
    this.logger.log(`Creating product: sku=${dto.sku}, name=${dto.name}, shopId=${shopId}`);

    // Validation de base
    if (!shopId) {
      this.logger.error('shopId is missing');
      throw new BadRequestException('Shop ID manquant');
    }

    if (!dto.sku || !dto.name) {
      this.logger.error(`Missing required fields: sku=${dto.sku}, name=${dto.name}`);
      throw new BadRequestException('SKU et nom sont requis');
    }

    try {
      // Vérifier l'unicité du SKU dans la boutique
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          shop_id: shopId,
          sku: dto.sku,
          deleted: false,
        },
      });

      if (existingProduct) {
        this.logger.warn(`SKU already exists: ${dto.sku}`);
        throw new ConflictException(`Un produit avec le SKU "${dto.sku}" existe déjà`);
      }

      // Créer le produit
      const product = await this.prisma.product.create({
        data: {
          id: uuidv4(),
          shop_id: shopId,
          sku: dto.sku,
          barcode: dto.barcode,
          name: dto.name,
          description: dto.description,
          category: dto.category,
          family: dto.family,
          article_type: dto.article_type,
          brand: dto.brand,
          reference: dto.reference,
          unit: dto.unit ?? 'unit',
          packaging_type_id: dto.packaging_type_id,
          units_per_package: dto.units_per_package,
          package_price: dto.package_price,
          tax_rate: dto.tax_rate ?? 0,
          cost_price: dto.cost_price,
          sell_price: dto.sell_price,
          is_active: dto.is_active ?? true,
          alert_threshold: dto.alert_threshold ?? 5,
          image_url: dto.image_url,
          device_id: deviceId,
          client_op_id: uuidv4(),
        },
      });

      this.logger.log(`Product created successfully: id=${product.id}, sku=${product.sku}`);

      // Récupérer le produit avec son stock
      return await this.findOneWithStock(product.id, shopId);
    } catch (error) {
      // Re-throw si c'est déjà une exception HTTP
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      // Log l'erreur avec détails
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma error creating product: code=${error.code}, meta=${JSON.stringify(error.meta)}`,
          error.stack
        );

        // Gérer les erreurs Prisma spécifiques
        if (error.code === 'P2002') {
          const rawTarget = error.meta?.target;
          const target = Array.isArray(rawTarget) ? rawTarget.map(t => String(t)) : [];
          throw new ConflictException(`Contrainte unique violée: ${target.join(', ')}`);
        }
      } else {
        this.logger.error(
          `Error creating product: ${(error as Error).message}`,
          (error as Error).stack
        );
      }

      throw error;
    }
  }

  /**
   * Récupérer tous les produits avec leur stock
   */
  async findAll(shopId: string, query?: SearchProductDto) {
    const where: Prisma.ProductWhereInput = {
      shop_id: shopId,
      deleted: false,
    };

    // Filtres
    if (query?.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.family) {
      where.family = query.family;
    }

    if (query?.brand) {
      where.brand = query.brand;
    }

    if (query?.article_type) {
      where.article_type = query.article_type;
    }

    if (query?.search) {
      where.OR = [
        { sku: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Tri
    const sortOrder: Prisma.SortOrder = query?.sort_order ?? 'asc';
    const orderBy: Prisma.ProductOrderByWithRelationInput = query?.sort_by
      ? { [query.sort_by]: sortOrder }
      : { created_at: 'desc' };

    const products = await this.prisma.product.findMany({
      where,
      orderBy,
    });

    // Calculer le stock et les infos multi-prix pour chaque produit
    const productsWithStock = await Promise.all(
      products.map(async product => {
        const stock = await this.calculateStock(product.id, shopId);

        // Vérifier si le produit a des prix multiples (batches actifs avec prix différents)
        const activeBatches = await this.prisma.stockBatch.findMany({
          where: {
            shop_id: shopId,
            product_id: product.id,
            remaining_quantity: { gt: 0 },
            deleted: false,
          },
          select: { sell_price: true },
        });

        const distinctPrices = [...new Set(activeBatches.map(b => b.sell_price))].sort(
          (a, b) => a - b
        );
        const is_multi_price = distinctPrices.length > 1;

        return {
          ...product,
          current_stock: stock,
          is_low_stock: stock <= product.alert_threshold,
          is_multi_price,
          price_min: distinctPrices.length > 0 ? distinctPrices[0] : product.sell_price,
          price_max:
            distinctPrices.length > 0
              ? distinctPrices[distinctPrices.length - 1]
              : product.sell_price,
        };
      })
    );

    return productsWithStock;
  }

  /**
   * Récupérer un produit par ID avec son stock
   */
  async findOne(id: string, shopId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop_id: shopId, deleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    return this.findOneWithStock(id, shopId);
  }

  /**
   * Récupérer un produit par SKU
   */
  async findBySku(sku: string, shopId: string) {
    const product = await this.prisma.product.findFirst({
      where: { sku, shop_id: shopId, deleted: false },
    });

    if (!product) {
      throw new NotFoundException(`Produit avec SKU "${sku}" non trouvé`);
    }

    return this.findOneWithStock(product.id, shopId);
  }

  /**
   * Mettre à jour un produit
   */
  async update(id: string, shopId: string, dto: UpdateProductDto, deviceId?: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop_id: shopId, deleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    // Si le SKU change, vérifier l'unicité
    if (dto.sku && dto.sku !== product.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          shop_id: shopId,
          sku: dto.sku,
          deleted: false,
          id: { not: id },
        },
      });

      if (existingProduct) {
        throw new ConflictException(`Un produit avec le SKU "${dto.sku}" existe déjà`);
      }
    }

    // Mettre à jour le produit - convert dto to plain object
    const {
      name,
      sku,
      barcode,
      description,
      category,
      family,
      article_type,
      brand,
      reference,
      unit,
      packaging_type_id,
      units_per_package,
      package_price,
      tax_rate,
      cost_price,
      sell_price,
      is_active,
      alert_threshold,
      image_url,
    } = dto;
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(barcode !== undefined && { barcode }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(family !== undefined && { family }),
        ...(article_type !== undefined && { article_type }),
        ...(brand !== undefined && { brand }),
        ...(reference !== undefined && { reference }),
        ...(unit !== undefined && { unit }),
        ...(packaging_type_id !== undefined && { packaging_type_id }),
        ...(units_per_package !== undefined && { units_per_package }),
        ...(package_price !== undefined && { package_price }),
        ...(tax_rate !== undefined && { tax_rate }),
        ...(cost_price !== undefined && { cost_price }),
        ...(sell_price !== undefined && { sell_price }),
        ...(is_active !== undefined && { is_active }),
        ...(alert_threshold !== undefined && { alert_threshold }),
        ...(image_url !== undefined && { image_url }),
        version: { increment: 1 },
        device_id: deviceId,
      },
    });

    return this.findOneWithStock(updatedProduct.id, shopId);
  }

  /**
   * Supprimer un produit (soft delete)
   */
  async remove(id: string, shopId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, shop_id: shopId, deleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
        version: { increment: 1 },
      },
    });

    return { message: 'Produit supprimé avec succès' };
  }

  /**
   * Récupérer les catégories uniques
   */
  async getCategories(shopId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });

    return products.map(p => p.category).filter(Boolean);
  }

  /**
   * Récupérer les familles uniques
   */
  async getFamilies(shopId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        family: { not: null },
      },
      select: { family: true },
      distinct: ['family'],
    });

    return products.map(p => p.family).filter(Boolean);
  }

  /**
   * Récupérer les marques uniques
   */
  async getBrands(shopId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        brand: { not: null },
      },
      select: { brand: true },
      distinct: ['brand'],
    });

    return products.map(p => p.brand).filter(Boolean);
  }

  /**
   * Récupérer les types d'articles uniques
   */
  async getArticleTypes(shopId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        article_type: { not: null },
      },
      select: { article_type: true },
      distinct: ['article_type'],
    });

    return products.map(p => p.article_type).filter(Boolean);
  }

  /**
   * Récupérer tous les filtres disponibles (familles, marques, types)
   * Supporte le filtrage en cascade
   */
  async getFilters(
    shopId: string,
    filters?: { family?: string; article_type?: string; brand?: string }
  ) {
    const where: Prisma.ProductWhereInput = {
      shop_id: shopId,
      deleted: false,
    };

    // Appliquer les filtres de cascade
    if (filters?.family) {
      where.family = filters.family;
    }
    if (filters?.article_type) {
      where.article_type = filters.article_type;
    }
    if (filters?.brand) {
      where.brand = filters.brand;
    }

    // Récupérer les valeurs distinctes pour chaque niveau
    const [familiesData, brandsData, articleTypesData] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...where, family: { not: null } },
        select: { family: true },
        distinct: ['family'],
      }),
      this.prisma.product.findMany({
        where: { ...where, brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
      }),
      this.prisma.product.findMany({
        where: { ...where, article_type: { not: null } },
        select: { article_type: true },
        distinct: ['article_type'],
      }),
    ]);

    return {
      families: familiesData.map(p => p.family).filter(Boolean),
      brands: brandsData.map(p => p.brand).filter(Boolean),
      article_types: articleTypesData.map(p => p.article_type).filter(Boolean),
    };
  }

  /**
   * Récupérer les produits en stock faible
   */
  async getLowStockProducts(shopId: string) {
    const products = await this.findAll(shopId, { is_active: true });
    return products.filter(p => p.is_low_stock);
  }

  /**
   * Obtenir les statistiques des produits
   */
  async getStats(shopId: string) {
    const [totalProducts, activeProducts, lowStockProducts, totalValue] = await Promise.all([
      this.prisma.product.count({
        where: { shop_id: shopId, deleted: false },
      }),
      this.prisma.product.count({
        where: { shop_id: shopId, deleted: false, is_active: true },
      }),
      this.getLowStockProducts(shopId).then(products => products.length),
      this.calculateTotalInventoryValue(shopId),
    ]);

    return {
      total_products: totalProducts,
      active_products: activeProducts,
      low_stock_count: lowStockProducts,
      total_inventory_value: totalValue,
    };
  }

  /**
   * Calculer le stock actuel d'un produit
   * Stock = Somme de tous les mouvements (PURCHASE +, SALE -, ADJUSTMENT ±)
   */
  private async calculateStock(productId: string, shopId: string): Promise<number> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        product_id: productId,
        shop_id: shopId,
        deleted: false,
      },
      select: { qty: true },
    });

    const totalStock = movements.reduce((sum, movement) => sum + movement.qty, 0);
    return totalStock;
  }

  /**
   * Récupérer un produit avec son stock et historique de mouvements
   */
  private async findOneWithStock(productId: string, shopId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shop_id: shopId, deleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    const stock = await this.calculateStock(productId, shopId);

    const recentMovements = await this.prisma.inventoryMovement.findMany({
      where: {
        product_id: productId,
        shop_id: shopId,
        deleted: false,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return {
      ...product,
      current_stock: stock,
      is_low_stock: stock <= product.alert_threshold,
      recent_movements: recentMovements,
    };
  }

  /**
   * Calculer la valeur totale de l'inventaire
   */
  private async calculateTotalInventoryValue(shopId: string): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { shop_id: shopId, deleted: false },
      select: { id: true, cost_price: true },
    });

    let totalValue = 0;
    for (const product of products) {
      const stock = await this.calculateStock(product.id, shopId);
      totalValue += stock * product.cost_price;
    }

    return totalValue;
  }

  /**
   * Récupérer les prix de vente disponibles pour un produit (depuis les lots actifs)
   */
  async getAvailablePrices(productId: string, shopId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shop_id: shopId, deleted: false },
      select: { id: true, name: true, sell_price: true },
    });

    if (!product) {
      throw new NotFoundException('Produit non trouvé');
    }

    // Récupérer les lots avec du stock disponible
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        shop_id: shopId,
        product_id: productId,
        remaining_quantity: { gt: 0 },
        deleted: false,
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        sell_price: true,
        cost_price: true,
        remaining_quantity: true,
        created_at: true,
      },
    });

    // Grouper par prix de vente, en conservant les batch IDs
    const priceMap = new Map<
      number,
      {
        sell_price: number;
        total_quantity: number;
        batch_count: number;
        batches: { id: string; remaining_quantity: number; cost_price: number; created_at: Date }[];
      }
    >();
    for (const batch of batches) {
      const existing = priceMap.get(batch.sell_price);
      if (existing) {
        existing.total_quantity += batch.remaining_quantity;
        existing.batch_count += 1;
        existing.batches.push({
          id: batch.id,
          remaining_quantity: batch.remaining_quantity,
          cost_price: batch.cost_price,
          created_at: batch.created_at,
        });
      } else {
        priceMap.set(batch.sell_price, {
          sell_price: batch.sell_price,
          total_quantity: batch.remaining_quantity,
          batch_count: 1,
          batches: [
            {
              id: batch.id,
              remaining_quantity: batch.remaining_quantity,
              cost_price: batch.cost_price,
              created_at: batch.created_at,
            },
          ],
        });
      }
    }

    const prices = Array.from(priceMap.values()).sort((a, b) => a.sell_price - b.sell_price);
    const is_multi_price = prices.length > 1;

    return {
      product_id: product.id,
      product_name: product.name,
      default_price: product.sell_price,
      prices,
      total_stock: batches.reduce((sum, b) => sum + b.remaining_quantity, 0),
      is_multi_price,
    };
  }

  /**
   * Mettre à jour un niveau de hiérarchie en masse
   */
  async batchUpdateHierarchy(shopId: string, dto: BatchUpdateHierarchyInput) {
    // Construire le where pour filtrer les produits
    const where: Prisma.ProductWhereInput = {
      shop_id: shopId,
      deleted: false,
      [dto.level]: dto.old_value,
    };

    // Appliquer les filtres optionnels
    if (dto.family) {
      where.family = dto.family;
    }
    if (dto.article_type) {
      where.article_type = dto.article_type;
    }
    if (dto.brand) {
      where.brand = dto.brand;
    }

    // Effectuer la mise à jour en masse
    const result = await this.prisma.product.updateMany({
      where,
      data: {
        [dto.level]: dto.new_value,
        version: { increment: 1 }, // Incrémenter la version pour la concurrence optimiste
      },
    });

    return {
      count: result.count,
      message: `${String(result.count)} produit(s) mis à jour avec succès`,
    };
  }
}
