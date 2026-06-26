import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePinInviteDto } from './dto/create-pin-invite.dto';

@Injectable()
export class PinInvitesService {
  constructor(private prisma: PrismaService) {}

  // Générer un code PIN aléatoire de 4 chiffres
  private generatePinCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async create(userId: string, shopId: string, dto: CreatePinInviteDto) {
    const pinCode = this.generatePinCode();

    // Par défaut, expiration dans 7 jours
    const validUntil = dto.expires_at
      ? new Date(dto.expires_at)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.pinInvite.create({
      data: {
        pin_code: pinCode,
        display_name: dto.invited_name,
        role: dto.role,
        valid_until: validUntil,
        shop_id: shopId,
        created_by: userId,
        is_active: true,
      },
    });

    return invite;
  }

  async getAll(
    shopId: string,
    filters?: {
      is_used?: boolean;
      is_expired?: boolean;
    }
  ) {
    const where: Prisma.PinInviteWhereInput = {
      shop_id: shopId,
      deleted: false,
    };

    // Filtre pour les codes utilisés/non utilisés
    if (filters?.is_used !== undefined) {
      if (filters.is_used) {
        where.used_by = { not: null };
      } else {
        where.used_by = null;
      }
    }

    const invites = await this.prisma.pinInvite.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    // Filtrer par expiration si nécessaire
    if (filters?.is_expired !== undefined) {
      const now = new Date();
      return invites.filter(invite => {
        const isExpired = invite.valid_until < now;
        return filters.is_expired ? isExpired : !isExpired;
      });
    }

    return invites;
  }

  async getOne(shopId: string, id: string) {
    const invite = await this.prisma.pinInvite.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
    });

    if (!invite) {
      throw new NotFoundException('PIN invite not found');
    }

    return invite;
  }

  async getByPinCode(pinCode: string) {
    const invite = await this.prisma.pinInvite.findFirst({
      where: {
        pin_code: pinCode,
        deleted: false,
        used_by: null, // Non utilisé
      },
    });

    if (!invite) {
      throw new NotFoundException('PIN code not found or already used');
    }

    // Vérifier si le code a expiré
    if (invite.valid_until < new Date()) {
      throw new BadRequestException('PIN code has expired');
    }

    return invite;
  }

  async markAsUsed(inviteId: string, userId: string) {
    const invite = await this.prisma.pinInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('PIN invite not found');
    }

    if (invite.used_by) {
      throw new BadRequestException('PIN code already used');
    }

    if (invite.valid_until < new Date()) {
      throw new BadRequestException('PIN code has expired');
    }

    const updated = await this.prisma.pinInvite.update({
      where: { id: inviteId },
      data: {
        used_by: userId,
        used_at: new Date(),
      },
    });

    return updated;
  }

  async revoke(shopId: string, id: string) {
    const invite = await this.getOne(shopId, id);

    if (invite.used_by) {
      throw new BadRequestException('Cannot revoke an already used PIN code');
    }

    await this.prisma.pinInvite.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'PIN invite revoked successfully' };
  }

  async getStats(shopId: string) {
    const invites = await this.prisma.pinInvite.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
    });

    const now = new Date();
    const activeInvites = invites.filter(i => !i.used_by && i.valid_until > now);
    const usedInvites = invites.filter(i => i.used_by);
    const expiredInvites = invites.filter(i => !i.used_by && i.valid_until <= now);

    return {
      totalInvites: invites.length,
      activeCount: activeInvites.length,
      usedCount: usedInvites.length,
      expiredCount: expiredInvites.length,
    };
  }
}
