import { Inject, Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationChannel, NotificationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  NotificationChannelAdapter,
  SMS_ADAPTER,
  WHATSAPP_ADAPTER,
} from './adapters/notification-channel.adapter';

/** A resolved channel + recipient pair for a given customer. */
export interface ResolvedChannel {
  channel: NotificationChannel;
  recipient: string;
}

/** Minimal customer shape needed to resolve notification channels. */
export interface ChannelResolvableCustomer {
  email: string | null;
  phone: string | null;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
}

export interface DispatchInput {
  shopId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  targetType?: string;
  targetId?: string;
  dedupKey?: string;
}

export type DispatchOutcome = 'SENT' | 'QUEUED' | 'FAILED' | 'SKIPPED';

/**
 * Multi-channel notification dispatcher.
 *
 * - EMAIL  -> existing SMTP mailer (NotificationLog SENT on success).
 * - SMS    -> SMS_ADAPTER (default LoggingSmsAdapter, NotificationLog QUEUED).
 * - WHATSAPP-> WHATSAPP_ADAPTER (default LoggingWhatsappAdapter, NotificationLog QUEUED).
 *
 * Deduplication: if a NotificationLog with the same dedup_key already exists,
 * the dispatch is skipped (returns 'SKIPPED', no error, no duplicate send).
 *
 * A NotificationLog is always written, recording the channel, target and status.
 * dispatch() never throws on a send failure: it records a FAILED log and returns 'FAILED'.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    @Inject(SMS_ADAPTER) private readonly smsAdapter: NotificationChannelAdapter,
    @Inject(WHATSAPP_ADAPTER) private readonly whatsappAdapter: NotificationChannelAdapter
  ) {}

  /**
   * Resolve the channels a customer has opted into, together with the recipient
   * address for each. A channel is included only when both the toggle is on and
   * the address exists.
   */
  resolveCustomerChannels(customer: ChannelResolvableCustomer): ResolvedChannel[] {
    const channels: ResolvedChannel[] = [];
    if (customer.email_notifications_enabled && customer.email) {
      channels.push({ channel: NotificationChannel.EMAIL, recipient: customer.email });
    }
    if (customer.sms_notifications_enabled && customer.phone) {
      channels.push({ channel: NotificationChannel.SMS, recipient: customer.phone });
    }
    if (customer.whatsapp_notifications_enabled && customer.phone) {
      channels.push({ channel: NotificationChannel.WHATSAPP, recipient: customer.phone });
    }
    return channels;
  }

  /**
   * Dispatch a single notification on a single channel. Writes a NotificationLog
   * and returns the resulting outcome. Never throws on a send/transport failure.
   */
  async dispatch(input: DispatchInput): Promise<DispatchOutcome> {
    // Dedup: skip if a log with the same dedup_key already exists.
    if (input.dedupKey) {
      const existing = await this.prisma.notificationLog.findFirst({
        where: { dedup_key: input.dedupKey, channel: input.channel },
        select: { id: true },
      });
      if (existing) {
        return 'SKIPPED';
      }
    }

    try {
      let status: NotificationStatus;

      switch (input.channel) {
        case NotificationChannel.EMAIL: {
          await this.mailer.sendMail({
            to: input.recipient,
            subject: input.subject,
            text: input.body,
            html: `<p>${input.body}</p>`,
          });
          status = NotificationStatus.SENT;
          break;
        }
        case NotificationChannel.SMS: {
          const result = await this.smsAdapter.send(input.recipient, input.subject, input.body);
          if (!result.ok) {
            throw new Error(result.error ?? 'SMS adapter returned not ok');
          }
          status = NotificationStatus.QUEUED;
          break;
        }
        case NotificationChannel.WHATSAPP: {
          const result = await this.whatsappAdapter.send(
            input.recipient,
            input.subject,
            input.body
          );
          if (!result.ok) {
            throw new Error(result.error ?? 'WhatsApp adapter returned not ok');
          }
          status = NotificationStatus.QUEUED;
          break;
        }
      }

      await this.prisma.notificationLog.create({
        data: {
          shop_id: input.shopId,
          type: input.type,
          channel: input.channel,
          target_type: input.targetType,
          target_id: input.targetId,
          recipient: input.recipient,
          status,
          dedup_key: input.dedupKey,
        },
      });

      return status === NotificationStatus.SENT ? 'SENT' : 'QUEUED';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Dispatch failed (${input.channel}/${input.type}) to ${input.recipient}: ${message}`
      );
      await this.prisma.notificationLog.create({
        data: {
          shop_id: input.shopId,
          type: input.type,
          channel: input.channel,
          target_type: input.targetType,
          target_id: input.targetId,
          recipient: input.recipient,
          status: NotificationStatus.FAILED,
          error: message,
          dedup_key: input.dedupKey,
        },
      });
      return 'FAILED';
    }
  }
}
