import axios, { type AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as any;

    if (error.response?.status === 401) {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (!config || !config.retry) {
      config.retry = 0;
    }

    const shouldRetry =
      config.retry < MAX_RETRIES &&
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response);

    if (shouldRetry) {
      config.retry += 1;
      await sleep(RETRY_DELAY * config.retry);
      return api(config);
    }

    return Promise.reject(error);
  }
);

// Auth API (email/password only for admin)
export const authApi = {
  login: async (email_or_phone: string, password: string) => {
    const response = await api.post('/auth/login', { email_or_phone, password });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Admin API
export const adminApi = {
  // ---- Enterprise CRUD ----
  createEnterprise: async (data: {
    name: string;
    code?: string;
    owner_id?: string;
    license_tier?: string;
    max_shops?: number;
    max_users_per_shop?: number;
    licensed_until?: string;
  }) => {
    const response = await api.post('/admin/enterprises', data);
    return response.data;
  },

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

  removeShopFromEnterprise: async (enterpriseId: string, shopId: string) => {
    const response = await api.delete(`/admin/enterprises/${enterpriseId}/shops/${shopId}`);
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
    enterprise_id?: string;
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
