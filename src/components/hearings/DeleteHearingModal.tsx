import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Hearing } from '../../types/hearing';
import './DeleteHearingModal.css';

type DeleteHearingModalProps = {
  hearing: Hearing;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteHearingModal({
  hearing,
  onClose,
  onConfirm,
}: DeleteHearingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete hearing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="delete-hearing-overlay" onClick={onClose}>
      <div
        className="delete-hearing-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-hearing-icon">
          <AlertTriangle size={40} />
        </div>

        <h3>Delete Hearing</h3>

        <p className="delete-hearing-description">
          Are you sure you want to delete this hearing? This action cannot be
          undone.
        </p>

        <div className="delete-hearing-details">
          <p>
            <strong>{hearing.title}</strong>
          </p>
          <p>{hearing.court}</p>
          <p className="delete-hearing-date">
            {new Date(hearing.hearing_at).toLocaleString('en-AE', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {error && <div className="delete-hearing-error">{error}</div>}

        <div className="delete-hearing-actions">
          <button
            type="button"
            className="delete-hearing-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-hearing-confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Hearing'}
          </button>
        </div>
      </div>
    </div>
  );
}
