-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "sms_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsapp_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "supplier_debts" ADD COLUMN     "due_date" TIMESTAMP(3);
