import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDeviceInfo } from './deviceInfo';

/**
 * Forme JSON arbitraire renvoyée par l'API lorsqu'un type précis n'est pas
 * encore modélisé. Plus sûr que `any` : force le consommateur à narrow.
 */
type JsonRecord = Record<string, unknown>;

/**
 * Manifest Expo (legacy) pouvant exposer `extra.apiUrl`. Utilisé comme
 * fallback de configuration de l'URL d'API.
 */
interface ManifestWithExtra {
  extra?: { apiUrl?: string } | null;
}

const legacyManifest = Constants.manifest as ManifestWithExtra | null;

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  legacyManifest?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/api';

// Debug: Afficher l'URL API utilisée
console.log('🔗 API URL configurée:', API_URL);

interface ApiError {
  message: string | string[];
  statusCode?: number;
}

/** Erreur 403 renvoyée lorsqu'un module est désactivé pour la boutique. */
interface ModuleDisabledError extends Error {
  code: 'MODULE_DISABLED';
  module?: string;
  moduleName?: string;
}

/** Forme partielle d'une réponse d'erreur JSON de l'API. */
interface ApiErrorResponse {
  message?: string | string[];
  code?: string;
  module?: string;
  moduleName?: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('access_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 secondes
    const TIMEOUT = 30000; // 30 secondes pour gérer le cold start

    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Créer un timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Gérer l'expiration de session (401 Unauthorized)
        if (response.status === 401) {
          // Lire le message d'erreur du serveur avant de nettoyer
          const errorData: ApiError = await response.json().catch(() => ({
            message: 'Unauthorized',
          }));
          const serverMessage = Array.isArray(errorData.message)
            ? errorData.message[0]
            : errorData.message;

          // Supprimer le token et les données utilisateur
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('shop');

          // Lancer l'erreur avec le message du serveur (pas un générique)
          throw new Error(serverMessage || 'Code boutique ou PIN invalide');
        }

        // Gérer les modules désactivés (403)
        if (response.status === 403) {
          const errorData: ApiErrorResponse = await response.json().catch(() => ({}));
          if (errorData?.code === 'MODULE_DISABLED') {
            const message = typeof errorData.message === 'string' ? errorData.message : undefined;
            const err = new Error(message || 'Module non disponible') as ModuleDisabledError;
            err.code = 'MODULE_DISABLED';
            err.module = errorData.module;
            err.moduleName = errorData.moduleName;
            throw err;
          }
        }

        const error: ApiError = await response.json().catch(() => ({
          message: 'Une erreur est survenue',
        }));
        const message = Array.isArray(error.message) ? error.message[0] : error.message;
        throw new Error(message || 'Request failed');
      }

