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
import { PackagingTypesService } from './packaging-types.service';
import { CreatePackagingTypeDto } from './dto/create-packaging-type.dto';
import { UpdatePackagingTypeDto } from './dto/update-packaging-type.dto';

@Controller('packaging-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagingTypesController {
  constructor(private readonly packagingTypesService: PackagingTypesService) {}

  /**
   * POST /api/packaging-types
   * Créer un nouveau type de conditionnement
   */
  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  async create(@Req() req: any, @Body() dto: CreatePackagingTypeDto) {
    return this.packagingTypesService.create(req.user.shopId, dto);
  }

  /**
   * GET /api/packaging-types
   * Récupérer tous les types de conditionnement
   */
  @Get()
  async getAll(@Req() req: any, @Query('include_product_count') includeProductCount?: string) {
    return this.packagingTypesService.getAll(req.user.shopId, includeProductCount === 'true');
  }

  /**
   * POST /api/packaging-types/init-defaults
   * Initialiser les conditionnements par défaut
   */
  @Post('init-defaults')
  @Roles(Role.OWNER, Role.MANAGER)
  async initDefaults(@Req() req: any) {
    return this.packagingTypesService.initDefaults(req.user.shopId);
  }

  /**
   * GET /api/packaging-types/:id
   * Récupérer un type de conditionnement par ID
   */
  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.packagingTypesService.getOne(req.user.shopId, id);
  }

  /**
   * PUT /api/packaging-types/:id
   * Mettre à jour un type de conditionnement
   */
  @Put(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePackagingTypeDto) {
    return this.packagingTypesService.update(req.user.shopId, id, dto);
  }

  /**
   * DELETE /api/packaging-types/:id
   * Supprimer un type de conditionnement
   */
  @Delete(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.packagingTypesService.delete(req.user.shopId, id);
  }
}
