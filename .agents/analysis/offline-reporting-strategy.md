# Offline Reporting & Analytics Strategy Analysis

## Problem Statement

SWALO mobile app requires network for business intelligence (HomeScreen KPIs, BusinessReportsScreen stats). Shop owners cannot access critical data (daily sales, cash balance, receivables, debts, stock status) without internet, blocking operations in low-connectivity zones.

---

## 1. Reportable Metrics by Data Availability

### Fully Computable Locally (Core Data Synced)

**Local SQLite tables available:** sales, sale_items, products, stock_batches, customers, cash_entries, inventory_movements

#### Sales Reports

- **Daily revenue** (SUM sales.grand_total WHERE created_at >= today)
- **Transaction count** (COUNT sales)
- **Items sold** (SUM sale_items.qty)
- **Cash vs Credit breakdown** (GROUP BY payment_method)
- **Category distribution** (GROUP BY product.category, SUM sale_items.total)

#### Stock Reports

- **Current inventory value** (SUM stock_batches.remaining_quantity × sell_price)
- **Low stock alerts** (WHERE remaining_quantity < product.alert_threshold)
- **Stock turnover** (SUM inventory_movements.qty by product by period)
- **Cost of goods sold** (SUM sale_items.unit_price × qty)

#### Cash Flow

- **Daily cash balance** (SUM cash_entries WHERE type='IN' - SUM WHERE type='OUT')
- **Cash entry categorization** (GROUP BY category: ventes, achats_marchandises, loyers, dépenses)
- **Transaction velocity** (COUNT cash_entries per hour/shift)

#### Customer Base

- **Customer count** (COUNT DISTINCT customers)
- **Repeat customers** (COUNT sales GROUP BY customer_id HAVING count > 1)
- **Top customers by volume** (SUM sale_items.qty GROUP BY customer_id)

### Partially Computable (Missing Entities)

**Problem:** Suppliers, receivables, and debts NOT synced locally

#### Receivables (Missing Data - Online Only)

- Total customer credit exposure
- Customer debt aging
- Payment collection tracking
- Credit limit enforcement

#### Debts (Missing Data - Online Only)

- Total supplier credit liability
- Supplier payment due dates
- Credit term compliance
- Borrowing limit utilization

#### Supplier Management (Missing Data - Online Only)

- Purchase history aggregation
- Supplier balance summary
- Supplier payment terms

---

## 2. Aggregation Approach: Real-Time vs Pre-Computed

### Real-Time SQLite Queries (Recommended)

**Pros:**

- Always fresh, zero sync latency
- Simple implementation: use SQLite aggregates (`SUM`, `GROUP BY`, `COUNT`)
- Minimal storage overhead
- No background job complexity

**Cons:**

- Query performance on large datasets (100K+ records)
- Mobile SQLite not optimized for complex joins

**Implementation:**

```sql
-- Example: Daily revenue by payment method
SELECT
  payment_method,
  COUNT(*) as transaction_count,
  SUM(grand_total) as total_revenue
FROM sales
WHERE date(created_at) = date('now')
GROUP BY payment_method;

-- Example: Stock valuation
SELECT
  p.category,
  SUM(sb.remaining_quantity * sb.sell_price) as total_value
FROM stock_batches sb
JOIN products p ON p.id = sb.product_id
WHERE sb.deleted = 0
GROUP BY p.category;
```

**Performance Optimization:**

- Indexes already exist: `idx_sales_shop`, `idx_stock_batches_product`, `idx_cash_entries_shop`
- Query timeout: 2-3 seconds acceptable on mobile
- Pagination for large result sets (top 100 customers)

### Pre-Computed Summaries (Optional Future)

**When to use:** If reports involve 7-day/monthly aggregations with 500K+ local records

- Create `_daily_summary` table: `{ date, shop_id, total_revenue, cash_in, cash_out }`
- Compute nightly via background sync
- Trade-off: added complexity for marginal performance gain

**Decision: Skip for MVP** — Real-time queries sufficient for typical small-shop volumes (10K-50K monthly sales).

---

## 3. Missing Data Gap Analysis

### Entities Not Currently Synced

| Entity          | Tables                                             | Impact                                                 | Priority |
| --------------- | -------------------------------------------------- | ------------------------------------------------------ | -------- |
| **Suppliers**   | `suppliers`                                        | Cannot show supplier payment history, borrowing limits | HIGH     |
| **Receivables** | `client_receivables`, `client_receivable_payments` | Cannot track customer credit exposure offline          | HIGH     |
| **Debts**       | `supplier_debts`, `supplier_debt_payments`         | Cannot track supplier payment obligations offline      | HIGH     |
| **Users/Roles** | `user_roles`                                       | Cannot attribute transactions by cashier role offline  | MEDIUM   |

### Sync Implementation Required

Add to **schema.ts** — Create tables for suppliers, receivables, debts:

```typescript
// In initDatabase() CREATE TABLE section:
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  borrowing_limit INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced'
);

CREATE TABLE IF NOT EXISTS client_receivables (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  status TEXT, -- PENDING, PARTIAL, PAID, CANCELLED
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced'
);

CREATE TABLE IF NOT EXISTS supplier_debts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  status TEXT,
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced'
);
```

Add to **sync.ts** pull() — Include in repoMap:

```typescript
const repoMap = {
  // ... existing
  suppliers: supplierRepo,
  client_receivables: receivablesRepo,
  supplier_debts: debtsRepo,
};
```

