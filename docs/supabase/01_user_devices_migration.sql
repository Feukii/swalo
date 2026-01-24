-- Migration to add UserDevice table and work schedule fields to Supabase
-- This should be run in your Supabase SQL editor

-- ============================================
-- 1. CREATE USER_DEVICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_devices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    last_login_at TIMESTAMP(3),
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMP(3),
    revoked_by TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_user_id_shop_id_device_id_key
    ON user_devices(user_id, shop_id, device_id);

-- Create index for queries
CREATE INDEX IF NOT EXISTS user_devices_user_id_shop_id_idx
    ON user_devices(user_id, shop_id);

-- ============================================
-- 2. ADD WORK SCHEDULE FIELDS TO USER_ROLES
-- ============================================

-- Add work schedule columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_roles' AND column_name = 'work_start_time'
    ) THEN
        ALTER TABLE user_roles
        ADD COLUMN work_start_time VARCHAR(5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_roles' AND column_name = 'work_end_time'
    ) THEN
        ALTER TABLE user_roles
        ADD COLUMN work_end_time VARCHAR(5);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_roles' AND column_name = 'work_days'
    ) THEN
        ALTER TABLE user_roles
        ADD COLUMN work_days TEXT;
    END IF;
END $$;

-- ============================================
-- 3. ENABLE RLS (Row Level Security)
-- ============================================

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. CREATE RLS POLICIES FOR USER_DEVICES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own devices" ON user_devices;
DROP POLICY IF EXISTS "Admins can view all devices in their shop" ON user_devices;
DROP POLICY IF EXISTS "Admins can manage devices in their shop" ON user_devices;
DROP POLICY IF EXISTS "Superadmins can view all devices" ON user_devices;
DROP POLICY IF EXISTS "Superadmins can manage all devices" ON user_devices;

-- Users can view their own devices
CREATE POLICY "Users can view their own devices" ON user_devices
    FOR SELECT
    USING (
        auth.uid()::TEXT = user_id
    );

-- Admins (ADMIN, OWNER, MANAGER) can view all devices in their shop
CREATE POLICY "Admins can view all devices in their shop" ON user_devices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.shop_id = user_devices.shop_id
              AND ur.role IN ('ADMIN', 'OWNER', 'MANAGER')
              AND ur.deleted = false
        )
    );

-- Admins can manage (INSERT, UPDATE, DELETE) devices in their shop
CREATE POLICY "Admins can manage devices in their shop" ON user_devices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.shop_id = user_devices.shop_id
              AND ur.role IN ('ADMIN', 'OWNER', 'MANAGER')
              AND ur.deleted = false
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.shop_id = user_devices.shop_id
              AND ur.role IN ('ADMIN', 'OWNER', 'MANAGER')
              AND ur.deleted = false
        )
    );

-- Superadmins can view all devices
CREATE POLICY "Superadmins can view all devices" ON user_devices
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.role = 'SUPERADMIN'
              AND ur.deleted = false
        )
    );

-- Superadmins can manage all devices
CREATE POLICY "Superadmins can manage all devices" ON user_devices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.role = 'SUPERADMIN'
              AND ur.deleted = false
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
              AND ur.role = 'SUPERADMIN'
              AND ur.deleted = false
        )
    );

-- ============================================
-- 5. CREATE TRIGGER FOR UPDATED_AT
-- ============================================

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_devices
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON user_devices;
CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_devices TO authenticated;
GRANT SELECT, UPDATE ON user_roles TO authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if table was created
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_devices'
ORDER BY ordinal_position;

-- Check if work schedule columns were added to user_roles
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'user_roles'
  AND column_name IN ('work_start_time', 'work_end_time', 'work_days');

-- Check RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'user_devices';
