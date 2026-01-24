-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPERADMIN';
ALTER TYPE "Role" ADD VALUE 'ADMIN';
ALTER TYPE "Role" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "cash_entries" ADD COLUMN     "category" VARCHAR(100),
ALTER COLUMN "device_id" DROP NOT NULL,
ALTER COLUMN "client_op_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "first_name" VARCHAR(255);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "first_name" VARCHAR(255);

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "work_days" TEXT,
ADD COLUMN     "work_end_time" VARCHAR(5),
ADD COLUMN     "work_start_time" VARCHAR(5);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pin_code" VARCHAR(4),
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "client_receivables" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_receivable_payments" (
    "id" TEXT NOT NULL,
    "receivable_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cashier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "client_receivable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_debts" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "status" "DebtStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "supplier_debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_debt_payments" (
    "id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cashier_id" TEXT,
    "cash_exit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "supplier_debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pin_invites" (
    "id" TEXT NOT NULL,
    "pin_code" VARCHAR(4) NOT NULL,
    "shop_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "created_by" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_by" TEXT,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pin_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_receivables_shop_id_customer_id_idx" ON "client_receivables"("shop_id", "customer_id");

-- CreateIndex
CREATE INDEX "client_receivables_shop_id_status_idx" ON "client_receivables"("shop_id", "status");

-- CreateIndex
CREATE INDEX "client_receivable_payments_receivable_id_idx" ON "client_receivable_payments"("receivable_id");

-- CreateIndex
CREATE INDEX "supplier_debts_shop_id_supplier_id_idx" ON "supplier_debts"("shop_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_debts_shop_id_status_idx" ON "supplier_debts"("shop_id", "status");

-- CreateIndex
CREATE INDEX "supplier_debt_payments_debt_id_idx" ON "supplier_debt_payments"("debt_id");

-- CreateIndex
CREATE UNIQUE INDEX "pin_invites_pin_code_key" ON "pin_invites"("pin_code");

-- CreateIndex
CREATE INDEX "pin_invites_pin_code_is_active_idx" ON "pin_invites"("pin_code", "is_active");

-- CreateIndex
CREATE INDEX "pin_invites_shop_id_role_idx" ON "pin_invites"("shop_id", "role");

-- CreateIndex
CREATE INDEX "cash_entries_shop_id_type_created_at_idx" ON "cash_entries"("shop_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "client_receivables" ADD CONSTRAINT "client_receivables_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_receivables" ADD CONSTRAINT "client_receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_receivable_payments" ADD CONSTRAINT "client_receivable_payments_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "client_receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_debts" ADD CONSTRAINT "supplier_debts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_debts" ADD CONSTRAINT "supplier_debts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_debt_payments" ADD CONSTRAINT "supplier_debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "supplier_debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
