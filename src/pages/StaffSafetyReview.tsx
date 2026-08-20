import './StaffSafetyReview.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  listDeletionRequests,
  listStaffActivity,
  markDeletionCompleted,
  markStaffActivityReviewed,
  resolveDeletionRequest,
  type DeletionRequestStatus,
  type StaffActivityEntry,
  type StaffDeletionRequest,
} from '../services/staffSafetyService';

type Filter = DeletionRequestStatus | 'all';
type Decision = { request: StaffDeletionRequest; kind: 'approve' | 'reject' | 'complete' };

const filters: Filter[] = ['pending', 'approved', 'rejected', 'completed', 'cancelled', 'all'];
const entityLabels: Record<string, string> = {
  client: 'Client', case: 'Case', case_note: 'Case note', task: 'Task', hearing: 'Hearing', document: 'Document',
};

function recordName(request: StaffDeletionRequest) {
  const snapshot = request.record_snapshot ?? {};
  for (const key of ['full_name', 'title', 'file_name', 'document_name', 'case_number', 'name']) {
    const value = snapshot[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return `${entityLabels[request.entity_type] ?? request.entity_type} ${request.record_id.slice(0, 8)}`;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

export function StaffSafetyReview() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [requests, setRequests] = useState<StaffDeletionRequest[]>([]);
  const [activities, setActivities] = useState<StaffActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [requestRows, activityRows] = await Promise.all([
        listDeletionRequests(filter),
        listStaffActivity(true),
      ]);
      setRequests(requestRows);
      setActivities(activityRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff safety records.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);
  const pendingCount = useMemo(() => filter === 'pending' ? requests.length : 0, [filter, requests]);

  const submitDecision = async () => {
    if (!decision) return;
    try {
      setSaving(true);
      setError(null);
      if (decision.kind === 'complete') {
        await markDeletionCompleted(decision.request.id);
        setNotice('Deletion was verified and marked completed.');
      } else {
        await resolveDeletionRequest(decision.request.id, decision.kind === 'approve', note);
        setNotice(decision.kind === 'approve'
          ? 'Request approved. An administrator may now delete the record from its normal module.'
          : 'Request rejected and retained in the audit history.');
      }
      setDecision(null);
      setNote('');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the request.');
    } finally {
      setSaving(false);
    }
  };

  const reviewActivity = async (activityId: number) => {
    try {
      await markStaffActivityReviewed(activityId);
      setActivities((current) => current.filter((entry) => entry.id !== activityId));
      setNotice('Staff edit marked as reviewed.');
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : 'Unable to review the activity.');
    }
  };

  return (
    <main className="page-container safety-review-page">
      <section className="page-heading safety-review-heading">
        <div>
          <Link to="/staff" className="safety-review-back"><ArrowLeft size={17} /> Staff</Link>
          <p className="page-eyebrow">Administrator control</p>
          <h2>Safety Review</h2>
          <p>Review staff deletion requests and edits without weakening existing access rules.</p>
        </div>
        <button type="button" className="secondary-action-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={17} /> Refresh
        </button>
      </section>

      <section className="safety-review-summary">
        <article><ShieldAlert size={22} /><div><span>Pending requests</span><strong>{pendingCount}</strong></div></article>
        <article><ClipboardCheck size={22} /><div><span>Staff edits awaiting review</span><strong>{activities.length}</strong></div></article>
      </section>

      {error ? <div className="safety-review-message error" role="alert">{error}</div> : null}
      {notice ? <div className="safety-review-message success">{notice}</div> : null}

      <section className="panel safety-review-panel">
        <header>
          <div><h3>Deletion requests</h3><p>Approval records authorization only. It never deletes data automatically.</p></div>
          <label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            {filters.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
          </select></label>
        </header>

        {loading ? <p className="safety-review-empty">Loading review queue…</p> : requests.length === 0 ? (
          <p className="safety-review-empty">No {filter === 'all' ? '' : `${filter} `}deletion requests.</p>
        ) : <div className="safety-request-list">{requests.map((request) => (
          <article className="safety-request-card" key={request.id}>
            <div className="safety-request-title">
              <div><span className={`safety-status ${request.status}`}>{request.status}</span><h4>{recordName(request)}</h4><p>{entityLabels[request.entity_type] ?? request.entity_type}</p></div>
              <time>{formatDate(request.requested_at)}</time>
            </div>
            <dl>
              <div><dt>Requested by</dt><dd>{request.requested_by_email}</dd></div>
              <div><dt>Reason</dt><dd>{request.reason}</dd></div>
              {request.resolution_note ? <div><dt>Administrator note</dt><dd>{request.resolution_note}</dd></div> : null}
            </dl>
            <details><summary>Record snapshot</summary><pre>{JSON.stringify(request.record_snapshot, null, 2)}</pre></details>
            {request.status === 'pending' ? <div className="safety-request-actions">
              <button className="safety-reject" type="button" onClick={() => setDecision({ request, kind: 'reject' })}><XCircle size={17} /> Reject</button>
              <button className="safety-approve" type="button" onClick={() => setDecision({ request, kind: 'approve' })}><CheckCircle2 size={17} /> Approve request</button>
            </div> : null}
            {request.status === 'approved' ? <div className="safety-request-actions">
              <button className="safety-complete" type="button" onClick={() => setDecision({ request, kind: 'complete' })}><ClipboardCheck size={17} /> Mark deletion completed</button>
            </div> : null}
          </article>
        ))}</div>}
      </section>

      <section className="panel safety-review-panel">
        <header><div><h3>Edits requiring attention</h3><p>Operations Staff edits are logged for administrator awareness.</p></div></header>
        {activities.length === 0 ? <p className="safety-review-empty">No staff edits require review.</p> : (
          <div className="safety-activity-list">{activities.map((activity) => <article key={activity.id}>
            <Clock3 size={18} /><div><strong>{entityLabels[activity.entity_type] ?? activity.entity_type} {activity.action}</strong><span>{activity.changed_by_email ?? 'Unknown staff account'} · {formatDate(activity.created_at)}</span></div>
            <button type="button" className="secondary-action-button" onClick={() => void reviewActivity(activity.id)}>Mark reviewed</button>
          </article>)}</div>
        )}
      </section>

      {decision ? <div className="safety-review-overlay" role="presentation"><section className="safety-review-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-decision-title">
        <p className="page-eyebrow">Administrator decision</p>
        <h3 id="safety-decision-title">{decision.kind === 'approve' ? 'Approve deletion request' : decision.kind === 'reject' ? 'Reject deletion request' : 'Confirm deletion completed'}</h3>
        <p><strong>{recordName(decision.request)}</strong></p>
        {decision.kind === 'complete' ? <p>Use this only after an administrator has deleted the record in its normal module and verified that the correct record was removed.</p> : <label>Decision note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Explain this decision (minimum 3 characters)." /></label>}
        <div className="safety-dialog-actions"><button type="button" className="secondary-action-button" onClick={() => { setDecision(null); setNote(''); }} disabled={saving}>Cancel</button><button type="button" className="primary-action-button" onClick={() => void submitDecision()} disabled={saving || (decision.kind !== 'complete' && note.trim().length < 3)}>{saving ? 'Saving…' : 'Confirm'}</button></div>
      </section></div> : null}
    </main>
  );
}
