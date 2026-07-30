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
  getHearingsForMonth,
  type DashboardHearing,
} from '../../services/hearingService';

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
  a: Date,
  b: Date,
): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarWidget() {
  const [visibleMonth, setVisibleMonth] =
    useState(() => {
      const now = new Date();

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
    });

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
          await getHearingsForMonth(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth(),
          );

        if (active) {
          setHearings(result);
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
      let date = 1;
      date <= totalDays;
      date += 1
    ) {
      cells.push(date);
    }

    return cells;
  }, [visibleMonth]);

  const hearingDates = useMemo(() => {
    return hearings.reduce<
      Record<number, number>
    >(
      (map, hearing) => {
        const hearingDate =
          new Date(
            hearing.hearing_at,
          );

        if (
          !Number.isNaN(
            hearingDate.getTime(),
          )
        ) {
          const day =
            hearingDate.getDate();

          map[day] =
            (map[day] ?? 0) + 1;
        }

        return map;
      },
      {},
    );
  }, [hearings]);

  const today =
    new Date();

  return (
    <section className="dashboard-panel calendar-widget-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            COURT CALENDAR
          </span>

          <h3>Calendar</h3>

          <p>
            Hearing activity by month.
          </p>
        </div>

        <div className="calendar-month-controls">
          <button
            type="button"
            onClick={() => {
              setVisibleMonth(
                (current) =>
                  new Date(
                    current.getFullYear(),
                    current.getMonth() - 1,
                    1,
                  ),
              );
            }}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </button>

          <strong>
            {monthLabel}
          </strong>

          <button
            type="button"
            onClick={() => {
              setVisibleMonth(
                (current) =>
                  new Date(
                    current.getFullYear(),
                    current.getMonth() + 1,
                    1,
                  ),
              );
            }}
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
              (date, index) => {
                if (date === null) {
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
                    date,
                  );

                const isToday =
                  sameDay(
                    cellDate,
                    today,
                  );

                const hearingCount =
                  hearingDates[date] ??
                  0;

                const className = [
                  'calendar-day',
                  isToday
                    ? 'today'
                    : '',
                  hearingCount > 0
                    ? 'highlighted'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <div
                    key={date}
                    className={className}
                    title={
                      hearingCount > 0
                        ? `${hearingCount} hearing${
                            hearingCount === 1
                              ? ''
                              : 's'
                          }`
                        : undefined
                    }
                  >
                    <span>
                      {date}
                    </span>

                    {hearingCount > 0 && (
                      <small>
                        {hearingCount}
                      </small>
                    )}
                  </div>
                );
              },
            )}
          </div>

          <div className="calendar-widget-footer">
            <span>
              {hearings.length === 0
                ? 'No hearings this month'
                : `${hearings.length} hearing${
                    hearings.length === 1
                      ? ''
                      : 's'
                  } this month`}
            </span>
          </div>
        </>
      )}
    </section>
  );
}