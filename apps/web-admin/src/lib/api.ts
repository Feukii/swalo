import axios, { type AxiosError } from 'axios';
import type {
  PermissionMatrix,
  PermissionModule,
  Capability,
  Role as PermissionRole,
} from '@swalo/core/modules/permissions';

/** Réponse des endpoints de configuration de permissions (boutique / entreprise). */
export interface PermissionConfigResponse {
  modules: readonly PermissionModule[];
  capabilities: Record<PermissionModule, Capability[]>;
  roles: PermissionRole[];
  labels: Record<Capability, string>;
  defaults: Record<PermissionRole, Record<PermissionModule, Capability[]>>;
  current: PermissionMatrix | null;
}

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

// ---- Drill-down return types (read-only) ----
export interface AdminShopProduct {
  id: string;
  name: string;
  category: string | null;
  sku: string;
  stock: number;
  batch_count: number;
  cost_price: number;
  sell_price: number;
  value: number;
  multi_price: boolean;
  is_active: boolean;
  packaging: string | null;
  units_per_package: number | null;
  package_price: number | null;
}

export type AdminPartyStatus = 'A jour' | 'Doit' | 'A rembourser';

export interface AdminShopCustomer {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  credit_limit: number;
  last_operation: string | null;
  status: AdminPartyStatus;
}

export interface AdminShopSupplier {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  borrowing_limit: number;
  last_operation: string | null;
  status: AdminPartyStatus;
}

export interface AdminPosProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string | null;
}

export interface AdminPosSale {
  id: string;
  short_id: string;
  total: number;
  item_count: number;
  created_at: string;
}

export interface AdminShopPos {
  products: AdminPosProduct[];
  recent_sales: AdminPosSale[];
}

export type AdminShopHealth = 'Sain' | 'A surveiller' | 'En difficulte';

export interface AdminEnterpriseShopReport {
  id: string;
  name: string;
  ca_jour: number;
  marge: number;
  caisse: number;
  creances: number;
  etat: AdminShopHealth;
}

export interface AdminEnterpriseReports {
  enterprise: { id: string; name: string };
  shops: AdminEnterpriseShopReport[];
  totals: {
    ca_reseau: number;
    tresorerie_reseau: number;
    creances_reseau: number;
    marge_reseau: number;
    marge_moyenne: number;
  };
}

// Comptabilité en partie double. Tous les montants sont des entiers en FCFA.
export interface AdminAccountingEntryLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

export interface AdminAccountingJournalEntry {
  date: string;
  libelle: string;
  lines: AdminAccountingEntryLine[];
}

export interface AdminAccountingLedgerMovement {
  account: string;
  debit: number;
  credit: number;
  date: string;
  libelle: string;
}

export interface AdminAccountingLedgerAccount {
  account: string;
  name: string;
  classe: number;
  debit: number;
  credit: number;
  solde: number;
  mouvements: AdminAccountingLedgerMovement[];
}

export interface AdminAccountingAmountRow {
  account: string;
  name: string;
  montant: number;
}

export interface AdminAccountingBalanceSheet {
  actif: AdminAccountingAmountRow[];
  passif: AdminAccountingAmountRow[];
  totalActif: number;
  totalPassif: number;
  resultat: number;
  equilibre: boolean;
}

export interface AdminAccountingIncomeStatement {
  ca: number;
  cogs: number;
  margeBrute: number;
  charges: AdminAccountingAmountRow[];
  autresProduits: number;
  beneficeNet: number;
}

export interface AdminShopAccounting {
  journal: AdminAccountingJournalEntry[];
  grand_livre: AdminAccountingLedgerAccount[];
  bilan: AdminAccountingBalanceSheet;
  resultat: AdminAccountingIncomeStatement;
}

export type AdminSupervisionSeverity = 'critical' | 'review';

export interface AdminSupervisionAlert {
  id: string;
  kind: string;
  severity: AdminSupervisionSeverity;
  title: string;
  detail: string;
  author: string | null;
  created_at: string;
}

export interface AdminShopSupervision {
  alerts: AdminSupervisionAlert[];
  critical_count: number;
  review_count: number;
  total: number;
}

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
    monthly_price?: number;
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
      monthly_price?: number;
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
      monthly_price?: number;
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

  // ---- License Config ----
  getLicenseConfig: async () => {
    const response = await api.get('/admin/license-config');
    return response.data;
  },

  updateLicenseConfig: async (overrides: Array<{ code: string; minimumLicenseTier: string }>) => {
    const response = await api.put('/admin/license-config', { overrides });
    return response.data;
  },

  // ---- Drill-down (read-only) ----
  getShopProducts: async (shopId: string): Promise<AdminShopProduct[]> => {
    const response = await api.get<AdminShopProduct[]>(`/admin/shops/${shopId}/products`);
    return response.data;
  },

  getShopCustomers: async (shopId: string): Promise<AdminShopCustomer[]> => {
    const response = await api.get<AdminShopCustomer[]>(`/admin/shops/${shopId}/customers`);
    return response.data;
  },

  getShopSuppliers: async (shopId: string): Promise<AdminShopSupplier[]> => {
    const response = await api.get<AdminShopSupplier[]>(`/admin/shops/${shopId}/suppliers`);
    return response.data;
  },

  getShopPos: async (shopId: string): Promise<AdminShopPos> => {
    const response = await api.get<AdminShopPos>(`/admin/shops/${shopId}/pos`);
    return response.data;
  },

  getEnterpriseReports: async (enterpriseId: string): Promise<AdminEnterpriseReports> => {
    const response = await api.get<AdminEnterpriseReports>(
      `/admin/enterprises/${enterpriseId}/reports`
    );
    return response.data;
  },

  getShopAccounting: async (shopId: string): Promise<AdminShopAccounting> => {
    const response = await api.get<AdminShopAccounting>(`/admin/shops/${shopId}/accounting`);
    return response.data;
  },

  getShopSupervision: async (shopId: string): Promise<AdminShopSupervision> => {
    const response = await api.get<AdminShopSupervision>(`/admin/shops/${shopId}/supervision`);
    return response.data;
  },

  // ---- Fine-grained permissions ----
  getShopPermissions: async (shopId: string): Promise<PermissionConfigResponse> => {
    const response = await api.get<PermissionConfigResponse>(`/admin/shops/${shopId}/permissions`);
    return response.data;
  },

  setShopPermissions: async (
    shopId: string,
    matrix: PermissionMatrix
  ): Promise<PermissionConfigResponse> => {
    const response = await api.put<PermissionConfigResponse>(`/admin/shops/${shopId}/permissions`, {
      matrix,
    });
    return response.data;
  },

  getEnterpriseDefaultPermissions: async (id: string): Promise<PermissionConfigResponse> => {
    const response = await api.get<PermissionConfigResponse>(
      `/admin/enterprises/${id}/default-permissions`
    );
    return response.data;
  },

  setEnterpriseDefaultPermissions: async (
    id: string,
    matrix: PermissionMatrix
  ): Promise<PermissionConfigResponse> => {
    const response = await api.put<PermissionConfigResponse>(
      `/admin/enterprises/${id}/default-permissions`,
      { matrix }
    );
    return response.data;
  },
};
