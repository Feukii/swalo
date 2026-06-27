import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Configuration retry pour gérer les cold starts (spin up)
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 secondes

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 secondes pour gérer le cold start
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs avec retry logic
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as any;

    // Gestion de l'authentification
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Gestion des modules desactives (403)
    if (error.response?.status === 403) {
      const data = error.response.data as any;
      if (data?.code === 'MODULE_DISABLED') {
        window.dispatchEvent(
          new CustomEvent('module-disabled', {
            detail: {
              module: data.module,
              moduleName: data.moduleName,
              message: data.message,
            },
          })
        );
      }
      return Promise.reject(error);
    }

    // Retry logic pour timeouts et erreurs réseau (cold start)
    if (!config || !config.retry) {
      config.retry = 0;
    }

    const shouldRetry =
      config.retry < MAX_RETRIES &&
      (error.code === 'ECONNABORTED' || // Timeout
        error.code === 'ERR_NETWORK' || // Erreur réseau
        !error.response); // Pas de réponse (serveur éteint)

    if (shouldRetry) {
      config.retry += 1;
      console.log(`🔄 Tentative ${config.retry}/${MAX_RETRIES} - Attente du réveil de l'API...`);
      await sleep(RETRY_DELAY * config.retry); // Backoff exponentiel
      return api(config);
    }

    return Promise.reject(error);
  }
);

const getBrowserDeviceId = () => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

const generateClientOpId = () => `cash_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Auth API
export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    display_name: string;
    phone: string;
    shop_code: string;
    shop_name: string;
    currency: string;
  }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (email_or_phone: string, password: string) => {
    const response = await api.post('/auth/login', { email_or_phone, password });
    return response.data;
  },

  loginWithPin: async (shop_code: string, pin_code: string) => {
    // Generate or retrieve device ID
    const deviceId = getBrowserDeviceId();

    // Get device information
    const deviceName = `${navigator.platform} - ${navigator.userAgent.split(/[()]/)[1] || 'Unknown'}`;
    const deviceType = 'web';

    const response = await api.post('/auth/pin', {
      shop_code,
      pin_code,
      device_id: deviceId,
      device_name: deviceName,
      device_type: deviceType,
    });
    return response.data;
  },

  createShop: async (data: {
    shop_name: string;
    owner_name: string;
    phone?: string;
    currency?: string;
  }) => {
    const response = await api.post('/auth/create-shop', data);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateShopCode: async (pin_code: string) => {
    const response = await api.patch('/auth/shop-code', { pin_code });
    return response.data;
  },
};

// Products API
export const productsApi = {
  getAll: async (params?: {
    search?: string;
    category?: string;
    is_active?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  create: async (data: {
    sku: string;
    name: string;
    description?: string;
    category?: string;
    unit?: string;
    barcode?: string;
    cost_price: number;
    sell_price: number;
    alert_threshold?: number;
    tax_rate?: number;
    packaging_type_id?: string;
    units_per_package?: number;
    package_price?: number;
  }) => {
    const response = await api.post('/products', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      sku: string;
      name: string;
      description?: string;
      category?: string;
      unit?: string;
      barcode?: string;
      cost_price: number;
      sell_price: number;
      alert_threshold?: number;
      tax_rate?: number;
      is_active: boolean;
      packaging_type_id?: string;
      units_per_package?: number;
      package_price?: number;
    }>
  ) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/products/categories');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/products/stats');
    return response.data;
  },

  getLowStock: async () => {
    const response = await api.get('/products/low-stock');
    return response.data;
  },
};

// Sales API
export const salesApi = {
  getAll: async (params?: {
    customer_id?: string;
    status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/sales/stats');
    return response.data;
  },

  create: async (data: {
    customer_id?: string;
    items: Array<{
      product_id: string;
      qty: number;
      unit_price: number;
      discount?: number;
    }>;
    discount?: number;
    notes?: string;
    status?: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
    due_date?: string;
  }) => {
    const response = await api.post('/sales', data);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.put(`/sales/${id}/cancel`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/sales/${id}`);
    return response.data;
  },
};

