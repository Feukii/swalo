import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SearchSaleDto } from './dto/search-sale.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste toutes les ventes d'une boutique avec filtres
   */
  async findAll(shopId: string, query: SearchSaleDto) {
    const where: any = {
      shop_id: shopId,
      deleted: false,
    };

    if (query.customer_id) {
      where.customer_id = query.customer_id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.start_date || query.end_date) {
      where.created_at = {};
      if (query.start_date) {
        where.created_at.gte = new Date(query.start_date);
      }
      if (query.end_date) {
        where.created_at.lte = new Date(query.end_date);
      }
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        cashier: {
          select: {
            id: true,
            display_name: true,
          },
        },
        items: {
          where: { deleted: false },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return sales;
  }

  /**
   * Statistiques des ventes
   */
  async getStats(shopId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalSales, todaySales, completedSales] = await Promise.all([
      this.prisma.sale.count({
        where: {
          shop_id: shopId,
          deleted: false,
        },
      }),
      this.prisma.sale.count({
        where: {
          shop_id: shopId,
          deleted: false,
          created_at: { gte: today },
        },
      }),
      this.prisma.sale.aggregate({
        where: {
          shop_id: shopId,
          deleted: false,
          status: 'COMPLETED',
        },
        _sum: {
          grand_total: true,
        },
      }),
    ]);

    return {
      total_sales: totalSales,
      today_sales: todaySales,
      total_revenue: completedSales._sum.grand_total || 0,
    };
  }

  /**
   * Récupère une vente par ID
   */
  async findOne(shopId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        customer: true,
        cashier: {
          select: {
            id: true,
            display_name: true,
            email: true,
          },
        },
        items: {
          where: { deleted: false },
          include: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Vente ${id} non trouvée`);
    }

    return sale;
  }

  /**
   * Crée une nouvelle vente
   */
  async create(shopId: string, cashierId: string, dto: CreateSaleDto) {
    // Vérifier que les produits existent et récupérer leurs infos
    const productIds = dto.items.map(item => item.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        shop_id: shopId,
        deleted: false,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Un ou plusieurs produits sont invalides');
    }

    // Créer un map pour accès rapide
    const productMap = new Map(products.map(p => [p.id, p]));

    // Vérifier le stock disponible via les lots FIFO pour chaque produit
    // (la deduction reelle se fait dans la transaction ci-dessous)
    if (dto.status === 'COMPLETED') {
      for (const item of dto.items) {
        const product = productMap.get(item.product_id);
        if (!product) continue;

        const batches = await this.prisma.stockBatch.findMany({
          where: {
            shop_id: shopId,
            product_id: item.product_id,
            remaining_quantity: { gt: 0 },
            deleted: false,
          },
        });

        const totalAvailable = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);

        if (totalAvailable < item.qty) {
          throw new BadRequestException(
            `Stock insuffisant pour ${product.name}. Disponible: ${totalAvailable}, Demandé: ${item.qty}`
          );
        }
      }
    }

    // Calculer les totaux
    let subtotal = 0;
    const saleItems = dto.items.map(item => {
      const product = productMap.get(item.product_id);
      const itemSubtotal = Math.round(item.unit_price * item.qty);
      const itemDiscount = item.discount || 0;
      const itemTaxRate = product?.tax_rate || 0;
      const itemNetAmount = itemSubtotal - itemDiscount;
      const itemTaxTotal = Math.round(itemNetAmount * itemTaxRate);
      const itemTotal = itemNetAmount + itemTaxTotal;

      subtotal += itemSubtotal;

      return {
        id: uuidv4(),
        product_id: item.product_id,
        product_name: product?.name || '',
        sku: product?.sku || '',
        qty: item.qty,
        unit_price: item.unit_price,
        discount: itemDiscount,
        tax_rate: itemTaxRate,
        subtotal: itemSubtotal,
        tax_total: itemTaxTotal,
        total: itemTotal,
      };
    });

    const globalDiscount = dto.discount || 0;
    const netTotal = subtotal - globalDiscount;

    // Calculer le total des taxes de tous les items
    const taxTotal = saleItems.reduce((sum, item) => sum + item.tax_total, 0);

    const grandTotal = netTotal + taxTotal;

    // Créer la vente avec transaction (inclut le destockage FIFO)
    const sale = await this.prisma.$transaction(async tx => {
      // Si COMPLETED, effectuer le destockage FIFO ou par lot spécifique
      const batchAssignments = new Map<string, string>(); // saleItem index -> primary batch_id

      if (dto.status === 'COMPLETED') {
        for (const item of dto.items) {
          if (item.batch_id) {
            // Destockage depuis un lot spécifique (choix utilisateur)
            const batch = await tx.stockBatch.findFirst({
              where: {
                id: item.batch_id,
                shop_id: shopId,
                product_id: item.product_id,
                deleted: false,
              },
            });

            if (!batch) {
              throw new BadRequestException(
                `Lot ${item.batch_id} non trouvé pour le produit ${item.product_id}`
              );
            }

            if (batch.remaining_quantity < item.qty) {
              throw new BadRequestException(
                `Stock insuffisant dans le lot sélectionné. Disponible: ${batch.remaining_quantity}, Demandé: ${item.qty}`
              );
            }

            await tx.stockBatch.update({
              where: { id: item.batch_id },
              data: { remaining_quantity: batch.remaining_quantity - item.qty },
            });

            batchAssignments.set(item.product_id, item.batch_id);
          } else {
            // Destockage FIFO automatique
            let remainingToDeduct = item.qty;

            // Récupérer les lots avec stock, triés FIFO
            const batches = await tx.stockBatch.findMany({
              where: {
                shop_id: shopId,
                product_id: item.product_id,
                remaining_quantity: { gt: 0 },
                deleted: false,
              },
              orderBy: { created_at: 'asc' },
            });

            let primaryBatchId: string | null = null;

            for (const batch of batches) {
              if (remainingToDeduct <= 0) break;

              const toDeduct = Math.min(batch.remaining_quantity, remainingToDeduct);

              await tx.stockBatch.update({
                where: { id: batch.id },
                data: { remaining_quantity: batch.remaining_quantity - toDeduct },
              });

              if (!primaryBatchId) {
                primaryBatchId = batch.id;
              }

              remainingToDeduct -= toDeduct;
            }

            if (primaryBatchId) {
              batchAssignments.set(item.product_id, primaryBatchId);
            }
          }
        }
      }

      // Ajouter batch_id aux items si disponible
      const saleItemsWithBatch = saleItems.map(item => ({
        ...item,
        batch_id: batchAssignments.get(item.product_id) || null,
      }));

      // Créer la vente
      const newSale = await tx.sale.create({
        data: {
          id: uuidv4(),
          shop_id: shopId,
          cashier_id: cashierId,
          customer_id: dto.customer_id || null,
          status: dto.status || 'DRAFT',
          payment_method: 'CASH',
          subtotal,
          discount: globalDiscount,
          tax_total: taxTotal,
          net_total: netTotal,
          grand_total: grandTotal,
          paid_total: dto.status === 'COMPLETED' ? grandTotal : 0,
          change: 0,
          notes: dto.notes || null,
          device_id: dto.device_id || '',
          items: {
            create: saleItemsWithBatch,
          },
        },
        include: {
          items: true,
          customer: true,
          cashier: {
            select: {
              id: true,
              display_name: true,
            },
          },
        },
      });

      // Si COMPLETED, créer les mouvements de stock avec ref_id = sale ID
      if (dto.status === 'COMPLETED') {
        for (const item of dto.items) {
          await tx.inventoryMovement.create({
            data: {
              id: uuidv4(),
              shop_id: shopId,
              product_id: item.product_id,
              type: 'SALE',
              qty: -Math.abs(item.qty),
              reason: 'Vente (FIFO)',
              ref_type: 'SALE',
              ref_id: newSale.id,
              device_id: dto.device_id || '',
              client_op_id: `sale_${dto.device_id || 'web'}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            },
          });
        }
      }

      return newSale;
    });

    return sale;
  }

  /**
   * Annule une vente
   */
  async cancel(shopId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        items: true,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Vente ${id} non trouvée`);
    }

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException('Cette vente est déjà annulée');
    }

    // Annuler avec transaction
    const updatedSale = await this.prisma.$transaction(async tx => {
      // Mettre à jour le statut
      const updated = await tx.sale.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        include: {
          items: true,
          customer: true,
          cashier: {
            select: {
              id: true,
              display_name: true,
            },
          },
        },
      });

      // Si la vente était COMPLETED, restaurer le stock et les lots
      if (sale.status === 'COMPLETED') {
        for (const item of sale.items) {
          // Créer le mouvement de stock inverse
          await tx.inventoryMovement.create({
            data: {
              id: uuidv4(),
              shop_id: shopId,
              product_id: item.product_id,
              type: 'ADJUSTMENT',
              qty: Math.abs(item.qty), // Positif pour retour
              reason: `Annulation vente ${id}`,
              ref_type: 'CANCEL',
              ref_id: id,
              device_id: '',
              client_op_id: `cancel_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            },
          });

          // Restaurer le remaining_quantity du lot si batch_id est connu
          if (item.batch_id) {
            await tx.stockBatch.update({
              where: { id: item.batch_id },
              data: {
                remaining_quantity: { increment: Math.abs(item.qty) },
              },
            });
          }
        }
      }

      return updated;
    });

    return updatedSale;
  }

  /**
   * Supprime (soft delete) une vente
   */
  async remove(shopId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
    });

    if (!sale) {
      throw new NotFoundException(`Vente ${id} non trouvée`);
    }

    if (sale.status === 'COMPLETED') {
      throw new BadRequestException(
        "Impossible de supprimer une vente terminée. Annulez-la d'abord."
      );
    }

    await this.prisma.sale.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Vente supprimée avec succès' };
  }
}
