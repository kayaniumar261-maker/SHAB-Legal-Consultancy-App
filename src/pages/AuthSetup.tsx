import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { shabLogoUrl } from '../constants/branding';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

import './Login.css';

export function AuthSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setError(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Use at least 8 characters for the password.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
  }

  if (authLoading) {
    return <div className="login-loading-screen"><div className="login-loading-card"><p>Checking secure invitation???</p></div></div>;
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card auth-setup-card">
          <p className="login-eyebrow">Account secured</p>
          <h1>Password saved</h1>
          <p className="login-description">Your SHAB account is ready to use.</p>
          <button type="button" className="login-submit" onClick={() => navigate('/', { replace: true })}>Open SHAB workspace</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card auth-setup-card">
          <p className="login-eyebrow">Invitation unavailable</p>
          <h1>This secure link has expired or is invalid.</h1>
          <p className="login-description">Ask an administrator to resend the invitation, or request another password-reset email.</p>
          <button type="button" className="login-submit" onClick={() => navigate('/login', { replace: true })}>Return to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo-shell"><img className="login-logo" src={shabLogoUrl} alt="SHAB Legal Consultants FZC" /></div>
          <p className="login-eyebrow">Secure account setup</p>
          <h1>Choose your password</h1>
          <p className="login-description">Set the password for {user.email}. It must contain at least 8 characters.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="login-input" required minLength={8} />
          <label className="login-label" htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="login-input" required minLength={8} />
          {error ? <div className="login-error" role="alert">{error}</div> : null}
          <button type="submit" className="login-submit" disabled={loading}>{loading ? 'Saving password???' : 'Save password'}</button>
        </form>
      </div>
    </div>
  );
}
