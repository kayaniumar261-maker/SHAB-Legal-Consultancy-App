import { useEffect, useState } from 'react';
import {
  getRevenueLast6Months,
  type MonthlyRevenue,
} from '../../services/revenueService';

export function RevenueChart() {
  const [data, setData] = useState<MonthlyRevenue[]>([]);

  useEffect(() => {
    getRevenueLast6Months()
      .then(setData)
      .catch(console.error);
  }, []);

  const highest = Math.max(
    ...data.map((x) => x.revenue),
    1,
  );

  return (
    <section className="dashboard-panel revenue-chart-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Revenue Overview</h3>
          <p>Last six months</p>
        </div>
      </div>

      <div className="revenue-bars">
        {data.map((item) => (
          <div
            key={item.month}
            className="revenue-bar-item"
          >
            <div
              className="revenue-bar"
              style={{
                height: `${
                  (item.revenue / highest) * 180
                }px`,
              }}
            />

            <span>{item.month}</span>

            <strong>
              AED {item.revenue.toLocaleString()}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}