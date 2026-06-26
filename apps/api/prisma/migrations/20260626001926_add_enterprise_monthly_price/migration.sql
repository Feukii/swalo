-- DropForeignKey
ALTER TABLE "enterprises" DROP CONSTRAINT "enterprises_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "shops" DROP CONSTRAINT "shops_enterprise_id_fkey";

-- AlterTable
ALTER TABLE "client_receivable_payments" ADD COLUMN     "cash_entry_id" TEXT;

-- AlterTable
ALTER TABLE "enterprises" ADD COLUMN     "monthly_price" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "owner_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
