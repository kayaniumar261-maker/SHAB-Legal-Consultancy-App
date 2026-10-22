import { tr, useLocale } from '../../i18n/locale';
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
  const interfaceLanguage = useLocale();
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{tr("Delete case")}{" "}{caseNumber}?</h3>
        <p>{tr("This will permanently delete the case. Linked records (hearings, tasks, documents) may also be affected.")}</p>

        <div className="modal-actions">
          <button type="button" className="secondary-action-button" onClick={onCancel} disabled={loading}>{tr("Cancel")}</button>
          <button type="button" className="primary-action-button" onClick={() => onConfirm()} disabled={loading}>{loading ? tr("Deleting…") : tr("Delete")}</button>
        </div>
      </div>
    </div>
  );
}
