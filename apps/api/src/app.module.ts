import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { SalesModule } from './modules/sales/sales.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CashModule } from './modules/cash/cash.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SyncModule } from './modules/sync/sync.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { DebtsModule } from './modules/debts/debts.module';
import { PinInvitesModule } from './modules/pin-invites/pin-invites.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminControlsModule } from './modules/admin-controls/admin-controls.module';
import { HealthModule } from './health/health.module';
import { PackagingTypesModule } from './modules/packaging-types/packaging-types.module';
import { ImportModule } from './modules/import/import.module';
import { EnterpriseModule } from './modules/enterprise/enterprise.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { BlockStatusGuard } from './common/guards/block-status.guard';
import { EntitlementGuard } from './common/guards/entitlement.guard';
import { CapabilityGuard } from './common/guards/capability.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    ProductsModule,
    SalesModule,
    CustomersModule,
    SuppliersModule,
    InvoicesModule,
    PaymentsModule,
    CashModule,
    InventoryModule,
    SyncModule,
    ReportsModule,
    ReceivablesModule, // Client receivables management
    DebtsModule, // Supplier debts management
    PinInvitesModule, // PIN-based access management
    AdminModule, // Admin dashboard and user management
    AdminControlsModule, // Admin controls: blocking, audit logs, module management
    HealthModule, // Health check endpoint
    PackagingTypesModule, // Packaging types (conditionnement)
    ImportModule, // Import catalog from Excel/CSV
    EnterpriseModule, // Enterprise & multi-shop management
    TransfersModule, // Inter-shop transfers
    NotificationsModule, // Monthly email summaries
  ],
  providers: [
    // Order matters: auth first, then authorization, then business guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BlockStatusGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EntitlementGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CapabilityGuard,
    },
  ],
})
export class AppModule {}
