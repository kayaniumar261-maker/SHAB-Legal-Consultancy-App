import { useEffect, useState } from 'react';
import { getCases } from '../../services/caseService';
import type { CaseWithRelations as CaseType } from '../../types/case';

type CaseRow = {
  case_number: string;
  client_name?: string;
  case_type: string;
  assigned_lawyer: string;
  court: string;
  status: string;
  next_hearing: string | null;
};

export function RecentCases() {
  const [cases, setCases] = useState<CaseType[]>([]);

  useEffect(() => {
    async function load() {
      const res = await getCases({ pageSize: 4 });
      setCases(res.data);
    }

    load();
  }, []);

  function statusClass(status: string) {
    switch (status) {
      case 'Open':
        return 'status-pill open';
      case 'In Progress':
        return 'status-pill progress';
      case 'Closed':
        return 'status-pill closed';
      case 'Appeal':
        return 'status-pill appeal';
      case 'Urgent':
        return 'status-pill urgent';
      default:
        return 'status-pill open';
    }
  }

  return (
    <section className="dashboard-panel recent-cases-panel">
      <div className="panel-heading-row">
        <div>
          <h3>Recent Cases</h3>
          <p>Current matters that need your attention.</p>
        </div>
      </div>

      <div className="recent-cases-table-wrap">
        <table className="recent-cases-table">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Client</th>
              <th>Case Type</th>
              <th>Lawyer</th>
              <th>Court</th>
              <th>Status</th>
              <th>Next Hearing</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>{c.case_number}</td>
                <td>{c.client_id}</td>
                <td>{c.case_type}</td>
                <td>{c.assigned_staff?.full_name ?? c.assigned_staff_id ?? '-'}</td>
                <td>{c.court}</td>
                <td>
                  <span className={statusClass(String(c.status))}>{String(c.status)}</span>
                </td>
                <td>{c.next_hearing_at ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
