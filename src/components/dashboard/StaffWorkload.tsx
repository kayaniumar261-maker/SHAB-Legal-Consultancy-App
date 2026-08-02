import {
  BriefcaseBusiness,
  FileText,
  Gavel,
  ListTodo,
  LoaderCircle,
  Users,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  getStaffWorkloadRanking,
  type StaffWorkloadRankingItem,
} from '../../services/staffDashboardService';

function formatRole(
  role: string | null,
): string {
  if (!role) {
    return 'Staff Member';
  }

  return role
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export function StaffWorkload() {
  const [items, setItems] =
    useState<
      StaffWorkloadRankingItem[]
    >([]);

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
          await getStaffWorkloadRanking(
            6,
          );

        if (active) {
          setItems(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load staff workload.',
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

  const highestWorkload =
    useMemo(
      () =>
        Math.max(
          ...items.map(
            (item) =>
              item.totalWorkload,
          ),
          1,
        ),
      [items],
    );

  return (
    <section className="dashboard-panel staff-workload-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            TEAM OPERATIONS
          </span>

          <h3>Staff Workload</h3>

          <p>
            Active team members ranked by linked operational records.
          </p>
        </div>

        <Link
          className="widget-link"
          to="/staff"
        >
          View Staff
        </Link>
      </div>

      {loading ? (
        <div className="staff-workload-state">
          <LoaderCircle
            size={22}
            className="staff-workload-loader"
          />

          <span>
            Loading team workload…
          </span>
        </div>
      ) : error ? (
        <div className="staff-workload-state error">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="staff-workload-state">
          <Users size={22} />

          <span>
            No active staff records available.
          </span>
        </div>
      ) : (
        <div className="staff-workload-list">
          {items.map((item) => {
            const percentage =
              item.totalWorkload > 0
                ? Math.max(
                    5,
                    (
                      item.totalWorkload /
                      highestWorkload
                    ) * 100,
                  )
                : 0;

            return (
              <Link
                key={item.id}
                className="staff-workload-row"
                to={`/staff/${item.id}`}
              >
                <div className="staff-workload-row-heading">
                  <div>
                    <strong>
                      {item.fullName}
                    </strong>

                    <span>
                      {formatRole(
                        item.role,
                      )}
                    </span>
                  </div>

                  <b>
                    {item.totalWorkload}
                  </b>
                </div>

                <div className="staff-workload-metrics">
                  <span title="Cases">
                    <BriefcaseBusiness
                      size={13}
                    />
                    {item.cases}
                  </span>

                  <span title="Tasks">
                    <ListTodo
                      size={13}
                    />
                    {item.tasks}
                  </span>

                  <span title="Hearings">
                    <Gavel size={13} />
                    {item.hearings}
                  </span>

                  <span title="Documents">
                    <FileText
                      size={13}
                    />
                    {item.documents}
                  </span>
                </div>

                <div className="staff-workload-track">
                  <div
                    className="staff-workload-progress"
                    style={{
                      width:
                        `${percentage}%`,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
