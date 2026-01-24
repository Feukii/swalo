-- AlterTable
ALTER TABLE "cash_entries" ADD COLUMN "supplier_id" TEXT;
ALTER TABLE "cash_entries" ADD COLUMN "customer_id" TEXT;

-- CreateIndex
CREATE INDEX "cash_entries_supplier_id_idx" ON "cash_entries"("supplier_id");
CREATE INDEX "cash_entries_customer_id_idx" ON "cash_entries"("customer_id");

-- AddForeignKey
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
