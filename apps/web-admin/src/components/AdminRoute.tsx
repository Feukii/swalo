import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface AdminRouteProps {
  children: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'SUPERADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acces Reserve</h1>
          <p className="text-gray-600 mb-6">
            Cette plateforme est reservee aux administrateurs SWALO.
          </p>
          <button onClick={() => useAuthStore.getState().logout()} className="btn-primary">
            Se deconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
