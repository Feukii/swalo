-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'PAYMENT_REMINDER', 'MONTHLY_SUMMARY', 'RECEIPT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "client_receivables" ADD COLUMN     "due_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "whatsapp_notifications_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "low_stock_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notification_email" TEXT,
ADD COLUMN     "payment_reminder_cadence_days" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "payment_reminders_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "target_type" TEXT,
    "target_id" TEXT,
    "recipient" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "dedup_key" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_shop_id_type_target_id_idx" ON "notification_logs"("shop_id", "type", "target_id");

-- CreateIndex
CREATE INDEX "notification_logs_shop_id_type_sent_at_idx" ON "notification_logs"("shop_id", "type", "sent_at");

-- CreateIndex
CREATE INDEX "notification_logs_dedup_key_idx" ON "notification_logs"("dedup_key");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

