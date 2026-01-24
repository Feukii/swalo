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
  loginWithPin: (shop_code: string, pin_code: string) => Promise<void>;
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

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      set({
        user: data.user,
        shop: data.shop,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erreur de connexion';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  loginWithPin: async (shop_code: string, pin_code: string) => {
    try {
      set({ isLoading: true, error: null });
      const data = await authApi.loginWithPin(shop_code, pin_code);

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      set({
        user: data.user,
        shop: data.shop,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Code boutique ou PIN invalide';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({
      user: null,
      shop: null,
      role: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const data = await authApi.getMe();
      set({
        user: data.user,
        shop: data.shop,
        role: data.role,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ isLoading: false });
    }
  },
}));
