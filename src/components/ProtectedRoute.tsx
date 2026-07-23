import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="protected-loading">
        <div className="protected-loading-card">
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
