import { tr, useLocale } from '../i18n/locale';
import { Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const interfaceLanguage = useLocale();
  const { loading: authLoading, user, signOut } = useAuth();
  const { profile, loading: accessLoading, error, reload } = useAccessProfile();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const loading = authLoading || accessLoading;

  if (loading) {
    return (
      <div className="protected-loading">
        <div className="protected-loading-card">
          <p>{tr("Checking authentication...")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error || !profile || !profile.is_active) {
    return (
      <div className="protected-loading"><div className="protected-loading-card" role="alert">
        <p>{signOutError || error || tr("Your SHAB application account is inactive. Contact an administrator.")}</p>
        <button type="button" onClick={() => { void reload(); }}>{tr("Check access again")}</button>{' '}
        <button type="button" onClick={() => {
          setSignOutError(null);
          void signOut().catch((reason) => setSignOutError(reason instanceof Error ? reason.message : 'Unable to sign out.'));
        }}>{tr("Sign out")}</button>
      </div></div>
    );
  }

  return <Outlet />;
}
