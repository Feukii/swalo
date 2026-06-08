import { create } from 'zustand';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  phone: string;
  display_name: string;
}

interface Shop {
  id: string;
  code: string;
  name: string;
}

interface AuthState {
  user: User | null;
  shop: Shop | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email_or_phone: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  shop: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email_or_phone: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const data = await authApi.login(email_or_phone, password);

      // Enforce SUPERADMIN role
      if (data.role !== 'SUPERADMIN') {
        set({
          error: 'Acces reserve aux administrateurs de la plateforme',
          isLoading: false,
        });
        throw new Error('Acces reserve aux administrateurs');
      }

      localStorage.setItem('admin_access_token', data.access_token);
      localStorage.setItem('admin_refresh_token', data.refresh_token);

      set({
        user: data.user,
        shop: data.shop,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      if (error.message === 'Acces reserve aux administrateurs') {
        throw error;
      }
      const message = error.response?.data?.message || 'Erreur de connexion';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    set({
      user: null,
      shop: null,
      role: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadUser: async () => {
    const token = localStorage.getItem('admin_access_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const data = await authApi.getMe();

      // Reject non-SUPERADMIN
      if (data.role !== 'SUPERADMIN') {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        set({ isLoading: false });
        return;
      }

      set({
        user: data.user,
        shop: data.shop,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      set({ isLoading: false });
    }
  },
}));