// Cash Entries API
export const cashApi = {
  getAll: async (params?: {
    type?: 'IN' | 'OUT' | 'OPENING' | 'CLOSING';
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/cash/entries', { params });
    return response.data;
  },

  getBalance: async () => {
    const response = await api.get('/cash/balance');
    return response.data;
  },

  getStats: async (params?: { start_date?: string; end_date?: string }) => {
    const response = await api.get('/cash/stats', { params });
    return response.data;
  },

  createEntry: async (data: {
    type: 'IN' | 'OUT';
    category: string;
    amount: number;
    note?: string;
    supplier_id?: string;
    customer_id?: string;
  }) => {
    const response = await api.post('/cash/entries', {
      ...data,
      device_id: getBrowserDeviceId(),
      client_op_id: generateClientOpId(),
    });
    return response.data;
  },
};

// Suppliers API
export const suppliersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/suppliers/stats');
    return response.data;
  },

  create: async (data: {
    code?: string;
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    borrowing_limit?: number;
    email_notifications_enabled?: boolean;
    sms_notifications_enabled?: boolean;
    whatsapp_notifications_enabled?: boolean;
  }) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      code?: string;
      name: string;
      first_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      is_active: boolean;
      borrowing_limit?: number;
      email_notifications_enabled?: boolean;
      sms_notifications_enabled?: boolean;
      whatsapp_notifications_enabled?: boolean;
    }>
  ) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  /**
   * Envoie une relance maintenant à un fournisseur (sans tâche préexistante).
   * Le message + le solde dû sont construits côté API à partir des dettes
   * PENDING/PARTIAL du fournisseur. Sémantique inversée : nous devons au
   * fournisseur.
   * @param supplierId - identifiant du fournisseur à relancer.
   * @param channels - canaux à utiliser ; si omis, tous les canaux activés.
   */
  manualRemind: async (supplierId: string, channels?: string[]) => {
    const response = await api.post('/seller-tasks/manual-remind-supplier', {
      supplier_id: supplierId,
      ...(channels && channels.length > 0 ? { channels } : {}),
    });
    return response.data;
  },
};

// Customers API
export const customersApi = {
  getAll: async (params?: { search?: string; is_active?: boolean }) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/customers/stats');
    return response.data;
  },

  create: async (data: {
    code?: string;
    name: string;
    first_name?: string;
    phone?: string;
    email?: string;
    address?: string;
    credit_limit?: number;
    notes?: string;
    sms_notifications_enabled?: boolean;
    whatsapp_notifications_enabled?: boolean;
  }) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  update: async (
    id: string,
    data: Partial<{
      code?: string;
      name: string;
      first_name?: string;
      phone?: string;
      email?: string;
      address?: string;
      credit_limit?: number;
      notes?: string;
      is_active: boolean;
      sms_notifications_enabled?: boolean;
      whatsapp_notifications_enabled?: boolean;
    }>
  ) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },
};

