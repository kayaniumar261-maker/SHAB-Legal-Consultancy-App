import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { shabLogoUrl } from '../constants/branding';
import './Login.css';

export function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  if (authLoading) {
    return (
      <div className="login-loading-screen">
        <div className="login-loading-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo-shell">
            <img
              className="login-logo"
              src={shabLogoUrl}
              alt="SHAB Legal Consultants FZC"
            />
          </div>

          <p className="login-eyebrow">
            SHAB Legal Consultants FZC
          </p>

          <h1>Secure Practice Management System</h1>

          <p className="login-description">
            Sign in with your email and password to access your practice dashboard.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="login-input"
            placeholder="name@company.com"
            required
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="login-input"
            placeholder="Enter your password"
            required
          />

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
