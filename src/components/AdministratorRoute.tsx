import { Navigate, Outlet } from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { isAdministrator } from '../services/accessControlService';

export function AdministratorRoute() {
  const { profile, loading } = useAccessProfile();
  if (loading) return <div className="protected-loading"><div className="protected-loading-card"><p>Checking administrator access…</p></div></div>;
  if (!isAdministrator(profile)) return <Navigate to="/" replace />;
  return <Outlet />;
}