// Receivables API (Créances clients)
export const receivablesApi = {
  getAll: async (params?: { customer_id?: string; status?: string }) => {
    const response = await api.get('/receivables', { params });
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/receivables/${id}`);
    return response.data;
  },
  create: async (data: {
    customer_id: string;
    amount: number;
    description?: string;
    due_date?: string;
  }) => {
    const response = await api.post('/receivables', data);
    return response.data;
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
    const response = await api.post(`/receivables/${receivableId}/payments`, data);
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.put(`/receivables/${id}/cancel`);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/receivables/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/receivables/stats');
    return response.data;
  },
};

// Debts API (Dettes fournisseurs)
export const debtsApi = {
  getAll: async (params?: { supplier_id?: string; status?: string }) => {
    const response = await api.get('/debts', { params });
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/debts/${id}`);
    return response.data;
  },
  create: async (data: {
    supplier_id: string;
    amount: number;
    description?: string;
    due_date?: string;
  }) => {
    const response = await api.post('/debts', data);
    return response.data;
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
    const response = await api.post(`/debts/${debtId}/payments`, data);
    return response.data;
  },
  cancel: async (id: string) => {
    const response = await api.put(`/debts/${id}/cancel`);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/debts/${id}`);
    return response.data;
  },
  getStats: async () => {
    const response = await api.get('/debts/stats');
    return response.data;
  },
};

// Product Batches API (Lots de stock)
export const productBatchesApi = {
  getProductBatches: async (productId: string) => {
    const response = await api.get(`/inventory/products/${productId}/batches`);
    return response.data || response;
  },
  getAvailablePrices: async (productId: string) => {
    const response = await api.get(`/products/${productId}/prices`);
    return response.data || response;
  },
};

// Inventory API (Mouvements de stock : réceptions & sorties)
export const inventoryApi = {
  /** Entrée de stock (réception). Montants en centimes. */
  stockIn: async (data: { product_id: string; quantity: number; unit_cost?: number; reason?: string }) => {
    const response = await api.post('/inventory/stock-in', data, {
      headers: { 'x-device-id': getBrowserDeviceId() },
    });
    return response.data;
  },
  /** Réception créant un lot daté (prix de revient + date de prise en compte). Montants en centimes. */
  createBatch: async (data: {
    product_id: string;
    quantity: number;
    cost_price: number;
    sell_price: number;
    received_at?: string;
  }) => {
    const response = await api.post('/inventory/batches', data, {
      headers: { 'x-device-id': getBrowserDeviceId() },
    });
    return response.data;
  },
  /** Mouvement de stock générique (sortie : qty négative). */
  createMovement: async (data: {
    product_id: string;
    type: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'INVENTORY';
    qty: number;
    reason?: string;
    unit_cost?: number;
  }) => {
    const response = await api.post('/inventory/movements', data, {
      headers: { 'x-device-id': getBrowserDeviceId() },
    });
    return response.data;
  },
};

// Invoices API
export const invoicesApi = {
  getAll: async (params?: {
    customer_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/invoices', { params });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  createFromSale: async (saleId: string, notes?: string) => {
    const response = await api.post(`/invoices/from-sale/${saleId}`, { notes });
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.put(`/invoices/${id}/cancel`);
    return response.data;
  },

  getPdfBase64: async (id: string) => {
    const response = await api.get(`/invoices/${id}/pdf?format=base64`);
    return response.data;
  },

  regeneratePdf: async (id: string) => {
    const response = await api.post(`/invoices/${id}/regenerate-pdf`);
    return response.data;
  },
};

// Enterprise API
export const enterpriseApi = {
  getAll: async () => {
    const response = await api.get('/enterprises');
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/enterprises/${id}`);
    return response.data;
  },

  update: async (id: string, data: { code?: string; name?: string }) => {
    const response = await api.put(`/enterprises/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/enterprises/${id}`);
    return response.data;
  },

  getShops: async (id: string) => {
    const response = await api.get(`/enterprises/${id}/shops`);
    return response.data;
  },

  getStats: async (id: string) => {
    const response = await api.get(`/enterprises/${id}/stats`);
    return response.data;
  },

  getFinancialSummary: async (id: string, filters?: { start_date?: string; end_date?: string }) => {
    const params: Record<string, string> = {};
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;
    const response = await api.get(`/enterprises/${id}/financial-summary`, { params });
    return response.data;
  },
};

