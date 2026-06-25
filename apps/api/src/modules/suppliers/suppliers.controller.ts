import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { ClaimRefundDto } from './dto/claim-refund.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

type AuthenticatedRequest = Request & {
  user: { userId: string; shopId: string; role: Role };
};

@Controller('suppliers')
@RequireModule('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  /**
   * POST /api/suppliers
   * Créer un nouveau fournisseur
   */
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(req.user.shopId, dto);
  }

  /**
   * GET /api/suppliers
   * Récupérer tous les fournisseurs
   */
  @Get()
  async getAll(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('is_active') isActive?: string
  ) {
    return this.suppliersService.getAll(req.user.shopId, {
      search,
      is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /api/suppliers/stats
   * Statistiques des fournisseurs
   */
  @Get('stats')
  async getStats(@Req() req: AuthenticatedRequest) {
    return this.suppliersService.getStats(req.user.shopId);
  }

  /**
   * GET /api/suppliers/duplicates
   * Détecter les fournisseurs avec des noms en doublons
   */
  @Get('duplicates')
  @Roles(Role.BOSS, Role.MANAGER)
  async findDuplicates(@Req() req: AuthenticatedRequest) {
    return this.suppliersService.findDuplicates(req.user.shopId);
  }

  /**
   * POST /api/suppliers/merge
   * Fusionner deux fournisseurs
   */
  @Post('merge')
  @Roles(Role.BOSS, Role.MANAGER)
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { keep_id: string; merge_id: string }
  ) {
    return this.suppliersService.merge(req.user.shopId, dto.keep_id, dto.merge_id);
  }

  /**
   * GET /api/suppliers/:id
   * Récupérer un fournisseur par ID
   */
  @Get(':id')
  async getOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.suppliersService.getOne(req.user.shopId, id);
  }

  /**
   * POST /api/suppliers/:id/claim-refund
   * Réclamer un remboursement au fournisseur (quand solde négatif)
   */
  @Post(':id/claim-refund')
  @Roles(Role.BOSS, Role.MANAGER)
  async claimRefund(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ClaimRefundDto
  ) {
    return this.suppliersService.claimRefund(req.user.shopId, id, req.user.userId, dto);
  }

  /**
   * PUT /api/suppliers/:id
   * Mettre à jour un fournisseur
   */
  @Put(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto
  ) {
    return this.suppliersService.update(req.user.shopId, id, dto);
  }

  /**
   * DELETE /api/suppliers/:id
   * Supprimer un fournisseur
   */
  @Delete(':id')
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.suppliersService.delete(req.user.shopId, id);
  }
}