      return response.json() as Promise<T>;
    } catch (error: unknown) {
      // Retry logic pour timeouts et erreurs réseau (cold start)
      const errorName = error instanceof Error ? error.name : undefined;
      const errorMessage = error instanceof Error ? error.message : undefined;
      const shouldRetry =
        retryCount < MAX_RETRIES &&
        (errorName === 'AbortError' || // Timeout
          errorMessage?.includes('Network request failed') || // Erreur réseau
          errorMessage?.includes('Failed to fetch')); // Serveur éteint

      if (shouldRetry) {
        console.log(
          `🔄 Tentative ${retryCount + 1}/${MAX_RETRIES} - Attente du réveil de l'API...`
        );
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

const api = new ApiClient(API_URL);

// Auth API
export const authApi = {
  loginWithPin: async (shop_code: string, pin_code: string) => {
    // Get device information
    const deviceInfo = await getDeviceInfo();

    const response = await api.post<{
      access_token: string;
      refresh_token: string;
      user: JsonRecord;
      shop: JsonRecord;
      enterprise?: { id: string; code: string; name: string; logo_url?: string | null } | null;
      role: string;
    }>('/auth/pin', {
      shop_code,
      pin_code,
      device_id: deviceInfo.device_id,
      device_name: deviceInfo.device_name,
      device_type: deviceInfo.device_type,
    });
    await AsyncStorage.setItem('access_token', response.access_token);
    await AsyncStorage.setItem('user', JSON.stringify({ ...response.user, role: response.role }));
    return response;
  },
  logout: async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('user');
  },
  getMe: async () => {
    return api.get<JsonRecord>('/auth/me');
  },
  verifyShop: async (code: string) => {
    return api.get<{
      exists: boolean;
      message?: string;
      shop?: { name: string; code: string };
    }>(`/auth/verify-shop/${code}`);
  },
};

// Cash API
export const cashApi = {
  getBalance: async () => {
    return api.get<{ balance: number }>('/cash/balance');
  },
  getStats: async (params?: { start_date?: string; end_date?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const query = queryParams.toString();
    return api.get<{
      balance: number;
      todayEntries: number;
      todayExits: number;
      todayNet: number;
      entriesCount: number;
      exitsCount: number;
      // KPIs ventes par mode
      totalSales: number;
      salesCash: number;
      salesCredit: number;
      salesMobile: number;
      salesCashCount: number;
      salesCreditCount: number;
      // KPIs achats par mode
      totalPurchases: number;
      purchasesCash: number;
      purchasesCredit: number;
      purchasesCashCount: number;
      purchasesCreditCount: number;
    }>(`/cash/stats${query ? `?${query}` : ''}`);
  },
  getAll: async (params?: {
    type?: 'IN' | 'OUT' | 'OPENING' | 'CLOSING';
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/cash/entries${query ? `?${query}` : ''}`);
  },
  createEntry: async (data: {
    type: 'IN' | 'OUT';
    category: string;
    amount: number;
    note?: string;
    supplier_id?: string;
    customer_id?: string;
  }) => {
    const deviceInfo = await getDeviceInfo();
    const clientOpId = `cash_${deviceInfo.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return api.post<JsonRecord>('/cash/entries', {
      ...data,
      device_id: deviceInfo.device_id,
      client_op_id: clientOpId,
    });
  },
  // New: Create merchandise purchase
  createMerchandisePurchase: async (data: {
    supplier_id: string;
    amount: number;
    description?: string;
    payment_method: 'CASH' | 'MOBILE_MONEY';
    create_debt: boolean;
  }) => {
    const deviceInfo = await getDeviceInfo();
    const clientOpId = `purchase_${deviceInfo.device_id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return api.post<JsonRecord>('/cash/merchandise-purchase', {
      ...data,
      device_id: deviceInfo.device_id,
      client_op_id: clientOpId,
    });
  },
};

// Suppliers API
export const suppliersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));

    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/suppliers${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/suppliers/${id}`);
  },
  create: async (data: {
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    return api.post<JsonRecord>('/suppliers', data);
  },
  update: async (
    id: string,
    data: {
      name?: string;
      first_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      is_active?: boolean;
    }
  ) => {
    return api.put<JsonRecord>(`/suppliers/${id}`, data);
  },
  // API pour les paiements de dettes fournisseurs
  payDebt: async (
    debtId: string,
    data: {
      amount: number;
      payment_method?: string;
      note?: string;
      cash_exit_id?: string;
    }
  ) => {
    return api.post<JsonRecord>(`/debts/${debtId}/payments`, data);
  },
  // New: Claim refund from supplier
  claimRefund: async (
    supplierId: string,
    data: {
      amount: number;
      payment_method: 'CASH' | 'MOBILE_MONEY';
      note?: string;
    }
  ) => {
    return api.post<JsonRecord>(`/suppliers/${supplierId}/claim-refund`, data);
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/suppliers/${id}`);
  },
  // Duplicates management
  getDuplicates: async () => {
    return api.get<JsonRecord>('/suppliers/duplicates');
  },
  merge: async (keepId: string, mergeId: string) => {
    return api.post<JsonRecord>('/suppliers/merge', { keep_id: keepId, merge_id: mergeId });
  },
};

// Customers API
export const customersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));

    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/customers${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/customers/${id}`);
  },
  create: async (data: {
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    credit_limit?: number;
  }) => {
    return api.post<JsonRecord>('/customers', data);
  },
  update: async (
    id: string,
    data: {
      name?: string;
      first_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      credit_limit?: number;
      is_active?: boolean;
    }
  ) => {
    return api.put<JsonRecord>(`/customers/${id}`, data);
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/customers/${id}`);
  },
  // New: Customer refund methods
  createRefund: async (
    customerId: string,
    data: {
      amount: number;
      payment_method: 'CASH' | 'MOBILE_MONEY';
      note?: string;
    }
  ) => {
    return api.post<JsonRecord>(`/customers/${customerId}/refund`, data);
  },
  getRefunds: async (customerId: string) => {
    return api.get<JsonRecord[]>(`/customers/${customerId}/refunds`);
  },
  // Duplicates management
  getDuplicates: async () => {
    return api.get<JsonRecord>('/customers/duplicates');
  },
  merge: async (keepId: string, mergeId: string) => {
    return api.post<JsonRecord>('/customers/merge', { keep_id: keepId, merge_id: mergeId });
  },
};

// Receivables API (Créances clients)
export const receivablesApi = {
  getAll: async (params?: { customer_id?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/receivables${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/receivables/${id}`);
  },
  create: async (data: {
    customer_id: string;
    amount: number;
    description?: string;
    notes?: string;
    due_date?: string;
  }) => {
    // Map notes to description if provided
    const payload = {
      ...data,
      description: data.description || data.notes,
    };
    return api.post<JsonRecord>('/receivables', payload);
  },
  addPayment: async (
    receivableId: string,
    data: {
      amount: number;
      payment_method?: string;
      note?: string;
      cash_entry_id?: string;
    }
  ) => {
    return api.post<JsonRecord>(`/receivables/${receivableId}/payments`, data);
  },
  cancel: async (id: string) => {
    return api.put<JsonRecord>(`/receivables/${id}/cancel`, {});
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/receivables/${id}`);
  },
  getStats: async () => {
    return api.get<JsonRecord>('/receivables/stats');
  },
};

// Debts API (Dettes fournisseurs)
export const debtsApi = {
  getAll: async (params?: { supplier_id?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.supplier_id) queryParams.append('supplier_id', params.supplier_id);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/debts${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/debts/${id}`);
  },
  create: async (data: {
    supplier_id: string;
    amount: number;
    description?: string;
    notes?: string;
    due_date?: string;
  }) => {
    // Map notes to description if provided
    const payload = {
      ...data,
      description: data.description || data.notes,
    };
    return api.post<JsonRecord>('/debts', payload);
  },
  addPayment: async (
    debtId: string,
    data: {
      amount: number;
      payment_method?: string;
      note?: string;
      cash_exit_id?: string;
    }
  ) => {
    return api.post<JsonRecord>(`/debts/${debtId}/payments`, data);
  },
  cancel: async (id: string) => {
    return api.put<JsonRecord>(`/debts/${id}/cancel`, {});
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/debts/${id}`);
  },
  getStats: async () => {
    return api.get<JsonRecord>('/debts/stats');
  },
};

// Seller Tasks API (Tâches vendeur : relances de créances / échéances)
/** Canaux de notification d'une relance (alignés sur l'enum Prisma). */
export type ReminderChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';

export interface SellerTask {
  id: string;
  title: string;
  message?: string;
  due_date?: string | null;
  customer_id?: string;
  receivable_id?: string;
  status: string;
  /** Client associé (enrichi par l'API), avec nom + téléphone. */
  customer?: { id?: string; name: string; phone?: string | null } | null;
  /** Solde restant dû (FCFA), null si aucune créance liée. */
  amount?: number | null;
  /** Canaux activés par le client pour cette relance. */
  channels?: ReminderChannel[];
  /** Message courtois prêt à envoyer (généré par l'API). */
  preview_message?: string | null;
}

/** Résultat d'un envoi manuel de relance. */
export interface RemindResult {
  ok: boolean;
  channelsSent?: ReminderChannel[];
  error?: string;
}

export const sellerTasksApi = {
  getTasks: async (): Promise<SellerTask[]> => {
    return api.get<SellerTask[]>('/seller-tasks');
  },
  getCount: async (): Promise<{ count: number }> => {
    return api.get<{ count: number }>('/seller-tasks/count');
  },
  markDone: async (id: string): Promise<SellerTask> => {
    return api.post<SellerTask>(`/seller-tasks/${id}/done`, {});
  },
  /**
   * Envoie une relance maintenant pour la tâche donnée.
   * @param channel - canal unique à utiliser ; si omis, tous les canaux
   *   activés par le client sont utilisés.
   */
  remind: async (id: string, channel?: ReminderChannel): Promise<RemindResult> => {
    return api.post<RemindResult>(`/seller-tasks/${id}/remind`, channel ? { channel } : {});
  },
};

// Import API
export const importApi = {
  previewCatalog: async <T = JsonRecord>(fileContent: string, fileName: string): Promise<T> => {
    return api.post<T>('/import/catalog/preview', {
      file_content: fileContent,
      file_name: fileName,
    });
  },
  confirmCatalog: async (fileContent: string, fileName: string) => {
    return api.post<JsonRecord>('/import/catalog/confirm', {
      file_content: fileContent,
      file_name: fileName,
    });
  },
};

// Packaging Types API (Conditionnement)
export const packagingTypesApi = {
  getAll: async () => {
    return api.get<JsonRecord[]>('/packaging-types');
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/packaging-types/${id}`);
  },
  create: async (data: { name: string; symbol?: string; is_default?: boolean }) => {
    return api.post<JsonRecord>('/packaging-types', data);
  },
  update: async (id: string, data: { name?: string; symbol?: string; is_default?: boolean }) => {
    return api.put<JsonRecord>(`/packaging-types/${id}`, data);
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/packaging-types/${id}`);
  },
  initDefaults: async () => {
    return api.post<JsonRecord>('/packaging-types/init-defaults', {});
  },
};

// Product Prices API
export const productPricesApi = {
  getAvailablePrices: async (productId: string) => {
    return api.get<JsonRecord>(`/products/${productId}/prices`);
  },
};

// Products API
export const productsApi = {
  getAll: async (params?: {
    search?: string;
    family?: string;
    brand?: string;
    article_type?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.family) queryParams.append('family', params.family);
    if (params?.brand) queryParams.append('brand', params.brand);
    if (params?.article_type) queryParams.append('article_type', params.article_type);
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));
    if (params?.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params?.sort_order) queryParams.append('sort_order', params.sort_order);
    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/products${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/products/${id}`);
  },
  getBySku: async (sku: string) => {
    return api.get<JsonRecord>(`/products/sku/${sku}`);
  },
  create: async (data: {
    sku: string;
    name: string;
    barcode?: string;
    description?: string;
    family?: string;
    article_type?: string;
    brand?: string;
    reference?: string;
    unit?: string;
    tax_rate?: number;
    cost_price: number;
    sell_price: number;
    is_active?: boolean;
    alert_threshold?: number;
    image_url?: string;
  }) => {
    return api.post<JsonRecord>('/products', data);
  },
  update: async (
    id: string,
    data: {
      sku?: string;
      name?: string;
      barcode?: string;
      description?: string;
      family?: string;
      article_type?: string;
      brand?: string;
      reference?: string;
      unit?: string;
      tax_rate?: number;
      cost_price?: number;
      sell_price?: number;
      is_active?: boolean;
      alert_threshold?: number;
      image_url?: string;
      // Legacy fields for StockManagementScreen compatibility
      current_stock?: number;
      unit_price?: number;
      selling_price?: number;
    }
  ) => {
    // Map legacy field names to API field names
    const payload = {
      ...data,
      cost_price: data.cost_price ?? data.unit_price,
      sell_price: data.sell_price ?? data.selling_price,
    };
    return api.put<JsonRecord>(`/products/${id}`, payload);
  },
  delete: async (id: string) => {
    return api.delete<JsonRecord>(`/products/${id}`);
  },
  getStats: async () => {
    return api.get<{
      total_products: number;
      active_products: number;
      low_stock_count: number;
      total_inventory_value: number;
    }>('/products/stats');
  },
  // Updated: getFilters with cascade filtering support
  getFilters: async (params?: { family?: string; article_type?: string; brand?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.family) queryParams.append('family', params.family);
    if (params?.article_type) queryParams.append('article_type', params.article_type);
    if (params?.brand) queryParams.append('brand', params.brand);
    const query = queryParams.toString();
    return api.get<{
      families: string[];
      brands: string[];
      article_types: string[];
    }>(`/products/filters${query ? `?${query}` : ''}`);
  },
  getFamilies: async () => {
    return api.get<string[]>('/products/families');
  },
  getBrands: async () => {
    return api.get<string[]>('/products/brands');
  },
  getArticleTypes: async () => {
    return api.get<string[]>('/products/article-types');
  },
  getLowStock: async () => {
    return api.get<JsonRecord[]>('/products/low-stock');
  },
  // New: Batch update hierarchy
  batchUpdateHierarchy: async (data: {
    level: 'family' | 'article_type' | 'brand' | 'reference';
    old_value: string;
    new_value: string;
    family?: string;
    article_type?: string;
    brand?: string;
  }) => {
    return api.post<{ count: number; message: string }>('/products/batch-update-hierarchy', data);
  },
};

