# Supabase Database Synchronization

This directory contains SQL scripts to synchronize the SWALO database schema with Supabase.

## Prerequisites

1. A Supabase account at [supabase.com](https://supabase.com)
2. A project created in Supabase
3. Access to the Supabase SQL Editor

## How to Apply Migrations

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2: Run Base Schema (if not already done)

If you haven't set up the initial database schema in Supabase, you need to:

1. Copy the content of your Prisma schema
2. Generate the SQL using: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
3. Run this SQL in Supabase SQL Editor

Or manually copy the migrations from:

- `apps/api/prisma/migrations/20251018185056_init/migration.sql`
- `apps/api/prisma/migrations/20251019000844_adapt_to_new_cdc/migration.sql`

### Step 3: Run Admin Features Migration

1. Open `01_user_devices_migration.sql` in a text editor
2. Copy the entire content
3. Paste it into the Supabase SQL Editor
4. Click **RUN** to execute the migration

This will:

- ✅ Create the `user_devices` table
- ✅ Add work schedule fields to `user_roles` table
- ✅ Set up Row Level Security (RLS) policies
- ✅ Create necessary indexes and constraints
- ✅ Set up triggers for automatic timestamp updates

### Step 4: Verify Migration

The migration script includes verification queries at the end. Check the results to ensure:

1. **user_devices table** was created with all columns
2. **work schedule columns** were added to user_roles (work_start_time, work_end_time, work_days)
3. **RLS policies** were created for proper access control

## Features Implemented

### 1. Device Tracking (`user_devices` table)

Tracks which devices employees use to access the system:

- Each employee can only use one device at a time
- Admins can view and revoke device access
- Automatic device registration on first login

**Schema:**

```sql
user_devices (
  id: TEXT (UUID)
  user_id: TEXT
  shop_id: TEXT
  device_id: VARCHAR(255)        -- Unique identifier for the device
  device_name: VARCHAR(255)       -- Human-readable name
  device_type: VARCHAR(50)        -- 'mobile', 'web', 'tablet'
  last_login_at: TIMESTAMP
  is_active: BOOLEAN              -- Can be revoked by admins
  revoked_at: TIMESTAMP
  revoked_by: TEXT
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
)
```

### 2. Work Schedule Management

Added to `user_roles` table:

- `work_start_time` (VARCHAR 5): Format "HH:mm" (e.g., "07:00")
- `work_end_time` (VARCHAR 5): Format "HH:mm" (e.g., "20:00")
- `work_days` (TEXT): JSON array of days (e.g., '["MON","TUE","WED","THU","FRI","SAT"]')

Employees can only access the system during their configured work hours and days.

### 3. Row Level Security (RLS) Policies

**For `user_devices` table:**

| Policy                                    | Who                     | Access                                 |
| ----------------------------------------- | ----------------------- | -------------------------------------- |
| Users can view their own devices          | All authenticated users | SELECT their own devices               |
| Admins can view all devices in their shop | ADMIN, OWNER, MANAGER   | SELECT all devices in shop             |
| Admins can manage devices in their shop   | ADMIN, OWNER, MANAGER   | INSERT, UPDATE, DELETE devices in shop |
| Superadmins can view all devices          | SUPERADMIN              | SELECT all devices                     |
| Superadmins can manage all devices        | SUPERADMIN              | INSERT, UPDATE, DELETE all devices     |

## Environment Configuration

Update your `.env` file with Supabase credentials:

```env
# Supabase Configuration
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

## API Synchronization

The admin API endpoints are already configured to work with both PostgreSQL and Supabase:

### Available Endpoints:

**Super Admin:**

- `GET /admin/shops` - View all shops
- `GET /admin/shops/:shopId` - View shop details
- `GET /admin/stats/system` - System statistics

**Shop Admin/Owner:**

- `GET /admin/users` - View all users in shop
- `GET /admin/users/:userId/devices` - View user's devices
- `DELETE /admin/devices/:deviceId` - Revoke device access
- `POST /admin/users/:userId/revoke-devices` - Revoke all user devices except current
- `PUT /admin/users/:userId/role` - Update user role and work schedule
- `DELETE /admin/users/:userId` - Deactivate user access

## Testing

After applying the migration, test the following:

### 1. Device Binding Test (Employee)

```bash
# Login with PIN from a mobile device
curl -X POST https://your-api.com/api/auth/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "device_id": "test-device-123",
    "device_name": "iPhone 12",
    "device_type": "mobile"
  }'

# Try to login from another device (should fail)
curl -X POST https://your-api.com/api/auth/pin \
  -H "Content-Type: application/json" \
  -d '{
    "pin_code": "1234",
    "device_id": "different-device-456",
    "device_name": "Android Phone",
    "device_type": "mobile"
  }'
# Expected: 401 Unauthorized - "Ce code PIN est déjà utilisé sur un autre appareil"
```

### 2. Work Schedule Test

```bash
# Set work schedule for an employee (admin action)
curl -X PUT https://your-api.com/api/admin/users/{userId}/role \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "work_start_time": "08:00",
    "work_end_time": "18:00",
    "work_days": "[\"MON\",\"TUE\",\"WED\",\"THU\",\"FRI\"]"
  }'

# Try to login outside work hours or days
# Expected: 401 Unauthorized - "Accès refusé : hors horaires de travail"
```

### 3. Device Management Test (Admin)

```bash
# View all users and their devices
curl -X GET https://your-api.com/api/admin/users \
  -H "Authorization: Bearer {admin_token}"

# Revoke a device
curl -X DELETE https://your-api.com/api/admin/devices/{deviceId} \
  -H "Authorization: Bearer {admin_token}"
```

## Rollback

If you need to rollback this migration:

```sql
-- Remove RLS policies
DROP POLICY IF EXISTS "Users can view their own devices" ON user_devices;
DROP POLICY IF EXISTS "Admins can view all devices in their shop" ON user_devices;
DROP POLICY IF EXISTS "Admins can manage devices in their shop" ON user_devices;
DROP POLICY IF EXISTS "Superadmins can view all devices" ON user_devices;
DROP POLICY IF EXISTS "Superadmins can manage all devices" ON user_devices;

-- Drop table
DROP TABLE IF EXISTS user_devices CASCADE;

-- Remove work schedule columns from user_roles
ALTER TABLE user_roles
    DROP COLUMN IF EXISTS work_start_time,
    DROP COLUMN IF EXISTS work_end_time,
    DROP COLUMN IF EXISTS work_days;
```

## Support

For issues or questions:

1. Check the Supabase logs in your dashboard
2. Verify RLS policies are correctly applied
3. Ensure the API server has the correct DATABASE_URL
4. Check that migrations were applied in order

## Next Steps

After successfully applying this migration:

1. Test device binding with employee accounts
2. Configure work schedules for employees
3. Test admin device management features
4. Monitor device usage in the admin dashboard
