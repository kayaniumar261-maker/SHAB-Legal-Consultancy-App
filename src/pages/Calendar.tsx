import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  FileWarning,
  Gavel,
  ListTodo,
  Scale,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useSearchParams,
} from 'react-router-dom';

import { useAccessProfile } from '../hooks/useAccessProfile';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

import {
  getCalendarEventsForMonth,
  type CalendarEvent,
  type CalendarEventType,
} from '../services/calendarService';

import './Calendar.css';
import './Calendar.mobile.css';

const weekDays = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

const eventLabels: Record<
  CalendarEventType,
  string
> = {
  hearing: 'Hearings',
  task: 'Tasks',
  invoice: 'Invoices',
  case_action: 'Case Actions',
  limitation: 'Limitations',
  follow_up: 'Follow-ups',
};

export function Calendar() {
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;

  const [searchParams, setSearchParams] =
    useSearchParams();

  const initialDate =
    searchParams.get('date');

  const initialMonth =
    initialDate &&
    !Number.isNaN(
      new Date(initialDate).getTime(),
    )
      ? new Date(initialDate)
      : new Date();

  const [
    visibleMonth,
    setVisibleMonth,
  ] = useState(
    new Date(
      initialMonth.getFullYear(),
      initialMonth.getMonth(),
      1,
    ),
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<Date>(
    new Date(
      initialMonth.getFullYear(),
      initialMonth.getMonth(),
      initialMonth.getDate(),
    ),
  );

  const [events, setEvents] =
    useState<CalendarEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [
    enabledTypes,
    setEnabledTypes,
  ] = useState<
    Set<CalendarEventType>
  >(
    new Set([
      'hearing',
      'task',
      'invoice',
      'case_action',
      'limitation',
      'follow_up',
    ]),
  );

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getCalendarEventsForMonth(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        administrator,
      );

      setEvents(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load calendar events.',
      );
    } finally {
      setLoading(false);
    }
  }, [administrator, visibleMonth]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useRealtimeRefresh(
    ['hearings', 'tasks', 'invoices', 'cases'],
    loadEvents,
  );

  const filteredEvents =
    useMemo(
      () =>
        events.filter(
          (event) =>
            enabledTypes.has(
              event.type,
            ),
        ),
      [
        events,
        enabledTypes,
      ],
    );

  const eventsByDay =
    useMemo(() => {
      return filteredEvents.reduce<
        Record<
          number,
          CalendarEvent[]
        >
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

          map[day].push(
            event,
          );

          return map;
        },
        {},
      );
    }, [filteredEvents]);

  const monthCells =
    useMemo(() => {
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

      while (
        cells.length % 7 !==
        0
      ) {
        cells.push(null);
      }

      return cells;
    }, [visibleMonth]);

  const selectedEvents =
    useMemo(() => {
      return (
        eventsByDay[
          selectedDate.getDate()
        ] ?? []
      );
    }, [
      eventsByDay,
      selectedDate,
    ]);

  const monthLabel =
    new Intl.DateTimeFormat(
      'en-AE',
      {
        month: 'long',
        year: 'numeric',
      },
    ).format(
      visibleMonth,
    );

  const selectedDateLabel =
    new Intl.DateTimeFormat(
      'en-AE',
      {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      },
    ).format(
      selectedDate,
    );

  const summary =
    useMemo(() => {
      return filteredEvents.reduce<
        Record<
          CalendarEventType,
          number
        >
      >(
        (map, event) => {
          map[event.type] += 1;
          return map;
        },
        {
          hearing: 0,
          task: 0,
          invoice: 0,
          case_action: 0,
          limitation: 0,
          follow_up: 0,
        },
      );
    }, [filteredEvents]);

  function changeMonth(
    offset: number,
  ) {
    const nextMonth =
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() +
          offset,
        1,
      );

    setVisibleMonth(
      nextMonth,
    );

    setSelectedDate(
      nextMonth,
    );

    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    nextParams.delete(
      'date',
    );

    setSearchParams(
      nextParams,
      {
        replace: true,
      },
    );
  }

  function selectDay(
    day: number,
  ) {
    const nextDate =
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        day,
      );

    setSelectedDate(
      nextDate,
    );

    const year =
      nextDate.getFullYear();

    const month =
      String(
        nextDate.getMonth() + 1,
      ).padStart(
        2,
        '0',
      );

    const date =
      String(
        nextDate.getDate(),
      ).padStart(
        2,
        '0',
      );

    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    nextParams.set(
      'date',
      `${year}-${month}-${date}`,
    );

    setSearchParams(
      nextParams,
      {
        replace: true,
      },
    );
  }

  function toggleType(
    type: CalendarEventType,
  ) {
    setEnabledTypes(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(type)
        ) {
          next.delete(type);
        } else {
          next.add(type);
        }

        return next;
      },
    );
  }

  return (
    <div className="calendar-page page-container">
      <section className="page-heading calendar-heading">
        <div>
          <p className="page-eyebrow">
            Firm planner
          </p>

          <h2>
            Legal Calendar
          </h2>

          <p className="page-intro">
            Hearings, tasks and critical matter deadlines in one workspace.
          </p>
        </div>

        <div className="calendar-heading-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => {
              const today =
                new Date();

              setVisibleMonth(
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  1,
                ),
              );

              setSelectedDate(
                today,
              );
            }}
          >
            <CalendarDays size={17} />
            Today
          </button>
        </div>
      </section>

      <section className="calendar-summary-grid">
        <SummaryCard
          icon={<Gavel size={18} />}
          label="Hearings"
          value={summary.hearing}
          type="hearing"
        />

        <SummaryCard
          icon={<ListTodo size={18} />}
          label="Tasks"
          value={summary.task}
          type="task"
        />

        {administrator && (
          <SummaryCard
            icon={<CreditCard size={18} />}
            label="Invoice Due"
            value={summary.invoice}
            type="invoice"
          />
        )}

        <SummaryCard
          icon={<FileWarning size={18} />}
          label="Limitations"
          value={summary.limitation}
          type="limitation"
        />
      </section>

      <section className="calendar-toolbar">
        <div className="calendar-month-navigation">
          <button
            type="button"
            onClick={() =>
              changeMonth(-1)
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>

          <strong>
            {monthLabel}
          </strong>

          <button
            type="button"
            onClick={() =>
              changeMonth(1)
            }
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-type-filters">
          {(
            Object.keys(
              eventLabels,
            ) as CalendarEventType[]
          ).map(
            (type) => (
              <button
                key={type}
                type="button"
                className={
                  enabledTypes.has(
                    type,
                  )
                    ? `active ${type}`
                    : type
                }
                onClick={() =>
                  toggleType(type)
                }
              >
                <span />
                {eventLabels[type]}
              </button>
            ),
          )}
        </div>
      </section>

      {error && (
        <div className="calendar-error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <section className="calendar-workspace">
        <div className="calendar-month-panel">
          <div className="calendar-weekdays">
            {weekDays.map(
              (day) => (
                <span key={day}>
                  {day}
                </span>
              ),
            )}
          </div>

          <div className="calendar-month-grid">
            {monthCells.map(
              (
                day,
                index,
              ) => {
                if (
                  day === null
                ) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="calendar-cell empty"
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
                    new Date(),
                  );

                const isSelected =
                  sameDay(
                    cellDate,
                    selectedDate,
                  );

                const dayEvents =
                  eventsByDay[day] ??
                  [];

                return (
                  <button
                    key={day}
                    type="button"
                    className={[
                      'calendar-cell',
                      isToday
                        ? 'today'
                        : '',
                      isSelected
                        ? 'selected'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() =>
                      selectDay(day)
                    }
                  >
                    <span className="calendar-cell-number">
                      {day}
                    </span>

                    <div className="calendar-cell-events">
                      {dayEvents
                        .slice(
                          0,
                          3,
                        )
                        .map(
                          (event) => (
                            <span
                              key={
                                event.id
                              }
                              className={`calendar-event-dot ${event.type}`}
                              title={
                                event.title
                              }
                            >
                              {event.title}
                            </span>
                          ),
                        )}

                      {dayEvents.length >
                        3 && (
                        <small>
                          +
                          {dayEvents.length -
                            3}{' '}
                          more
                        </small>
                      )}
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        <aside className="calendar-agenda-panel">
          <header>
            <div>
              <span className="calendar-agenda-eyebrow">
                Selected day
              </span>

              <h3>
                {selectedDateLabel}
              </h3>
            </div>

            <strong>
              {
                selectedEvents.length
              }
            </strong>
          </header>

          {loading ? (
            <div className="calendar-agenda-state">
              Loading events…
            </div>
          ) : selectedEvents.length ===
            0 ? (
            <div className="calendar-agenda-state">
              <CalendarDays size={26} />

              <strong>
                No events
              </strong>

              <span>
                Nothing is scheduled for this day.
              </span>
            </div>
          ) : (
            <div className="calendar-agenda-list">
              {selectedEvents.map(
                (event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                  />
                ),
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  type,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  type: CalendarEventType;
}) {
  return (
    <article
      className={`calendar-summary-card ${type}`}
    >
      <div>
        {icon}
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function EventCard({
  event,
}: {
  event: CalendarEvent;
}) {
  return (
    <article
      className={`calendar-agenda-item ${event.type}`}
    >
      <div className="calendar-agenda-icon">
        {getEventIcon(
          event.type,
        )}
      </div>

      <div className="calendar-agenda-content">
        <div className="calendar-agenda-title">
          <strong>
            {event.title}
          </strong>

          <span>
            {eventLabels[
              event.type
            ]}
          </span>
        </div>

        <div className="calendar-agenda-meta">
          <span>
            <Clock3 size={13} />
            {formatTime(
              event.startsAt,
            )}
          </span>

          {event.caseNumber && (
            <span>
              <Scale size={13} />
              {event.caseNumber}
            </span>
          )}

          {event.clientName && (
            <span>
              {event.clientName}
            </span>
          )}
        </div>

        {event.location && (
          <p>
            {event.location}
          </p>
        )}

        {event.amount !==
          null && (
          <p>
            {formatCurrency(
              event.amount,
              event.currency,
            )}
          </p>
        )}

        <Link
          to={event.href}
          className="calendar-agenda-link"
        >
          Open details
        </Link>
      </div>
    </article>
  );
}

function getEventIcon(
  type: CalendarEventType,
) {
  switch (type) {
    case 'hearing':
      return <Gavel size={18} />;

    case 'task':
      return <ListTodo size={18} />;

    case 'invoice':
      return <CreditCard size={18} />;

    case 'limitation':
      return <FileWarning size={18} />;

    case 'case_action':
    case 'follow_up':
      return <Scale size={18} />;

    default:
      return <CalendarDays size={18} />;
  }
}

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

function formatTime(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'All day';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function formatCurrency(
  value: number,
  currency: string | null,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency:
        currency ||
        'AED',
      maximumFractionDigits: 2,
    },
  ).format(value);
}