// Admin API
export const adminApi = {
  getAllShops: async () => {
    return api.get<JsonRecord[]>('/admin/shops');
  },
  getShopUsers: async <T = JsonRecord>(): Promise<T[]> => {
    return api.get<T[]>('/admin/users');
  },
  getUserDevices: async (userId: string) => {
    return api.get<JsonRecord[]>(`/admin/users/${userId}/devices`);
  },
  revokeDevice: async (deviceId: string) => {
    return api.delete<JsonRecord>(`/admin/devices/${deviceId}`);
  },
  updateUserRole: async (
    userId: string,
    data: {
      role?: string;
      work_start_time?: string;
      work_end_time?: string;
      work_days?: string;
    }
  ) => {
    return api.put<JsonRecord>(`/admin/users/${userId}/role`, data);
  },
  deactivateUser: async (userId: string) => {
    return api.delete<JsonRecord>(`/admin/users/${userId}`);
  },
};

// PIN Invites API
export const pinInvitesApi = {
  create: async (data: {
    invited_name: string;
    invited_phone?: string;
    role: string;
    note?: string;
  }) => {
    return api.post<{
      id: string;
      pin_code: string;
      invited_name: string;
      invited_phone?: string;
      role: string;
      expires_at: string;
      is_used: boolean;
    }>('/pin-invites', data);
  },
  getAll: async (params?: { is_used?: boolean; is_expired?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.is_used !== undefined) queryParams.append('is_used', String(params.is_used));
    if (params?.is_expired !== undefined)
      queryParams.append('is_expired', String(params.is_expired));

    const query = queryParams.toString();
    return api.get<JsonRecord[]>(`/pin-invites${query ? `?${query}` : ''}`);
  },
  getStats: async () => {
    return api.get<{
      total: number;
      active: number;
      used: number;
      expired: number;
    }>('/pin-invites/stats');
  },
  revoke: async (id: string) => {
    return api.delete<JsonRecord>(`/pin-invites/${id}`);
  },
};

