import {
  CalendarDays,
  Clock3,
  MapPin,
  Scale,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  getUpcomingHearings,
  type DashboardHearing,
} from '../../services/hearingService';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

export function UpcomingHearings() {
  const [hearings, setHearings] =
    useState<DashboardHearing[]>([]);

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
          await getUpcomingHearings(5);

        if (active) {
          setHearings(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load hearings.',
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
    <section className="dashboard-panel upcoming-hearings-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            COURT CALENDAR
          </span>

          <h3>Upcoming Hearings</h3>

          <p>
            Next scheduled court appearances.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="hearing-empty-state">
          Loading hearings…
        </div>
      ) : error ? (
        <div className="hearing-empty-state error">
          {error}
        </div>
      ) : hearings.length === 0 ? (
        <div className="hearing-empty-state">
          <CalendarDays size={22} />
          <span>
            No upcoming hearings scheduled.
          </span>
        </div>
      ) : (
        <div className="hearing-dashboard-list">
          {hearings.map((hearing) => (
            <article
              key={hearing.id}
              className="hearing-dashboard-item"
            >
              <div className="hearing-date-box">
                <strong>
                  {formatDate(hearing.hearing_at)}
                </strong>

                <span>
                  {formatTime(hearing.hearing_at)}
                </span>
              </div>

              <div className="hearing-dashboard-content">
                <div className="hearing-dashboard-title">
                  <Scale size={16} />

                  <strong>
                    {hearing.case_number ||
                      hearing.case_type ||
                      'Court Hearing'}
                  </strong>
                </div>

                {hearing.client_name && (
                  <span className="hearing-client">
                    {hearing.client_name}
                  </span>
                )}

                <div className="hearing-meta-row">
                  {hearing.court && (
                    <span>
                      <MapPin size={13} />
                      {hearing.court}
                    </span>
                  )}

                  {hearing.courtroom && (
                    <span>
                      <Clock3 size={13} />
                      {hearing.courtroom}
                    </span>
                  )}
                </div>
              </div>

              <span className="hearing-status-pill">
                {hearing.status || 'Scheduled'}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}