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

    let active = true;
    let suspended = false;
    let channelSequence = 0;
    let refreshTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let refreshPending = false;
    let channel:
      ReturnType<typeof supabase.channel> | null =
      null;

    const canConnect = () =>
      active &&
      !suspended &&
      navigator.onLine &&
      document.visibilityState === 'visible';

    const runRefresh = () => {
      refreshTimer = null;

      if (!canConnect()) {
        refreshPending = true;
        return;
      }

      refreshPending = false;

      void Promise.resolve(
        callbackRef.current(),
      ).catch((error) => {
        console.error(
          'Realtime screen refresh failed:',
          error,
        );
      });
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(
        runRefresh,
        debounceMs,
      );
    };

    const stopChannel = async () => {
      if (!channel) {
        return;
      }

      const removal =
        supabase.removeChannel(channel);

      channel = null;

      await removal;
    };

    const startChannel = () => {
      if (!canConnect() || channel) {
        return;
      }

      channelSequence += 1;

      const nextChannel = supabase.channel(
        `${channelNameRef.current}-${channelSequence}`,
      );

      channel = nextChannel;

      for (const table of tablesKey.split(',')) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
          },
          scheduleRefresh,
        );
      }

      nextChannel.subscribe((status) => {
        if (
          channel !== nextChannel ||
          !canConnect()
        ) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          reconnectAttempt = 0;

          if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }

          return;
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          if (reconnectTimer !== null) {
            return;
          }

          reconnectAttempt += 1;

          const retryDelay = Math.min(
            1_000 * 2 ** Math.min(reconnectAttempt, 5),
            30_000,
          );

          reconnectTimer = window.setTimeout(
            () => {
              reconnectTimer = null;
              restartChannel();
            },
            retryDelay,
          );
        }
      });
    };

    const restartChannel = () => {
      void stopChannel()
        .catch((error) => {
          console.warn(
            'Realtime channel cleanup failed:',
            error,
          );
        })
        .finally(() => {
          if (canConnect()) {
            startChannel();

            if (refreshPending) {
              scheduleRefresh();
            }
          }
        });
    };

    const suspendChannel = () => {
      suspended = true;
      reconnectAttempt = 0;

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      void stopChannel().catch(() => {
        // The browser may already be freezing the page.
      });
    };

    const resumeChannel = () => {
      suspended = false;
      refreshPending = true;
      restartChannel();
    };

    const handlePageHide = () => {
      suspendChannel();
    };

    const handlePageShow = () => {
      resumeChannel();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        suspendChannel();
      } else {
        resumeChannel();
      }
    };

    const handleOnline = () => {
      resumeChannel();
    };

    const handleOffline = () => {
      suspendChannel();
    };

    startChannel();

    window.addEventListener(
      'pagehide',
      handlePageHide,
    );
    window.addEventListener(
      'pageshow',
      handlePageShow,
    );
    window.addEventListener(
      'online',
      handleOnline,
    );
    window.addEventListener(
      'offline',
      handleOffline,
    );
    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      active = false;
      suspended = true;

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      window.removeEventListener(
        'pagehide',
        handlePageHide,
      );
      window.removeEventListener(
        'pageshow',
        handlePageShow,
      );
      window.removeEventListener(
        'online',
        handleOnline,
      );
      window.removeEventListener(
        'offline',
        handleOffline,
      );
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      void stopChannel().catch(() => {
        // Cleanup failure is harmless during unmount.
      });
    };
  }, [debounceMs, enabled, tablesKey]);
}