/**
 * Local SQLite database schema for offline-first support.
 * Mirrors critical Prisma models with additional sync metadata fields.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'swalo.db';
/** Current target schema version (see runMigrations). Kept for documentation. */
const _DB_VERSION = 5;

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

    -- Auth cache for offline PIN authentication
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
      packaging_type_id TEXT,
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

  if (currentVersion < 3) {
    // Migration v3: Add all remaining entities for full offline autonomy
    await db.execAsync(`
      -- Suppliers (mirror of Prisma Supplier)
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        code TEXT,
        name TEXT NOT NULL,
        first_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        borrowing_limit INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_shop ON suppliers(shop_id, is_active);

      -- Supplier Debts (mirror of Prisma SupplierDebt)
      CREATE TABLE IF NOT EXISTS supplier_debts (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paid_amount INTEGER NOT NULL DEFAULT 0,
        balance INTEGER NOT NULL,
        description TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_debts_shop ON supplier_debts(shop_id, supplier_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_debts_status ON supplier_debts(shop_id, status);

      -- Supplier Debt Payments (mirror of Prisma SupplierDebtPayment)
      CREATE TABLE IF NOT EXISTS supplier_debt_payments (
        id TEXT PRIMARY KEY,
        debt_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        notes TEXT,
        cashier_id TEXT,
        cash_exit_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (debt_id) REFERENCES supplier_debts(id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_debt_payments_debt ON supplier_debt_payments(debt_id);

      -- Supplier Invoices (mirror of Prisma SupplierInvoice)
      CREATE TABLE IF NOT EXISTS supplier_invoices (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        number TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        subtotal INTEGER NOT NULL,
        tax_total INTEGER NOT NULL,
        total INTEGER NOT NULL,
        paid_total INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_invoices_shop ON supplier_invoices(shop_id, supplier_id);

      -- Supplier Invoice Items (mirror of Prisma SupplierInvoiceItem)
      CREATE TABLE IF NOT EXISTS supplier_invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        description TEXT,
        qty REAL NOT NULL,
        unit_cost INTEGER NOT NULL,
        tax_rate REAL NOT NULL DEFAULT 0,
        subtotal INTEGER NOT NULL,
        tax_total INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_invoice ON supplier_invoice_items(invoice_id);

      -- Client Receivables (mirror of Prisma ClientReceivable)
      CREATE TABLE IF NOT EXISTS client_receivables (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paid_amount INTEGER NOT NULL DEFAULT 0,
        balance INTEGER NOT NULL,
        description TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
      CREATE INDEX IF NOT EXISTS idx_client_receivables_shop ON client_receivables(shop_id, customer_id);
      CREATE INDEX IF NOT EXISTS idx_client_receivables_status ON client_receivables(shop_id, status);

      -- Client Receivable Payments (mirror of Prisma ClientReceivablePayment)
      CREATE TABLE IF NOT EXISTS client_receivable_payments (
        id TEXT PRIMARY KEY,
        receivable_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        notes TEXT,
        cashier_id TEXT,
        cash_entry_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (receivable_id) REFERENCES client_receivables(id)
      );
      CREATE INDEX IF NOT EXISTS idx_client_receivable_payments_recv ON client_receivable_payments(receivable_id);

      -- Payments (mirror of Prisma Payment)
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'CASH',
        amount INTEGER NOT NULL,
        receipt_ref TEXT,
        notes TEXT,
        cashier_id TEXT,
        device_id TEXT NOT NULL,
        client_op_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id, ref_type, ref_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotent ON payments(device_id, client_op_id);

      -- Invoices (mirror of Prisma Invoice)
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        sale_id TEXT,
        customer_id TEXT,
        number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        issue_date TEXT NOT NULL,
        due_date TEXT,
        subtotal INTEGER NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        tax_total INTEGER NOT NULL,
        grand_total INTEGER NOT NULL,
        paid_total INTEGER NOT NULL DEFAULT 0,
        balance_due INTEGER NOT NULL,
        notes TEXT,
        pdf_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_shop ON invoices(shop_id, customer_id);

      -- Invoice Items (mirror of Prisma InvoiceItem)
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        product_id TEXT,
        description TEXT NOT NULL,
        qty REAL NOT NULL,
        unit_price INTEGER NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        subtotal INTEGER NOT NULL,
        tax_total INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

      -- Packaging Types (mirror of Prisma PackagingType)
      CREATE TABLE IF NOT EXISTS packaging_types (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        symbol TEXT,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_packaging_types_name ON packaging_types(shop_id, name);

      -- Cash Sessions (mirror of Prisma CashSession)
      CREATE TABLE IF NOT EXISTS cash_sessions (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        cashier_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        opening_balance INTEGER NOT NULL,
        closing_balance INTEGER,
        expected_balance INTEGER,
        difference INTEGER,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_cash_sessions_shop ON cash_sessions(shop_id, cashier_id);

      -- Inventory Sessions (mirror of Prisma InventorySession)
      CREATE TABLE IF NOT EXISTS inventory_sessions (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_sessions_shop ON inventory_sessions(shop_id);

      -- Inventory Counts (mirror of Prisma InventoryCount)
      CREATE TABLE IF NOT EXISTS inventory_counts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        expected_qty INTEGER NOT NULL,
        counted_qty INTEGER NOT NULL,
        difference INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        _sync_status TEXT NOT NULL DEFAULT 'synced',
        _server_id TEXT,
        _last_synced_at TEXT,
        FOREIGN KEY (session_id) REFERENCES inventory_sessions(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_counts_session ON inventory_counts(session_id);
    `);
    await db.runAsync('UPDATE _schema_version SET version = 3');
  }

  if (currentVersion < 4) {
    // Migration v4: Add priority to mutation queue, auto_resolved to sync conflicts
    await db.execAsync(`
      ALTER TABLE _mutation_queue ADD COLUMN priority INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE _sync_conflicts ADD COLUMN auto_resolved INTEGER NOT NULL DEFAULT 0;
    `);
    // Update index to include priority for efficient ordering
    await db.execAsync(`
      DROP INDEX IF EXISTS idx_mutation_queue_status;
      CREATE INDEX IF NOT EXISTS idx_mutation_queue_status ON _mutation_queue(status, priority ASC, timestamp ASC);
    `);
    await db.runAsync('UPDATE _schema_version SET version = 4');
  }

  if (currentVersion < 5) {
    // Migration v5: Add packaging_type_id to products, expected_total/pricing_notes to sales
    // Using try/catch per statement because columns may already exist on newer installs
    const alterStatements = [
      'ALTER TABLE products ADD COLUMN packaging_type_id TEXT;',
      'ALTER TABLE sales ADD COLUMN expected_total INTEGER;',
      'ALTER TABLE sales ADD COLUMN pricing_notes TEXT;',
    ];
    for (const stmt of alterStatements) {
      try {
        await db.execAsync(stmt);
      } catch {
        // Column already exists, ignore
      }
    }
    await db.runAsync('UPDATE _schema_version SET version = 5');
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
    DELETE FROM inventory_counts;
    DELETE FROM inventory_sessions;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM supplier_invoice_items;
    DELETE FROM supplier_invoices;
    DELETE FROM supplier_debt_payments;
    DELETE FROM supplier_debts;
    DELETE FROM client_receivable_payments;
    DELETE FROM client_receivables;
    DELETE FROM payments;
    DELETE FROM cash_sessions;
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM inventory_movements;
    DELETE FROM cash_entries;
    DELETE FROM stock_batches;
    DELETE FROM packaging_types;
    DELETE FROM suppliers;
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
  'packaging_types',
  'customers',
  'suppliers',
  'sales',
  'sale_items',
  'cash_entries',
  'cash_sessions',
  'inventory_movements',
  'inventory_sessions',
  'inventory_counts',
  'client_receivables',
  'client_receivable_payments',
  'supplier_debts',
  'supplier_debt_payments',
  'supplier_invoices',
  'supplier_invoice_items',
  'payments',
  'invoices',
  'invoice_items',
] as const;

export type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];
