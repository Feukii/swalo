import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class ReceivablesService {
  constructor(private prisma: PrismaService) {}

  async create(shopId: string, dto: CreateReceivableDto) {
    // Pour les montants négatifs (remboursements/ajustements de solde),
    // le statut est automatiquement 'PAID' car ce n'est pas une dette en attente
    const isNegativeAmount = dto.amount < 0;
    const status = isNegativeAmount ? 'PAID' : 'PENDING';
    const description =
      dto.description || (isNegativeAmount ? 'Remboursement - Ajustement de solde' : undefined);

    // Vérifier la limite de crédit pour les montants positifs (nouvelles créances)
    if (!isNegativeAmount && dto.amount > 0) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customer_id, shop_id: shopId, deleted: false },
      });

      if (customer && customer.credit_limit > 0) {
        // Calculer le solde actuel des créances en cours
        const activeReceivables = await this.prisma.clientReceivable.findMany({
          where: {
            customer_id: dto.customer_id,
            shop_id: shopId,
            deleted: false,
            status: { in: ['PENDING', 'PARTIAL'] },
          },
        });
        const currentBalance = activeReceivables.reduce((sum, r) => sum + r.balance, 0);

        if (currentBalance + dto.amount > customer.credit_limit) {
          throw new BadRequestException(
            `Limite de crédit dépassée. Solde actuel : ${currentBalance} FCFA, ` +
              `nouvelle créance : ${dto.amount} FCFA, ` +
              `limite : ${customer.credit_limit} FCFA`
          );
        }
      }
    }

    const receivable = await this.prisma.clientReceivable.create({
      data: {
        amount: dto.amount,
        paid_amount: 0,
        balance: dto.amount,
        description,
        notes: dto.notes,
        status,
        shop: {
          connect: { id: shopId },
        },
        customer: {
          connect: { id: dto.customer_id },
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
          },
        },
      },
    });

    return receivable;
  }

  async getAll(
    shopId: string,
    filters?: {
      customer_id?: string;
      status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
    }
  ) {
    const where = {
      shop_id: shopId,
      deleted: false,
      ...(filters?.customer_id && { customer_id: filters.customer_id }),
      ...(filters?.status && { status: filters.status }),
    };

    const receivables = await this.prisma.clientReceivable.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
          },
        },
        payments: {
          where: { deleted: false },
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return receivables;
  }

  async getOne(shopId: string, id: string) {
    const receivable = await this.prisma.clientReceivable.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
            email: true,
          },
        },
        payments: {
          where: { deleted: false },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!receivable) {
      throw new NotFoundException('Receivable not found');
    }

    return receivable;
  }

  async addPayment(shopId: string, receivableId: string, dto: CreatePaymentDto) {
    const receivable = await this.getOne(shopId, receivableId);

    if (receivable.status === 'PAID') {
      throw new BadRequestException('Receivable is already fully paid');
    }

    if (receivable.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add payment to cancelled receivable');
    }

    // Permettre les paiements excédentaires (dépassement de dette)
    // Le solde peut devenir négatif, indiquant un montant à rendre au client

    // Créer le paiement et mettre à jour la créance dans une transaction
    const result = await this.prisma.$transaction(async tx => {
      const payment = await tx.clientReceivablePayment.create({
        data: {
          amount: dto.amount,
          notes: dto.note,
          receivable: {
            connect: { id: receivableId },
          },
        },
      });

      const newPaidAmount = receivable.paid_amount + dto.amount;
      const newBalance = receivable.balance - dto.amount;
      // Le statut est PAID si le solde est <= 0 (payé ou dépassé)
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

      const updatedReceivable = await tx.clientReceivable.update({
        where: { id: receivableId },
        data: {
          paid_amount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              first_name: true,
              phone: true,
            },
          },
          payments: {
            where: { deleted: false },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      return {
        payment,
        receivable: updatedReceivable,
        overpayment: newBalance < 0 ? Math.abs(newBalance) : 0,
      };
    });

    return result;
  }

  async cancel(shopId: string, id: string) {
    const receivable = await this.getOne(shopId, id);

    if (receivable.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a fully paid receivable');
    }

    if (receivable.paid_amount > 0) {
      throw new BadRequestException('Cannot cancel receivable with existing payments');
    }

    const updated = await this.prisma.clientReceivable.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
          },
        },
      },
    });

    return updated;
  }

  async delete(shopId: string, id: string) {
    const receivable = await this.getOne(shopId, id);

    if (receivable.paid_amount > 0) {
      throw new BadRequestException('Cannot delete receivable with payments');
    }

    await this.prisma.clientReceivable.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Receivable deleted successfully' };
  }

  async getStats(shopId: string) {
    const receivables = await this.prisma.clientReceivable.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        status: {
          in: ['PENDING', 'PARTIAL'],
        },
      },
    });

    const totalReceivable = receivables.reduce((sum, r) => sum + r.balance, 0);
    const pendingCount = receivables.filter(r => r.status === 'PENDING').length;
    const partialCount = receivables.filter(r => r.status === 'PARTIAL').length;

    return {
      totalReceivable,
      pendingCount,
      partialCount,
      totalCount: receivables.length,
    };
  }
}
