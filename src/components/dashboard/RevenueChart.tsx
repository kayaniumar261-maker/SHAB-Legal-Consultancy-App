import {
  BarChart3,
  TrendingUp,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getRevenueLast6Months,
  type MonthlyRevenue,
} from '../../services/revenueService';

function formatMoney(
  value: number,
): string {
  if (value >= 1_000_000) {
    return `AED ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `AED ${(value / 1_000).toFixed(
      value % 1_000 === 0 ? 0 : 1,
    )}K`;
  }

  return `AED ${value.toLocaleString('en-AE')}`;
}

export function RevenueChart() {
  const [data, setData] =
    useState<MonthlyRevenue[]>([]);

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
          await getRevenueLast6Months();

        if (active) {
          setData(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load revenue.',
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

  const totalRevenue = useMemo(
    () =>
      data.reduce(
        (total, item) =>
          total + Number(item.revenue ?? 0),
        0,
      ),
    [data],
  );

  const highest = useMemo(
    () =>
      Math.max(
        ...data.map(
          (item) =>
            Number(item.revenue ?? 0),
        ),
        1,
      ),
    [data],
  );

  const hasRevenue =
    totalRevenue > 0;

  return (
    <section className="dashboard-panel revenue-chart-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">
            FINANCIAL PERFORMANCE
          </span>

          <h3>Revenue Overview</h3>

          <p>
            Completed collections over the last six months.
          </p>
        </div>

        <div className="revenue-total-badge">
          <TrendingUp size={13} />

          <div>
            <small>6M Total</small>

            <strong>
              {formatMoney(totalRevenue)}
            </strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dashboard-widget-state">
          Loading revenue…
        </div>
      ) : error ? (
        <div className="dashboard-widget-state error">
          {error}
        </div>
      ) : !hasRevenue ? (
        <div className="dashboard-widget-state revenue-empty-state">
          <BarChart3 size={17} />

          <span>
            No completed payments recorded in the last six months.
          </span>
        </div>
      ) : (
        <div className="revenue-chart-body">
          <div className="revenue-bars">
            {data.map((item) => {
              const revenue =
                Number(item.revenue ?? 0);

              const height =
                revenue === 0
                  ? 3
                  : Math.max(
                      10,
                      (revenue / highest) *
                        82,
                    );

              return (
                <div
                  key={item.month}
                  className="revenue-bar-item"
                >
                  <div className="revenue-bar-value">
                    {revenue > 0
                      ? formatMoney(revenue)
                      : '—'}
                  </div>

                  <div className="revenue-bar-track">
                    <div
                      className={
                        revenue > 0
                          ? 'revenue-bar has-value'
                          : 'revenue-bar'
                      }
                      style={{
                        height: `${height}px`,
                      }}
                    />
                  </div>

                  <span>
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
