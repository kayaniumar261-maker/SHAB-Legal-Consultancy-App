import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  LoaderCircle,
} from 'lucide-react';

import {
  getCaseDistribution,
  type CaseDistributionItem,
} from '../../services/caseDistributionService';

function formatStatus(status: string): string {
  return status
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CaseDistribution() {
  const [items, setItems] = useState<CaseDistributionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result = await getCaseDistribution();

        if (active) {
          setItems(result);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load case distribution.',
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

  const totalCases = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.count,
        0,
      ),
    [items],
  );

  return (
    <section className="dashboard-panel case-distribution-panel">
      <div className="panel-heading-row">
        <div>
          <span className="section-tag">CASE PORTFOLIO</span>
          <h3>Case Distribution</h3>
          <p>
            Live breakdown of non-archived matters by status.
          </p>
        </div>

        <div className="case-distribution-total">
          <strong>{totalCases}</strong>
          <span>Total</span>
        </div>
      </div>

      {loading ? (
        <div className="case-distribution-state">
          <LoaderCircle
            size={22}
            className="case-distribution-loader"
          />
          <span>Loading case portfolio…</span>
        </div>
      ) : error ? (
        <div className="case-distribution-state error">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="case-distribution-state">
          <BriefcaseBusiness size={22} />
          <span>No case data available yet.</span>
        </div>
      ) : (
        <div className="case-distribution-list">
          {items.map((item) => (
            <div
              className="case-distribution-row"
              key={item.status}
            >
              <div className="case-distribution-row-top">
                <span>{formatStatus(item.status)}</span>

                <div>
                  <strong>{item.count}</strong>
                  <small>{item.percentage}%</small>
                </div>
              </div>

              <div className="case-distribution-track">
                <div
                  className="case-distribution-progress"
                  style={{
                    width: `${item.percentage}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}