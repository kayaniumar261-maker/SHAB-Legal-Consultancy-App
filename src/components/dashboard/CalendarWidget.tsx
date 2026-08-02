import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  getCalendarEventsForMonth,
  type CalendarEvent,
} from '../../services/calendarService';

const weekDays = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

function sameDay(
  left: Date,
  right: Date,
): boolean {
  return (
    left.getFullYear() ===
      right.getFullYear() &&
    left.getMonth() ===
      right.getMonth() &&
    left.getDate() ===
      right.getDate()
  );
}

export function CalendarWidget() {
  const navigate = useNavigate();

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(() => {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );
  });

  const [events, setEvents] =
    useState<CalendarEvent[]>([]);

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
          await getCalendarEventsForMonth(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth(),
          );

        if (active) {
          setEvents(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load calendar.',
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
  }, [visibleMonth]);

  const monthLabel =
    new Intl.DateTimeFormat(
      'en-AE',
      {
        month: 'long',
        year: 'numeric',
      },
    ).format(visibleMonth);

  const days = useMemo(() => {
    const year =
      visibleMonth.getFullYear();

    const month =
      visibleMonth.getMonth();

    const firstDay =
      new Date(
        year,
        month,
        1,
      ).getDay();

    const totalDays =
      new Date(
        year,
        month + 1,
        0,
      ).getDate();

    const cells: Array<
      number | null
    > = [];

    for (
      let index = 0;
      index < firstDay;
      index += 1
    ) {
      cells.push(null);
    }

    for (
      let day = 1;
      day <= totalDays;
      day += 1
    ) {
      cells.push(day);
    }

    return cells;
  }, [visibleMonth]);

  const eventsByDay = useMemo(() => {
    return events.reduce<
      Record<number, CalendarEvent[]>
    >(
      (map, event) => {
        const eventDate =
          new Date(
            event.startsAt,
          );

        if (
          Number.isNaN(
            eventDate.getTime(),
          )
        ) {
          return map;
        }

        const day =
          eventDate.getDate();

        if (!map[day]) {
          map[day] = [];
        }

        map[day].push(event);

        return map;
      },
      {},
    );
  }, [events]);

  const eventSummary =
    useMemo(() => {
      const hearings =
        events.filter(
          (event) =>
            event.type ===
            'hearing',
        ).length;

      const tasks =
        events.filter(
          (event) =>
            event.type ===
            'task',
        ).length;

      const deadlines =
        events.filter(
          (event) =>
            event.type ===
              'limitation' ||
            event.type ===
              'case_action' ||
            event.type ===
              'follow_up' ||
            event.type ===
              'invoice',
        ).length;

      return {
        hearings,
        tasks,
        deadlines,
      };
    }, [events]);

  const today = new Date();

  return (
    <section className="dashboard-panel calendar-widget-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            FIRM CALENDAR
          </span>

          <h3>
            Calendar
          </h3>

          <p>
            Hearings, tasks and deadlines.
          </p>
        </div>

        <div className="calendar-month-controls">
          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  new Date(
                    current.getFullYear(),
                    current.getMonth() - 1,
                    1,
                  ),
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>

          <strong>
            {monthLabel}
          </strong>

          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                (current) =>
                  new Date(
                    current.getFullYear(),
                    current.getMonth() + 1,
                    1,
                  ),
              )
            }
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading calendar…
        </div>
      ) : error ? (
        <div className="dashboard-widget-state error">
          {error}
        </div>
      ) : (
        <>
          <div className="calendar-grid">
            {weekDays.map(
              (day) => (
                <div
                  key={day}
                  className="calendar-day-label"
                >
                  {day}
                </div>
              ),
            )}

            {days.map(
              (
                day,
                index,
              ) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="calendar-day calendar-day-empty"
                    />
                  );
                }

                const cellDate =
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day,
                  );

                const isToday =
                  sameDay(
                    cellDate,
                    today,
                  );

                const dayEvents =
                  eventsByDay[day] ??
                  [];

                const className = [
                  'calendar-day',
                  isToday
                    ? 'today'
                    : '',
                  dayEvents.length > 0
                    ? 'highlighted'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={day}
                    type="button"
                    className={className}
                    onClick={() => {
                      const year =
                        cellDate.getFullYear();

                      const month =
                        String(
                          cellDate.getMonth() +
                            1,
                        ).padStart(
                          2,
                          '0',
                        );

                      const date =
                        String(
                          cellDate.getDate(),
                        ).padStart(
                          2,
                          '0',
                        );

                      navigate(
                        `/calendar?date=${year}-${month}-${date}`,
                      );
                    }}
                    title={
                      dayEvents.length > 0
                        ? `${dayEvents.length} event${
                            dayEvents.length === 1
                              ? ''
                              : 's'
                          } — open calendar`
                        : 'Open calendar'
                    }
                  >
                    <span>
                      {day}
                    </span>

                    {dayEvents.length >
                      0 && (
                      <small>
                        {
                          dayEvents.length
                        }
                      </small>
                    )}
                  </button>
                );
              },
            )}
          </div>

          <div className="calendar-widget-footer">
            <span>
              {events.length === 0
                ? 'No events this month'
                : `${events.length} total events`}
            </span>

            <span>
              {eventSummary.hearings} hearings ·{' '}
              {eventSummary.tasks} tasks ·{' '}
              {eventSummary.deadlines} deadlines
            </span>
          </div>
        </>
      )}
    </section>
  );
}
