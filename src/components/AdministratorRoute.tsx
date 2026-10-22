import { tr, useLocale } from '../i18n/locale';
import { Navigate, Outlet } from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { isAdministrator } from '../services/accessControlService';

export function AdministratorRoute() {
  const interfaceLanguage = useLocale();
  const { profile, loading } = useAccessProfile();
  if (loading) return <div className="protected-loading"><div className="protected-loading-card"><p>{tr("Checking administrator access…")}</p></div></div>;
  if (!isAdministrator(profile)) return <Navigate to="/" replace />;
  return <Outlet />;
}
