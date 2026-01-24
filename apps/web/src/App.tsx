import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import LoginPin from './pages/LoginPin';
import CreateShop from './pages/CreateShop';
import ShopSettings from './pages/ShopSettings';
import POS from './pages/POS';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Suppliers from './pages/Suppliers';
import SupplierDetails from './pages/SupplierDetails';
import UserManagement from './pages/UserManagement';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminPanel from './pages/AdminPanel';
import BusinessReports from './pages/BusinessReports';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';
import './App.css';

function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    // Warm-up ping pour réveiller l'API au démarrage
    const warmUpApi = async () => {
      const API_URL = import.meta.env.VITE_API_URL;

      // Uniquement si on est en production (API distante)
      if (API_URL && !API_URL.includes('localhost')) {
        try {
          console.log("🔥 Réveil de l'API...");
          await fetch(`${API_URL.replace('/api', '')}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5 secondes max
          });
          console.log('✅ API prête');
        } catch (error) {
          console.log('⏳ API en cours de démarrage (normal si premier accès)');
        }
      }
    };

    warmUpApi();
    loadUser();
  }, [loadUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques (sans layout) */}
        <Route path="/login" element={<LoginPin />} />
        <Route path="/login/admin" element={<Login />} />
        <Route path="/create-shop" element={<CreateShop />} />

        {/* Routes protégées (avec layout) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <POS />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <MainLayout>
                <POS />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Customers />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CustomerDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Suppliers />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers/:id"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SupplierDetails />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/receivables"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/debts"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BusinessReports />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Routes d'administration */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requireRole="SUPERADMIN">
              <MainLayout>
                <SuperAdminDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/panel"
          element={
            <ProtectedRoute requireRole="SUPERADMIN">
              <MainLayout>
                <AdminPanel />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireRole={['ADMIN', 'OWNER', 'MANAGER', 'SUPERADMIN']}>
              <MainLayout>
                <UserManagement />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Paramètres boutique (propriétaire uniquement) */}
        <Route
          path="/settings/shop"
          element={
            <ProtectedRoute requireRole="OWNER">
              <ShopSettings />
            </ProtectedRoute>
          }
        />

        <Route path="/dashboard" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
