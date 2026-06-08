# Strategy Analysis: FULL OFFLINE REWRITE

**SWALO Mobile App - Offline Architecture Evaluation**

---

## Executive Summary

A **FULL DATABASE REWRITE is NOT recommended** for SWALO at this stage. The current expo-sqlite + hand-rolled sync is functional and maintainable. However, **selective database replacement (PowerSync specifically) is viable** IF coverage needs are addressed first. Current coverage gap is **7/33 core Prisma models** synced, not 7/20+.

---

## Current State Assessment

### Entities in SWALO (Prisma Models)

**Total: 33 models** across all layers

| Category          | Entities                                                                          | Notes      |
| ----------------- | --------------------------------------------------------------------------------- | ---------- |
| **User/Auth**     | User, UserRole, UserDevice, PinInvite                                             | 4 entities |
| **Multi-tenancy** | Enterprise, Shop                                                                  | 2 entities |
| **Products**      | Product, StockBatch, PackagingType                                                | 3 entities |
| **Inventory**     | InventoryMovement, InventorySession, InventoryCount                               | 3 entities |
| **Sales**         | Sale, SaleItem, Invoice, InvoiceItem                                              | 4 entities |
| **Payments**      | Payment, CashEntry, CashSession                                                   | 3 entities |
| **Customers**     | Customer, ClientReceivable, ClientReceivablePayment                               | 3 entities |
| **Suppliers**     | Supplier, SupplierDebt, SupplierDebtPayment, SupplierInvoice, SupplierInvoiceItem | 5 entities |
| **Advanced**      | InterShopTransfer, InterShopTransferItem, AuditLog, SystemConfig, DeviceSyncState | 5 entities |

### Currently Synced (expo-sqlite)

**7 core entities only:**

1. `products` ✓
2. `stock_batches` ✓
3. `customers` ✓
4. `sales` ✓
5. `sale_items` ✓
6. `cash_entries` ✓
7. `inventory_movements` ✓

**Missing: 26 entities** (79% of domain)

### Sync Architecture Assessment

**Strengths:**

- Simple, transparent mutation queue (`_mutation_queue` table)
- FIFO ordering ensures data consistency
- Idempotency via `[device_id, client_op_id]` constraints
- Soft-delete tracking works cleanly
- Version/timestamp conflict detection in place
- 60s periodic sync + on-demand trigger

**Weaknesses:**

- No built-in relationship/foreign-key cascading on sync
- Conflict resolution is user-facing (requires manual intervention)
- No multi-device sync awareness (DeviceSyncState exists but underutilized)
- APK bundle already includes 3+ sync modules (db/, queue, sync, repositories)
- Manual CRUD repositories for each entity = high code duplication

---

## Alternative Technologies Comparison

### 1. WatermelonDB

**Status:** SQLite-based ORM for React Native

| Factor                     | Rating                      | Notes                                              |
| -------------------------- | --------------------------- | -------------------------------------------------- |
| **Bundle size impact**     | ⭐⭐⭐⭐ (small)            | ~500KB-1MB JS; native SQLite layer already present |
| **Sync solution**          | ⭐⭐ (manual)               | No built-in sync; must implement own push/pull     |
| **Relationship support**   | ⭐⭐⭐⭐ (excellent)        | Relational ORM, JOIN queries, cascades             |
| **Learning curve**         | ⭐⭐⭐ (moderate)           | Decorators, associations, RxJS observables         |
| **Migration effort**       | ⭐⭐ (high)                 | Rewrite all repositories; different query API      |
| **Offline-first maturity** | ⭐⭐⭐⭐ (production-ready) | Used by Nozbe, many enterprise apps                |

**Verdict:** Best for relationships but still requires custom sync implementation. Would solve ~30% of current problem.

### 2. Realm

**Status:** Native mobile database (C++ backend)