// Inventory API
export const inventoryApi = {
  createMovement: async (data: {
    product_id: string;
    type: 'IN' | 'OUT' | 'ADJUST';
    qty: number;
    reason?: string;
    ref_type?: string;
    ref_id?: string;
    unit_cost?: number;
  }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<JsonRecord>('/inventory/movements', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
  saleOut: async (data: { product_id: string; quantity: number; sale_id?: string }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<JsonRecord>('/inventory/sale-out', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
  stockIn: async (data: {
    product_id: string;
    quantity: number;
    unit_cost?: number;
    reason?: string;
  }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<JsonRecord>('/inventory/stock-in', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
  // Stock batches (lots avec prix)
  createBatch: async (data: {
    product_id: string;
    quantity: number;
    cost_price: number;
    sell_price: number;
    notes?: string;
  }) => {
    const deviceInfo = await getDeviceInfo();
    console.log('📦 Creating stock batch:', { ...data, device_id: deviceInfo.device_id });
    const result = await api.post<JsonRecord>('/inventory/batches', data, {
      'x-device-id': deviceInfo.device_id,
    });
    console.log('✅ Stock batch created:', result);
    return result;
  },
  getProductBatches: async (productId: string) => {
    return api.get<JsonRecord>(`/inventory/products/${productId}/batches`);
  },
  saleFIFO: async (data: { product_id: string; quantity: number; sale_id?: string }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<JsonRecord>('/inventory/sale-fifo', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
  saleFromBatch: async (data: {
    product_id: string;
    batch_id: string;
    quantity: number;
    sale_id?: string;
  }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<JsonRecord>('/inventory/sale-from-batch', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
};

// ============================================================
// Sync API
// ============================================================
export const syncApi = {
  pull: async (data: {
    device_id: string;
    last_sync_at?: string;
    entity_versions?: Record<string, number>;
  }) => {
    return api.post<{
      changes: Record<string, JsonRecord[]>;
      newCursor: string;
      serverTime: string;
    }>('/sync/pull', data);
  },

  push: async (data: {
    device_id: string;
    changes: Record<string, JsonRecord[]>;
    base_cursor?: string;
  }) => {
    return api.post<{
      applied: Record<string, string[]>;
      conflicts: Array<{
        entity: string;
        id: string;
        reason: string;
        serverVersion?: Record<string, unknown>;
        clientVersion?: Record<string, unknown>;
      }>;
      newCursor: string;
      serverTime: string;
    }>('/sync/push', data);
  },

  status: async (deviceId: string) => {
    return api.get<JsonRecord>(`/sync/status?device_id=${deviceId}`);
  },
};

export const enterpriseApi = {
  getAll: async () => {
    return api.get<JsonRecord[]>('/enterprises');
  },

  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/enterprises/${id}`);
  },

  getShops: async (id: string) => {
    return api.get<JsonRecord[]>(`/enterprises/${id}/shops`);
  },

  getStats: async (id: string) => {
    return api.get<JsonRecord>(`/enterprises/${id}/stats`);
  },
};

export const transfersApi = {
  getAll: async <T = JsonRecord>(enterpriseId?: string): Promise<T[]> => {
    const params = enterpriseId ? `?enterprise_id=${enterpriseId}` : '';
    return api.get<T[]>(`/transfers${params}`);
  },

  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/transfers/${id}`);
  },

  create: async (data: {
    source_shop_id: string;
    target_shop_id: string;
    items: Array<{
      product_sku: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      cost_price: number;
    }>;
    notes?: string;
  }) => {
    return api.post<JsonRecord>('/transfers', data);
  },

  confirm: async (id: string) => {
    return api.put<JsonRecord>(`/transfers/${id}/confirm`, {});
  },

  ship: async (id: string) => {
    return api.put<JsonRecord>(`/transfers/${id}/ship`, {});
  },

  receive: async (id: string) => {
    return api.put<JsonRecord>(`/transfers/${id}/receive`, {});
  },

  cancel: async (id: string) => {
    return api.put<JsonRecord>(`/transfers/${id}/cancel`, {});
  },
};

// Invoices API (Factures)
export const invoicesApi = {
  createFromSale: async (saleId: string, notes?: string) => {
    return api.post<JsonRecord>(`/invoices/from-sale/${saleId}`, { notes });
  },

  getAll: async <T = JsonRecord>(params?: {
    customer_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<T[]> => {
    const queryParams = new URLSearchParams();
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    const query = queryParams.toString();
    return api.get<T[]>(`/invoices${query ? `?${query}` : ''}`);
  },

  getOne: async (id: string) => {
    return api.get<JsonRecord>(`/invoices/${id}`);
  },

  getPdfBase64: async (id: string) => {
    return api.get<{ pdf_data: string; number: string }>(`/invoices/${id}/pdf?format=base64`);
  },

  regeneratePdf: async (id: string) => {
    return api.post<JsonRecord>(`/invoices/${id}/regenerate-pdf`);
  },

  cancel: async (id: string) => {
    return api.put<JsonRecord>(`/invoices/${id}/cancel`);
  },
};

export const shopSwitchApi = {
  getAccessibleShops: async () => {
    return api.get<
      Array<{
        shop: {
          id: string;
          code: string;
          name: string;
          shop_type: string;
          enterprise_id: string | null;
          enterprise: { id: string; code: string; name: string } | null;
        };
        role: string;
      }>
    >('/auth/accessible-shops');
  },

  switchShop: async (shopId: string) => {
    return api.post<{
      user: JsonRecord;
      shop: JsonRecord;
      role: string;
      access_token: string;
      refresh_token: string;
    }>('/auth/switch-shop', { shop_id: shopId });
  },
};

export default api;
