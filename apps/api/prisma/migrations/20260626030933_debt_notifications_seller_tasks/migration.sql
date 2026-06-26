-- CreateEnum
CREATE TYPE "SellerTaskType" AS ENUM ('DEBT_REMINDER');

-- CreateEnum
CREATE TYPE "SellerTaskStatus" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'SMS';

-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'QUEUED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DEBT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DEBT_PAYMENT';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "sms_notifications_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "seller_tasks" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "type" "SellerTaskType" NOT NULL DEFAULT 'DEBT_REMINDER',
    "customer_id" TEXT,
    "receivable_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "SellerTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dedup_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done_at" TIMESTAMP(3),
    "done_by" TEXT,

    CONSTRAINT "seller_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_tasks_shop_id_status_idx" ON "seller_tasks"("shop_id", "status");

-- CreateIndex
CREATE INDEX "seller_tasks_dedup_key_idx" ON "seller_tasks"("dedup_key");

-- AddForeignKey
ALTER TABLE "seller_tasks" ADD CONSTRAINT "seller_tasks_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

