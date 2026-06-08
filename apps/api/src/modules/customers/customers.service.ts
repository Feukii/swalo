import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau client
   * Conforme au CDC SWALO - Section 3.2
   */
  async create(shopId: string, dto: CreateCustomerDto) {
    // Vérifier si un client avec le même nom existe déjà (case-insensitive)
    const existingByName = await this.prisma.customer.findFirst({
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
        'Un client avec ce nom existe déjà. Veuillez choisir un autre nom.'
      );
    }

    // Vérifier si un client avec le même téléphone existe déjà
    if (dto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          shop_id: shopId,
          phone: dto.phone,
          deleted: false,
        },
      });

      if (existing) {
        throw new BadRequestException('Un client avec ce numéro de téléphone existe déjà');
      }
    }

    // Utiliser une transaction pour créer le client et la créance initiale si nécessaire
    return await this.prisma.$transaction(async tx => {
      const customer = await tx.customer.create({
        data: {
          shop_id: shopId,
          name: dto.name,
          first_name: dto.first_name,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          credit_limit: dto.credit_limit || 0,
          notes: dto.notes,
          is_active: true,
          email_notifications_enabled: dto.email_notifications_enabled ?? true,
        },
      });

      // Si un solde initial est fourni, créer une créance
      if (dto.initial_balance && dto.initial_balance > 0) {
        await tx.clientReceivable.create({
          data: {
            shop_id: shopId,
            customer_id: customer.id,
            amount: dto.initial_balance,
            balance: dto.initial_balance,
            paid_amount: 0,
            status: 'PENDING',
            notes: 'Solde initial',
          },
        });
      }

      return customer;
    });
  }

  /**
   * Récupérer tous les clients
   */
  async getAll(
    shopId: string,
    filters?: {
      search?: string;
      is_active?: boolean;
    }
  ) {
    const where: any = {
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

    const customers = await this.prisma.customer.findMany({
      where,
      include: {
        receivables: {
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

    // Calculer le solde total des créances pour chaque client
    const customersWithBalance = customers.map(customer => ({
      ...customer,
      total_balance: customer.receivables.reduce((sum, r) => sum + r.balance, 0),
      receivables_count: customer.receivables.length,
    }));

    return customersWithBalance;
  }

  /**
   * Récupérer un client par ID
   */
  async getOne(shopId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        shop_id: shopId,
        deleted: false,
      },
      include: {
        receivables: {
          where: { deleted: false },
          include: {
            payments: {
              where: { deleted: false },
              select: {
                id: true,
                amount: true,
                payment_date: true,
                notes: true,
                cash_entry_id: true,
                created_at: true,
              },
              orderBy: { created_at: 'desc' },
            },
          },
          orderBy: { created_at: 'desc' },
        },
        sales: {
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

    if (!customer) {
      throw new NotFoundException('Client non trouvé');
    }

    // Calculer les statistiques du client
    const stats = {
      total_receivables: customer.receivables.reduce((sum, r) => sum + r.amount, 0),
      total_balance: customer.receivables.reduce((sum, r) => sum + r.balance, 0),
      total_paid: customer.receivables.reduce((sum, r) => sum + r.paid_amount, 0),
      receivables_count: customer.receivables.length,
      sales_count: customer.sales.length,
      cash_refunds_count: customer.cash_entries.length,
      total_cash_refunds: customer.cash_entries.reduce((sum, c) => sum + c.amount, 0),
    };

    return {
      ...customer,
      stats,
    };
  }

  /**
   * Mettre à jour un client
   */
  async update(shopId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.getOne(shopId, id);

    // Vérifier le nom si modifié (case-insensitive)
    if (dto.name && dto.name.toLowerCase() !== customer.name.toLowerCase()) {
      const existingByName = await this.prisma.customer.findFirst({
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
          'Un client avec ce nom existe déjà. Veuillez choisir un autre nom.'
        );
      }
    }

    // Vérifier le téléphone si modifié
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          shop_id: shopId,
          phone: dto.phone,
          deleted: false,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException('Un client avec ce numéro de téléphone existe déjà');
      }
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.first_name !== undefined && { first_name: dto.first_name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.credit_limit !== undefined && { credit_limit: dto.credit_limit }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.email_notifications_enabled !== undefined && {
          email_notifications_enabled: dto.email_notifications_enabled,
        }),
        updated_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * Supprimer (soft delete) un client
   */
  async delete(shopId: string, id: string) {
    await this.getOne(shopId, id);

    // Vérifier qu'il n'a pas de créances en cours
    const activeReceivables = await this.prisma.clientReceivable.count({
      where: {
        customer_id: id,
        deleted: false,
        status: { in: ['PENDING', 'PARTIAL'] },
      },
    });

    if (activeReceivables > 0) {
      throw new BadRequestException('Impossible de supprimer un client avec des créances en cours');
    }

    await this.prisma.customer.update({
      where: { id },
      data: {
        deleted: true,
        deleted_at: new Date(),
      },
    });

    return { message: 'Client supprimé avec succès' };
  }

  /**
   * Obtenir les statistiques des clients
   */
  async getStats(shopId: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      include: {
        receivables: {
          where: { deleted: false },
        },
      },
    });

    const activeCustomers = customers.filter(c => c.is_active);
    const totalReceivables = customers.reduce(
      (sum, c) => sum + c.receivables.reduce((s, r) => s + r.amount, 0),
      0
    );
    const totalBalance = customers.reduce(
      (sum, c) => sum + c.receivables.reduce((s, r) => s + r.balance, 0),
      0
    );
    const customersWithDebt = customers.filter(c => c.receivables.some(r => r.balance > 0)).length;

    return {
      total_customers: customers.length,
      active_customers: activeCustomers.length,
      customers_with_debt: customersWithDebt,
      total_receivables: totalReceivables,
      total_balance: totalBalance,
      total_paid: totalReceivables - totalBalance,
    };
  }

  /**
   * Créer un remboursement client
   * Crée une sortie de caisse et une créance négative pour tracer le remboursement
   */
  async createRefund(shopId: string, customerId: string, userId: string, dto: any) {
    // Vérifier que le client existe
    const customer = await this.getOne(shopId, customerId);

    // Valider que le montant ne dépasse pas le remboursement dû (solde négatif)
    const currentBalance = customer.stats?.total_balance || 0;
    if (currentBalance >= 0) {
      throw new BadRequestException("Ce client n'a pas de remboursement dû");
    }

    const refundOwed = Math.abs(currentBalance);
    if (dto.amount > refundOwed) {
      throw new BadRequestException(
        `Le montant du remboursement (${dto.amount}) dépasse le montant dû (${refundOwed})`
      );
    }

    // Utiliser une transaction pour créer la sortie de caisse et la créance
    return await this.prisma.$transaction(async tx => {
      // Créer la sortie de caisse
      const cashEntry = await tx.cashEntry.create({
        data: {
          shop_id: shopId,
          type: 'OUT',
          category: 'Remboursement client',
          amount: dto.amount,
          note: dto.note || `Remboursement à ${customer.name}`,
          customer_id: customerId,
          cashier_id: userId,
        },
      });

      // Créer une créance positive pour compenser le solde négatif
      // Balance actuelle: -10000 (on doit au client), remboursement: 5000
      // Nouvelle créance: +5000, nouveau solde total: -10000 + 5000 = -5000
      const receivable = await tx.clientReceivable.create({
        data: {
          shop_id: shopId,
          customer_id: customerId,
          amount: dto.amount, // Montant positif pour compenser le solde négatif
          balance: dto.amount,
          paid_amount: 0,
          status: 'PAID',
          description: 'Remboursement effectué',
          notes: dto.note,
        },
      });

      return {
        cash_entry: cashEntry,
        receivable,
        message: 'Remboursement enregistré avec succès',
      };
    });
  }

  /**
   * Récupérer l'historique des remboursements d'un client
   */
  async getRefundHistory(shopId: string, customerId: string) {
    // Vérifier que le client existe
    await this.getOne(shopId, customerId);

    // Récupérer les entrées de caisse de type remboursement
    const refunds = await this.prisma.cashEntry.findMany({
      where: {
        shop_id: shopId,
        customer_id: customerId,
        type: 'OUT',
        category: 'Remboursement client',
        deleted: false,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return refunds;
  }

  /**
   * Détecter les clients avec des noms en doublons (case-insensitive)
   */
  async findDuplicates(shopId: string) {
    // Récupérer tous les clients non supprimés
    const customers = await this.prisma.customer.findMany({
      where: {
        shop_id: shopId,
        deleted: false,
      },
      include: {
        receivables: {
          where: { deleted: false },
          select: { balance: true },
        },
        sales: {
          where: { deleted: false },
          select: { id: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Grouper par nom (case-insensitive)
    const grouped: Record<string, typeof customers> = {};
    for (const customer of customers) {
      const normalizedName = customer.name.toLowerCase().trim();
      if (!grouped[normalizedName]) {
        grouped[normalizedName] = [];
      }
      grouped[normalizedName].push(customer);
    }

    // Filtrer pour ne garder que les groupes avec plus d'un client
    const duplicates = Object.entries(grouped)
      .filter(([_, group]) => group.length > 1)
      .map(([name, group]) => ({
        name,
        count: group.length,
        customers: group.map(c => ({
          id: c.id,
          name: c.name,
          first_name: c.first_name,
          phone: c.phone,
          created_at: c.created_at,
          total_balance: c.receivables.reduce((sum, r) => sum + r.balance, 0),
          sales_count: c.sales.length,
        })),
      }));

    return {
      total_duplicate_groups: duplicates.length,
      total_duplicate_customers: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates,
    };
  }

  /**
   * Fusionner deux clients (transférer les données vers le client à conserver)
   * @param keepId - ID du client à conserver
   * @param mergeId - ID du client à supprimer (ses données seront transférées)
   */
  async merge(shopId: string, keepId: string, mergeId: string) {
    // Vérifier que les deux clients existent
    const keepCustomer = await this.getOne(shopId, keepId);
    const mergeCustomer = await this.getOne(shopId, mergeId);

    if (keepId === mergeId) {
      throw new BadRequestException('Impossible de fusionner un client avec lui-même');
    }

    // Utiliser une transaction pour garantir l'intégrité
    return await this.prisma.$transaction(async tx => {
      // 1. Transférer les créances
      const receivablesUpdated = await tx.clientReceivable.updateMany({
        where: {
          customer_id: mergeId,
          deleted: false,
        },
        data: {
          customer_id: keepId,
        },
      });

      // 2. Transférer les ventes
      const salesUpdated = await tx.sale.updateMany({
        where: {
          customer_id: mergeId,
          deleted: false,
        },
        data: {
          customer_id: keepId,
        },
      });

      // 3. Transférer les entrées de caisse
      const cashEntriesUpdated = await tx.cashEntry.updateMany({
        where: {
          customer_id: mergeId,
          deleted: false,
        },
        data: {
          customer_id: keepId,
        },
      });

      // 4. Soft delete le client fusionné
      await tx.customer.update({
        where: { id: mergeId },
        data: {
          deleted: true,
          deleted_at: new Date(),
          notes: `Fusionné avec ${keepCustomer.name} (ID: ${keepId}) le ${new Date().toISOString()}`,
        },
      });

      return {
        message: `Client "${mergeCustomer.name}" fusionné avec "${keepCustomer.name}"`,
        transferred: {
          receivables: receivablesUpdated.count,
          sales: salesUpdated.count,
          cash_entries: cashEntriesUpdated.count,
        },
        kept_customer_id: keepId,
        deleted_customer_id: mergeId,
      };
    });
  }
}