// Transfers API (Inter-shop)
export const transfersApi = {
  getAll: async () => {
    const response = await api.get('/transfers');
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/transfers/${id}`);
    return response.data;
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
    const response = await api.post('/transfers', data);
    return response.data;
  },

  confirm: async (id: string) => {
    const response = await api.put(`/transfers/${id}/confirm`);
    return response.data;
  },

  ship: async (id: string) => {
    const response = await api.put(`/transfers/${id}/ship`);
    return response.data;
  },

  receive: async (id: string) => {
    const response = await api.put(`/transfers/${id}/receive`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await api.put(`/transfers/${id}/cancel`);
    return response.data;
  },
};

// Admin API
export const adminApi = {
  // ---- Enterprise CRUD (read-only, creation via web-admin) ----
  getAllEnterprises: async () => {
    const response = await api.get('/admin/enterprises');
    return response.data;
  },

  getEnterpriseDetails: async (id: string) => {
    const response = await api.get(`/admin/enterprises/${id}`);
    return response.data;
  },

  updateEnterprise: async (
    id: string,
    data: {
      name?: string;
      license_tier?: string;
      max_shops?: number;
      max_users_per_shop?: number;
      licensed_until?: string;
    }
  ) => {
    const response = await api.put(`/admin/enterprises/${id}`, data);
    return response.data;
  },

  deleteEnterprise: async (id: string) => {
    const response = await api.delete(`/admin/enterprises/${id}`);
    return response.data;
  },

  // ---- Enterprise <-> Shop ----
  addShopToEnterprise: async (enterpriseId: string, shopId: string) => {
    const response = await api.post(`/admin/enterprises/${enterpriseId}/shops/${shopId}`);
    return response.data;
  },

  moveShopToEnterprise: async (shopId: string, enterpriseId: string) => {
    const response = await api.put(`/admin/shops/${shopId}/move-to-enterprise/${enterpriseId}`);
    return response.data;
  },

  // ---- License Management ----
  updateLicense: async (
    enterpriseId: string,
    data: {
      license_tier: string;
      licensed_until?: string;
      max_shops?: number;
      max_users_per_shop?: number;
    }
  ) => {
    const response = await api.put(`/admin/enterprises/${enterpriseId}/license`, data);
    return response.data;
  },

  // ---- Shop Management ----
  createShop: async (data: {
    shop_name: string;
    shop_code?: string;
    owner_id?: string;
    owner_name?: string;
    owner_phone?: string;
    enterprise_id: string;
    shop_type?: string;
    address?: string;
    phone?: string;
    email?: string;
    currency?: string;
    enabled_modules?: string[];
  }) => {
    const response = await api.post('/admin/shops', data);
    return response.data;
  },

  getAllShops: async () => {
    const response = await api.get('/admin/shops');
    return response.data;
  },

  getShopDetails: async (shopId: string) => {
    const response = await api.get(`/admin/shops/${shopId}`);
    return response.data;
  },

  deleteShop: async (shopId: string) => {
    const response = await api.delete(`/admin/shops/${shopId}`);
    return response.data;
  },

  // ---- Global Users ----
  getGlobalUsers: async (params?: {
    search?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/admin/users/global', { params });
    return response.data;
  },

  // ---- System Stats ----
  getSystemStats: async () => {
    const response = await api.get('/admin/stats/system');
    return response.data;
  },

  // ---- System Config ----
  getSystemConfigs: async () => {
    const response = await api.get('/admin/system-config');
    return response.data;
  },

  getSystemConfig: async (key: string) => {
    const response = await api.get(`/admin/system-config/${key}`);
    return response.data;
  },

  setSystemConfig: async (key: string, data: { value: string; description?: string }) => {
    const response = await api.put(`/admin/system-config/${key}`, data);
    return response.data;
  },

  deleteSystemConfig: async (key: string) => {
    const response = await api.delete(`/admin/system-config/${key}`);
    return response.data;
  },

  // ---- Audit Logs ----
  getAuditLogs: async (filters?: {
    action?: string;
    entity_type?: string;
    admin_id?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/admin/audit-logs', { params: filters });
    return response.data;
  },

  exportAuditLogs: async (filters?: {
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/admin/audit-logs/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  // ---- Shop Owner / Admin endpoints ----
  getShopUsers: async (shopId?: string) => {
    const url = shopId ? `/admin/shops/${shopId}/users` : '/admin/users';
    const response = await api.get(url);
    return response.data;
  },

  getUserDevices: async (userId: string) => {
    const response = await api.get(`/admin/users/${userId}/devices`);
    return response.data;
  },

  revokeDevice: async (deviceId: string) => {
    const response = await api.delete(`/admin/devices/${deviceId}`);
    return response.data;
  },

  revokeAllUserDevices: async (userId: string, currentDeviceId: string) => {
    const response = await api.post(`/admin/users/${userId}/revoke-devices`, {
      currentDeviceId,
    });
    return response.data;
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
    const response = await api.put(`/admin/users/${userId}/role`, data);
    return response.data;
  },

  deactivateUser: async (userId: string) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },

  // ---- Block/Unblock ----
  blockShop: async (shopId: string, reason: string) => {
    const response = await api.post(`/admin/shops/${shopId}/block`, { reason });
    return response.data;
  },

  unblockShop: async (shopId: string) => {
    const response = await api.post(`/admin/shops/${shopId}/unblock`);
    return response.data;
  },

  blockUser: async (userId: string, reason: string) => {
    const response = await api.post(`/admin/users/${userId}/block`, { reason });
    return response.data;
  },

  unblockUser: async (userId: string) => {
    const response = await api.post(`/admin/users/${userId}/unblock`);
    return response.data;
  },

  blockEnterprise: async (enterpriseId: string, reason: string) => {
    const response = await api.post(`/admin/enterprises/${enterpriseId}/block`, { reason });
    return response.data;
  },

  unblockEnterprise: async (enterpriseId: string) => {
    const response = await api.post(`/admin/enterprises/${enterpriseId}/unblock`);
    return response.data;
  },

  // ---- Enhanced Stats ----
  getEnhancedSystemStats: async () => {
    const response = await api.get('/admin/system/stats');
    return response.data;
  },

  // ---- Module Management ----
  getShopModules: async (shopId: string) => {
    const response = await api.get(`/admin/shops/${shopId}/modules`);
    return response.data;
  },

  updateShopModules: async (shopId: string, modules: string[]) => {
    const response = await api.post(`/admin/shops/${shopId}/modules`, { modules });
    return response.data;
  },
};

// Seller Tasks API (Taches vendeur — relances dettes/creances)
/** Canaux de notification d'une relance (alignés sur l'enum Prisma). */
export type ReminderChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';

export interface SellerTask {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'DONE';
  due_date?: string;
  customer_id?: string;
  receivable_id?: string;
  created_at: string;
  done_at?: string;
  /** Client associé (enrichi par l'API), avec nom + téléphone. */
  customer?: { id?: string; name: string; phone?: string | null } | null;
  /** Solde restant dû (FCFA entier), null si aucune créance liée. */
  amount?: number | null;
  /** Canaux activés par le client pour cette relance. */
  channels?: ReminderChannel[];
  /** Message courtois prêt à envoyer (généré par l'API). */
  preview_message?: string | null;
}

export interface SellerTaskCount {
  count: number;
}

/** Résultat d'un envoi manuel de relance. */
export interface RemindResult {
  ok: boolean;
  channelsSent?: ReminderChannel[];
  error?: string;
}

export const sellerTasksApi = {
  getTasks: async (): Promise<SellerTask[]> => {
    const response = await api.get<SellerTask[]>('/seller-tasks');
    return response.data;
  },
  getCount: async (): Promise<SellerTaskCount> => {
    const response = await api.get<SellerTaskCount>('/seller-tasks/count');
    return response.data;
  },
  markDone: async (id: string): Promise<SellerTask> => {
    const response = await api.post<SellerTask>(`/seller-tasks/${id}/done`);
    return response.data;
  },
  /**
   * Envoie une relance maintenant pour la tâche donnée.
   * @param id - identifiant de la tâche vendeur.
   * @param channel - canal unique à utiliser ; si omis, tous les canaux
   *   activés par le client sont utilisés.
   */
  remind: async (id: string, channel?: ReminderChannel): Promise<RemindResult> => {
    const response = await api.post<RemindResult>(
      `/seller-tasks/${id}/remind`,
      channel ? { channel } : {}
    );
    return response.data;
  },
  /**
   * Envoie une relance maintenant à un client SANS tâche vendeur préexistante.
   * Le message est construit côté API à partir du solde dû actuel du client
   * (créances PENDING/PARTIAL).
   * @param customerId - identifiant du client à relancer.
   * @param channels - canaux à utiliser ; si omis, tous les canaux activés par le client.
   */
  manualRemind: async (
    customerId: string,
    channels?: ReminderChannel[]
  ): Promise<RemindResult> => {
    const response = await api.post<RemindResult>('/seller-tasks/manual-remind', {
      customer_id: customerId,
      ...(channels && channels.length > 0 ? { channels } : {}),
    });
    return response.data;
  },
};

// Reminder Settings API (Réglages relances de créances)
export interface ReminderSettings {
  payment_reminders_enabled: boolean;
  notification_email: string | null;
  payment_reminder_cadence_days: number;
  /** Décalages (en jours) auxquels les relances sont envoyées, ex: [-7, -3, 0]. */
  offsets: number[];
}

export interface ReminderSettingsUpdate {
  payment_reminders_enabled?: boolean;
  notification_email?: string | null;
  payment_reminder_cadence_days?: number;
}

export const reminderSettingsApi = {
  get: async (): Promise<ReminderSettings> => {
    const response = await api.get<ReminderSettings>('/shops/me/reminder-settings');
    return response.data;
  },
  update: async (payload: ReminderSettingsUpdate): Promise<ReminderSettings> => {
    const response = await api.put<ReminderSettings>('/shops/me/reminder-settings', payload);
    return response.data;
  },
};

// Reports API (Rapports réseau multi-boutiques)
export type ShopHealth = 'Sain' | 'A surveiller' | 'En difficulte';

export interface NetworkShopReport {
  id: string;
  name: string;
  /** CA du jour, en centimes */
  ca_jour: number;
  /** Marge en pourcentage (ex: 38 pour 38%) */
  marge: number;
  /** Solde de caisse, en centimes */
  caisse: number;
  /** Créances clients, en centimes */
  creances: number;
  etat: ShopHealth;
}

export interface NetworkReportTotals {
  /** CA réseau du jour, en centimes */
  ca_reseau: number;
  /** Trésorerie réseau (somme des caisses), en centimes */
  tresorerie_reseau: number;
  /** Créances réseau, en centimes */
  creances_reseau: number;
  /** Marge réseau, en centimes */
  marge_reseau: number;
  /** Marge moyenne en pourcentage (ex: 35.5 pour 35,5%) */
  marge_moyenne: number;
}

export interface NetworkReport {
  shops: NetworkShopReport[];
  totals: NetworkReportTotals;
}

// --- Rapports boutique (vue business mono-boutique, miroir mobile) ---
// Tous les montants sont des entiers en FCFA (affichés tels quels).
export interface ShopCashFlowDailyPoint {
  /** Jour au format YYYY-MM-DD. */
  date: string;
  /** Solde net du jour (encaissements − décaissements). */
  net: number;
}

export interface ShopCashCategoryRow {
  /** Catégorie d'encaissement normalisée (ventes, remboursement_client, …). */
  category: string;
  amount: number;
}

export interface ShopCashFlowReport {
  total_in: number;
  total_out: number;
  net: number;
  /** Tendance des 7 derniers jours glissants (du plus ancien au plus récent). */
  daily: ShopCashFlowDailyPoint[];
  by_category_in: ShopCashCategoryRow[];
}

export interface ShopPaymentMethodRow {
  method: string;
  count: number;
  total: number;
}

export interface ShopSalesReport {
  total_sales: number;
  completed_sales: number;
  cancelled_sales: number;
  total_revenue: number;
  average_ticket: number;
  by_payment_method: ShopPaymentMethodRow[];
}

export interface ShopCashReport {
  total_entries: number;
  total_exits: number;
  net_flow: number;
  entries_count: number;
  exits_count: number;
  cash_balance: number;
  pending_receivables: number;
  pending_receivables_count: number;
  pending_debts: number;
  pending_debts_count: number;
}

export interface ShopTopProduct {
  id: string;
  name: string;
  /** Chiffre d'affaires du produit sur la période (FCFA). */
  value: number;
  /** Quantité vendue. */
  count: number;
}

type DateRangeFilter = { start_date?: string; end_date?: string };

export const reportsApi = {
  /** Vue réseau multi-boutiques (rôle BOSS). Tous les montants sont en centimes. */
  getNetwork: async (): Promise<NetworkReport> => {
    const response = await api.get<NetworkReport>('/reports/network');
    return response.data;
  },

  /** Flux de caisse de la boutique : totaux, tendance 7 jours, répartition encaissements. */
  getCashFlow: async (filters?: DateRangeFilter): Promise<ShopCashFlowReport> =>
    (await api.get<ShopCashFlowReport>('/reports/cash-flow', { params: filters })).data,

  /** Rapport ventes de la boutique (totaux + répartition par moyen de paiement). */
  getSales: async (filters?: DateRangeFilter): Promise<ShopSalesReport> =>
    (await api.get<ShopSalesReport>('/reports/sales', { params: filters })).data,

  /** Rapport trésorerie de la boutique (inclut créances et dettes en cours). */
  getCash: async (filters?: DateRangeFilter): Promise<ShopCashReport> =>
    (await api.get<ShopCashReport>('/reports/cash', { params: filters })).data,

  /** Top produits de la boutique par chiffre d'affaires sur la période. */
  getTopProducts: async (filters?: DateRangeFilter, limit = 5): Promise<ShopTopProduct[]> =>
    (await api.get<ShopTopProduct[]>('/reports/top-products', { params: { ...filters, limit } }))
      .data,
};

// Accounting API (Comptabilité en partie double : journal, grand livre, bilan, résultat)
// Tous les montants sont des entiers en FCFA (aucune division à l'affichage).
export interface AccountingEntryLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

export interface AccountingJournalEntry {
  date: string;
  libelle: string;
  lines: AccountingEntryLine[];
}

export interface AccountingLedgerMovement {
  account: string;
  debit: number;
  credit: number;
  date: string;
  libelle: string;
}

export interface AccountingLedgerAccount {
  account: string;
  name: string;
  classe: number;
  debit: number;
  credit: number;
  solde: number;
  mouvements: AccountingLedgerMovement[];
}

export interface AccountingAmountRow {
  account: string;
  name: string;
  montant: number;
}

export interface AccountingBalanceSheet {
  actif: AccountingAmountRow[];
  passif: AccountingAmountRow[];
  totalActif: number;
  totalPassif: number;
  resultat: number;
  equilibre: boolean;
}

export interface AccountingIncomeStatement {
  ca: number;
  cogs: number;
  margeBrute: number;
  charges: AccountingAmountRow[];
  autresProduits: number;
  beneficeNet: number;
}

export interface AccountingReport {
  journal: AccountingJournalEntry[];
  grand_livre: AccountingLedgerAccount[];
  bilan: AccountingBalanceSheet;
  resultat: AccountingIncomeStatement;
}

export const accountingApi = {
  getReport: async (filters?: { start_date?: string; end_date?: string }): Promise<AccountingReport> =>
    (await api.get<AccountingReport>('/reports/accounting', { params: filters })).data,
};

// Supervision API (Actions anormales du jour)
export type SupervisionSeverity = 'critical' | 'review';

export interface SupervisionAlert {
  id: string;
  kind: string;
  severity: SupervisionSeverity;
  title: string;
  detail: string;
  author: string | null;
  created_at: string;
}

export interface SupervisionReport {
  alerts: SupervisionAlert[];
  critical_count: number;
  review_count: number;
  total: number;
}

export const supervisionApi = {
  getReport: async (filters?: { start_date?: string; end_date?: string }): Promise<SupervisionReport> =>
    (await api.get<SupervisionReport>('/reports/supervision', { params: filters })).data,
  acknowledgeAlert: async (alertId: string, note?: string): Promise<{ ok: boolean }> =>
    (await api.post<{ ok: boolean }>('/reports/supervision/ack', { alert_id: alertId, ...(note ? { note } : {}) }))
      .data,
};

// Packaging Types API (Conditionnements)
export const packagingTypesApi = {
  getAll: async () => {
    const response = await api.get('/packaging-types');
    return response.data;
  },
  create: async (data: { name: string; symbol?: string; is_default?: boolean }) => {
    const response = await api.post('/packaging-types', data);
    return response.data;
  },
  update: async (id: string, data: { name?: string; symbol?: string; is_default?: boolean }) => {
    const response = await api.put(`/packaging-types/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/packaging-types/${id}`);
    return response.data;
  },
  initDefaults: async () => {
    const response = await api.post('/packaging-types/init-defaults', {});
    return response.data;
  },
};
