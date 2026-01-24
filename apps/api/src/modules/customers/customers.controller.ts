import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * POST /api/customers
   * Créer un nouveau client
   */
  @Post()
  async create(@Req() req: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.shopId, dto);
  }

  /**
   * GET /api/customers
   * Récupérer tous les clients
   */
  @Get()
  async getAll(
    @Req() req: any,
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
  async getStats(@Req() req: any) {
    return this.customersService.getStats(req.user.shopId);
  }

  /**
   * GET /api/customers/duplicates
   * Détecter les clients avec des noms en doublons
   */
  @Get('duplicates')
  @Roles(Role.OWNER, Role.MANAGER)
  async findDuplicates(@Req() req: any) {
    return this.customersService.findDuplicates(req.user.shopId);
  }

  /**
   * POST /api/customers/merge
   * Fusionner deux clients
   */
  @Post('merge')
  @Roles(Role.OWNER, Role.MANAGER)
  async merge(@Req() req: any, @Body() dto: { keep_id: string; merge_id: string }) {
    return this.customersService.merge(req.user.shopId, dto.keep_id, dto.merge_id);
  }

  /**
   * GET /api/customers/:id
   * Récupérer un client par ID
   */
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.customersService.getOne(req.user.shopId, id);
  }

  /**
   * POST /api/customers/:id/refund
   * Créer un remboursement client
   */
  @Post(':id/refund')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  async createRefund(@Req() req: any, @Param('id') id: string, @Body() dto: CreateRefundDto) {
    return this.customersService.createRefund(req.user.shopId, id, req.user.userId, dto);
  }

  /**
   * GET /api/customers/:id/refunds
   * Récupérer l'historique des remboursements d'un client
   */
  @Get(':id/refunds')
  async getRefundHistory(@Req() req: any, @Param('id') id: string) {
    return this.customersService.getRefundHistory(req.user.shopId, id);
  }

  /**
   * PUT /api/customers/:id
   * Mettre à jour un client
   */
  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(req.user.shopId, id, dto);
  }

  /**
   * DELETE /api/customers/:id
   * Supprimer un client
   */
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.customersService.delete(req.user.shopId, id);
  }
}
