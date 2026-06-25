import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePackagingTypeDto } from './dto/create-packaging-type.dto';
import { UpdatePackagingTypeDto } from './dto/update-packaging-type.dto';

@Injectable()
export class PackagingTypesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau type de conditionnement
   */
  async create(shopId: string, dto: CreatePackagingTypeDto) {
    // Vérifier si un conditionnement avec le même nom existe déjà (case-insensitive)
    const existing = await this.prisma.packagingType.findFirst({
      where: {
        shop_id: shopId,
        name: {
          equals: dto.name,
          mode: 'insensitive',
        },
        deleted: false,
      },
    });

    if (existing) {
      throw new BadRequestException('Un conditionnement avec ce nom existe déjà');
    }

    return this.prisma.packagingType.create({
      data: {
        shop_id: shopId,
        name: dto.name,
        symbol: dto.symbol,
        is_default: dto.is_default ?? false,
      },
    });
  }

  /**
   * Récupérer tous les types de conditionnement d'une boutique
   */
  async getAll(shopId: string, includeProductCount = false) {
    const types = await this.prisma.packagingType.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      orderBy: [{ is_default: 'desc' }, { name: 'asc' }],
    });

    if (!includeProductCount) {
      return types;
    }

    // Ajouter le nombre de produits utilisant chaque type
    return Promise.all(
      types.map(async type => {
        const product_count = await this.prisma.product.count({
          where: {
            shop_id: shopId,
            unit: type.name,
            deleted: false,
          },
        });
        return { ...type, product_count };
      })
    );
  }

  /**
   * Récupérer un type de conditionnement par ID
   */
  async getOne(shopId: string, id: string) {
    const packagingType = await this.prisma.packagingType.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
    });

    if (!packagingType) {
      throw new NotFoundException('Conditionnement non trouvé');
    }

    return packagingType;
  }

  /**
   * Mettre à jour un type de conditionnement
   */
  async update(shopId: string, id: string, dto: UpdatePackagingTypeDto) {
    await this.getOne(shopId, id);

    // Vérifier si le nouveau nom existe déjà
    if (dto.name) {
      const existing = await this.prisma.packagingType.findFirst({
        where: {
          shop_id: shopId,
          name: {
            equals: dto.name,
            mode: 'insensitive',
          },
          deleted: false,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException('Un conditionnement avec ce nom existe déjà');
      }
    }

    return this.prisma.packagingType.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });
  }

  /**
   * Compter le nombre de produits utilisant un type de conditionnement
   */
  async getProductCount(shopId: string, id: string): Promise<number> {
    const packagingType = await this.getOne(shopId, id);
    return this.prisma.product.count({
      where: {
        shop_id: shopId,
        unit: packagingType.name,
        deleted: false,
      },
    });
  }

  /**
   * Supprimer (soft delete) un type de conditionnement
   */
  async delete(shopId: string, id: string) {
    const packagingType = await this.getOne(shopId, id);

    // Empêcher la suppression des conditionnements par défaut
    if (packagingType.is_default) {
      throw new BadRequestException('Impossible de supprimer un conditionnement par défaut');
    }

    // Empêcher la suppression si des produits utilisent ce type
    const productCount = await this.prisma.product.count({
      where: {
        shop_id: shopId,
        unit: packagingType.name,
        deleted: false,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer ce conditionnement: ${String(productCount)} produit(s) l'utilisent`
      );
    }

    await this.prisma.packagingType.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Conditionnement supprimé avec succès' };
  }

  /**
   * Initialiser les conditionnements par défaut pour une boutique
   */
  async initDefaults(shopId: string) {
    const defaults = [
      { name: 'Pièce', symbol: 'pce', is_default: true },
      { name: 'Carton', symbol: 'ctn', is_default: false },
      { name: 'Douzaine', symbol: 'dz', is_default: false },
      { name: 'Paquet', symbol: 'pqt', is_default: false },
      { name: 'Boîte', symbol: 'bte', is_default: false },
      { name: 'Unité', symbol: 'u', is_default: false },
      { name: 'Kilogramme', symbol: 'kg', is_default: false },
      { name: 'Gramme', symbol: 'g', is_default: false },
      { name: 'Litre', symbol: 'l', is_default: false },
    ];

    for (const item of defaults) {
      const existing = await this.prisma.packagingType.findFirst({
        where: {
          shop_id: shopId,
          name: {
            equals: item.name,
            mode: 'insensitive',
          },
        },
      });

      if (!existing) {
        await this.prisma.packagingType.create({
          data: {
            shop_id: shopId,
            ...item,
          },
        });
      }
    }

    return { message: 'Conditionnements par défaut initialisés' };
  }
}
