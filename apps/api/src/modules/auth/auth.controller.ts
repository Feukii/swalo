import { Controller, Post, Body, UseGuards, Get, Request, Patch, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  PinLoginDto,
  CreateShopDto,
  UpdateShopCodeDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LocalAuthGuard as _LocalAuthGuard } from '../../common/guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/register
   * Inscription d'un nouveau propriétaire de boutique
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/auth/login
   * Connexion d'un utilisateur
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/auth/pin
   * Authentification par code Boutique + PIN (6 chiffres + 4 chiffres)
   * Conforme au CDC SWALO - Section 2
   */
  @Post('pin')
  async loginWithPin(@Body() dto: PinLoginDto) {
    const deviceInfo = dto.device_id
      ? {
          device_id: dto.device_id,
          device_name: dto.device_name,
          device_type: dto.device_type,
        }
      : undefined;

    return this.authService.loginWithPin(dto, deviceInfo);
  }

  /**
   * POST /api/auth/create-shop
   * Création rapide d'une boutique (Admin Web uniquement)
   * Génère automatiquement shop_code (6 chiffres) et PIN propriétaire (4 chiffres)
   */
  @Post('create-shop')
  async createShop(@Body() dto: CreateShopDto) {
    return this.authService.createShop(dto);
  }

  /**
   * GET /api/auth/verify-shop/:code
   * Vérifie si une boutique existe (endpoint public pour diagnostic)
   * Ne retourne pas de données sensibles
   */
  @Get('verify-shop/:code')
  async verifyShop(@Param('code') code: string) {
    return this.authService.verifyShopExists(code);
  }

  /**
   * POST /api/auth/refresh
   * Rafraîchissement du token
   */
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  /**
   * GET /api/auth/me
   * Récupère les infos de l'utilisateur connecté
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return this.authService.getUserWithRoles(req.user.userId);
  }

  /**
   * PATCH /api/auth/shop-code
   * Modification du code boutique par le propriétaire
   * Requiert confirmation du PIN
   */
  @UseGuards(JwtAuthGuard)
  @Patch('shop-code')
  async updateShopCode(@Request() req: any, @Body() dto: UpdateShopCodeDto) {
    return this.authService.updateShopCode(req.user.shopId, req.user.userId, dto);
  }

  /**
   * POST /api/auth/switch-shop
   * Switch to a different shop (multi-shop users)
   */
  @UseGuards(JwtAuthGuard)
  @Post('switch-shop')
  async switchShop(@Request() req: any, @Body() body: { shop_id: string }) {
    return this.authService.switchShop(req.user.userId, body.shop_id);
  }

  /**
   * GET /api/auth/accessible-shops
   * Get all shops accessible to the current user
   */
  @UseGuards(JwtAuthGuard)
  @Get('accessible-shops')
  async getAccessibleShops(@Request() req: any) {
    return this.authService.getAccessibleShops(req.user.userId);
  }
}
