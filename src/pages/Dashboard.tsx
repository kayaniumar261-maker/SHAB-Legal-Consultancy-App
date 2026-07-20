import {
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  CreditCard,
  Gavel,
  Users,
} from 'lucide-react';

const summaryCards = [
  {
    label: 'Total Clients',
    value: '0',
    icon: Users,
    detail: 'Active client records',
  },
  {
    label: 'Open Cases',
    value: '0',
    icon: BriefcaseBusiness,
    detail: 'Cases requiring attention',
  },
  {
    label: 'Upcoming Hearings',
    value: '0',
    icon: Gavel,
    detail: 'Next 30 days',
  },
  {
    label: 'Pending Tasks',
    value: '0',
    icon: CheckSquare,
    detail: 'Incomplete assignments',
  },
  {
    label: 'Outstanding',
    value: 'AED 0',
    icon: CreditCard,
    detail: 'Pending collections',
  },
  {
    label: 'Today’s Events',
    value: '0',
    icon: CalendarClock,
    detail: 'Hearings and deadlines',
  },
];

export function Dashboard() {
  return (
    <div className="page-container">
      <section className="page-heading">
        <div>
          <p className="page-eyebrow">
            Executive overview
          </p>

          <h2>Dashboard</h2>

          <p>
            Monitor clients, cases,
            hearings, tasks, and financial
            activity from one place.
          </p>
        </div>

        <div className="status-badge">
          System Ready
        </div>
      </section>

      <section className="summary-grid">
        {summaryCards.map(
          ({
            label,
            value,
            icon: Icon,
            detail,
          }) => (
            <article
              key={label}
              className="summary-card"
            >
              <div className="summary-card-icon">
                <Icon size={22} />
              </div>

              <div>
                <p>{label}</p>
                <strong>{value}</strong>
                <span>{detail}</span>
              </div>
            </article>
          ),
        )}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Upcoming Schedule</h3>

              <p>
                Hearings, deadlines, and
                tasks will appear here.
              </p>
            </div>

            <CalendarClock size={22} />
          </div>

          <div className="empty-panel">
            <CalendarClock size={34} />

            <strong>
              No upcoming events
            </strong>

            <span>
              Add hearings or tasks to
              begin tracking deadlines.
            </span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Activity</h3>

              <p>
                Important actions across
                the application.
              </p>
            </div>

            <BriefcaseBusiness size={22} />
          </div>

          <div className="empty-panel">
            <BriefcaseBusiness size={34} />

            <strong>
              No activity recorded
            </strong>

            <span>
              New clients, cases, and
              updates will appear here.
            </span>
          </div>
        </article>
      </section>
    </div>
  );
}
