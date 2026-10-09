import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../lib/supabase';
import { getMyAccessProfile, type AccessProfile } from '../services/accessControlService';

export function useAccessProfile() {
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const isCurrent = () => active.current && sequence === requestSequence.current;
    try {
      if (!active.current) return;
      setLoading(true); setError(null);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isCurrent()) return;
      if (sessionError) throw sessionError;
      if (!data.session) { setProfile(null); return; }
      const nextProfile = await getMyAccessProfile();
      if (isCurrent()) setProfile(nextProfile);
    } catch (loadError) {
      if (!isCurrent()) return;
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to verify application access.');
    } finally { if (isCurrent()) setLoading(false); }
  }, []);

  useEffect(() => {
    active.current = true;
    let timer: number | undefined;
    void load();
    const { data } = supabase.auth.onAuthStateChange((_, session) => {
      ++requestSequence.current;
      window.clearTimeout(timer);
      if (!session) {
        setProfile(null); setError(null); setLoading(false);
        return;
      }
      // Leave the auth callback before calling other Supabase APIs.
      timer = window.setTimeout(() => { void load(); }, 0);
    });
    return () => {
      active.current = false;
      ++requestSequence.current;
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [load]);

  return { profile, loading, error, reload: load };
}
