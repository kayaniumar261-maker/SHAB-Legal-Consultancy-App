import { useEffect, useState } from 'react';
import { getRecentActivity } from '../../services/activityLogService';

export function ActivityFeed() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await getRecentActivity(8);
      setItems(rows);
    }

    load();
  }, []);

  return (
    <section className="dashboard-panel activity-feed-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Recent Activity</h3>
          <p>Audit trail of the most recent updates.</p>
        </div>
      </div>

      <div className="activity-list">
        {items.map((item) => (
          <div key={item.id} className="activity-item">
            <div>
              <strong>{item.action}</strong>
              <p>{item.details}</p>
            </div>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
