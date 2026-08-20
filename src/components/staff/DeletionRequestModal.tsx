import { useEffect, useState } from 'react';
import { AlertTriangle, Send, X } from 'lucide-react';

import {
  requestRecordDeletion,
  type StaffSafetyEntity,
} from '../../services/staffSafetyService';
import './DeletionRequestModal.css';

type Props = {
  open: boolean;
  entityType: StaffSafetyEntity;
  recordId: string | null;
  recordLabel: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function DeletionRequestModal({
  open,
  entityType,
  recordId,
  recordLabel,
  onClose,
  onSubmitted,
}: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open || !recordId) return null;

  async function submit() {
    try {
      setSubmitting(true);
      setError(null);
      await requestRecordDeletion(entityType, recordId!, reason);
      window.alert('Deletion request sent to the administrators for review.');
      onSubmitted?.();
      onClose();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit the deletion request.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="deletion-request-backdrop" role="presentation">
      <section className="deletion-request-modal" role="dialog" aria-modal="true" aria-labelledby="deletion-request-title">
        <header>
          <div className="deletion-request-icon"><AlertTriangle size={22} /></div>
          <div>
            <p>Administrator approval required</p>
            <h2 id="deletion-request-title">Request deletion</h2>
          </div>
          <button type="button" className="deletion-request-close" onClick={onClose} disabled={submitting} aria-label="Close"><X size={20} /></button>
        </header>
        <p className="deletion-request-record">{recordLabel}</p>
        <label>
          Reason for deletion
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} rows={4} placeholder="Explain why this record should be deleted (minimum 10 characters)." autoFocus />
        </label>
        <small>{reason.trim().length}/1000 characters</small>
        {error ? <div className="deletion-request-error">{error}</div> : null}
        <footer>
          <button type="button" className="secondary-action-button" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="primary-action-button" onClick={() => void submit()} disabled={submitting || reason.trim().length < 10}>
            <Send size={17} />{submitting ? 'Sending…' : 'Send to administrator'}
          </button>
        </footer>
      </section>
    </div>
  );
}
