import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { ClaimRefundDto } from './dto/claim-refund.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau fournisseur
   * Conforme au CDC Swalo - Section 3.3
   */
  async create(shopId: string, dto: CreateSupplierDto) {
    // Vérifier si un fournisseur avec le même nom existe déjà (case-insensitive)
    const existingByName = await this.prisma.supplier.findFirst({
      where: {
        shop_id: shopId,
        name: {
          equals: dto.name,
          mode: 'insensitive',
        },
        deleted: false,
      },
    });

    if (existingByName) {
      throw new BadRequestException(
        'Un fournisseur avec ce nom existe déjà. Veuillez choisir un autre nom.'
      );
    }

    // Vérifier si un fournisseur avec le même téléphone existe déjà
    if (dto.phone) {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          shop_id: shopId,
          phone: dto.phone,
          deleted: false,
        },
      });

      if (existing) {
        throw new BadRequestException('Un fournisseur avec ce numéro de téléphone existe déjà');
      }
    }

    // Utiliser une transaction pour créer le fournisseur et la dette initiale si nécessaire
    return await this.prisma.$transaction(async tx => {
      const supplier = await tx.supplier.create({
        data: {
          shop_id: shopId,
          name: dto.name,
          first_name: dto.first_name,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          borrowing_limit: dto.borrowing_limit ?? 0,
          notes: dto.notes,
          is_active: true,
        },
      });

      // Si un solde initial est fourni, créer une dette
      if (dto.initial_balance && dto.initial_balance > 0) {
        await tx.supplierDebt.create({
          data: {
            shop_id: shopId,
            supplier_id: supplier.id,
            amount: dto.initial_balance,
            balance: dto.initial_balance,
            paid_amount: 0,
            status: 'PENDING',
            notes: 'Solde initial',
          },
        });
      }

      return supplier;
    });
  }

  /**
   * Récupérer tous les fournisseurs
   */
  async getAll(
    shopId: string,
    filters?: {
      search?: string;
      is_active?: boolean;
    }
  ) {
    const where: Prisma.SupplierWhereInput = {
      shop_id: shopId,
      deleted: false,
    };

    if (filters?.is_active !== undefined) {
      where.is_active = filters.is_active;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { first_name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        debts: {
          where: { deleted: false },
          select: {
            id: true,
            amount: true,
            balance: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Calculer le solde total des dettes pour chaque fournisseur
    const suppliersWithBalance = suppliers.map(supplier => ({
      ...supplier,
      total_balance: supplier.debts.reduce((sum, d) => sum + d.balance, 0),
      debts_count: supplier.debts.length,
    }));

    return suppliersWithBalance;
  }

  /**
   * Récupérer un fournisseur par ID
   */
  async getOne(shopId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        debts: {
          where: { deleted: false },
          include: {
            payments: {
              where: { deleted: false },
              select: {
                id: true,
                amount: true,
                payment_date: true,
                notes: true,
                cash_exit_id: true,
                created_at: true,
              },
              orderBy: { created_at: 'desc' },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        invoices: {
          where: { deleted: false },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
        cash_entries: {
          where: { deleted: false },
          include: {
            cashier: {
              select: {
                id: true,
                display_name: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          take: 20,
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Fournisseur non trouvé');
    }

    // Calculer les statistiques du fournisseur
    const stats = {
      total_debts: supplier.debts.reduce((sum, d) => sum + d.amount, 0),
      total_balance: supplier.debts.reduce((sum, d) => sum + d.balance, 0),
      total_paid: supplier.debts.reduce((sum, d) => sum + d.paid_amount, 0),
      debts_count: supplier.debts.length,
      invoices_count: supplier.invoices.length,
      cash_payments_count: supplier.cash_entries.length,
      total_cash_payments: supplier.cash_entries.reduce((sum, c) => sum + c.amount, 0),
    };

    return {
      ...supplier,
      stats,
    };
  }

  /**
   * Mettre à jour un fournisseur
   */
  async update(shopId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.getOne(shopId, id);

    // Vérifier le nom si modifié (case-insensitive)
    if (dto.name && dto.name.toLowerCase() !== supplier.name.toLowerCase()) {
      const existingByName = await this.prisma.supplier.findFirst({
        where: {
          shop_id: shopId,
          name: {
            equals: dto.name,
            mode: 'insensitive',
          },
          deleted: false,
          id: { not: id },
        },
      });

      if (existingByName) {
        throw new BadRequestException(
          'Un fournisseur avec ce nom existe déjà. Veuillez choisir un autre nom.'
        );
      }
    }

    // Vérifier le téléphone si modifié
    if (dto.phone && dto.phone !== supplier.phone) {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          shop_id: shopId,
          phone: dto.phone,
          deleted: false,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException('Un fournisseur avec ce numéro de téléphone existe déjà');
      }
    }

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.first_name !== undefined && { first_name: dto.first_name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.borrowing_limit !== undefined && { borrowing_limit: dto.borrowing_limit }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        updated_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * Supprimer (soft delete) un fournisseur
   */
  async delete(shopId: string, id: string) {
    await this.getOne(shopId, id);

    // Vérifier qu'il n'a pas de dettes en cours
    const activeDebts = await this.prisma.supplierDebt.count({
      where: {
        supplier_id: id,
        deleted: false,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
    });

    if (activeDebts > 0) {
      throw new BadRequestException(
        'Impossible de supprimer un fournisseur avec des dettes en cours'
      );
    }

    await this.prisma.supplier.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Fournisseur supprimé avec succès' };
  }

  /**
   * Obtenir les statistiques des fournisseurs
   */
  async getStats(shopId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      include: {
        debts: {
          where: { deleted: false },
        },
      },
    });

    const activeSuppliers = suppliers.filter(s => s.is_active);
    const totalDebts = suppliers.reduce(
      (sum, s) => sum + s.debts.reduce((d, debt) => d + debt.amount, 0),
      0
    );
    const totalBalance = suppliers.reduce(
      (sum, s) => sum + s.debts.reduce((d, debt) => d + debt.balance, 0),
      0
    );
    const suppliersWithDebt = suppliers.filter(s => s.debts.some(d => d.balance > 0)).length;

    return {
      total_suppliers: suppliers.length,
      active_suppliers: activeSuppliers.length,
      suppliers_with_debt: suppliersWithDebt,
      total_debts: totalDebts,
      total_balance: totalBalance,
      total_paid: totalDebts - totalBalance,
    };
  }

  /**
   * Réclamer un remboursement au fournisseur (quand solde négatif)
   * Crée une entrée de caisse pour enregistrer le remboursement reçu
   */
  async claimRefund(
    shopId: string,
    supplierId: string,
    userId: string,
    dto: Omit<ClaimRefundDto, 'payment_method'> & {
      payment_method: 'CASH' | 'MOBILE_MONEY';
    }
  ) {
    // Vérifier que le fournisseur existe
    const supplier = await this.getOne(shopId, supplierId);

    // Valider que le solde est négatif (fournisseur nous doit de l'argent)
    const currentBalance = supplier.stats.total_balance;
    if (currentBalance >= 0) {
      throw new BadRequestException('Ce fournisseur ne vous doit pas de remboursement');
    }

    const refundOwed = Math.abs(currentBalance);
    if (dto.amount > refundOwed) {
      throw new BadRequestException(
        `Le montant réclamé (${String(dto.amount)}) dépasse le montant dû (${String(refundOwed)})`
      );
    }

    // Utiliser une transaction pour créer l'entrée de caisse et ajuster la dette
    return await this.prisma.$transaction(async tx => {
      // Créer l'entrée de caisse (remboursement reçu = IN)
      const cashEntry = await tx.cashEntry.create({
        data: {
          shop_id: shopId,
          type: 'IN',
          category: 'Remboursement fournisseur',
          amount: dto.amount,
          note:
            dto.note && dto.note.length > 0 ? dto.note : `Remboursement reçu de ${supplier.name}`,
          supplier_id: supplierId,
          cashier_id: userId,
        },
      });

      // Créer une dette positive pour compenser le solde négatif
      // Balance actuelle: -10000 (fournisseur nous doit), remboursement: 5000
      // Nouvelle dette: +5000, nouveau solde total: -10000 + 5000 = -5000
      const debt = await tx.supplierDebt.create({
        data: {
          shop_id: shopId,
          supplier_id: supplierId,
          amount: dto.amount, // Montant positif pour compenser le solde négatif
          balance: dto.amount,
          paid_amount: 0,
          status: 'PAID',
          description: 'Remboursement reçu du fournisseur',
          notes: dto.note,
        },
      });

      return {
        cash_entry: cashEntry,
        debt,
        message: 'Remboursement enregistré avec succès',
      };
    });
  }

  /**
   * Détecter les fournisseurs avec des noms en doublons (case-insensitive)
   */
  async findDuplicates(shopId: string) {
    // Récupérer tous les fournisseurs non supprimés
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      include: {
        debts: {
          where: { deleted: false },
          select: { balance: true },
        },
        invoices: {
          where: { deleted: false },
          select: { id: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Grouper par nom (case-insensitive)
    const grouped = new Map<string, typeof suppliers>();
    for (const supplier of suppliers) {
      const normalizedName = supplier.name.toLowerCase().trim();
      const group = grouped.get(normalizedName);
      if (group) {
        group.push(supplier);
      } else {
        grouped.set(normalizedName, [supplier]);
      }
    }

    // Filtrer pour ne garder que les groupes avec plus d'un fournisseur
    const duplicates = Array.from(grouped.entries())
      .filter(([, group]) => group.length > 1)
      .map(([name, group]) => ({
        name,
        count: group.length,
        suppliers: group.map(s => ({
          id: s.id,
          name: s.name,
          first_name: s.first_name,
          phone: s.phone,
          created_at: s.created_at,
          total_balance: s.debts.reduce((sum, d) => sum + d.balance, 0),
          invoices_count: s.invoices.length,
        })),
      }));

    return {
      total_duplicate_groups: duplicates.length,
      total_duplicate_suppliers: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates,
    };
  }

  /**
   * Fusionner deux fournisseurs (transférer les données vers le fournisseur à conserver)
   * @param keepId - ID du fournisseur à conserver
   * @param mergeId - ID du fournisseur à supprimer (ses données seront transférées)
   */
  async merge(shopId: string, keepId: string, mergeId: string) {
    // Vérifier que les deux fournisseurs existent
    const keepSupplier = await this.getOne(shopId, keepId);
    const mergeSupplier = await this.getOne(shopId, mergeId);

    if (keepId === mergeId) {
      throw new BadRequestException('Impossible de fusionner un fournisseur avec lui-même');
    }

    // Utiliser une transaction pour garantir l'intégrité
    return await this.prisma.$transaction(async tx => {
      // 1. Transférer les dettes
      const debtsUpdated = await tx.supplierDebt.updateMany({
        where: {
          supplier_id: mergeId,
          deleted: false,
        },
        data: {
          supplier_id: keepId,
        },
      });

      // 2. Transférer les factures fournisseur
      const invoicesUpdated = await tx.supplierInvoice.updateMany({
        where: {
          supplier_id: mergeId,
          deleted: false,
        },
        data: {
          supplier_id: keepId,
        },
      });

      // 3. Transférer les entrées de caisse
      const cashEntriesUpdated = await tx.cashEntry.updateMany({
        where: {
          supplier_id: mergeId,
          deleted: false,
        },
        data: {
          supplier_id: keepId,
        },
      });

      // 4. Soft delete le fournisseur fusionné
      await tx.supplier.update({
        where: { id: mergeId },
        data: {
          deleted: true,
          deleted_at: new Date(),
          notes: `Fusionné avec ${keepSupplier.name} (ID: ${keepId}) le ${new Date().toISOString()}`,
        },
      });

      return {
        message: `Fournisseur "${mergeSupplier.name}" fusionné avec "${keepSupplier.name}"`,
        transferred: {
          debts: debtsUpdated.count,
          invoices: invoicesUpdated.count,
          cash_entries: cashEntriesUpdated.count,
        },
        kept_supplier_id: keepId,
        deleted_supplier_id: mergeId,
      };
    });
  }
}
