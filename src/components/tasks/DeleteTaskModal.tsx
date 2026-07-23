type DeleteTaskModalProps = {
  open: boolean;
  taskTitle: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteTaskModal({
  open,
  taskTitle,
  loading,
  onCancel,
  onConfirm,
}: DeleteTaskModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="task-modal-layer" role="presentation">
      <button
        type="button"
        className="task-modal-backdrop"
        onClick={onCancel}
        aria-label="Close delete dialog"
      />

      <section className="task-modal" role="dialog" aria-modal="true">
        <header className="task-modal-header">
          <div>
            <p className="modal-eyebrow">Delete task</p>
            <h3>Confirm deletion</h3>
            <p className="modal-description">
              This action cannot be undone. The task "{taskTitle}" will be permanently removed.
            </p>
          </div>
        </header>

        <div className="task-form" style={{ paddingBottom: '24px' }}>
          <div className="validation-error" role="alert">
            Are you sure you want to delete this task?
          </div>

          <footer className="task-form-actions">
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
              {loading ? 'Deleting…' : 'Delete Task'}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
