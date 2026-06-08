import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Récupérer le rôle de l'utilisateur pour la boutique courante
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        user_id: user.userId,
        shop_id: user.shopId,
        deleted: false,
      },
    });

    if (!userRole) {
      return false;
    }

    // SUPERADMIN bypasses all role checks
    if (userRole.role === Role.SUPERADMIN) {
      return true;
    }

    return requiredRoles.some(role => userRole.role === role);
  }
}
