import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCashEntryDto } from './dto/create-cash-entry.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  async createEntry(userId: string, shopId: string, userRole: Role, dto: CreateCashEntryDto) {
    if (dto.amount === 0) {
      throw new BadRequestException('Le montant ne peut pas ?tre nul');
    }

    if (dto.amount < 0 && userRole !== Role.OWNER) {
      throw new ForbiddenException(
        'Seuls les propri?taires peuvent effectuer des corrections n?gatives'
      );
    }

    // G?n?rer un client_op_id unique
    const client_op_id =
      dto.client_op_id || `cash_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const device_id = dto.device_id || 'web';

    const normalizedAmount = dto.amount;

    // Validation: pas de sortie sup?rieure au solde actuel
    if (dto.type === 'OUT' && normalizedAmount > 0) {
      const balanceData = await this.getBalance(shopId);
      if (normalizedAmount > balanceData.balance) {
        throw new BadRequestException(
          'Solde insuffisant: le montant de la sortie d?passe le solde de caisse'
        );
      }
    }

    // Pr?parer les donn?es de cr?ation
    const entryData: any = {
      type: dto.type,
      category: dto.category,
      amount: normalizedAmount,
      note: dto.note,
      device_id,
      client_op_id,
      shop: {
        connect: { id: shopId },
      },
      cashier: {
        connect: { id: userId },
      },
    };

    // Ajouter la relation supplier si fourni (pour règlement fournisseur)
    if (dto.supplier_id) {
      entryData.supplier = {
        connect: { id: dto.supplier_id },
      };
    }

    // Ajouter la relation customer si fourni (pour remboursement client)
    if (dto.customer_id) {
      entryData.customer = {
        connect: { id: dto.customer_id },
      };
    }

    // Créer l'entrée de caisse et mettre à jour le solde fournisseur/client si applicable
    const entry = await this.prisma.$transaction(async tx => {
      const cashEntry = await tx.cashEntry.create({
        data: entryData,
        include: {
          supplier: dto.supplier_id
            ? {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                },
              }
            : false,
          customer: dto.customer_id
            ? {
                select: {
                  id: true,
                  name: true,
                  first_name: true,
                },
              }
            : false,
        },
      });

      // Si c'est un paiement fournisseur (sortie avec supplier_id), traiter le paiement de dette
      // IMPORTANT: Ne pas traiter automatiquement si c'est un 'reglement_fournisseur'
      // car une dette négative a déjà été créée pour ajuster le solde
      if (dto.supplier_id && dto.type === 'OUT' && dto.category !== 'reglement_fournisseur') {
        // Trouver les dettes impayées du fournisseur
        const unpaidDebts = await tx.supplierDebt.findMany({
          where: {
            shop_id: shopId,
            supplier_id: dto.supplier_id,
            status: { in: ['PENDING', 'PARTIAL'] },
            deleted: false,
          },
          orderBy: {
            created_at: 'asc',
          },
        });

        // Répartir le paiement sur les dettes
        let remainingAmount = Math.abs(normalizedAmount);
        for (const debt of unpaidDebts) {
          if (remainingAmount <= 0) break;

          const paymentAmount = Math.min(remainingAmount, debt.balance);

          // Créer le paiement
          await tx.supplierDebtPayment.create({
            data: {
              debt_id: debt.id,
              amount: paymentAmount,
              notes: dto.note || 'Règlement via caisse',
              cashier_id: userId,
              cash_exit_id: cashEntry.id,
            },
          });

          // Mettre à jour la dette
          const newPaidAmount = debt.paid_amount + paymentAmount;
          const newBalance = debt.balance - paymentAmount;
          const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

          await tx.supplierDebt.update({
            where: { id: debt.id },
            data: {
              paid_amount: newPaidAmount,
              balance: newBalance,
              status: newStatus,
            },
          });

          remainingAmount -= paymentAmount;
        }
      }

      // Si c'est un paiement client (entrée avec customer_id), traiter le paiement de créance
      // IMPORTANT: Ne pas traiter automatiquement si c'est:
      // - 'remboursement_client': une créance négative a déjà été créée pour ajuster le solde
      // - 'vente': une vente cash ne doit pas affecter le solde des créances du client
      const excludedCategories = ['remboursement_client', 'vente'];
      if (
        dto.customer_id &&
        dto.type === 'IN' &&
        dto.category &&
        !excludedCategories.includes(dto.category)
      ) {
        // Trouver les créances impayées du client
        const unpaidReceivables = await tx.clientReceivable.findMany({
          where: {
            shop_id: shopId,
            customer_id: dto.customer_id,
            status: { in: ['PENDING', 'PARTIAL'] },
            deleted: false,
          },
          orderBy: {
            created_at: 'asc',
          },
        });

        // Répartir le paiement sur les créances
        let remainingAmount = Math.abs(normalizedAmount);
        for (const receivable of unpaidReceivables) {
          if (remainingAmount <= 0) break;

          const paymentAmount = Math.min(remainingAmount, receivable.balance);

          // Créer le paiement
          await tx.clientReceivablePayment.create({
            data: {
              receivable_id: receivable.id,
              amount: paymentAmount,
              notes: dto.note || 'Remboursement via caisse',
              cashier_id: userId,
              cash_entry_id: cashEntry.id,
            },
          });

          // Mettre à jour la créance
          const newPaidAmount = receivable.paid_amount + paymentAmount;
          const newBalance = receivable.balance - paymentAmount;
          const newStatus = newBalance === 0 ? 'PAID' : 'PARTIAL';

          await tx.clientReceivable.update({
            where: { id: receivable.id },
            data: {
              paid_amount: newPaidAmount,
              balance: newBalance,
              status: newStatus,
            },
          });

          remainingAmount -= paymentAmount;
        }
      }

      return cashEntry;
    });

    return entry;
  }

  async getAll(
    shopId: string,
    filters?: {
      type?: 'IN' | 'OUT' | 'OPENING' | 'CLOSING';
      start_date?: string;
      end_date?: string;
    }
  ) {
    const where: any = {
      shop_id: shopId,
      deleted: false,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.start_date) {
      where.created_at = {
        ...where.created_at,
        gte: new Date(filters.start_date),
      };
    }

    if (filters?.end_date) {
      where.created_at = {
        ...where.created_at,
        lte: new Date(filters.end_date),
      };
    }

    const entries = await this.prisma.cashEntry.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      include: {
        cashier: {
          select: {
            id: true,
            display_name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            first_name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
          },
        },
      },
    });

    return entries;
  }

  async getBalance(shopId: string) {
    // Calculer le solde total: (entrées - sorties)
    const entries = await this.prisma.cashEntry.aggregate({
      where: {
        shop_id: shopId,
        type: 'IN',
        deleted: false,
      },
      _sum: {
        amount: true,
      },
    });

    const exits = await this.prisma.cashEntry.aggregate({
      where: {
        shop_id: shopId,
        type: 'OUT',
        deleted: false,
      },
      _sum: {
        amount: true,
      },
    });

    const totalIn = entries._sum.amount || 0;
    const totalOut = exits._sum.amount || 0;
    const balance = totalIn - totalOut;

    return {
      balance,
      totalIn,
      totalOut,
    };
  }

  async getStats(
    shopId: string,
    filters?: {
      start_date?: string;
      end_date?: string;
    }
  ) {
    const where: any = {
      shop_id: shopId,
      deleted: false,
    };

    const receivableWhere: any = {
      shop_id: shopId,
      deleted: false,
    };

    const debtWhere: any = {
      shop_id: shopId,
      deleted: false,
    };

    if (filters?.start_date) {
      where.created_at = {
        ...where.created_at,
        gte: new Date(filters.start_date),
      };
      receivableWhere.created_at = {
        ...receivableWhere.created_at,
        gte: new Date(filters.start_date),
      };
      debtWhere.created_at = {
        ...debtWhere.created_at,
        gte: new Date(filters.start_date),
      };
    }

    if (filters?.end_date) {
      where.created_at = {
        ...where.created_at,
        lte: new Date(filters.end_date),
      };
      receivableWhere.created_at = {
        ...receivableWhere.created_at,
        lte: new Date(filters.end_date),
      };
      debtWhere.created_at = {
        ...debtWhere.created_at,
        lte: new Date(filters.end_date),
      };
    }

    // Stats pour les entrées de caisse (cash/mobile)
    const entriesStats = await this.prisma.cashEntry.aggregate({
      where: {
        ...where,
        type: 'IN',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Stats pour les sorties de caisse (cash)
    const exitsStats = await this.prisma.cashEntry.aggregate({
      where: {
        ...where,
        type: 'OUT',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Stats pour les ventes de caisse (catégorie ventes uniquement)
    const salesCashStats = await this.prisma.cashEntry.aggregate({
      where: {
        ...where,
        type: 'IN',
        category: { in: ['ventes', 'vente'] },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Stats pour les achats en cash (catégorie achats_marchandises)
    const purchasesCashStats = await this.prisma.cashEntry.aggregate({
      where: {
        ...where,
        type: 'OUT',
        category: 'achats_marchandises',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Stats pour les ventes à crédit (créances clients)
    // Note: Exclure les montants négatifs qui sont des ajustements/remboursements
    const salesCreditStats = await this.prisma.clientReceivable.aggregate({
      where: {
        ...receivableWhere,
        amount: { gt: 0 }, // Seulement les montants positifs (vraies ventes à crédit)
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Stats pour les achats à crédit (dettes fournisseurs)
    // Note: Exclure les montants négatifs qui sont des ajustements/remboursements
    const purchasesCreditStats = await this.prisma.supplierDebt.aggregate({
      where: {
        ...debtWhere,
        amount: { gt: 0 }, // Seulement les montants positifs (vrais achats à crédit)
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    const todayEntries = entriesStats._sum.amount || 0;
    const todayExits = exitsStats._sum.amount || 0;
    const todayNet = todayEntries - todayExits;

    // Ventes totales = ventes cash + ventes crédit
    const salesCash = salesCashStats._sum.amount || 0;
    const salesCredit = salesCreditStats._sum.amount || 0;
    const totalSales = salesCash + salesCredit;

    // Achats totaux = achats cash + achats crédit
    const purchasesCash = purchasesCashStats._sum.amount || 0;
    const purchasesCredit = purchasesCreditStats._sum.amount || 0;
    const totalPurchases = purchasesCash + purchasesCredit;

    // Balance total (tous les temps)
    const balanceData = await this.getBalance(shopId);

    return {
      balance: balanceData.balance,
      todayEntries,
      todayExits,
      todayNet,
      entriesCount: entriesStats._count,
      exitsCount: exitsStats._count,
      // Nouveaux KPIs pour les ventes
      totalSales,
      salesCash,
      salesCredit,
      salesMobile: 0, // Pour l'instant, pas de distinction entre cash et mobile dans la DB
      salesCashCount: salesCashStats._count,
      salesCreditCount: salesCreditStats._count,
      // Nouveaux KPIs pour les achats
      totalPurchases,
      purchasesCash,
      purchasesCredit,
      purchasesCashCount: purchasesCashStats._count,
      purchasesCreditCount: purchasesCreditStats._count,
    };
  }

  async getOne(shopId: string, id: string) {
    const entry = await this.prisma.cashEntry.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        cashier: {
          select: {
            id: true,
            display_name: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            first_name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            first_name: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Entrée de caisse non trouvée');
    }

    return entry;
  }

  async delete(shopId: string, id: string) {
    await this.getOne(shopId, id);

    await this.prisma.cashEntry.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Entrée supprimée avec succès' };
  }

  /**
   * Créer un achat de marchandise auprès d'un fournisseur
   * Crée une sortie de caisse et optionnellement une dette fournisseur
   */
  async createMerchandisePurchase(userId: string, shopId: string, dto: any) {
    // Vérifier que le fournisseur existe
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: dto.supplier_id,
        shop_id: shopId,
        deleted: false,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur non trouvé');
    }

    // Valider le solde de caisse pour le paiement cash
    if (dto.payment_method === 'CASH') {
      const balanceData = await this.getBalance(shopId);
      if (dto.amount > balanceData.balance) {
        throw new BadRequestException(
          "Solde insuffisant: le montant de l'achat dépasse le solde de caisse"
        );
      }
    }

    // Utiliser une transaction pour créer la sortie de caisse et optionnellement la dette
    return await this.prisma.$transaction(async tx => {
      // Créer la sortie de caisse
      const cashEntry = await tx.cashEntry.create({
        data: {
          shop_id: shopId,
          type: 'OUT',
          category: 'Achats Marchandises',
          amount: dto.amount,
          note: dto.description || `Achat marchandise de ${supplier.name}`,
          supplier_id: dto.supplier_id,
          cashier_id: userId,
          device_id: dto.device_id || 'web',
          client_op_id:
            dto.client_op_id ||
            `purchase_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        },
      });

      // Si create_debt est true, créer une dette fournisseur
      let debt = null;
      if (dto.create_debt) {
        debt = await tx.supplierDebt.create({
          data: {
            shop_id: shopId,
            supplier_id: dto.supplier_id,
            amount: dto.amount,
            balance: dto.amount,
            paid_amount: 0,
            status: 'PENDING',
            description: dto.description || `Dette pour achat marchandise`,
            notes: `Lié à l'achat caisse #${cashEntry.id}`,
          },
        });
      }

      return {
        cash_entry: cashEntry,
        debt,
        message: dto.create_debt
          ? 'Achat enregistré avec succès et dette créée'
          : 'Achat enregistré avec succès',
      };
    });
  }
}