| Factor                     | Rating                        | Notes                                              |
| -------------------------- | ----------------------------- | -------------------------------------------------- |
| **Bundle size impact**     | ⭐ (heavy)                    | +2.5-3.1 MB native libs (ARM/x86) per architecture |
| **Sync solution**          | ⭐⭐⭐ (Realm Sync available) | Paid enterprise feature; complex setup             |
| **Relationship support**   | ⭐⭐⭐⭐ (excellent)          | Embedded objects, links, cascades                  |
| **Learning curve**         | ⭐⭐⭐ (moderate)             | API similar to other NoSQL DBs                     |
| **Migration effort**       | ⭐⭐⭐ (moderate-high)        | Schema-to-Realm mapping, no SQL                    |
| **Offline-first maturity** | ⭐⭐⭐⭐ (excellent)          | Strong multi-device sync with Realm Sync           |

**Verdict:** APK bloat is significant for SWALO's "lightweight" requirement. Realm Sync adds cost. Not ideal for this project.

### 3. PowerSync

**Status:** Open-source, **Postgres ↔ SQLite** bidirectional sync

| Factor                     | Rating                        | Notes                                                         |
| -------------------------- | ----------------------------- | ------------------------------------------------------------- |
| **Bundle size impact**     | ⭐⭐⭐ (moderate)             | ~5.95 MB npm; embeds polyfills & sync engine; pre-bundled     |
| **Sync solution**          | ⭐⭐⭐⭐⭐ (built-in)         | Real-time pull→push with CRDTs, automatic conflict resolution |
| **Relationship support**   | ⭐⭐⭐⭐ (good)               | SQL + foreign keys; uses SQLite underneath                    |
| **Learning curve**         | ⭐⭐⭐⭐ (gentle)             | SQL familiar; write SQL views for sync rules                  |
| **Migration effort**       | ⭐⭐⭐ (moderate)             | Minimal schema changes; migration utilities exist             |
| **Offline-first maturity** | ⭐⭐⭐⭐⭐ (production-ready) | Used by MongoDB Atlas, Supabase partnerships                  |

**Verdict:** **BEST CHOICE** if pursuing full rewrite. Solves sync problem completely; minimal APK overhead vs Realm.

---

## Migration Path Analysis

### Option A: PowerSync Full Migration

**Effort:** 4-6 weeks | **Risk:** Medium | **Upside:** 100% offline coverage + CRDT sync

**Steps:**

1. Install `@powersync/react-native` alongside existing expo-sqlite (no conflicts)
2. Define PowerSync "sync rules" (SQL views of what to replicate)
3. Incrementally migrate entities:
   - Week 1: Products, StockBatches (read-only replication)
   - Week 2: Sales, SaleItems, CashEntries (mutations)
   - Week 3: Customers, Suppliers, Receivables
   - Week 4-6: Payments, Invoices, advanced flows; delete old sync code
4. Test conflict scenarios (multi-device edits, server pushback)
5. Validate APK size: expect +6-7 MB total (current ~50 MB, acceptable)
6. Remove old `_mutation_queue` and custom sync engine

**Data migration:**

- PowerSync has built-in migration utilities
- Existing SQLite records can hydrate initial state
- No data loss if executed carefully

### Option B: Incremental Coverage (Current Path)

**Effort:** 2-3 weeks | **Risk:** Low | **Upside:** 50% gap closed

**Steps:**

1. Extend current repositories for missing entities (Suppliers, Receivables, Payments)
2. Add to `SYNCABLE_ENTITIES` array
3. Implement sync DTOs for each entity
4. Test push/pull for new entities
5. Update API sync controller

**Why This First?**

- Addresses immediate business need (supplier debt tracking)
- Requires no framework changes
- Creates baseline for measuring improvement
- Then reassess PowerSync ROI with fuller data set

---

## Bundle Size Impact Breakdown

### Current SWALO Mobile

