import { tr, useLocale } from '../../i18n/locale';
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
  const interfaceLanguage = useLocale();
  if (!open) {
    return null;
  }

  return (
    <div className="task-modal-layer" role="presentation">
      <button
        type="button"
        className="task-modal-backdrop"
        onClick={onCancel}
        aria-label={tr("Close delete dialog")}
      />

      <section className="task-modal" role="dialog" aria-modal="true">
        <header className="task-modal-header">
          <div>
            <p className="modal-eyebrow">{tr("Delete task")}</p>
            <h3>{tr("Confirm deletion")}</h3>
            <p className="modal-description">{tr("This action cannot be undone. The task \"")}{taskTitle}{tr("\" will be permanently removed.")}</p>
          </div>
        </header>

        <div className="task-form" style={{ paddingBottom: '24px' }}>
          <div className="validation-error" role="alert">{tr("Are you sure you want to delete this task?")}</div>

          <footer className="task-form-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onCancel}
              disabled={loading}
            >{tr("Cancel")}</button>
            <button
              type="button"
              className="primary-action-button"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? tr("Deleting…") : tr("Delete Task")}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
