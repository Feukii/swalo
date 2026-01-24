import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MovementType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un mouvement de stock
   */
  async createMovement(data: {
    shop_id: string;
    product_id: string;
    type: MovementType;
    qty: number;
    reason?: string;
    ref_type?: string;
    ref_id?: string;
    unit_cost?: number;
    device_id: string;
  }) {
    const movement = await this.prisma.inventoryMovement.create({
      data: {
        id: uuidv4(),
        shop_id: data.shop_id,
        product_id: data.product_id,
        type: data.type,
        qty: data.qty,
        reason: data.reason,
        ref_type: data.ref_type,
        ref_id: data.ref_id,
        unit_cost: data.unit_cost,
        device_id: data.device_id,
        client_op_id: `inv_${data.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      },
    });

    return movement;
  }

  /**
   * Calculer le stock actuel d'un produit
   */
  async calculateStock(product_id: string, shop_id: string): Promise<number> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        product_id,
        shop_id,
        deleted: false,
      },
    });

    let stock = 0;
    for (const movement of movements) {
      // All movement types use their qty directly:
      // - PURCHASE/INVENTORY: positive qty adds to stock
      // - SALE: negative qty (e.g., -5) subtracts from stock
      // - ADJUSTMENT: can be positive or negative
      stock += movement.qty;
    }

    return Math.max(0, stock); // Le stock ne peut pas être négatif
  }

  /**
   * Enregistrer une sortie de stock pour une vente
   * Note: quantity is passed as positive, but stored as negative to reduce stock
   */
  async recordSaleOut(data: {
    shop_id: string;
    product_id: string;
    quantity: number;
    sale_id?: string;
    device_id: string;
  }) {
    return this.createMovement({
      shop_id: data.shop_id,
      product_id: data.product_id,
      type: 'SALE',
      qty: -Math.abs(data.quantity), // Negative qty to reduce stock
      reason: 'Vente',
      ref_type: 'SALE',
      ref_id: data.sale_id,
      device_id: data.device_id,
    });
  }

  /**
   * Enregistrer une entrée de stock pour un approvisionnement
   */
  async recordStockIn(data: {
    shop_id: string;
    product_id: string;
    quantity: number;
    unit_cost?: number;
    reason?: string;
    device_id: string;
  }) {
    return this.createMovement({
      shop_id: data.shop_id,
      product_id: data.product_id,
      type: 'PURCHASE',
      qty: data.quantity,
      reason: data.reason || 'Approvisionnement',
      unit_cost: data.unit_cost,
      device_id: data.device_id,
    });
  }

  /**
   * Créer un lot de stock avec prix
   */
  async createStockBatch(data: {
    shop_id: string;
    product_id: string;
    quantity: number;
    cost_price: number;
    sell_price: number;
    notes?: string;
    device_id: string;
  }) {
    // Fermer la validité du lot précédent (si existe)
    const previousBatch = await this.prisma.stockBatch.findFirst({
      where: {
        shop_id: data.shop_id,
        product_id: data.product_id,
        price_valid_until: null,
        deleted: false,
      },
      orderBy: { created_at: 'desc' },
    });

    const now = new Date();

    return await this.prisma.$transaction(async tx => {
      // Si un lot précédent existe sans date de fin, le fermer
      if (previousBatch) {
        await tx.stockBatch.update({
          where: { id: previousBatch.id },
          data: { price_valid_until: now },
        });
      }

      // Créer le nouveau lot
      const batch = await tx.stockBatch.create({
        data: {
          shop_id: data.shop_id,
          product_id: data.product_id,
          quantity: data.quantity,
          remaining_quantity: data.quantity,
          cost_price: data.cost_price,
          sell_price: data.sell_price,
          price_valid_from: now,
          notes: data.notes,
        },
      });

      // Créer le mouvement de stock correspondant
      await tx.inventoryMovement.create({
        data: {
          id: uuidv4(),
          shop_id: data.shop_id,
          product_id: data.product_id,
          type: 'PURCHASE',
          qty: data.quantity,
          reason: `Nouveau lot - Prix achat: ${data.cost_price}, Prix vente: ${data.sell_price}`,
          unit_cost: data.cost_price,
          device_id: data.device_id,
          client_op_id: `batch_${data.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        },
      });

      // Mettre à jour le prix de vente du produit si différent
      await tx.product.update({
        where: { id: data.product_id },
        data: {
          cost_price: data.cost_price,
          sell_price: data.sell_price,
        },
      });

      return batch;
    });
  }

  /**
   * Récupérer tous les lots d'un produit
   */
  async getProductBatches(shop_id: string, product_id: string) {
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        shop_id,
        product_id,
        deleted: false,
      },
      orderBy: { created_at: 'asc' },
    });

    // Calculer les statistiques
    const totalQuantity = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
    const totalValue = batches.reduce((sum, b) => sum + b.remaining_quantity * b.cost_price, 0);

    return {
      batches,
      stats: {
        total_batches: batches.length,
        batches_with_stock: batches.filter(b => b.remaining_quantity > 0).length,
        total_quantity: totalQuantity,
        total_value: totalValue,
      },
    };
  }

  /**
   * Déduire du stock selon la logique FIFO (First In, First Out)
   * @returns Les lots utilisés avec les quantités déduites de chacun
   */
  async deductStockFIFO(data: {
    shop_id: string;
    product_id: string;
    quantity: number;
    device_id: string;
    sale_id?: string;
  }): Promise<{ batch_id: string; quantity: number; sell_price: number }[]> {
    let remainingToDeduct = data.quantity;
    const usedBatches: { batch_id: string; quantity: number; sell_price: number }[] = [];

    // Récupérer les lots avec stock disponible, triés par date (FIFO)
    const batches = await this.prisma.stockBatch.findMany({
      where: {
        shop_id: data.shop_id,
        product_id: data.product_id,
        remaining_quantity: { gt: 0 },
        deleted: false,
      },
      orderBy: { created_at: 'asc' }, // FIFO - les plus anciens d'abord
    });

    // Vérifier qu'il y a assez de stock
    const totalAvailable = batches.reduce((sum, b) => sum + b.remaining_quantity, 0);
    if (totalAvailable < data.quantity) {
      throw new BadRequestException(
        `Stock insuffisant. Disponible: ${totalAvailable}, Demandé: ${data.quantity}`
      );
    }

    // Déduire du stock en FIFO
    await this.prisma.$transaction(async tx => {
      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const toDeduct = Math.min(batch.remaining_quantity, remainingToDeduct);

        // Mettre à jour le lot
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: {
            remaining_quantity: batch.remaining_quantity - toDeduct,
          },
        });

        usedBatches.push({
          batch_id: batch.id,
          quantity: toDeduct,
          sell_price: batch.sell_price,
        });

        remainingToDeduct -= toDeduct;
      }

      // Créer le mouvement de stock
      await tx.inventoryMovement.create({
        data: {
          id: uuidv4(),
          shop_id: data.shop_id,
          product_id: data.product_id,
          type: 'SALE',
          qty: -data.quantity,
          reason: 'Vente (FIFO)',
          ref_type: data.sale_id ? 'SALE' : undefined,
          ref_id: data.sale_id,
          device_id: data.device_id,
          client_op_id: `sale_${data.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        },
      });
    });

    return usedBatches;
  }

  /**
   * Déduire du stock d'un lot spécifique (sélection manuelle)
   */
  async deductFromBatch(data: {
    shop_id: string;
    product_id: string;
    batch_id: string;
    quantity: number;
    device_id: string;
    sale_id?: string;
  }) {
    const batch = await this.prisma.stockBatch.findFirst({
      where: {
        id: data.batch_id,
        shop_id: data.shop_id,
        product_id: data.product_id,
        deleted: false,
      },
    });

    if (!batch) {
      throw new BadRequestException('Lot non trouvé');
    }

    if (batch.remaining_quantity < data.quantity) {
      throw new BadRequestException(
        `Stock insuffisant dans ce lot. Disponible: ${batch.remaining_quantity}, Demandé: ${data.quantity}`
      );
    }

    return await this.prisma.$transaction(async tx => {
      // Mettre à jour le lot
      await tx.stockBatch.update({
        where: { id: data.batch_id },
        data: {
          remaining_quantity: batch.remaining_quantity - data.quantity,
        },
      });

      // Créer le mouvement de stock
      await tx.inventoryMovement.create({
        data: {
          id: uuidv4(),
          shop_id: data.shop_id,
          product_id: data.product_id,
          type: 'SALE',
          qty: -data.quantity,
          reason: `Vente (Lot: ${data.batch_id.substring(0, 8)})`,
          ref_type: data.sale_id ? 'SALE' : undefined,
          ref_id: data.sale_id,
          device_id: data.device_id,
          client_op_id: `sale_${data.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        },
      });

      return {
        batch_id: data.batch_id,
        quantity: data.quantity,
        sell_price: batch.sell_price,
      };
    });
  }
}
