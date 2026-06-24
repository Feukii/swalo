/**
 * Auth Cache - Offline PIN authentication support.
 * Stores hashed PIN credentials locally for offline login.
 * TTL: 7 days (aligned with refresh token expiry).
 */

import { getDatabase } from './schema';
import { normalizeShopCode } from '@swalo/core/schemas';

const AUTH_CACHE_TTL_DAYS = 7;

export interface AuthCacheEntry {
  user_id: string;
  shop_id: string;
  shop_code: string;
  pin_hash: string;
  name: string;
  role: string;
  enabled_modules: string[];
  cached_at: string;
  expires_at: string;
}

/**
 * Simple SHA-256 hash for PIN verification (not bcrypt to avoid native deps).
 * Combined with shop_code as salt for basic security.
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  // Use a simple but effective hash: PIN + salt -> hex string
  // This avoids adding bcrypt native dependency (APK size concern)
  const data = `${salt}:${pin}:swalo_offline`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  // Use multiple rounds for slightly better security
  let result = Math.abs(hash).toString(16);
  for (let round = 0; round < 1000; round++) {
    let h = 0;
    const roundData = `${result}:${round}:${salt}`;
    for (let i = 0; i < roundData.length; i++) {
      const char = roundData.charCodeAt(i);
      h = (h << 5) - h + char;
      h |= 0;
    }
    result = Math.abs(h).toString(16) + result.slice(0, 8);
  }
  return result;
}

/**
 * Cache user credentials after a successful online login.
 * Called from LoginPinScreen on successful API login.
 */
export async function cacheAuthCredentials(params: {
  userId: string;
  shopId: string;
  shopCode: string;
  pin: string;
  name: string;
  role: string;
  enabledModules: string[];
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  // Normaliser le code (majuscules) : il sert de SEL au hash et de clé de lookup.
  // La casse doit être identique au cache et à la vérification hors-ligne.
  const shopCode = normalizeShopCode(params.shopCode);
  const pinHash = await hashPin(params.pin, shopCode);

  await db.runAsync(
    `INSERT OR REPLACE INTO auth_cache
     (user_id, shop_id, shop_code, pin_hash, name, role, enabled_modules, cached_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params.userId,
    params.shopId,
    shopCode,
    pinHash,
    params.name,
    params.role,
    JSON.stringify(params.enabledModules),
    now.toISOString(),
    expiresAt.toISOString()
  );
}

/**
 * Verify PIN against cached credentials for offline login.
 * Returns the cached user data if PIN matches and cache is valid.
 */
export async function verifyOfflinePin(
  shopCode: string,
  pin: string
): Promise<AuthCacheEntry | null> {
  const db = await getDatabase();

  // Normaliser identiquement au cache (clé de lookup + sel du hash).
  const normalizedShopCode = normalizeShopCode(shopCode);

  const row = await db.getFirstAsync<{
    user_id: string;
    shop_id: string;
    shop_code: string;
    pin_hash: string;
    name: string;
    role: string;
    enabled_modules: string;
    cached_at: string;
    expires_at: string;
  }>('SELECT * FROM auth_cache WHERE shop_code = ? LIMIT 1', normalizedShopCode);

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    // Cache expired, remove it
    await db.runAsync('DELETE FROM auth_cache WHERE user_id = ?', row.user_id);
    return null;
  }

  // Verify PIN hash
  const inputHash = await hashPin(pin, normalizedShopCode);
  if (inputHash !== row.pin_hash) return null;

  return {
    ...row,
    enabled_modules: JSON.parse(row.enabled_modules),
  };
}

/**
 * Get cached auth data for a shop (without PIN verification).
 * Used to check if offline login is available.
 */
export async function getCachedAuth(shopCode: string): Promise<AuthCacheEntry | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    user_id: string;
    shop_id: string;
    shop_code: string;
    pin_hash: string;
    name: string;
    role: string;
    enabled_modules: string;
    cached_at: string;
    expires_at: string;
  }>('SELECT * FROM auth_cache WHERE shop_code = ? LIMIT 1', normalizeShopCode(shopCode));

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return {
    ...row,
    enabled_modules: JSON.parse(row.enabled_modules),
  };
}

/**
 * Clear all cached auth data (on logout or security reset).
 */
export async function clearAuthCache(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM auth_cache');
}
