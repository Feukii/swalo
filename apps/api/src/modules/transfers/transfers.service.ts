import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { v4 as uuidv4 } from 'uuid';

const TRANSFER_DEVICE_ID = 'SYSTEM_TRANSFER';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService
  ) {}

  /**
   * Create a new inter-shop transfer
   */
  async create(userId: string, dto: CreateTransferDto) {
    // Validate both shops exist and belong to same enterprise
    const [sourceShop, targetShop] = await Promise.all([
      this.prisma.shop.findUnique({ where: { id: dto.source_shop_id, deleted: false } }),
      this.prisma.shop.findUnique({ where: { id: dto.target_shop_id, deleted: false } }),
    ]);

    if (!sourceShop) {
      throw new NotFoundException('Boutique source non trouvee');
    }
    if (!targetShop) {
      throw new NotFoundException('Boutique cible non trouvee');
    }

    if (sourceShop.id === targetShop.id) {
      throw new BadRequestException('La source et la cible doivent etre des boutiques differentes');
    }

    if (!sourceShop.enterprise_id || !targetShop.enterprise_id) {
      throw new BadRequestException(
        'Les deux boutiques doivent appartenir a une entreprise pour effectuer un transfert'
      );
    }

    if (sourceShop.enterprise_id !== targetShop.enterprise_id) {
      throw new BadRequestException('Les deux boutiques doivent appartenir a la meme entreprise');
    }

    const enterpriseId = sourceShop.enterprise_id;

    // Calculate totals for items
    const itemsWithTotals = dto.items.map(item => ({
      product_sku: item.product_sku,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_price: item.cost_price,
      total: item.quantity * item.unit_price,
    }));

    // Create the transfer in DRAFT status
    const transfer = await this.prisma.interShopTransfer.create({
      data: {
        enterprise_id: enterpriseId,
        source_shop_id: dto.source_shop_id,
        target_shop_id: dto.target_shop_id,
        status: 'DRAFT',
        notes: dto.notes,
        created_by: userId,
        items: {
          create: itemsWithTotals.map(item => ({
            product_sku: item.product_sku,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price: item.cost_price,
            total: item.total,
          })),
        },
      },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        target_shop: { select: { id: true, code: true, name: true, shop_type: true } },
      },
    });

    return transfer;
  }

  /**
   * Confirm a transfer — destock from source, stock in target
   */
  async confirm(transferId: string, userId: string) {
    const transfer = await this.prisma.interShopTransfer.findUnique({
      where: { id: transferId, deleted: false },
      include: {
        items: true,
        source_shop: true,
        target_shop: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfert non trouve');
    }

    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(
        `Le transfert ne peut pas etre confirme (statut actuel: ${transfer.status})`
      );
    }

    // Verify user has access to the enterprise
    await this.verifyEnterpriseAccess(transfer.enterprise_id, userId);

    await this.prisma.$transaction(async tx => {
      for (const item of transfer.items) {
        // Find the product in source shop by SKU
        const sourceProduct = await tx.product.findFirst({
          where: {
            shop_id: transfer.source_shop_id,
            sku: item.product_sku,
            deleted: false,
          },
        });

        if (!sourceProduct) {
          throw new BadRequestException(
            `Produit "${item.product_name}" (SKU: ${item.product_sku}) non trouve dans la boutique source`
          );
        }

        // Check available stock in source
        const stockResult = await tx.stockBatch.aggregate({
          where: {
            shop_id: transfer.source_shop_id,
            product_id: sourceProduct.id,
            remaining_quantity: { gt: 0 },
            deleted: false,
          },
          _sum: { remaining_quantity: true },
        });

        const availableStock = stockResult._sum.remaining_quantity || 0;
        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour "${item.product_name}". Disponible: ${availableStock}, Demande: ${item.quantity}`
          );
        }

        // FIFO destock from source
        await this.deductStockFIFO(
          tx,
          transfer.source_shop_id,
          sourceProduct.id,
          item.quantity,
          transferId
        );

        // Create inventory movement on source (SALE type = outgoing)
        await tx.inventoryMovement.create({
          data: {
            id: uuidv4(),
            shop_id: transfer.source_shop_id,
            product_id: sourceProduct.id,
            type: 'SALE',
            qty: -item.quantity,
            reason: `Transfert vers ${transfer.target_shop.name} (${transfer.target_shop.code})`,
            ref_type: 'TRANSFER',
            ref_id: transferId,
            device_id: TRANSFER_DEVICE_ID,
            client_op_id: `transfer_out_${transferId}_${item.id}`,
          },
        });

        // Find or create product in target shop by SKU
        let targetProduct = await tx.product.findFirst({
          where: {
            shop_id: transfer.target_shop_id,
            sku: item.product_sku,
            deleted: false,
          },
        });

        if (!targetProduct) {
          // Auto-create product in target shop
          targetProduct = await tx.product.create({
            data: {
              id: uuidv4(),
              shop_id: transfer.target_shop_id,
              sku: item.product_sku,
              name: item.product_name,
              cost_price: item.cost_price,
              sell_price: item.unit_price,
              device_id: TRANSFER_DEVICE_ID,
              client_op_id: `transfer_product_${transferId}_${item.id}`,
            },
          });
        }

        // Create stock batch in target shop
        await tx.stockBatch.create({
          data: {
            shop_id: transfer.target_shop_id,
            product_id: targetProduct.id,
            quantity: item.quantity,
            remaining_quantity: item.quantity,
            cost_price: item.cost_price,
            sell_price: item.unit_price,
            notes: `Transfert depuis ${transfer.source_shop.name} (${transfer.source_shop.code})`,
          },
        });

        // Create inventory movement on target (PURCHASE type = incoming)
        await tx.inventoryMovement.create({
          data: {
            id: uuidv4(),
            shop_id: transfer.target_shop_id,
            product_id: targetProduct.id,
            type: 'PURCHASE',
            qty: item.quantity,
            reason: `Transfert depuis ${transfer.source_shop.name} (${transfer.source_shop.code})`,
            ref_type: 'TRANSFER',
            ref_id: transferId,
            unit_cost: item.cost_price,
            device_id: TRANSFER_DEVICE_ID,
            client_op_id: `transfer_in_${transferId}_${item.id}`,
          },
        });
      }

      // Update transfer status
      await tx.interShopTransfer.update({
        where: { id: transferId },
        data: {
          status: 'CONFIRMED',
          version: { increment: 1 },
        },
      });
    });

    return this.findOne(transferId);
  }

  /**
   * Mark transfer as shipped
   */
  async ship(transferId: string, userId: string) {
    const transfer = await this.prisma.interShopTransfer.findUnique({
      where: { id: transferId, deleted: false },
    });

    if (!transfer) {
      throw new NotFoundException('Transfert non trouve');
    }

    if (transfer.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Le transfert ne peut pas etre expedie (statut actuel: ${transfer.status})`
      );
    }

    await this.verifyEnterpriseAccess(transfer.enterprise_id, userId);

    return this.prisma.interShopTransfer.update({
      where: { id: transferId },
      data: {
        status: 'SHIPPED',
        version: { increment: 1 },
      },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true } },
        target_shop: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Confirm receipt of a transfer
   */
  async receive(transferId: string, userId: string) {
    const transfer = await this.prisma.interShopTransfer.findUnique({
      where: { id: transferId, deleted: false },
    });

    if (!transfer) {
      throw new NotFoundException('Transfert non trouve');
    }

    if (transfer.status !== 'SHIPPED' && transfer.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Le transfert ne peut pas etre recu (statut actuel: ${transfer.status})`
      );
    }

    await this.verifyEnterpriseAccess(transfer.enterprise_id, userId);

    return this.prisma.interShopTransfer.update({
      where: { id: transferId },
      data: {
        status: 'RECEIVED',
        version: { increment: 1 },
      },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true } },
        target_shop: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Cancel a transfer and rollback stock if already confirmed
   */
  async cancel(transferId: string, userId: string) {
    const transfer = await this.prisma.interShopTransfer.findUnique({
      where: { id: transferId, deleted: false },
      include: {
        items: true,
        source_shop: true,
        target_shop: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfert non trouve');
    }

    if (transfer.status === 'CANCELLED') {
      throw new BadRequestException('Le transfert est deja annule');
    }

    if (transfer.status === 'RECEIVED') {
      throw new BadRequestException('Un transfert deja recu ne peut pas etre annule');
    }

    await this.verifyEnterpriseAccess(transfer.enterprise_id, userId);

    // If confirmed or shipped, rollback stock movements
    if (transfer.status === 'CONFIRMED' || transfer.status === 'SHIPPED') {
      await this.prisma.$transaction(async tx => {
        for (const item of transfer.items) {
          // Restore source stock
          const sourceProduct = await tx.product.findFirst({
            where: {
              shop_id: transfer.source_shop_id,
              sku: item.product_sku,
              deleted: false,
            },
          });

          if (sourceProduct) {
            // Find the last batch that was deducted and restore
            const sourceBatch = await tx.stockBatch.findFirst({
              where: {
                shop_id: transfer.source_shop_id,
                product_id: sourceProduct.id,
                deleted: false,
              },
              orderBy: { created_at: 'desc' },
            });

            if (sourceBatch) {
              await tx.stockBatch.update({
                where: { id: sourceBatch.id },
                data: {
                  remaining_quantity: { increment: item.quantity },
                },
              });
            }

            // Create reversal movement on source
            await tx.inventoryMovement.create({
              data: {
                id: uuidv4(),
                shop_id: transfer.source_shop_id,
                product_id: sourceProduct.id,
                type: 'ADJUSTMENT',
                qty: item.quantity,
                reason: `Annulation transfert vers ${transfer.target_shop.name}`,
                ref_type: 'TRANSFER',
                ref_id: transferId,
                device_id: TRANSFER_DEVICE_ID,
                client_op_id: `transfer_cancel_src_${transferId}_${item.id}`,
              },
            });
          }

          // Remove stock from target
          const targetProduct = await tx.product.findFirst({
            where: {
              shop_id: transfer.target_shop_id,
              sku: item.product_sku,
              deleted: false,
            },
          });

          if (targetProduct) {
            // Find the batch created by this transfer
            const targetBatch = await tx.stockBatch.findFirst({
              where: {
                shop_id: transfer.target_shop_id,
                product_id: targetProduct.id,
                notes: { contains: transfer.source_shop.code },
                deleted: false,
              },
              orderBy: { created_at: 'desc' },
            });

            if (targetBatch) {
              const newRemaining = Math.max(0, targetBatch.remaining_quantity - item.quantity);
              await tx.stockBatch.update({
                where: { id: targetBatch.id },
                data: { remaining_quantity: newRemaining },
              });
            }

            // Create reversal movement on target
            await tx.inventoryMovement.create({
              data: {
                id: uuidv4(),
                shop_id: transfer.target_shop_id,
                product_id: targetProduct.id,
                type: 'ADJUSTMENT',
                qty: -item.quantity,
                reason: `Annulation transfert depuis ${transfer.source_shop.name}`,
                ref_type: 'TRANSFER',
                ref_id: transferId,
                device_id: TRANSFER_DEVICE_ID,
                client_op_id: `transfer_cancel_tgt_${transferId}_${item.id}`,
              },
            });
          }
        }

        await tx.interShopTransfer.update({
          where: { id: transferId },
          data: {
            status: 'CANCELLED',
            version: { increment: 1 },
          },
        });
      });
    } else {
      // DRAFT: just cancel, no stock to rollback
      await this.prisma.interShopTransfer.update({
        where: { id: transferId },
        data: {
          status: 'CANCELLED',
          version: { increment: 1 },
        },
      });
    }

    return this.findOne(transferId);
  }

  /**
   * Find all transfers for an enterprise
   */
  async findAllByEnterprise(enterpriseId: string) {
    return this.prisma.interShopTransfer.findMany({
      where: {
        enterprise_id: enterpriseId,
        deleted: false,
      },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        target_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        creator: { select: { id: true, display_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Find all transfers where a shop is source or target
   */
  async findAllByShop(shopId: string) {
    return this.prisma.interShopTransfer.findMany({
      where: {
        deleted: false,
        OR: [{ source_shop_id: shopId }, { target_shop_id: shopId }],
      },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        target_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        creator: { select: { id: true, display_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Find one transfer by ID
   */
  async findOne(transferId: string) {
    const transfer = await this.prisma.interShopTransfer.findUnique({
      where: { id: transferId, deleted: false },
      include: {
        items: true,
        source_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        target_shop: { select: { id: true, code: true, name: true, shop_type: true } },
        creator: { select: { id: true, display_name: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfert non trouve');
    }

    return transfer;
  }

  /**
   * FIFO stock deduction within a transaction
   */
  private async deductStockFIFO(
    tx: any,
    shopId: string,
    productId: string,
    quantity: number,
    _refId: string
  ) {
    let remainingToDeduct = quantity;

    const batches = await tx.stockBatch.findMany({
      where: {
        shop_id: shopId,
        product_id: productId,
        remaining_quantity: { gt: 0 },
        deleted: false,
      },
      orderBy: { created_at: 'asc' },
    });

    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;

      const toDeduct = Math.min(batch.remaining_quantity, remainingToDeduct);

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: {
          remaining_quantity: batch.remaining_quantity - toDeduct,
        },
      });

      remainingToDeduct -= toDeduct;
    }

    if (remainingToDeduct > 0) {
      throw new BadRequestException(`Stock insuffisant. Il manque ${remainingToDeduct} unites.`);
    }
  }

  /**
   * Verify that user has access to enterprise (is owner or SUPERADMIN)
   */
  private async verifyEnterpriseAccess(enterpriseId: string, userId: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId, deleted: false },
    });

    if (!enterprise) {
      throw new NotFoundException('Entreprise non trouvee');
    }

    // Check if user is the enterprise owner
    if (enterprise.owner_id === userId) {
      return;
    }

    // Check if user has a role in any shop of this enterprise
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        user_id: userId,
        deleted: false,
        shop: {
          enterprise_id: enterpriseId,
          deleted: false,
        },
      },
    });

    if (!userRole) {
      throw new ForbiddenException('Acces non autorise a cette entreprise');
    }
  }
}
