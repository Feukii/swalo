import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get the current shop ID from AsyncStorage
 * Returns null if no shop is stored (user not logged in)
 */
export async function getCurrentShopId(): Promise<string | null> {
  try {
    const shopData = await AsyncStorage.getItem('shop');
    if (!shopData) return null;

    const shop = JSON.parse(shopData);
    return shop.id || null;
  } catch (error) {
    console.error('Error getting current shop ID:', error);
    return null;
  }
}

/**
 * Get a storage key prefixed with the current shop ID
 * This ensures data isolation between different shops
 */
export async function getShopPrefixedKey(key: string): Promise<string> {
  const shopId = await getCurrentShopId();
  if (!shopId) {
    throw new Error('No shop ID found. User might not be logged in.');
  }
  return `shop_${shopId}_${key}`;
}

/**
 * Get an item from AsyncStorage with shop-specific prefix
 */
export async function getShopItem(key: string): Promise<string | null> {
  try {
    const prefixedKey = await getShopPrefixedKey(key);
    return await AsyncStorage.getItem(prefixedKey);
  } catch (error) {
    console.error(`Error getting shop item ${key}:`, error);
    return null;
  }
}

/**
 * Set an item in AsyncStorage with shop-specific prefix
 */
export async function setShopItem(key: string, value: string): Promise<void> {
  try {
    const prefixedKey = await getShopPrefixedKey(key);
    await AsyncStorage.setItem(prefixedKey, value);
  } catch (error) {
    console.error(`Error setting shop item ${key}:`, error);
    throw error;
  }
}

/**
 * Remove an item from AsyncStorage with shop-specific prefix
 */
export async function removeShopItem(key: string): Promise<void> {
  try {
    const prefixedKey = await getShopPrefixedKey(key);
    await AsyncStorage.removeItem(prefixedKey);
  } catch (error) {
    console.error(`Error removing shop item ${key}:`, error);
    throw error;
  }
}
