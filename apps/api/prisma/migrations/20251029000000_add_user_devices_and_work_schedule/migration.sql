-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "device_id" VARCHAR(255) NOT NULL,
    "device_name" VARCHAR(255),
    "device_type" VARCHAR(50),
    "last_login_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_devices_user_id_shop_id_idx" ON "user_devices"("user_id", "shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_shop_id_device_id_key" ON "user_devices"("user_id", "shop_id", "device_id");
