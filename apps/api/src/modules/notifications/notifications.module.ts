import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    ScheduleModule.forRoot(),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
          auth: {
            user: config.get<string>('SMTP_USER', ''),
            pass: config.get<string>('SMTP_PASS', ''),
          },
        },
        defaults: {
          from: config.get<string>('SMTP_FROM', '"Swalo" <noreply@swalo.app>'),
        },
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
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}
