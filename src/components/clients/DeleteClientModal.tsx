import { tr, useLocale } from '../../i18n/locale';
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
  const interfaceLanguage = useLocale();
  if (!open) {
    return null;
  }

  return (
    <div className="client-modal-layer" role="presentation">
      <button
        type="button"
        className="client-modal-backdrop"
        onClick={onCancel}
        aria-label={tr("Close delete dialog")}
      />

      <section className="client-modal" role="dialog" aria-modal="true">
        <header className="client-modal-header">
          <div>
            <p className="modal-eyebrow">{tr("Delete client")}</p>
            <h3>{tr("Confirm deletion")}</h3>
            <p className="modal-description">{tr("This action cannot be undone. The client record for")}{" "}{clientName}{" "}{tr("will be removed permanently.")}</p>
          </div>
        </header>

        <div className="client-form" style={{ paddingBottom: '24px' }}>
          <div className="validation-error" role="alert">{tr("Are you sure you want to delete this client?")}</div>

          <footer className="client-form-actions">
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
              {loading ? tr("Deleting…") : tr("Delete Client")}
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
