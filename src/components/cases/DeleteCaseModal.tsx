import React from 'react';
import './CaseFormModal.css';

type Props = {
  caseNumber: string;
  open: boolean;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
};

export function DeleteCaseModal({ caseNumber, open, loading, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Delete case {caseNumber}?</h3>
        <p>This will permanently delete the case. Linked records (hearings, tasks, documents) may also be affected.</p>

        <div className="modal-actions">
          <button type="button" className="secondary-action-button" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="button" className="primary-action-button" onClick={() => onConfirm()} disabled={loading}>{loading ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}
