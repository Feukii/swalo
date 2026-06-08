import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import DashboardHome from './pages/DashboardHome';
import AdminEnterprises from './pages/AdminEnterprises';
import AdminShops from './pages/AdminShops';
import AdminGlobalUsers from './pages/AdminGlobalUsers';
import AdminConfig from './pages/AdminConfig';
import AuditLogs from './pages/AuditLogs';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import LicenseConfig from './pages/LicenseConfig';
import './App.css';

function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Login (public) */}
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected admin routes */}
        <Route
          path="/"
          element={
            <AdminRoute>
              <AdminLayout>
                <DashboardHome />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/enterprises"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminEnterprises />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/shops"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminShops />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminGlobalUsers />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <AdminRoute>
              <AdminLayout>
                <AuditLogs />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/license-config"
          element={
            <AdminRoute>
              <AdminLayout>
                <LicenseConfig />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/config"
          element={
            <AdminRoute>
              <AdminLayout>
                <AdminConfig />
              </AdminLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/system"
          element={
            <AdminRoute>
              <AdminLayout>
                <SuperAdminDashboard />
              </AdminLayout>
            </AdminRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
