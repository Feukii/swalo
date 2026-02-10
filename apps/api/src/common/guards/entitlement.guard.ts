import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_MODULE_KEY } from '../decorators/require-module.decorator';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredModule) {
      return true; // Pas de module requis
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    // SUPERADMIN bypass le guard
    if (user.role === 'SUPERADMIN') {
      return true;
    }

    if (!user.shopId) {
      return true;
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: user.shopId },
      select: { enabled_modules: true },
    });

    if (!shop) {
      return true;
    }

    // Si enabled_modules est vide, autoriser tout (retrocompatibilite)
    if (shop.enabled_modules.length === 0) {
      return true;
    }

    if (!shop.enabled_modules.includes(requiredModule)) {
      throw new ForbiddenException(
        `Le module "${requiredModule}" n'est pas active pour cette boutique. Contactez votre administrateur.`
      );
    }

    return true;
  }
}
