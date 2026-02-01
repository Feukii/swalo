/**
 * Hook to get the current authenticated user and shop info from AsyncStorage.
 * Used by screens that need shop_id for local database queries.
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrentUser {
  id: string;
  name: string;
  first_name?: string;
  role: string;
  shop_id?: string;
}

interface CurrentShop {
  id: string;
  name: string;
  code: string;
}

interface UseCurrentUserResult {
  user: CurrentUser | null;
  shop: CurrentShop | null;
  shopId: string | null;
  userId: string | null;
  loading: boolean;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [shop, setShop] = useState<CurrentShop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [userJson, shopJson] = await Promise.all([
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('shop'),
        ]);

        if (userJson) {
          setUser(JSON.parse(userJson));
        }
        if (shopJson) {
          setShop(JSON.parse(shopJson));
        }
      } catch (e) {
        console.error('Error loading user/shop from storage:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return {
    user,
    shop,
    shopId: shop?.id || user?.shop_id || null,
    userId: user?.id || null,
    loading,
  };
}
