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

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_, session) => {
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
    await supabase.auth.signOut();
  }, []);

  return {
    session,
    user,
    loading,
    signOut,
  };
}
