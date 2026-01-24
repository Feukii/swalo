-- CreateTable
CREATE TABLE "packaging_types" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(10),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "packaging_types_pkey" PRIMARY KEY ("id")
);

-- Add columns to stock_batches
ALTER TABLE "stock_batches" ADD COLUMN IF NOT EXISTS "price_valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "stock_batches" ADD COLUMN IF NOT EXISTS "price_valid_until" TIMESTAMP(3);
ALTER TABLE "stock_batches" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "stock_batches" ADD COLUMN IF NOT EXISTS "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stock_batches" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_types_shop_id_name_key" ON "packaging_types"("shop_id", "name");

-- CreateIndex
CREATE INDEX "stock_batches_price_valid_from_idx" ON "stock_batches"("price_valid_from");

-- AddForeignKey
ALTER TABLE "packaging_types" ADD CONSTRAINT "packaging_types_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
