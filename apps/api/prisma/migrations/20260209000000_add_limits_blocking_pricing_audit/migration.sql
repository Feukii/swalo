-- Phase 1: Add borrowing_limit to suppliers
ALTER TABLE "suppliers" ADD COLUMN "borrowing_limit" INTEGER NOT NULL DEFAULT 0;

-- Phase 2: Add pricing fields to sales
ALTER TABLE "sales" ADD COLUMN "expected_total" INTEGER;
ALTER TABLE "sales" ADD COLUMN "pricing_notes" TEXT;

-- Phase 4: Add blocking fields to enterprises
ALTER TABLE "enterprises" ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "enterprises" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "enterprises" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "enterprises" ADD COLUMN "blocked_by" TEXT;

-- Phase 5: Add license fields to enterprises
ALTER TABLE "enterprises" ADD COLUMN "license_tier" TEXT NOT NULL DEFAULT 'STARTER';
ALTER TABLE "enterprises" ADD COLUMN "licensed_until" TIMESTAMP(3);
ALTER TABLE "enterprises" ADD COLUMN "max_shops" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "enterprises" ADD COLUMN "max_users_per_shop" INTEGER NOT NULL DEFAULT 5;

-- Phase 4: Add blocking fields to shops
ALTER TABLE "shops" ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shops" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "shops" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "shops" ADD COLUMN "blocked_by" TEXT;

-- Phase 5: Add enabled_modules to shops
ALTER TABLE "shops" ADD COLUMN "enabled_modules" TEXT[] DEFAULT ARRAY['auth','products','customers','sales','cash','inventory']::TEXT[];

-- Phase 4: Add blocking fields to users
ALTER TABLE "users" ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "users" ADD COLUMN "blocked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "blocked_by" TEXT;

-- Phase 4: Create audit_logs table
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Phase 4: Create system_configs table
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- Add foreign key for audit_logs
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
