import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getDeviceInfo } from './deviceInfo';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ??
  (Constants.manifest as any)?.extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000/api';

// Debug: Afficher l'URL API utilisée
console.log('🔗 API URL configurée:', API_URL);

interface ApiError {
  message: string;
  statusCode?: number;
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
          // Supprimer le token et les données utilisateur
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('shop');

          // Lancer une erreur spécifique pour l'authentification
          throw new Error('Unauthorized');
        }

        const error: ApiError = await response.json().catch(() => ({
          message: 'Une erreur est survenue',
        }));
        throw new Error(error.message || 'Request failed');
      }

      return response.json();
    } catch (error: any) {
      // Retry logic pour timeouts et erreurs réseau (cold start)
      const shouldRetry =
        retryCount < MAX_RETRIES &&
        (error.name === 'AbortError' || // Timeout
          error.message?.includes('Network request failed') || // Erreur réseau
          error.message?.includes('Failed to fetch')); // Serveur éteint

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

  async post<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
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
      user: any;
      shop: any;
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
    return api.get<any[]>(`/cash/entries${query ? `?${query}` : ''}`);
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
    return api.post<any>('/cash/entries', {
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
    return api.post<any>('/cash/merchandise-purchase', {
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
    return api.get<any[]>(`/suppliers${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<any>(`/suppliers/${id}`);
  },
  create: async (data: {
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    return api.post<any>('/suppliers', data);
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
    return api.put<any>(`/suppliers/${id}`, data);
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
    return api.post<any>(`/debts/${debtId}/payments`, data);
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
    return api.post<any>(`/suppliers/${supplierId}/claim-refund`, data);
  },
  delete: async (id: string) => {
    return api.delete<any>(`/suppliers/${id}`);
  },
  // Duplicates management
  getDuplicates: async () => {
    return api.get<any>('/suppliers/duplicates');
  },
  merge: async (keepId: string, mergeId: string) => {
    return api.post<any>('/suppliers/merge', { keep_id: keepId, merge_id: mergeId });
  },
};

// Customers API
export const customersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.is_active !== undefined) queryParams.append('is_active', String(params.is_active));

    const query = queryParams.toString();
    return api.get<any[]>(`/customers${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<any>(`/customers/${id}`);
  },
  create: async (data: {
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    credit_limit?: number;
  }) => {
    return api.post<any>('/customers', data);
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
    return api.put<any>(`/customers/${id}`, data);
  },
  delete: async (id: string) => {
    return api.delete<any>(`/customers/${id}`);
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
    return api.post<any>(`/customers/${customerId}/refund`, data);
  },
  getRefunds: async (customerId: string) => {
    return api.get<any[]>(`/customers/${customerId}/refunds`);
  },
  // Duplicates management
  getDuplicates: async () => {
    return api.get<any>('/customers/duplicates');
  },
  merge: async (keepId: string, mergeId: string) => {
    return api.post<any>('/customers/merge', { keep_id: keepId, merge_id: mergeId });
  },
};

// Receivables API (Créances clients)
export const receivablesApi = {
  getAll: async (params?: { customer_id?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return api.get<any[]>(`/receivables${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<any>(`/receivables/${id}`);
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
    return api.post<any>('/receivables', payload);
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
    return api.post<any>(`/receivables/${receivableId}/payments`, data);
  },
  cancel: async (id: string) => {
    return api.put<any>(`/receivables/${id}/cancel`, {});
  },
  delete: async (id: string) => {
    return api.delete<any>(`/receivables/${id}`);
  },
  getStats: async () => {
    return api.get<any>('/receivables/stats');
  },
};

// Debts API (Dettes fournisseurs)
export const debtsApi = {
  getAll: async (params?: { supplier_id?: string; status?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.supplier_id) queryParams.append('supplier_id', params.supplier_id);
    if (params?.status) queryParams.append('status', params.status);

    const query = queryParams.toString();
    return api.get<any[]>(`/debts${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<any>(`/debts/${id}`);
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
    return api.post<any>('/debts', payload);
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
    return api.post<any>(`/debts/${debtId}/payments`, data);
  },
  cancel: async (id: string) => {
    return api.put<any>(`/debts/${id}/cancel`, {});
  },
  delete: async (id: string) => {
    return api.delete<any>(`/debts/${id}`);
  },
  getStats: async () => {
    return api.get<any>('/debts/stats');
  },
};

// Import API
export const importApi = {
  previewCatalog: async (fileContent: string, fileName: string) => {
    return api.post<any>('/import/catalog/preview', {
      file_content: fileContent,
      file_name: fileName,
    });
  },
  confirmCatalog: async (fileContent: string, fileName: string) => {
    return api.post<any>('/import/catalog/confirm', {
      file_content: fileContent,
      file_name: fileName,
    });
  },
};

// Packaging Types API (Conditionnement)
export const packagingTypesApi = {
  getAll: async () => {
    return api.get<any[]>('/packaging-types');
  },
  getOne: async (id: string) => {
    return api.get<any>(`/packaging-types/${id}`);
  },
  create: async (data: { name: string; symbol?: string; is_default?: boolean }) => {
    return api.post<any>('/packaging-types', data);
  },
  update: async (id: string, data: { name?: string; symbol?: string; is_default?: boolean }) => {
    return api.put<any>(`/packaging-types/${id}`, data);
  },
  delete: async (id: string) => {
    return api.delete<any>(`/packaging-types/${id}`);
  },
  initDefaults: async () => {
    return api.post<any>('/packaging-types/init-defaults', {});
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
    return api.get<any[]>(`/products${query ? `?${query}` : ''}`);
  },
  getOne: async (id: string) => {
    return api.get<any>(`/products/${id}`);
  },
  getBySku: async (sku: string) => {
    return api.get<any>(`/products/sku/${sku}`);
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
    return api.post<any>('/products', data);
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
    return api.put<any>(`/products/${id}`, payload);
  },
  delete: async (id: string) => {
    return api.delete<any>(`/products/${id}`);
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
    return api.get<any[]>('/products/low-stock');
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
    return api.get<any[]>('/admin/shops');
  },
  getShopUsers: async () => {
    return api.get<any[]>('/admin/users');
  },
  getUserDevices: async (userId: string) => {
    return api.get<any[]>(`/admin/users/${userId}/devices`);
  },
  revokeDevice: async (deviceId: string) => {
    return api.delete<any>(`/admin/devices/${deviceId}`);
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
    return api.put<any>(`/admin/users/${userId}/role`, data);
  },
  deactivateUser: async (userId: string) => {
    return api.delete<any>(`/admin/users/${userId}`);
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
    return api.get<any[]>(`/pin-invites${query ? `?${query}` : ''}`);
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
    return api.delete<any>(`/pin-invites/${id}`);
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
    return api.post<any>('/inventory/movements', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
  saleOut: async (data: { product_id: string; quantity: number; sale_id?: string }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<any>('/inventory/sale-out', {
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
    return api.post<any>('/inventory/stock-in', {
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
    const result = await api.post<any>(
      '/inventory/batches',
      data,
      { 'x-device-id': deviceInfo.device_id }
    );
    console.log('✅ Stock batch created:', result);
    return result;
  },
  getProductBatches: async (productId: string) => {
    return api.get<any>(`/inventory/products/${productId}/batches`);
  },
  saleFIFO: async (data: { product_id: string; quantity: number; sale_id?: string }) => {
    const deviceInfo = await getDeviceInfo();
    return api.post<any>('/inventory/sale-fifo', {
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
    return api.post<any>('/inventory/sale-from-batch', {
      ...data,
      device_id: deviceInfo.device_id,
    });
  },
};

export default api;
