import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { existsSync } from 'fs';
import * as nodemailer from 'nodemailer';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { DebtNotificationsService } from './debt-notifications.service';
import { SellerTasksService } from './seller-tasks.service';
import { SellerTasksController } from './seller-tasks.controller';
import { ShopReminderSettingsController } from './shop-reminder-settings.controller';
import { SMS_ADAPTER, WHATSAPP_ADAPTER } from './adapters/notification-channel.adapter';
import { LoggingSmsAdapter } from './adapters/logging-sms.adapter';
import { LoggingWhatsappAdapter } from './adapters/logging-whatsapp.adapter';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const smtpUser = config.get<string>('SMTP_USER', '');
        const smtpPass = config.get<string>('SMTP_PASS', '');
        let transport: nodemailer.TransportOptions | Record<string, unknown>;
        let from = config.get<string>('SMTP_FROM', '"Swalo" <noreply@swalo.app>');

        // Bascule sur le vrai SMTP seulement si user ET pass sont renseignés
        // (un user sans mot de passe ferait échouer tous les envois).
        if (smtpUser && smtpPass) {
          // SMTP réel configuré
          transport = {
            host: config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
            port: config.get<number>('SMTP_PORT', 587),
            secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
            auth: { user: smtpUser, pass: smtpPass },
          };
        } else {
          // Aucun SMTP configuré -> repli Ethereal (compte de test nodemailer) :
          // les emails partent réellement et une URL de prévisualisation est
          // loggée à chaque envoi. Pour de la vraie livraison, renseigner SMTP_USER/PASS.
          try {
            const testAccount = await nodemailer.createTestAccount();
            transport = {
              host: 'smtp.ethereal.email',
              port: 587,
              secure: false,
              auth: { user: testAccount.user, pass: testAccount.pass },
            };
            from = '"Swalo (démo)" <demo@swalo.app>';
            new Logger('Mailer').log(
              `SMTP non configuré -> repli Ethereal (${testAccount.user}). ` +
                `Les emails sont capturés ; voir l'URL de prévisualisation dans les logs d'envoi.`
            );
          } catch {
            transport = { jsonTransport: true }; // dernier recours : no-op loggable
            new Logger('Mailer').warn('Ethereal indisponible -> transport jsonTransport (no-op).');
          }
        }

        return {
          transport,
          defaults: { from },
          template: {
            // In webpack mode __dirname resolves to dist root; fallback to full path
            dir: existsSync(join(__dirname, 'templates'))
              ? join(__dirname, 'templates')
              : join(__dirname, 'modules', 'notifications', 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  controllers: [NotificationsController, SellerTasksController, ShopReminderSettingsController],
  providers: [
    NotificationsService,
    NotificationsScheduler,
    NotificationDispatcherService,
    DebtNotificationsService,
    SellerTasksService,
    { provide: SMS_ADAPTER, useClass: LoggingSmsAdapter },
    { provide: WHATSAPP_ADAPTER, useClass: LoggingWhatsappAdapter },
  ],
  exports: [NotificationsService, NotificationDispatcherService, DebtNotificationsService],
})
export class NotificationsModule {}
