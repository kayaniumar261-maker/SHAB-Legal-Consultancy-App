import {
  Bell,
  BellRing,
  Check,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getNotifications,
  markNotificationRead,
} from '../../services/notificationService';

type DashboardNotification = {
  id: string;
  title?: string | null;
  body?: string | null;
  read?: boolean | null;
  created_at?: string | null;
};

export function Notifications() {
  const [items, setItems] =
    useState<DashboardNotification[]>(
      [],
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getNotifications();

        if (active) {
          setItems(
            result
              .slice(0, 8)
              .map((item) => ({
                ...item,
              })) as DashboardNotification[],
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load notifications.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const unreadCount =
    useMemo(
      () =>
        items.filter(
          (item) => !item.read,
        ).length,
      [items],
    );

  async function markRead(
    id: string,
  ) {
    try {
      setUpdatingId(id);

      await markNotificationRead(id);

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                read: true,
              }
            : item,
        ),
      );
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : 'Unable to update notification.',
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="dashboard-panel notifications-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            ALERT CENTRE
          </span>

          <h3>Notifications</h3>

          <p>
            Unread updates and important alerts.
          </p>
        </div>

        <div className="notification-count">
          <BellRing size={14} />
          {unreadCount}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading notifications…
        </div>
      ) : error && items.length === 0 ? (
        <div className="dashboard-widget-state error">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="dashboard-widget-state">
          <Bell size={22} />

          <span>
            No notifications at this time.
          </span>
        </div>
      ) : (
        <div className="notification-dashboard-list">
          {items.map((item) => (
            <article
              key={item.id}
              className={
                item.read
                  ? 'notification-dashboard-item read'
                  : 'notification-dashboard-item unread'
              }
            >
              <div className="notification-dashboard-content">
                <strong>
                  {item.title ||
                    'Notification'}
                </strong>

                {item.body && (
                  <p>
                    {item.body}
                  </p>
                )}
              </div>

              {!item.read && (
                <button
                  type="button"
                  className="notification-read-button"
                  onClick={() => {
                    void markRead(
                      item.id,
                    );
                  }}
                  disabled={
                    updatingId === item.id
                  }
                  title="Mark as read"
                >
                  <Check size={15} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {error && items.length > 0 && (
        <div className="dashboard-inline-error">
          {error}
        </div>
      )}
    </section>
  );
}