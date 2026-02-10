import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlockStatusGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Pas d'utilisateur = endpoint public
    }

    // SUPERADMIN bypass le guard
    if (user.role === 'SUPERADMIN') {
      return true;
    }

    // Vérifier si l'utilisateur est bloqué
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { is_blocked: true, blocked_reason: true },
    });

    if (dbUser?.is_blocked) {
      throw new ForbiddenException(
        `Votre compte est bloqué. Raison : ${dbUser.blocked_reason ?? 'Non spécifiée'}. Contactez votre administrateur.`
      );
    }

    // Vérifier si la boutique est bloquée
    if (user.shopId) {
      const shop = await this.prisma.shop.findUnique({
        where: { id: user.shopId },
        select: { is_blocked: true, blocked_reason: true, enterprise_id: true },
      });

      if (shop?.is_blocked) {
        throw new ForbiddenException(
          `Cette boutique est bloquée. Raison : ${shop.blocked_reason ?? 'Non spécifiée'}. Contactez votre administrateur.`
        );
      }

      // Vérifier si l'entreprise est bloquée
      if (shop) {
        const enterprise = await this.prisma.enterprise.findUnique({
          where: { id: shop.enterprise_id },
          select: { is_blocked: true, blocked_reason: true },
        });

        if (enterprise?.is_blocked) {
          throw new ForbiddenException(
            `L'entreprise est bloquée. Raison : ${enterprise.blocked_reason ?? 'Non spécifiée'}. Contactez votre administrateur.`
          );
        }
      }
    }

    return true;
  }
}
