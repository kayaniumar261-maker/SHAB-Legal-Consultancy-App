import { useEffect, useState } from 'react';
import {
  CalendarDays,
  FolderOpen,
  Scale,
  UserRound,
} from 'lucide-react';
import { getCases } from '../../services/caseService';
import type { CaseWithRelations } from '../../types/case';
import './RecentCases.css';

export function RecentCases() {
  const [cases, setCases] = useState<CaseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getCases({ pageSize: 4 });
        setCases(result.data ?? []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function statusClass(status: string) {
    switch (status) {
      case 'Open':
        return 'case-status open';

      case 'Closed':
        return 'case-status closed';

      case 'In Progress':
        return 'case-status progress';

      case 'Appeal':
        return 'case-status appeal';

      case 'Urgent':
        return 'case-status urgent';

      default:
        return 'case-status';
    }
  }

  function formatDate(date: string | null) {
    if (!date) return 'No Hearing';

    return new Date(date).toLocaleDateString();
  }

  if (loading) {
    return (
      <section className="dashboard-panel recent-cases-panel">
        <div className="recent-cases-loading">
          Loading recent cases...
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-panel recent-cases-panel">
      <div className="recent-cases-header">
        <div>
          <span className="recent-eyebrow">
            CASE MANAGEMENT
          </span>

          <h3>Recent Cases</h3>

          <p>
            Current legal matters requiring attention.
          </p>
        </div>

        <div className="recent-header-icon">
          <Scale size={22} />
        </div>
      </div>

      <div className="recent-case-list">
        {cases.map((item) => (
          <div
            key={item.id}
            className="recent-case-card"
          >
            <div className="recent-top">
              <div className="case-icon">
                <FolderOpen size={18} />
              </div>

              <div className="case-title">
                <strong>{item.case_number}</strong>

                <span>{item.case_type}</span>
              </div>

              <span
                className={statusClass(
                  String(item.status)
                )}
              >
                {String(item.status)}
              </span>
            </div>

            <div className="recent-info-grid">
              <div>
                <UserRound size={15} />

                <div>
                  <small>Client</small>

                  <strong>
                    {item.client_id || '-'}
                  </strong>
                </div>
              </div>

              <div>
                <Scale size={15} />

                <div>
                  <small>Lawyer</small>

                  <strong>
                    {item.assigned_staff?.full_name ??
                      '-'}
                  </strong>
                </div>
              </div>

              <div>
                <CalendarDays size={15} />

                <div>
                  <small>Hearing</small>

                  <strong>
                    {formatDate(
                      item.next_hearing_at
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="recent-footer">
              <span>Court</span>

              <strong>{item.court}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}