/**
 * Result of attempting to send a notification through a channel adapter.
 */
export interface ChannelSendResult {
  ok: boolean;
  error?: string;
}

/**
 * A pluggable transport for a single notification channel (SMS, WhatsApp, ...).
 *
 * Default implementations only journalise the message (no external call) so the
 * feature is fully wired end-to-end while a real provider is integrated later.
 * To plug a real provider, implement this interface and bind it to the matching
 * injection token (SMS_ADAPTER / WHATSAPP_ADAPTER) in the notifications module.
 */
export interface NotificationChannelAdapter {
  send(recipient: string, subject: string, body: string): Promise<ChannelSendResult>;
}

/** Injection token for the SMS channel adapter. */
export const SMS_ADAPTER = Symbol('SMS_ADAPTER');

/** Injection token for the WhatsApp channel adapter. */
export const WHATSAPP_ADAPTER = Symbol('WHATSAPP_ADAPTER');
