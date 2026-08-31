import { useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';

type RealtimeRefreshOptions = {
  debounceMs?: number;
  enabled?: boolean;
};

export function useRealtimeRefresh(
  tables: string[],
  onRefresh: () => void | Promise<void>,
  options: RealtimeRefreshOptions = {},
) {
  const callbackRef = useRef(onRefresh);
  const channelNameRef = useRef(
    `shab-live-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const tablesKey = [...new Set(tables)].sort().join(',');
  const debounceMs = options.debounceMs ?? 700;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !tablesKey) {
      return undefined;
    }

    let refreshTimer: number | null = null;
    let refreshPending = false;

    const runRefresh = () => {
      refreshTimer = null;

      if (document.visibilityState === 'hidden') {
        refreshPending = true;
        return;
      }

      refreshPending = false;

      void Promise.resolve(callbackRef.current()).catch((error) => {
        console.error('Realtime screen refresh failed:', error);
      });
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(runRefresh, debounceMs);
    };

    const channel = supabase.channel(channelNameRef.current);

    tablesKey.split(',').forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        scheduleRefresh,
      );
    });

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn(`Realtime channel status: ${status}`);
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && refreshPending) {
        scheduleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [debounceMs, enabled, tablesKey]);
}