**Estimated effort:** 2-3 hours (create 3 repos + integrate sync)

---

## 4. Performance Strategy for Mobile SQLite

### Query Optimization Checklist

1. **Indexes:** Already present for `shop_id`, `created_at`, `product_id` ✓
2. **Date filtering:** Use `WHERE date(created_at) = date('now')` vs string comparison
3. **Pagination:** Limit reports to last 30 days by default, allow user expand
4. **Lazy loading:** Top-N queries (TOP 10 customers) instead of full scan
5. **No expensive JOINs:** Denormalize when possible (e.g., product name stored in sale_items)

### Caching Approach

**Don't cache:**

- Real-time KPIs (refresh on screen focus via `useFocusEffect`)
- Stale data breaks trust with shop owner

**Result:** Query fresh every time but optimize SQL, not cache.

---

## 5. Data Freshness Indicator

### Last Sync Timestamp Display

**Current:** HomeScreen has no sync indicator
**Proposal:** Add sync badge showing:

- "Last synced: 5 minutes ago" (online, recent)
- "Last synced: 3 hours ago" (working offline, stale)
- "Offline - Using cached data" (no network)
- "Offline - Pending: 3 transactions" (pending queue)

**Implementation:**

```typescript
// In sync.ts, persist sync metadata
async function getLastSyncTime(): Promise<Date | null> {
  const timestamp = await AsyncStorage.getItem(SYNC_META_LAST_SYNC);
  return timestamp ? new Date(timestamp) : null;
}

// In HomeScreen, subscribe to sync events
useEffect(() => {
  const unsubscribe = syncEngine.addListener(event => {
    if (event.type === 'sync_complete') {
      setLastSyncAt(new Date());
    }
  });
  return unsubscribe;
}, []);
```

**UI Placement:** HomeScreen header top-right or badge on each KPI card.

### Trust Signals

- Green checkmark: Data synced within 10 minutes
- Orange warning: Data synced >1 hour ago
- Red alert: Offline mode + unsaved transactions pending

---

## 6. Report Implementation Roadmap

### Phase 1: Core Offline Reports (Use Real-Time Queries)

**Target: 2 weeks**

1. Daily Sales Report (revenue, transactions, by payment method, by category)
2. Daily Cash Flow (total in/out, balance, category breakdown)
3. Stock Snapshot (current quantities, low stock alerts, valuation)
4. Shift Summary (start-of-day balances for cashiers)

**Files to create:**

- `apps/mobile/src/db/queries/sales.ts` — SUM, COUNT, GROUP BY queries
- `apps/mobile/src/db/queries/cash.ts` — Balance calculations
- `apps/mobile/src/db/queries/stock.ts` — Inventory queries
- `apps/mobile/src/hooks/useOfflineReports.ts` — React hook wrapper

### Phase 2: Add Missing Data (Sync + Report)

**Target: 3 weeks**

1. Sync suppliers, receivables, debts tables
2. Customer Credit Report (who owes us, aging)
3. Supplier Debt Report (who we owe, due dates)
4. Combined Financial Summary (cash + receivables - debts)

**Files to create:**

- `apps/mobile/src/db/repositories/suppliers.ts`
- `apps/mobile/src/db/repositories/receivables.ts`
- `apps/mobile/src/db/repositories/debts.ts`
- `apps/mobile/src/screens/OfflineFinancialSummaryScreen.tsx`

### Phase 3: Performance & Caching (If Needed)

**Trigger: If queries take >2s on real data**

- Add date range indexes
- Implement query result memoization (React Query)
- Pre-compute daily summaries for lookback reports

---

## Summary Table

| Aspect                  | Decision                                  | Confidence |
| ----------------------- | ----------------------------------------- | ---------- |
| **Aggregation**         | Real-time SQLite queries                  | 9/10       |
| **Caching**             | No caching; refresh on focus              | 8/10       |
| **Missing Data**        | Sync suppliers + receivables + debts      | 10/10      |
| **Performance**         | Existing indexes sufficient; 2-3s timeout | 7/10       |
| **Freshness Indicator** | Last sync timestamp + sync event badge    | 9/10       |
| **Time to MVP**         | 2 weeks (Phase 1 only)                    | 8/10       |

---

## Confidence Score: 8/10

**Why not 10?**

- SQLite performance untested on >100K records (typical for 6-month shop)
- Receivables/Debts sync design assumes simple pull from API (may need pagination)
- No UX research on what reports shop owners actually need most

**Mitigations:**

- Start Phase 1 with daily reports; expand to historical if fast enough
- Test with 500K-record SQLite dump before production
- Gather user feedback in Phase 1 beta before Phase 2

---

## Key Files Reference

**Current Offline Implementation:**

- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/mobile/src/db/schema.ts` — Local tables (missing suppliers, receivables, debts)
- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/mobile/src/db/sync.ts` — Sync engine
- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/mobile/src/db/offlineWrite.ts` — Offline operations

**Reporting Screens:**

- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/mobile/src/screens/HomeScreen.tsx` — Currently online-only KPIs
- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/mobile/src/screens/BusinessReportsScreen.tsx` — Currently online-only stats

**API Models:**

- `/h/99_Projets_Dev_Perso/projects/swalo_dev/apps/api/prisma/schema.prisma` — Server schema (source of truth)
