-- CreateTable
CREATE TABLE "alert_acknowledgements" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "acknowledged_by" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "alert_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alert_acknowledgements_shop_id_alert_id_key" ON "alert_acknowledgements"("shop_id", "alert_id");

-- CreateIndex
CREATE INDEX "alert_acknowledgements_shop_id_idx" ON "alert_acknowledgements"("shop_id");
