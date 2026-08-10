import { Navigate, Outlet } from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { loading: authLoading, user } = useAuth();
  const { profile, loading: accessLoading, error } = useAccessProfile();
  const loading = authLoading || accessLoading;

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

  if (error || !profile || !profile.is_active) {
    return <div className="protected-loading"><div className="protected-loading-card"><p>{error || 'Your SHAB application account is inactive. Contact an administrator.'}</p></div></div>;
  }

  return <Outlet />;
}
