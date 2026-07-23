import { useEffect, useState } from 'react';
import { ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { deleteCase, getCaseById } from '../services/caseService';
import type { CaseWithRelations as Case } from '../types/case';
import { CaseTabs } from '../components/cases/CaseTabs';
import './CaseDetails.css';

export function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Case ID is missing.');
      setLoading(false);
      return;
    }

    const caseId = id;

    async function loadCase() {
      try {
        const caseData = await getCaseById(caseId);

        if (!caseData) {
          setError('Case not found.');
          return;
        }

        setCaseRecord(caseData);
      } catch (fetchError) {
        if (fetchError instanceof Error) {
          setError(fetchError.message);
        } else {
          setError('Unable to load case details.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadCase();
  }, [id]);

  if (loading) {
    return (
      <div className="case-details-page">
        <div className="case-details-loading">Loading case details…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-details-page page-container">
        <section className="page-heading">
          <p className="page-eyebrow">Case management</p>
          <h2>Error</h2>
          <p className="page-intro">There was a problem loading the case.</p>
        </section>

        <div className="case-details-error">{error}</div>
        <button
          type="button"
          className="secondary-action-button"
          onClick={() => navigate('/cases')}
        >
          Back to Cases
        </button>
      </div>
    );
  }

  if (!caseRecord) {
    return null;
  }

  return (
    <div className="case-details-page page-container">
      <section className="case-details-header">
        <button
          type="button"
          className="secondary-action-button back-button"
          onClick={() => navigate('/cases')}
        >
          <ArrowLeft size={16} /> Back to cases
        </button>

        <div>
          <p className="page-eyebrow">Case details</p>
          <h2>{caseRecord.case_number}</h2>
          <p className="page-intro">
            Track every detail for this matter, including client information and legal progress.
          </p>
        </div>

        <div className="case-details-actions">
          <Link
            to={`/cases/${caseRecord.id}/edit`}
            className="primary-action-button"
          >
            <Edit3 size={18} /> Edit Case
          </Link>

          <button
            type="button"
            className="secondary-action-button delete-case-button"
            onClick={async () => {
              const confirmed = window.confirm(
                'Delete this case? This cannot be undone.',
              );

              if (!confirmed) {
                return;
              }

              try {
                await deleteCase(caseRecord.id);
                navigate('/cases');
              } catch (deleteError) {
                if (deleteError instanceof Error) {
                  setError(deleteError.message);
                } else {
                  setError('Unable to delete case.');
                }
              }
            }}
          >
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </section>

      <section className="case-details-summary">
        <div className="case-details-summary-row">
          <span>Client</span>
          <strong>{caseRecord.client?.full_name ?? 'Unknown client'}</strong>
        </div>
        <div className="case-details-summary-row">
          <span>Status</span>
          <strong>{caseRecord.status}</strong>
        </div>
        <div className="case-details-summary-row">
          <span>Priority</span>
          <strong>{caseRecord.priority}</strong>
        </div>
        <div className="case-details-summary-row">
          <span>Filing Date</span>
          <strong>{formatDate(caseRecord.filing_date)}</strong>
        </div>
        <div className="case-details-summary-row">
          <span>Next Hearing</span>
          <strong>
            {caseRecord.next_hearing_at
              ? formatDate(caseRecord.next_hearing_at)
              : 'Not scheduled'}
          </strong>
        </div>
        <div className="case-details-summary-row">
          <span>Assigned Staff</span>
          <strong>{caseRecord.assigned_staff?.full_name ?? caseRecord.assigned_staff_id ?? 'Unassigned'}</strong>
        </div>
      </section>

      <CaseTabs
        caseRecord={caseRecord}
        clientName={caseRecord.client?.full_name ?? 'Unknown client'}
      />
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
