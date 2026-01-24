import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';

@Injectable()
export class DebtsService {
  constructor(private prisma: PrismaService) {}

  async create(shopId: string, dto: CreateDebtDto) {
    const debt = await this.prisma.supplierDebt.create({
      data: {
        amount: dto.amount,
        paid_amount: 0,
        balance: dto.amount,
        description: dto.description,
        notes: dto.notes,
        status: 'PENDING',
        shop: {
          connect: { id: shopId },
        },
        supplier: {
          connect: { id: dto.supplier_id },
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            first_name: true,
            phone: true,
          },
        },
      },
    });

    return debt;
  }

  async getAll(
    shopId: string,
    filters?: {
      supplier_id?: string;
      status?: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
    }
  ) {
    const where = {
      shop_id: shopId,
      deleted: false,
      ...(filters?.supplier_id && { supplier_id: filters.supplier_id }),
      ...(filters?.status && { status: filters.status }),
    };

    const debts = await this.prisma.supplierDebt.findMany({
      where,
      include: {
        supplier: {
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

    return debts;
  }

  async getOne(shopId: string, id: string) {
    const debt = await this.prisma.supplierDebt.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        supplier: {
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

    if (!debt) {
      throw new NotFoundException('Debt not found');
    }

    return debt;
  }

  async addPayment(shopId: string, debtId: string, dto: CreateDebtPaymentDto) {
    const debt = await this.getOne(shopId, debtId);

    if (debt.status === 'PAID') {
      throw new BadRequestException('Debt is already fully paid');
    }

    if (debt.status === 'CANCELLED') {
      throw new BadRequestException('Cannot add payment to cancelled debt');
    }

    // Permettre les paiements excédentaires (dépassement de dette)
    // Le solde peut devenir négatif, indiquant un montant que le fournisseur doit rendre

    // Créer le paiement et mettre à jour la dette dans une transaction
    const result = await this.prisma.$transaction(async tx => {
      const payment = await tx.supplierDebtPayment.create({
        data: {
          amount: dto.amount,
          notes: dto.note,
          cash_exit_id: dto.cash_exit_id,
          debt: {
            connect: { id: debtId },
          },
        },
      });

      const newPaidAmount = debt.paid_amount + dto.amount;
      const newBalance = debt.balance - dto.amount;
      // Le statut est PAID si le solde est <= 0 (payé ou dépassé)
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

      const updatedDebt = await tx.supplierDebt.update({
        where: { id: debtId },
        data: {
          paid_amount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
        include: {
          supplier: {
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

      return { payment, debt: updatedDebt, overpayment: newBalance < 0 ? Math.abs(newBalance) : 0 };
    });

    return result;
  }

  async cancel(shopId: string, id: string) {
    const debt = await this.getOne(shopId, id);

    if (debt.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a fully paid debt');
    }

    if (debt.paid_amount > 0) {
      throw new BadRequestException('Cannot cancel debt with existing payments');
    }

    const updated = await this.prisma.supplierDebt.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        supplier: {
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
    const debt = await this.getOne(shopId, id);

    if (debt.paid_amount > 0) {
      throw new BadRequestException('Cannot delete debt with payments');
    }

    await this.prisma.supplierDebt.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Debt deleted successfully' };
  }

  async getStats(shopId: string) {
    const debts = await this.prisma.supplierDebt.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
        status: {
          in: ['PENDING', 'PARTIAL'],
        },
      },
    });

    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
    const pendingCount = debts.filter(d => d.status === 'PENDING').length;
    const partialCount = debts.filter(d => d.status === 'PARTIAL').length;

    return {
      totalDebt,
      pendingCount,
      partialCount,
      totalCount: debts.length,
    };
  }
}
