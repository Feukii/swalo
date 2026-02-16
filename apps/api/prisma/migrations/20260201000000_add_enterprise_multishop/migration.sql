-- CreateEnum
CREATE TYPE "ShopType" AS ENUM ('MAGASIN', 'BOUTIQUE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "enterprises" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "enterprises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_shop_transfers" (
    "id" TEXT NOT NULL,
    "enterprise_id" TEXT NOT NULL,
    "source_shop_id" TEXT NOT NULL,
    "target_shop_id" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "inter_shop_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inter_shop_transfer_items" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_sku" VARCHAR(50) NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "cost_price" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inter_shop_transfer_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add enterprise_id and shop_type to shops
ALTER TABLE "shops" ADD COLUMN "enterprise_id" TEXT;
ALTER TABLE "shops" ADD COLUMN "shop_type" "ShopType" NOT NULL DEFAULT 'BOUTIQUE';

-- CreateIndex
CREATE UNIQUE INDEX "enterprises_code_key" ON "enterprises"("code");

-- CreateIndex
CREATE INDEX "shops_enterprise_id_idx" ON "shops"("enterprise_id");

-- CreateIndex
CREATE INDEX "inter_shop_transfers_enterprise_id_idx" ON "inter_shop_transfers"("enterprise_id");
CREATE INDEX "inter_shop_transfers_source_shop_id_idx" ON "inter_shop_transfers"("source_shop_id");
CREATE INDEX "inter_shop_transfers_target_shop_id_idx" ON "inter_shop_transfers"("target_shop_id");
CREATE INDEX "inter_shop_transfers_status_idx" ON "inter_shop_transfers"("status");

-- CreateIndex
CREATE INDEX "inter_shop_transfer_items_transfer_id_idx" ON "inter_shop_transfer_items"("transfer_id");

-- AddForeignKey
ALTER TABLE "enterprises" ADD CONSTRAINT "enterprises_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_shop_transfers" ADD CONSTRAINT "inter_shop_transfers_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inter_shop_transfers" ADD CONSTRAINT "inter_shop_transfers_source_shop_id_fkey" FOREIGN KEY ("source_shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inter_shop_transfers" ADD CONSTRAINT "inter_shop_transfers_target_shop_id_fkey" FOREIGN KEY ("target_shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inter_shop_transfers" ADD CONSTRAINT "inter_shop_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inter_shop_transfer_items" ADD CONSTRAINT "inter_shop_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inter_shop_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
