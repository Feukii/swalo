import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPin from './pages/LoginPin';
import CreateShop from './pages/CreateShop';
import ShopSettings from './pages/ShopSettings';
import Home from './pages/Home';
import Sale from './pages/Sale';
import POS from './pages/POS';
import Products from './pages/Products';
import ProductBatches from './pages/ProductBatches';
import CatalogHierarchy from './pages/CatalogHierarchy';
import StockManagement from './pages/StockManagement';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Suppliers from './pages/Suppliers';
import SupplierDetails from './pages/SupplierDetails';
import Receivables from './pages/Receivables';
import Debts from './pages/Debts';
import TransactionHistory from './pages/TransactionHistory';
import BusinessReports from './pages/BusinessReports';
import UserManagement from './pages/UserManagement';
import EnterpriseDashboard from './pages/EnterpriseDashboard';
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
        <Route path="/create-shop" element={<CreateShop />} />

        {/* Routes protégées (avec layout) */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Home />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sale"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Sale />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cash"
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
                <TransactionHistory />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Products />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:productId/batches"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProductBatches />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalog"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CatalogHierarchy />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StockManagement />
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
                <Receivables />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/debts"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Debts />
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

        {/* Enterprise & Multi-shop */}
        <Route
          path="/enterprise"
          element={
            <ProtectedRoute requireRole={['BOSS', 'MANAGER', 'SUPERADMIN']}>
              <MainLayout>
                <EnterpriseDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* Gestion utilisateurs boutique (MANAGER, BOSS) */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requireRole={['MANAGER', 'BOSS', 'SUPERADMIN']}>
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
            <ProtectedRoute requireRole="BOSS">
              <ShopSettings />
            </ProtectedRoute>
          }
        />

        {/* Redirects for old routes */}
        <Route path="/pos" element={<Navigate to="/cash" replace />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/inventory" element={<Navigate to="/stock" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
