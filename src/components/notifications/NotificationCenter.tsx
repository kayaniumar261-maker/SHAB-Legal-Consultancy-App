import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  getNotificationCenterData,
  type PracticeNotification,
} from '../../services/notificationService';

import './NotificationCenter.css';

const readStorageKey =
  'shab-read-notifications';

export function NotificationCenter() {
  const navigate = useNavigate();

  const panelRef =
    useRef<HTMLDivElement>(null);

  const [open, setOpen] =
    useState(false);

  const [items, setItems] =
    useState<PracticeNotification[]>([]);

  const [readIds, setReadIds] =
    useState<string[]>(readReadIds);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [loadedAt, setLoadedAt] =
    useState<string | null>(null);

  const loadNotifications =
    useCallback(
      async (refresh = false) => {
        try {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError(null);

          const response =
            await getNotificationCenterData();

          setItems(response.items);
          setLoadedAt(response.loadedAt);

          if (
            response.errors.length > 0 &&
            response.items.length === 0
          ) {
            setError(
              'Notifications could not be loaded.',
            );
          }
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load notifications.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadNotifications();

    const interval =
      window.setInterval(() => {
        void loadNotifications(true);
      }, 300_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        panelRef.current &&
        !panelRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    window.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      window.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [open]);

  const unreadCount = useMemo(
    () =>
      items.filter(
        (item) =>
          !readIds.includes(item.id),
      ).length,
    [items, readIds],
  );

  function saveReadIds(
    nextIds: string[],
  ) {
    setReadIds(nextIds);

    window.localStorage.setItem(
      readStorageKey,
      JSON.stringify(nextIds),
    );
  }

  function markAllRead() {
    saveReadIds(
      Array.from(
        new Set([
          ...readIds,
          ...items.map(
            (item) => item.id,
          ),
        ]),
      ),
    );
  }

  function openNotification(
    item: PracticeNotification,
  ) {
    if (!readIds.includes(item.id)) {
      saveReadIds([
        ...readIds,
        item.id,
      ]);
    }

    setOpen(false);
    navigate(item.to);
  }

  return (
    <div
      className="notification-center"
      ref={panelRef}
    >
      <button
        type="button"
        className="notification-trigger"
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-label="Open notifications"
        aria-expanded={open}
      >
        <Bell size={19} />

        {unreadCount > 0 ? (
          <span>
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="notification-panel">
          <header className="notification-header">
            <div>
              <span>
                Practice alerts
              </span>

              <h3>Notifications</h3>

              {loadedAt ? (
                <small>
                  Updated{' '}
                  {formatTime(loadedAt)}
                </small>
              ) : null}
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  void loadNotifications(true);
                }}
                disabled={refreshing}
                aria-label="Refresh notifications"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? 'spinning'
                      : ''
                  }
                />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={17} />
              </button>
            </div>
          </header>

          <div className="notification-toolbar">
            <span>
              {unreadCount} unread
            </span>

            <button
              type="button"
              onClick={markAllRead}
              disabled={
                unreadCount === 0
              }
            >
              <Check size={14} />
              Mark all read
            </button>
          </div>

          <div className="notification-list">
            {loading ? (
              <NotificationState>
                <LoaderCircle
                  size={21}
                  className="spinning"
                />

                Loading notifications…
              </NotificationState>
            ) : error ? (
              <NotificationState error>
                <AlertTriangle
                  size={21}
                />

                {error}
              </NotificationState>
            ) : items.length === 0 ? (
              <NotificationState>
                <CheckCircle2
                  size={22}
                />

                No notifications.
              </NotificationState>
            ) : (
              items.map((item) => {
                const isUnread =
                  !readIds.includes(
                    item.id,
                  );

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      'notification-item',
                      item.tone,
                      isUnread
                        ? 'unread'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      openNotification(
                        item,
                      )
                    }
                  >
                    <span className="notification-icon">
                      {getToneIcon(
                        item.tone,
                      )}
                    </span>

                    <span className="notification-copy">
                      <strong>
                        {item.title}
                      </strong>

                      <small>
                        {item.message}
                      </small>
                    </span>

                    {isUnread ? (
                      <span className="notification-unread-dot" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function NotificationState({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={
        error
          ? 'notification-state error'
          : 'notification-state'
      }
    >
      {children}
    </div>
  );
}

function getToneIcon(
  tone: PracticeNotification['tone'],
) {
  switch (tone) {
    case 'danger':
      return (
        <AlertTriangle size={17} />
      );

    case 'warning':
      return <Clock3 size={17} />;

    case 'success':
      return (
        <CheckCircle2 size={17} />
      );

    default:
      return <Info size={17} />;
  }
}

function readReadIds(): string[] {
  try {
    const stored =
      window.localStorage.getItem(
        readStorageKey,
      );

    if (!stored) {
      return [];
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed.filter(
          (value) =>
            typeof value === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function formatTime(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'en-AE',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value));
}
