import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: string | string[];
}

export default function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuthStore();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7fafc',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e2e8f0',
              borderTopColor: '#667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
          <p style={{ marginTop: '1rem', color: '#718096' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role requirements
  if (requireRole) {
    const allowedRoles = Array.isArray(requireRole) ? requireRole : [requireRole];

    // SUPERADMIN has access to everything
    if (role === 'SUPERADMIN') {
      return <>{children}</>;
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(role || '')) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7fafc',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem' }}>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#2d3748',
                marginBottom: '1rem',
              }}
            >
              Accès Refusé
            </h2>
            <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
            <button
              onClick={() => window.history.back()}
              style={{
                background: '#667eea',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Retour
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
