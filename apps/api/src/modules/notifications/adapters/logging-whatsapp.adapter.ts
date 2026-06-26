import { Injectable, Logger } from '@nestjs/common';
import type { ChannelSendResult, NotificationChannelAdapter } from './notification-channel.adapter';

/**
 * Default WhatsApp adapter: journalises the message and returns ok without any
 * external call. The resulting NotificationLog is marked QUEUED so a real
 * provider can later pick it up (or it can simply serve as an audit trail).
 */
@Injectable()
export class LoggingWhatsappAdapter implements NotificationChannelAdapter {
  private readonly logger = new Logger(LoggingWhatsappAdapter.name);

  send(recipient: string, subject: string, body: string): Promise<ChannelSendResult> {
    this.logger.log(`[WhatsApp:queued] to=${recipient} subject="${subject}" body="${body}"`);
    return Promise.resolve({ ok: true });
  }
}
