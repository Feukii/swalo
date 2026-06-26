import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ChannelResolvableCustomer,
  NotificationDispatcherService,
} from './notification-dispatcher.service';

/**
 * Business-facing helper that emits debt lifecycle notifications (DEBT_CREATED,
 * DEBT_PAYMENT) to a customer across all the channels they opted into.
 *
 * Every method is best-effort: it NEVER throws, so a notification failure can
 * never roll back the underlying business operation (sale, receivable, payment).
 */
@Injectable()
export class DebtNotificationsService {
  private readonly logger = new Logger(DebtNotificationsService.name);

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

  private async loadCustomer(
    shopId: string,
    customerId: string
  ): Promise<(ChannelResolvableCustomer & { id: string }) | null> {
    return this.prisma.customer.findFirst({
      where: { id: customerId, shop_id: shopId, deleted: false },
      select: {
        id: true,
        email: true,
        phone: true,
        email_notifications_enabled: true,
        sms_notifications_enabled: true,
        whatsapp_notifications_enabled: true,
      },
    });
  }

  /**
   * Notify a customer that a new debt was registered.
   * dedup_key = debt_created:{receivableId} (one notification per channel per receivable).
   */
  async notifyDebtCreated(params: {
    shopId: string;
    customerId: string;
    receivableId: string;
    amount: number;
    dueDate: Date | null;
  }): Promise<void> {
    try {
      const customer = await this.loadCustomer(params.shopId, params.customerId);
      if (!customer) return;

      const channels = this.dispatcher.resolveCustomerChannels(customer);
      if (channels.length === 0) return;

      const subject = 'Nouvelle dette enregistrée';
      const dueText = params.dueDate ? `, échéance le ${this.formatDate(params.dueDate)}` : '';
      const body = `Nouvelle dette de ${this.formatAmount(params.amount)} FCFA enregistrée${dueText}.`;

      for (const { channel, recipient } of channels) {
        await this.dispatcher.dispatch({
          shopId: params.shopId,
          type: NotificationType.DEBT_CREATED,
          channel,
          recipient,
          subject,
          body,
          targetType: 'receivable',
          targetId: params.receivableId,
          dedupKey: `debt_created:${params.receivableId}`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `notifyDebtCreated failed for receivable ${params.receivableId}: ${message}`
      );
    }
  }

  /**
   * Notify a customer that a payment was recorded on a debt.
   * dedup_key = debt_payment:{paymentId} (one notification per channel per payment).
   */
  async notifyDebtPayment(params: {
    shopId: string;
    customerId: string;
    receivableId: string;
    paymentId: string;
    amount: number;
    balance: number;
  }): Promise<void> {
    try {
      const customer = await this.loadCustomer(params.shopId, params.customerId);
      if (!customer) return;

      const channels = this.dispatcher.resolveCustomerChannels(customer);
      if (channels.length === 0) return;

      const isFullyPaid = params.balance <= 0;
      const subject = 'Paiement reçu';
      const settlement = isFullyPaid
        ? 'Votre dette est entièrement réglée.'
        : `Solde restant ${this.formatAmount(params.balance)} FCFA (paiement partiel).`;
      const body = `Paiement de ${this.formatAmount(params.amount)} FCFA reçu. ${settlement}`;

      for (const { channel, recipient } of channels) {
        await this.dispatcher.dispatch({
          shopId: params.shopId,
          type: NotificationType.DEBT_PAYMENT,
          channel,
          recipient,
          subject,
          body,
          targetType: 'receivable',
          targetId: params.receivableId,
          dedupKey: `debt_payment:${params.paymentId}`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`notifyDebtPayment failed for payment ${params.paymentId}: ${message}`);
    }
  }
}
