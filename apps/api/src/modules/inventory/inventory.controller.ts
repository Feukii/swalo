import { Controller, Post, Get, Body, Param, Headers } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MovementType, Role } from '@prisma/client';

interface CurrentUserPayload {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  /**
   * POST /api/inventory/movements
   * Créer un mouvement de stock
   */
  @Post('movements')
  async createMovement(
    @Body()
    data: {
      product_id: string;
      type: MovementType;
      qty: number;
      reason?: string;
      ref_type?: string;
      ref_id?: string;
      unit_cost?: number;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.createMovement({
      shop_id: user.shopId,
      product_id: data.product_id,
      type: data.type,
      qty: data.qty,
      reason: data.reason,
      ref_type: data.ref_type,
      ref_id: data.ref_id,
      unit_cost: data.unit_cost,
      device_id: deviceId ?? 'unknown',
    });
  }

  /**
   * POST /api/inventory/sale-out
   * Enregistrer une sortie de stock pour une vente
   */
  @Post('sale-out')
  async recordSaleOut(
    @Body()
    data: {
      product_id: string;
      quantity: number;
      sale_id?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.recordSaleOut({
      shop_id: user.shopId,
      product_id: data.product_id,
      quantity: data.quantity,
      sale_id: data.sale_id,
      device_id: deviceId ?? 'unknown',
    });
  }

  /**
   * POST /api/inventory/stock-in
   * Enregistrer une entrée de stock
   */
  @Post('stock-in')
  async recordStockIn(
    @Body()
    data: {
      product_id: string;
      quantity: number;
      unit_cost?: number;
      reason?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.recordStockIn({
      shop_id: user.shopId,
      product_id: data.product_id,
      quantity: data.quantity,
      unit_cost: data.unit_cost,
      reason: data.reason,
      device_id: deviceId ?? 'unknown',
    });
  }

  /**
   * POST /api/inventory/batches
   * Créer un nouveau lot de stock avec prix
   */
  @Post('batches')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  async createStockBatch(
    @Body()
    data: {
      product_id: string;
      quantity: number;
      cost_price: number;
      sell_price: number;
      notes?: string;
      received_at?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.createStockBatch({
      shop_id: user.shopId,
      product_id: data.product_id,
      quantity: data.quantity,
      cost_price: data.cost_price,
      sell_price: data.sell_price,
      notes: data.notes,
      price_valid_from: data.received_at ? new Date(data.received_at) : undefined,
      device_id: deviceId ?? 'unknown',
    });
  }

  /**
   * GET /api/inventory/products/:productId/batches
   * Récupérer tous les lots d'un produit
   */
  @Get('products/:productId/batches')
  async getProductBatches(
    @Param('productId') productId: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    return this.inventoryService.getProductBatches(user.shopId, productId);
  }

  /**
   * POST /api/inventory/sale-fifo
   * Vendre avec déduction FIFO automatique
   */
  @Post('sale-fifo')
  async saleWithFIFO(
    @Body()
    data: {
      product_id: string;
      quantity: number;
      sale_id?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.deductStockFIFO({
      shop_id: user.shopId,
      product_id: data.product_id,
      quantity: data.quantity,
      sale_id: data.sale_id,
      device_id: deviceId ?? 'unknown',
    });
  }

  /**
   * POST /api/inventory/sale-from-batch
   * Vendre depuis un lot spécifique
   */
  @Post('sale-from-batch')
  async saleFromBatch(
    @Body()
    data: {
      product_id: string;
      batch_id: string;
      quantity: number;
      sale_id?: string;
    },
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.inventoryService.deductFromBatch({
      shop_id: user.shopId,
      product_id: data.product_id,
      batch_id: data.batch_id,
      quantity: data.quantity,
      sale_id: data.sale_id,
      device_id: deviceId ?? 'unknown',
    });
  }
}
