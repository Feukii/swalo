/**
 * Local SQLite database schema for offline-first support.
 * Mirrors critical Prisma models with additional sync metadata fields.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'swalo.db';
const DB_VERSION = 2;

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Sync status for local records
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/**
 * Get or create the database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  return dbInstance;
}

/**
 * Initialize the database schema (create all tables)
 */
export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS _schema_version (
      version INTEGER NOT NULL
    );

    -- Products (mirror of Prisma Product)
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      barcode TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      family TEXT,
      article_type TEXT,
      brand TEXT,
      reference TEXT,
      unit TEXT NOT NULL DEFAULT 'unit',
      tax_rate REAL NOT NULL DEFAULT 0,
      cost_price INTEGER NOT NULL,
      sell_price INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      alert_threshold INTEGER NOT NULL DEFAULT 5,
      image_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      device_id TEXT,
      client_op_id TEXT,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id, is_active);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(shop_id, sku);

    -- Stock Batches (mirror of Prisma StockBatch)
    CREATE TABLE IF NOT EXISTS stock_batches (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      remaining_quantity INTEGER NOT NULL,
      cost_price INTEGER NOT NULL,
      sell_price INTEGER NOT NULL,
      price_valid_from TEXT NOT NULL,
      price_valid_until TEXT,
      notes TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_batches_product ON stock_batches(shop_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_batches_remaining ON stock_batches(remaining_quantity);

    -- Customers (mirror of Prisma Customer)
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      credit_limit INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      first_name TEXT,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id, is_active);

    -- Sales (mirror of Prisma Sale)
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      customer_id TEXT,
      cashier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      tax_total INTEGER NOT NULL,
      net_total INTEGER NOT NULL,
      grand_total INTEGER NOT NULL,
      paid_total INTEGER NOT NULL DEFAULT 0,
      change INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      expected_total INTEGER,
      pricing_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      device_id TEXT,
      client_op_id TEXT,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(shop_id, customer_id);

    -- Sale Items (mirror of Prisma SaleItem)
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL,
      tax_total INTEGER NOT NULL,
      total INTEGER NOT NULL,
      batch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

    -- Cash Entries (mirror of Prisma CashEntry)
    CREATE TABLE IF NOT EXISTS cash_entries (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT,
      cashier_id TEXT NOT NULL,
      device_id TEXT,
      client_op_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      category TEXT,
      supplier_id TEXT,
      customer_id TEXT,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cash_entries_shop ON cash_entries(shop_id, created_at);

    -- Inventory Movements (mirror of Prisma InventoryMovement)
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL,
      qty INTEGER NOT NULL,
      reason TEXT,
      ref_type TEXT,
      ref_id TEXT,
      unit_cost INTEGER,
      device_id TEXT NOT NULL,
      client_op_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      _sync_status TEXT NOT NULL DEFAULT 'synced',
      _server_id TEXT,
      _last_synced_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_inv_movements_shop ON inventory_movements(shop_id, product_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_movements_idempotent ON inventory_movements(device_id, client_op_id);

    -- Mutation Queue (offline operations waiting to sync)
    CREATE TABLE IF NOT EXISTS _mutation_queue (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      op TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      client_op_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mutation_queue_status ON _mutation_queue(status, timestamp);

    -- Sync Conflicts (stored for user resolution)
    CREATE TABLE IF NOT EXISTS _sync_conflicts (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      client_data TEXT,
      server_data TEXT,
      mutation_id TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolution TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON _sync_conflicts(resolved, created_at);

    -- Sync metadata (last sync timestamps)
    CREATE TABLE IF NOT EXISTS _sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Run migrations
  await runMigrations(db);
}

/**
 * Run schema migrations based on current version
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const versionRow = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM _schema_version LIMIT 1'
  );
  const currentVersion = versionRow?.version ?? 0;

  if (currentVersion < 1) {
    await db.runAsync('INSERT INTO _schema_version (version) VALUES (?)', 1);
  }

  if (currentVersion < 2) {
    // Migration v2: Add auth_cache table for offline PIN authentication
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS auth_cache (
        user_id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        shop_code TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        enabled_modules TEXT NOT NULL DEFAULT '[]',
        cached_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);
    await db.runAsync('UPDATE _schema_version SET version = 2');
  }
}

/**
 * Reset the database (for testing or full re-sync)
 */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM _sync_conflicts;
    DELETE FROM _mutation_queue;
    DELETE FROM _sync_meta;
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM inventory_movements;
    DELETE FROM cash_entries;
    DELETE FROM stock_batches;
    DELETE FROM customers;
    DELETE FROM products;
    DELETE FROM auth_cache;
    DELETE FROM _schema_version;
  `);
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

/**
 * Get the current schema version
 */
export async function getSchemaVersion(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM _schema_version LIMIT 1'
  );
  return row?.version ?? 0;
}

/**
 * Entity names that can be synced
 */
export const SYNCABLE_ENTITIES = [
  'products',
  'stock_batches',
  'customers',
  'sales',
  'sale_items',
  'cash_entries',
  'inventory_movements',
] as const;

export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];
