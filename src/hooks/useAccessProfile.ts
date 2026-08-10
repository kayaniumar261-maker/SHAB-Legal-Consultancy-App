import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';
import { getMyAccessProfile, type AccessProfile } from '../services/accessControlService';

export function useAccessProfile() {
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setProfile(null); return; }
      setProfile(await getMyAccessProfile());
    } catch (loadError) {
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to verify application access.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  return { profile, loading, error, reload: load };
}
