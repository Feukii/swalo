-- ============================================================
-- Migration: Enterprise required + Role simplification + Logo
-- ============================================================

-- ==========================================
-- PART 1: Add logo_url to enterprises
-- ==========================================
ALTER TABLE "enterprises" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;

-- ==========================================
-- PART 2: Make enterprise_id required on shops
-- ==========================================

-- Step 2a: Create a default enterprise for each orphan shop
INSERT INTO "enterprises" ("id", "code", "name", "owner_id", "license_tier", "max_shops", "max_users_per_shop", "created_at", "updated_at", "version")
SELECT
  gen_random_uuid(),
  'ENT-' || s."code",
  s."name",
  s."owner_id",
  'STARTER',
  1,
  5,
  NOW(),
  NOW(),
  1
FROM "shops" s
WHERE s."enterprise_id" IS NULL
  AND s."deleted" = false
ON CONFLICT ("code") DO NOTHING;

-- Step 2b: Assign orphan shops to their auto-created enterprises
UPDATE "shops" s
SET "enterprise_id" = e."id"
FROM "enterprises" e
WHERE e."code" = 'ENT-' || s."code"
  AND s."enterprise_id" IS NULL;

-- Step 2c: For any remaining orphan shops, create a catch-all enterprise
DO $$
DECLARE
  catchall_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM "shops" WHERE "enterprise_id" IS NULL) THEN
    INSERT INTO "enterprises" ("id", "code", "name", "license_tier", "max_shops", "max_users_per_shop", "created_at", "updated_at", "version")
    VALUES (gen_random_uuid(), 'ENT-LEGACY', 'Legacy (migration)', 'STARTER', 100, 50, NOW(), NOW(), 1)
    ON CONFLICT ("code") DO NOTHING;

    SELECT "id" INTO catchall_id FROM "enterprises" WHERE "code" = 'ENT-LEGACY';

    UPDATE "shops" SET "enterprise_id" = catchall_id WHERE "enterprise_id" IS NULL;
  END IF;
END $$;

-- Step 2d: Make enterprise_id NOT NULL
ALTER TABLE "shops" ALTER COLUMN "enterprise_id" SET NOT NULL;

-- ==========================================
-- PART 3: Simplify roles (6 -> 4)
-- ==========================================
-- Create the new enum with simplified roles
CREATE TYPE "Role_new" AS ENUM ('EMPLOYEE', 'MANAGER', 'BOSS', 'SUPERADMIN');

-- Convert user_roles column to new enum with CASE mapping
ALTER TABLE "user_roles" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN 'BOSS'
    WHEN 'ADMIN' THEN 'MANAGER'
    WHEN 'CASHIER' THEN 'EMPLOYEE'
    ELSE "role"::text
  END
)::"Role_new";

-- Convert pin_invites column to new enum with CASE mapping
ALTER TABLE "pin_invites" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'OWNER' THEN 'BOSS'
    WHEN 'ADMIN' THEN 'MANAGER'
    WHEN 'CASHIER' THEN 'EMPLOYEE'
    ELSE "role"::text
  END
)::"Role_new";

-- Drop old enum and rename new one
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
