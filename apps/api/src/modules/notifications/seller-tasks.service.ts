import { Injectable, NotFoundException } from '@nestjs/common';
import { SellerTaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Read/complete operations for seller follow-up tasks (e.g. debt reminders).
 * All queries are scoped to the authenticated user's shop.
 */
@Injectable()
export class SellerTasksService {
  constructor(private readonly prisma: PrismaService) {}

  /** List PENDING tasks for a shop, enriched with customer + receivable info. */
  async getPending(shopId: string) {
    const tasks = await this.prisma.sellerTask.findMany({
      where: { shop_id: shopId, status: SellerTaskStatus.PENDING },
      orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
    });

    const customerIds = [
      ...new Set(tasks.map(t => t.customer_id).filter((id): id is string => id !== null)),
    ];
    const receivableIds = [
      ...new Set(tasks.map(t => t.receivable_id).filter((id): id is string => id !== null)),
    ];

    const [customers, receivables] = await Promise.all([
      customerIds.length > 0
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true, first_name: true, phone: true, email: true },
          })
        : Promise.resolve([]),
      receivableIds.length > 0
        ? this.prisma.clientReceivable.findMany({
            where: { id: { in: receivableIds } },
            select: { id: true, balance: true, amount: true, due_date: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map(c => [c.id, c]));
    const receivableMap = new Map(receivables.map(r => [r.id, r]));

    return tasks.map(task => ({
      ...task,
      customer: task.customer_id ? (customerMap.get(task.customer_id) ?? null) : null,
      receivable: task.receivable_id ? (receivableMap.get(task.receivable_id) ?? null) : null,
    }));
  }

  /** Count of PENDING tasks for a shop (for badges). */
  async countPending(shopId: string): Promise<{ count: number }> {
    const count = await this.prisma.sellerTask.count({
      where: { shop_id: shopId, status: SellerTaskStatus.PENDING },
    });
    return { count };
  }

  /** Mark a task as DONE (records done_at + done_by). */
  async markDone(shopId: string, id: string, userId: string) {
    const task = await this.prisma.sellerTask.findFirst({
      where: { id, shop_id: shopId },
    });

    if (!task) {
      throw new NotFoundException('Tâche non trouvée');
    }

    return this.prisma.sellerTask.update({
      where: { id },
      data: {
        status: SellerTaskStatus.DONE,
        done_at: new Date(),
        done_by: userId,
      },
    });
  }
}
