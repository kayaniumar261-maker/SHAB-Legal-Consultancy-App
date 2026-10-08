import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

type AuthResult = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active || authEventReceived) return;
        if (error) throw error;
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        if (!active || authEventReceived) return;
        console.error('Unable to restore session:', error);
        setSession(null); setUser(null);
      } finally {
        if (active && !authEventReceived) setLoading(false);
      }
    }

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (!active) return;
        authEventReceived = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    session,
    user,
    loading,
    signOut,
  };
}
