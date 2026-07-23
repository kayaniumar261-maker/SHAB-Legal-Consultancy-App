import { useEffect, useState } from 'react';
import { getNotifications } from '../../services/notificationService';

export function Notifications() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await getNotifications();
      setItems(rows);
    }

    load();
  }, []);

  return (
    <section className="dashboard-panel notifications-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Notifications</h3>
          <p>Unread updates and urgent items.</p>
        </div>
      </div>

      <div className="notification-list">
        {items.map((item) => (
          <div key={item.id} className={`notification-item ${item.read ? 'read' : 'unread'}`}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
