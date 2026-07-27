import {
  Activity,
  FileClock,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  getRecentActivity,
} from '../../services/activityLogService';

type ActivityItem = {
  id: string;
  action?: string | null;
  details?: string | null;
  created_at: string;
};

function formatActivityDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

export function ActivityFeed() {
  const [items, setItems] =
    useState<ActivityItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getRecentActivity(8);

        if (active) {
          setItems(
            result as ActivityItem[],
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load recent activity.',
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

  return (
    <section className="dashboard-panel activity-feed-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            AUDIT TRAIL
          </span>

          <h3>Recent Activity</h3>

          <p>
            Latest recorded updates across the practice.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading activity…
        </div>
      ) : error ? (
        <div className="dashboard-widget-state error">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="dashboard-widget-state">
          <FileClock size={22} />

          <span>
            No activity has been recorded yet.
          </span>
        </div>
      ) : (
        <div className="activity-dashboard-list">
          {items.map((item) => (
            <article
              key={item.id}
              className="activity-dashboard-item"
            >
              <div className="activity-icon">
                <Activity size={15} />
              </div>

              <div className="activity-dashboard-content">
                <strong>
                  {item.action ||
                    'Activity recorded'}
                </strong>

                {item.details && (
                  <p>
                    {item.details}
                  </p>
                )}
              </div>

              <time>
                {formatActivityDate(
                  item.created_at,
                )}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}