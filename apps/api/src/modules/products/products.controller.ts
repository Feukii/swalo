import { Controller, Get, Post, Put, Delete, Body, Param, Query, Headers } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { BatchUpdateHierarchyDto } from './dto/batch-update-hierarchy.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireCapability } from '../../common/decorators/require-capability.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

interface AuthUser {
  userId: string;
  shopId: string;
  role: Role;
}

@Controller('products')
@RequireModule('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  /**
   * GET /api/products
   * Récupérer tous les produits avec filtres optionnels
   */
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: SearchProductDto) {
    return this.productsService.findAll(user.shopId, query);
  }

  /**
   * GET /api/products/stats
   * Obtenir les statistiques des produits
   */
  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.productsService.getStats(user.shopId);
  }

  /**
   * GET /api/products/categories
   * Récupérer les catégories uniques
   */
  @Get('categories')
  getCategories(@CurrentUser() user: AuthUser) {
    return this.productsService.getCategories(user.shopId);
  }

  /**
   * GET /api/products/filters
   * Récupérer tous les filtres disponibles (familles, marques, types d'article)
   * Supporte le filtrage en cascade avec query params
   */
  @Get('filters')
  getFilters(
    @CurrentUser() user: AuthUser,
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
  getFamilies(@CurrentUser() user: AuthUser) {
    return this.productsService.getFamilies(user.shopId);
  }

  /**
   * GET /api/products/brands
   * Récupérer les marques uniques
   */
  @Get('brands')
  getBrands(@CurrentUser() user: AuthUser) {
    return this.productsService.getBrands(user.shopId);
  }

  /**
   * GET /api/products/article-types
   * Récupérer les types d'article uniques
   */
  @Get('article-types')
  getArticleTypes(@CurrentUser() user: AuthUser) {
    return this.productsService.getArticleTypes(user.shopId);
  }

  /**
   * GET /api/products/low-stock
   * Récupérer les produits en stock faible
   */
  @Get('low-stock')
  getLowStock(@CurrentUser() user: AuthUser) {
    return this.productsService.getLowStockProducts(user.shopId);
  }

  /**
   * GET /api/products/sku/:sku
   * Récupérer un produit par SKU
   */
  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string, @CurrentUser() user: AuthUser) {
    return this.productsService.findBySku(sku, user.shopId);
  }

  /**
   * GET /api/products/:id/prices
   * Récupérer les prix de vente disponibles depuis les lots actifs
   */
  @Get(':id/prices')
  getAvailablePrices(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.getAvailablePrices(id, user.shopId);
  }

  /**
   * GET /api/products/:id
   * Récupérer un produit par ID avec son stock
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.findOne(id, user.shopId);
  }

  /**
   * POST /api/products
   * Créer un nouveau produit (OWNER, MANAGER)
   */
  @Post()
  @Roles(Role.BOSS, Role.MANAGER)
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.productsService.create(user.shopId, dto, deviceId);
  }

  /**
   * POST /api/products/batch-update-hierarchy
   * Mettre à jour un niveau de hiérarchie en masse (OWNER, MANAGER)
   */
  @Post('batch-update-hierarchy')
  @Roles(Role.BOSS, Role.MANAGER)
  batchUpdateHierarchy(@Body() dto: BatchUpdateHierarchyDto, @CurrentUser() user: AuthUser) {
    return this.productsService.batchUpdateHierarchy(user.shopId, dto);
  }

  /**
   * PUT /api/products/:id
   * Mettre à jour un produit (OWNER, MANAGER)
   */
  @Put(':id')
  @Roles(Role.BOSS, Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.productsService.update(id, user.shopId, dto, deviceId);
  }

  /**
   * DELETE /api/products/:id
   * Supprimer un produit (OWNER uniquement)
   */
  @Delete(':id')
  @Roles(Role.BOSS)
  @RequireCapability('products', 'delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productsService.remove(id, user.shopId);
  }
}