```
Base (React Native + Expo)        ~25-30 MB
Existing dependencies              ~20 MB
expo-sqlite (built-in)            <1 MB
Sync modules (db/, queue.ts, sync.ts, repositories/)  ~200 KB
─────────────────────────────────
Subtotal                           ~47-51 MB
```

### Adding PowerSync

```
@powersync/react-native           5.95 MB
(includes polyfills, sync engine, SQLite bindings)
─────────────────────────────────
With PowerSync                     ~53-57 MB
```

**Delta: +6 MB** — acceptable for production (most Play Store apps 50-150 MB)

### Why NOT Realm?

```
Realm native libraries (per arch)  2.5-3.1 MB × 2 architectures (arm64 + x86) = ~5-6 MB
Realm JS bindings                  1-2 MB
Realm Sync (if added)              additional licensing + setup
─────────────────────────────────
With Realm                         ~53-59 MB
```

**Same as PowerSync but:** (1) Less mature for SWALO's use case, (2) Expensive Sync tier, (3) No SQL familiarity benefit.

---

## Confidence Assessment

### FULL REWRITE (PowerSync) Confidence: **7/10**

**What makes it viable:**

- PowerSync specifically designed for offline-first sync patterns
- Automatic CRDT conflict resolution (no user intervention needed)
- SQL familiarity reduces learning curve
- Production-ready; used by Atlas/Supabase
- APK overhead reasonable

**What introduces risk:**

- 4-6 week timeline in active development cycle
- No off-the-shelf Expo integration guide (must adapt)
- Requires careful schema design for sync rules
- Testing multi-device scenarios critical (needs real devices)
- Reverse migration path if issues arise

### INCREMENTAL APPROACH Confidence: **9/10**

**Why this ranks higher:**

- Zero breaking changes
- Extends proven patterns
- Can measure Supplier/Receivable demand first
- Keeps development velocity
- PowerSync can still be adopted later with working baseline

---

## Recommendation

### 🎯 **PRIMARY: Pursue Incremental Coverage First**

1. **Weeks 1-3:** Extend current sync to cover Suppliers (debt tracking) and ClientReceivables
2. **Week 4:** Measure:
   - Mutation queue size in production
   - Sync success/failure rates
   - User complaints about missing entities
   - Actual APK size impact
3. **After Week 4:** Reassess PowerSync ROI with real data

### 🔄 **FALLBACK: Plan PowerSync Migration**

- If incremental approach hits limits (data consistency, conflict storms, complexity)
- Use 4-6 week window to implement PowerSync
- Leverage working code as migration template

---

## Risk Mitigation

| Risk                   | Mitigation                                           |
| ---------------------- | ---------------------------------------------------- |
| Migration data loss    | Use transaction-based import; test on staging first  |
| Multi-device conflicts | PowerSync CRDTs handle this; manual testing required |
| APK bloat              | ~53 MB still under 100 MB threshold; acceptable      |
| Sync engine rewrite    | Start with one entity type; iterate slowly           |
| Performance regression | Profile before/after with real-world payloads        |

---

## Final Verdict

**Do NOT pursue a full database rewrite today.** Instead:

1. ✅ **Fill the 7→33 entity gap** with current expo-sqlite (2-3 weeks)
2. ⏳ **Collect production metrics** (1-2 weeks)
3. 🔄 **Then decide:** PowerSync migration justified or incremental growth sufficient?

This keeps SWALO shipping while de-risking the larger architectural decision. PowerSync remains a strong option for Phase 2 if sync complexity grows beyond hand-rolled queue.

---

## References & Sizes

- **WatermelonDB:** ~500KB-1MB JS overhead | [GitHub](https://github.com/Nozbe/WatermelonDB)
- **Realm JS:** +2.5-3.1 MB native libs | [npm](https://www.npmjs.com/package/realm)
- **PowerSync React Native:** 5.95 MB | [npm](https://www.npmjs.com/package/@powersync/react-native)
- **Current sync code:** 7 entities synced out of 33 total
- **APK baseline:** ~50 MB (Expo + deps)
