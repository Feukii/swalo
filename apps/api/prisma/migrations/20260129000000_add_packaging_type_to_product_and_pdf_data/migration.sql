-- AlterTable: Add packaging_type_id to products
ALTER TABLE "products" ADD COLUMN "packaging_type_id" TEXT;

-- AlterTable: Add pdf_data to invoices (base64 PDF storage)
ALTER TABLE "invoices" ADD COLUMN "pdf_data" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_packaging_type_id_fkey" FOREIGN KEY ("packaging_type_id") REFERENCES "packaging_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
