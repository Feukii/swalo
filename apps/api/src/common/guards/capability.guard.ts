import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import {
  REQUIRED_CAPABILITY_KEY,
  type RequiredCapability,
} from '../decorators/require-capability.decorator';
import {
  resolveEffectivePermissions,
  can,
  CAPABILITY_LABELS,
  type Role,
} from '@swalo/core/modules/permissions';

interface RequestUser {
  userId: string;
  shopId: string;
  role: Role;
}

/**
 * Garde d'autorisation fine basée sur la matrice de permissions partagée.
 *
 * - Sans métadonnée `@RequireCapability`, laisse passer (n'impacte pas les
 *   endpoints existants).
 * - SUPERADMIN contourne toujours.
 * - Sinon, résout les permissions effectives du rôle pour la boutique courante
 *   (config boutique > défaut entreprise > défauts intégrés) et refuse en 403
 *   si la capacité requise n'est pas accordée.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredCapability | undefined>(
      REQUIRED_CAPABILITY_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required) {
      return true; // Aucune capacité requise : laisser passer
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      return true; // Endpoint sans authentification : laisser le reste décider
    }

    // SUPERADMIN contourne toujours
    if (user.role === 'SUPERADMIN') {
      return true;
    }

    // Robuste si pas de boutique rattachée
    if (!user.shopId) {
      throw this.forbidden(required);
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: user.shopId },
      select: {
        module_permissions: true,
        enterprise: { select: { default_module_permissions: true } },
      },
    });

    const effective = resolveEffectivePermissions(
      user.role,
      shop?.module_permissions,
      shop?.enterprise.default_module_permissions
    );

    if (!can(effective, required.module, required.capability)) {
      throw this.forbidden(required);
    }

    return true;
  }

  private forbidden(required: RequiredCapability): ForbiddenException {
    const capabilityLabel = CAPABILITY_LABELS[required.capability];
    return new ForbiddenException({
      statusCode: 403,
      code: 'CAPABILITY_DENIED',
      module: required.module,
      capability: required.capability,
      message: `Action non autorisée : ${capabilityLabel} sur "${required.module}". Contactez votre administrateur.`,
    });
  }
}
