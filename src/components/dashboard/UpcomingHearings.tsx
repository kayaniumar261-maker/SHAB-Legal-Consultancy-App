import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { getHearingsToday } from '../../services/hearingService';
import type { Hearing } from '../../types/hearing';

export function UpcomingHearings() {
  const [hearings, setHearings] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await getHearingsToday();
      setHearings(rows);
    }

    load();
  }, []);

  return (
    <section className="dashboard-panel upcoming-hearings-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Upcoming Hearings</h3>
          <p>Today’s critical court events.</p>
        </div>
      </div>

      <div className="timeline-list">
        {hearings.map((item) => (
          <div key={item.id} className="timeline-item">
            <div className="timeline-time">{item.hearing_time ?? item.time}</div>
            <div className="timeline-body">
              <strong>{item.court}</strong>
              <span>{item.client_id ?? item.client}</span>
              <span>{item.lawyer ?? item.uploaded_by}</span>
              <span>{item.courtroom}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
