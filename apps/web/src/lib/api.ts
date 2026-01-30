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
    }>
  ) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/suppliers/${id}`);
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

// Admin API
export const adminApi = {
  // Super Admin endpoints
  getAllShops: async () => {
    const response = await api.get('/admin/shops');
    return response.data;
  },

  getShopDetails: async (shopId: string) => {
    const response = await api.get(`/admin/shops/${shopId}`);
    return response.data;
  },

  getSystemStats: async () => {
    const response = await api.get('/admin/stats/system');
    return response.data;
  },

  deleteShop: async (shopId: string) => {
    const response = await api.delete(`/admin/shops/${shopId}`);
    return response.data;
  },

  // Shop Owner / Admin endpoints
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

// Invoices API (Factures)
export const invoicesApi = {
  getAll: async (params?: { customer_id?: string; start_date?: string; end_date?: string }) => {
    const response = await api.get('/invoices', { params });
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },
  createFromSale: async (saleId: string) => {
    const response = await api.post(`/invoices/from-sale/${saleId}`);
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
