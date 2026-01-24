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
  Headers,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { BatchUpdateHierarchyDto } from './dto/batch-update-hierarchy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  /**
   * GET /api/products
   * Récupérer tous les produits avec filtres optionnels
   */
  @Get()
  findAll(@CurrentUser() user: any, @Query() query: SearchProductDto) {
    return this.productsService.findAll(user.shopId, query);
  }

  /**
   * GET /api/products/stats
   * Obtenir les statistiques des produits
   */
  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.productsService.getStats(user.shopId);
  }

  /**
   * GET /api/products/categories
   * Récupérer les catégories uniques
   */
  @Get('categories')
  getCategories(@CurrentUser() user: any) {
    return this.productsService.getCategories(user.shopId);
  }

  /**
   * GET /api/products/filters
   * Récupérer tous les filtres disponibles (familles, marques, types d'article)
   * Supporte le filtrage en cascade avec query params
   */
  @Get('filters')
  getFilters(
    @CurrentUser() user: any,
    @Query('family') family?: string,
    @Query('article_type') articleType?: string,
    @Query('brand') brand?: string
  ) {
    return this.productsService.getFilters(user.shopId, {
      family,
      article_type: articleType,
      brand,
    });
  }

  /**
   * GET /api/products/families
   * Récupérer les familles uniques
   */
  @Get('families')
  getFamilies(@CurrentUser() user: any) {
    return this.productsService.getFamilies(user.shopId);
  }

  /**
   * GET /api/products/brands
   * Récupérer les marques uniques
   */
  @Get('brands')
  getBrands(@CurrentUser() user: any) {
    return this.productsService.getBrands(user.shopId);
  }

  /**
   * GET /api/products/article-types
   * Récupérer les types d'article uniques
   */
  @Get('article-types')
  getArticleTypes(@CurrentUser() user: any) {
    return this.productsService.getArticleTypes(user.shopId);
  }

  /**
   * GET /api/products/low-stock
   * Récupérer les produits en stock faible
   */
  @Get('low-stock')
  getLowStock(@CurrentUser() user: any) {
    return this.productsService.getLowStockProducts(user.shopId);
  }

  /**
   * GET /api/products/sku/:sku
   * Récupérer un produit par SKU
   */
  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string, @CurrentUser() user: any) {
    return this.productsService.findBySku(sku, user.shopId);
  }

  /**
   * GET /api/products/:id
   * Récupérer un produit par ID avec son stock
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, user.shopId);
  }

  /**
   * POST /api/products
   * Créer un nouveau produit (OWNER, MANAGER)
   */
  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.productsService.create(user.shopId, dto, deviceId);
  }

  /**
   * POST /api/products/batch-update-hierarchy
   * Mettre à jour un niveau de hiérarchie en masse (OWNER, MANAGER)
   */
  @Post('batch-update-hierarchy')
  @Roles(Role.OWNER, Role.MANAGER)
  batchUpdateHierarchy(@Body() dto: BatchUpdateHierarchyDto, @CurrentUser() user: any) {
    return this.productsService.batchUpdateHierarchy(user.shopId, dto);
  }

  /**
   * PUT /api/products/:id
   * Mettre à jour un produit (OWNER, MANAGER)
   */
  @Put(':id')
  @Roles(Role.OWNER, Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.productsService.update(id, user.shopId, dto, deviceId);
  }

  /**
   * DELETE /api/products/:id
   * Supprimer un produit (OWNER uniquement)
   */
  @Delete(':id')
  @Roles(Role.OWNER)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.shopId);
  }
}
