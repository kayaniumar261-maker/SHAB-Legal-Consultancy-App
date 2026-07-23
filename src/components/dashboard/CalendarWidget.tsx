const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const highlighted = [3, 5, 9, 12, 16];

export function CalendarWidget() {
  return (
    <section className="dashboard-panel calendar-widget-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Calendar</h3>
          <p>Current month with highlighted hearings.</p>
        </div>
      </div>

      <div className="calendar-grid">
        {days.map((day) => (
          <div key={day} className="calendar-day-label">
            {day}
          </div>
        ))}

        {Array.from({ length: 30 }, (_, index) => index + 1).map((date) => (
          <div
            key={date}
            className={
              highlighted.includes(date)
                ? 'calendar-day highlighted'
                : 'calendar-day'
            }
          >
            {date}
          </div>
        ))}
      </div>
    </section>
  );
}
