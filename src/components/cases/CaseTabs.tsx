import { useMemo, useState, useEffect } from 'react';

import type { Case } from '../../types/case';
import type { Hearing } from '../../types/hearing';
import { getHearingsByCase } from '../../services/hearingService';
import './CaseTabs.css';

const tabs = [
  'Overview',
  'Hearings',
  'Documents',
  'Tasks',
  'Billing',
  'Timeline',
  'Notes',
] as const;

type CaseTabsProps = {
  caseRecord: Case;
  clientName: string;
};

export function CaseTabs({
  caseRecord,
  clientName,
}: CaseTabsProps) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Overview');
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(false);

  useEffect(() => {
    if (activeTab === 'Hearings') {
      setLoadingHearings(true);
      getHearingsByCase(caseRecord.id)
        .then((rows) => setHearings(rows))
        .catch(() => setHearings([]))
        .finally(() => setLoadingHearings(false));
    }
  }, [activeTab, caseRecord.id]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'Overview':
        return (
          <div className="case-tabs-content-grid">
            <article className="case-summary-card">
              <h3>Summary</h3>
              <div className="case-summary-row">
                <span>Case Number</span>
                <strong>{caseRecord.case_number}</strong>
              </div>
              <div className="case-summary-row">
                <span>Client</span>
                <strong>{clientName}</strong>
              </div>
              <div className="case-summary-row">
                <span>Case Type</span>
                <strong>{caseRecord.case_type}</strong>
              </div>
              <div className="case-summary-row">
                <span>Court</span>
                <strong>{caseRecord.court}</strong>
              </div>
              <div className="case-summary-row">
                <span>Assigned Staff</span>
                <strong>{caseRecord.assigned_staff_id ?? 'Unassigned'}</strong>
              </div>
              <div className="case-summary-row">
                <span>Status</span>
                <strong>{caseRecord.status}</strong>
              </div>
              <div className="case-summary-row">
                <span>Priority</span>
                <strong>{caseRecord.priority}</strong>
              </div>
            </article>

            <article className="case-summary-card">
              <h3>Dates</h3>
              <div className="case-summary-row">
                <span>Filing Date</span>
                <strong>{formatDate(caseRecord.filing_date)}</strong>
              </div>
              <div className="case-summary-row">
                <span>Next Hearing</span>
                <strong>
                  {caseRecord.next_hearing_at
                    ? formatDate(caseRecord.next_hearing_at)
                    : 'Not scheduled'}
                </strong>
              </div>
              <div className="case-summary-row">
                <span>Case Value</span>
                <strong>
                  {caseRecord.case_value != null
                    ? `AED ${caseRecord.case_value.toLocaleString('en-AE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Not set'}
                </strong>
              </div>
            </article>

            <article className="case-summary-card case-summary-card-wide">
              <h3>Case details</h3>
              <p>{caseRecord.description || 'No description provided.'}</p>
            </article>
          </div>
        );

      case 'Hearings':
        return (
          <div>
            <h3>Hearings</h3>
            {loadingHearings ? (
              <div>Loading hearings…</div>
            ) : hearings.length === 0 ? (
              <div className="case-empty-state">No hearings found for this case.</div>
            ) : (
              <div className="case-list">
                {hearings.map((h) => (
                  <div key={h.id} className="case-list-row">
                    <div>
                      <strong>{h.title}</strong>
                      <br />
                      <small>
                        {new Date(h.hearing_at).toLocaleString('en-AE', {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </div>
                    <div>{h.court}</div>
                    <div>{h.hearing_type}</div>
                    <div>
                      <span className={`hearing-status-badge hearing-status-${h.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {h.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'Documents':
        return (
          <div className="case-empty-state">
            <strong>Documents</strong>
            <p>
              Upload legal documents, pleadings, and evidence files for this case in the documents module.
            </p>
          </div>
        );

      case 'Tasks':
        return (
          <div className="case-empty-state">
            <strong>Tasks</strong>
            <p>
              Manage tasks related to this case in the tasks module.
            </p>
          </div>
        );

      case 'Billing':
        return (
          <div className="case-empty-state">
            <strong>Billing</strong>
            <p>
              Billing and invoice details will appear here once billing is connected to the case.
            </p>
          </div>
        );

      case 'Timeline':
        return (
          <div className="case-empty-state">
            <strong>Timeline</strong>
            <p>
              Follow case progress and event history across filings, hearings, and notes in the timeline.
            </p>
          </div>
        );

      case 'Notes':
        return (
          <article className="case-summary-card case-summary-card-wide">
            <h3>Internal Notes</h3>
            <p>{caseRecord.internal_notes || 'No internal notes have been added.'}</p>
          </article>
        );

      default:
        return null;
    }
  }, [activeTab, caseRecord, clientName, hearings, loadingHearings]);

  return (
    <div className="case-tabs">
      <div className="case-tabs-navigation">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={
              tab === activeTab
                ? 'case-tab-button case-tab-button-active'
                : 'case-tab-button'
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="case-tabs-panel">{tabContent}</div>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
