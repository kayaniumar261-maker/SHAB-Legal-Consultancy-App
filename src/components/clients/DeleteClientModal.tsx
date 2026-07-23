type DeleteClientModalProps = {
  open: boolean;
  clientName: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteClientModal({
  open,
  clientName,
  loading,
  onCancel,
  onConfirm,
}: DeleteClientModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="client-modal-layer" role="presentation">
      <button
        type="button"
        className="client-modal-backdrop"
        onClick={onCancel}
        aria-label="Close delete dialog"
      />

      <section className="client-modal" role="dialog" aria-modal="true">
        <header className="client-modal-header">
          <div>
            <p className="modal-eyebrow">Delete client</p>
            <h3>Confirm deletion</h3>
            <p className="modal-description">
              This action cannot be undone. The client record for {clientName} will be removed permanently.
            </p>
          </div>
        </header>

        <div className="client-form" style={{ paddingBottom: '24px' }}>
          <div className="validation-error" role="alert">
            Are you sure you want to delete this client?
          </div>

          <footer className="client-form-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-action-button"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Deleting…' : 'Delete Client'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
