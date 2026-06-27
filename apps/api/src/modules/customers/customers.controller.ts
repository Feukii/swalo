import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { Role } from '@prisma/client';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

@Controller('customers')
@RequireModule('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * POST /api/customers
   * Créer un nouveau client
   */
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.shopId, dto);
  }

  /**
   * GET /api/customers
   * Récupérer tous les clients
   */
  @Get()
  async getAll(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('is_active') isActive?: string
  ) {
    return this.customersService.getAll(req.user.shopId, {
      search,
      is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /api/customers/stats
   * Statistiques des clients
   */
  @Get('stats')
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.customersService.getStats(req.user.shopId);
  }

  /**
   * GET /api/customers/duplicates
   * Détecter les clients avec des noms en doublons
   */
  @Get('duplicates')
  @Roles(Role.BOSS, Role.MANAGER)
  async findDuplicates(@Req() req: AuthenticatedRequest) {
    return this.customersService.findDuplicates(req.user.shopId);
  }

  /**
   * POST /api/customers/merge
   * Fusionner deux clients
   */
  @Post('merge')
  @Roles(Role.BOSS, Role.MANAGER)
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { keep_id: string; merge_id: string }
  ) {
    return this.customersService.merge(req.user.shopId, dto.keep_id, dto.merge_id);
  }

  /**
   * GET /api/customers/:id
   * Récupérer un client par ID
   */
  @Get(':id')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.customersService.getOne(req.user.shopId, id);
  }

  /**
   * POST /api/customers/:id/refund
   * Créer un remboursement client
   */
  @Post(':id/refund')
  @Roles(Role.BOSS, Role.MANAGER, Role.EMPLOYEE)
  @RequireCapability('receivables', 'refund')
  async createRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto
  ) {
    return this.customersService.createRefund(req.user.shopId, id, req.user.userId, dto);
  }

  /**
   * GET /api/customers/:id/refunds
   * Récupérer l'historique des remboursements d'un client
   */
  @Get(':id/refunds')
  async getRefundHistory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.customersService.getRefundHistory(req.user.shopId, id);
  }

  /**
   * PUT /api/customers/:id
   * Mettre à jour un client
   */
  @Put(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto
  ) {
    return this.customersService.update(req.user.shopId, id, dto);
  }

  /**
   * DELETE /api/customers/:id
   * Supprimer un client
   */
  @Delete(':id')
  @RequireCapability('customers', 'delete')
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.customersService.delete(req.user.shopId, id);
  }
}
