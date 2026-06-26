import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType, SellerTaskStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

/** Customer fields needed to build a reminder + resolve its channels. */
interface ReminderCustomer {
  id: string;
  name: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
}

/** Receivable fields needed to build a reminder. */
export interface ReminderReceivable {
  id: string;
  balance: number;
  amount: number;
  due_date: Date | null;
  status: string;
}

/** Result of sending a manual reminder. */
export interface SendReminderResult {
  ok: boolean;
  channelsSent?: NotificationChannel[];
  error?: string;
}

/**
 * Read/complete operations for seller follow-up tasks (e.g. debt reminders),
 * plus manual on-demand reminder sending. All queries are scoped to the
 * authenticated user's shop.
 */
@Injectable()
export class SellerTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService
  ) {}

  /** Format an integer FCFA amount with space thousands separators. */
  private formatAmount(amount: number): string {
    return Math.abs(amount)
      .toFixed(0)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Short display name (first name if present, else full name). */
  private displayName(customer: { name: string; first_name: string | null }): string {
    const firstName = customer.first_name?.trim();
    return firstName !== undefined && firstName.length > 0 ? firstName : customer.name;
  }

  /** List of channels the customer opted into, as plain enum values. */
  private channelsFor(customer: ReminderCustomer): NotificationChannel[] {
    return this.dispatcher.resolveCustomerChannels(customer).map(c => c.channel);
  }

  /**
   * Build a courteous payment-reminder message for a task.
   * Falls back gracefully when the amount/due date are unknown.
   */
  private buildPreviewMessage(params: {
    customer: { name: string; first_name: string | null };
    balance: number | null;
    dueDate: Date | null;
    shopName: string;
    fallbackMessage: string | null;
  }): string {
    const { customer, balance, dueDate, shopName, fallbackMessage } = params;

    if (balance === null) {
      // No linked receivable: reuse the task message if available.
      return (
        fallbackMessage ??
        `Bonjour ${this.displayName(customer)}, nous vous rappelons courtoisement le suivi de votre compte. Merci de votre confiance. — ${shopName}`
      );
    }

    const amountText = `${this.formatAmount(balance)} FCFA`;
    const dueText = dueDate
      ? ` arrive à échéance le ${this.formatDate(dueDate)}`
      : ' reste à régler';

    return `Bonjour ${this.displayName(customer)}, nous vous rappelons courtoisement que votre solde de ${amountText}${dueText}. Merci de votre confiance. — ${shopName}`;
  }

  /**
   * List PENDING tasks for a shop, enriched with customer, receivable, amount,
   * due date, opted-in channels and a ready-to-send courteous preview message.
   * Keeps the existing sort (due_date asc, created_at asc).
   */
  async getPending(shopId: string) {
    const [tasks, shop] = await Promise.all([
      this.prisma.sellerTask.findMany({
        where: { shop_id: shopId, status: SellerTaskStatus.PENDING },
        orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
      }),
      this.prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } }),
    ]);

    const shopName = shop?.name ?? 'votre boutique';

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
            select: {
              id: true,
              name: true,
              first_name: true,
              phone: true,
              email: true,
              email_notifications_enabled: true,
              sms_notifications_enabled: true,
              whatsapp_notifications_enabled: true,
            },
          })
        : Promise.resolve([]),
      receivableIds.length > 0
        ? this.prisma.clientReceivable.findMany({
            where: { id: { in: receivableIds } },
            select: { id: true, balance: true, amount: true, due_date: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const customerMap = new Map<string, ReminderCustomer>(customers.map(c => [c.id, c]));
    const receivableMap = new Map<string, ReminderReceivable>(receivables.map(r => [r.id, r]));

    return tasks.map(task => {
      const customer = task.customer_id ? (customerMap.get(task.customer_id) ?? null) : null;
      const receivable = task.receivable_id
        ? (receivableMap.get(task.receivable_id) ?? null)
        : null;

      const channels = customer ? this.channelsFor(customer) : [];
      const amount = receivable ? receivable.balance : null;
      const dueDate = receivable?.due_date ?? task.due_date ?? null;

      const previewMessage = customer
        ? this.buildPreviewMessage({
            customer,
            balance: amount,
            dueDate,
            shopName,
            fallbackMessage: task.message,
          })
        : task.message;

      return {
        ...task,
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
        receivable,
        amount,
        due_date: dueDate,
        channels,
        preview_message: previewMessage,
      };
    });
  }

  /** Count of PENDING tasks for a shop (for badges). */
  async countPending(shopId: string): Promise<{ count: number }> {
    const count = await this.prisma.sellerTask.count({
      where: { shop_id: shopId, status: SellerTaskStatus.PENDING },
    });
    return { count };
  }

  /**
   * Build a reminder preview (message + opted-in channels + tone) for a single
   * task. Throws NotFoundException if the task does not belong to the shop.
   */
  async preview(shopId: string, taskId: string) {
    const { task, customer, receivable, shopName } = await this.loadReminderContext(shopId, taskId);

    const dueDate = receivable?.due_date ?? task.due_date ?? null;
    const message = customer
      ? this.buildPreviewMessage({
          customer,
          balance: receivable ? receivable.balance : null,
          dueDate,
          shopName,
          fallbackMessage: task.message,
        })
      : task.message;

    return {
      message,
      channels: customer ? this.channelsFor(customer) : [],
      tone: 'Courtois' as const,
    };
  }

  /**
   * Send a payment reminder NOW for the task's customer/receivable.
   *
   * - If `channel` is given, only that channel is used (when the customer opted in).
   * - Otherwise all channels the customer opted into are used.
   * - Best-effort: never throws on a send failure; returns { ok: false, error }
   *   instead. Does NOT mark the task as done.
   */
  async sendReminder(
    shopId: string,
    taskId: string,
    channel?: NotificationChannel
  ): Promise<SendReminderResult> {
    try {
      const { task, customer, receivable, shopName } = await this.loadReminderContext(
        shopId,
        taskId
      );

      if (!customer) {
        return { ok: false, error: 'Aucun client associé à cette tâche' };
      }

      const allChannels = this.dispatcher.resolveCustomerChannels(customer);
      const resolved = channel ? allChannels.filter(c => c.channel === channel) : allChannels;

      if (resolved.length === 0) {
        return {
          ok: false,
          error: channel
            ? `Le client n'a pas activé le canal ${channel}`
            : "Le client n'a activé aucun canal de notification",
        };
      }

      const dueDate = receivable?.due_date ?? task.due_date ?? null;
      const body = this.buildPreviewMessage({
        customer,
        balance: receivable ? receivable.balance : null,
        dueDate,
        shopName,
        fallbackMessage: task.message,
      });
      const subject = 'Rappel de paiement';

      const channelsSent: NotificationChannel[] = [];
      for (const { channel: ch, recipient } of resolved) {
        const outcome = await this.dispatcher.dispatch({
          shopId,
          type: NotificationType.PAYMENT_REMINDER,
          channel: ch,
          recipient,
          subject,
          body,
          targetType: receivable ? 'receivable' : 'customer',
          targetId: receivable?.id ?? customer.id,
          // Manual reminder: timestamped dedup key so repeats are allowed.
          dedupKey: `manual_reminder:${task.id}:${ch}:${new Date().toISOString()}`,
        });
        if (outcome === 'SENT' || outcome === 'QUEUED') {
          channelsSent.push(ch);
        }
      }

      if (channelsSent.length === 0) {
        return { ok: false, error: "Échec de l'envoi sur tous les canaux" };
      }

      return { ok: true, channelsSent };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
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

  /**
   * Load a task (scoped to the shop) together with its customer, receivable and
   * shop name. Throws NotFoundException if the task is missing or not in scope.
   */
  private async loadReminderContext(
    shopId: string,
    taskId: string
  ): Promise<{
    task: { id: string; message: string | null; due_date: Date | null };
    customer: ReminderCustomer | null;
    receivable: ReminderReceivable | null;
    shopName: string;
  }> {
    const task = await this.prisma.sellerTask.findFirst({
      where: { id: taskId, shop_id: shopId },
      select: { id: true, message: true, due_date: true, customer_id: true, receivable_id: true },
    });

    if (!task) {
      throw new NotFoundException('Tâche non trouvée');
    }

    const [customer, receivable, shop] = await Promise.all([
      task.customer_id
        ? this.prisma.customer.findFirst({
            where: { id: task.customer_id, shop_id: shopId, deleted: false },
            select: {
              id: true,
              name: true,
              first_name: true,
              phone: true,
              email: true,
              email_notifications_enabled: true,
              sms_notifications_enabled: true,
              whatsapp_notifications_enabled: true,
            },
          })
        : Promise.resolve(null),
      task.receivable_id
        ? this.prisma.clientReceivable.findFirst({
            where: { id: task.receivable_id, shop_id: shopId },
            select: { id: true, balance: true, amount: true, due_date: true, status: true },
          })
        : Promise.resolve(null),
      this.prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } }),
    ]);

    return {
      task: { id: task.id, message: task.message, due_date: task.due_date },
      customer,
      receivable,
      shopName: shop?.name ?? 'votre boutique',
    };
  }
}
