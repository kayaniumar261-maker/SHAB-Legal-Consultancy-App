import React from 'react';
import './CaseFormModal.css';
import { CaseForm } from './CaseForm';
import type { Case, CaseInsert, CaseUpdate } from '../../types/case';
import type { Client } from '../../types/client';
import type { Staff } from '../../types/staff';

type Props = {
  open: boolean;
  caseRecord?: Case | null;
  clients: Array<Pick<Client, 'id' | 'full_name'>>;
  staff: Array<Pick<Staff, 'id' | 'full_name'>>;
  loading?: boolean;
  onSubmit: (data: CaseInsert | CaseUpdate) => Promise<void>;
  onClose: () => void;
  submitLabel: string;
};

export function CaseFormModal({ open, caseRecord, clients, staff, loading, onSubmit, onClose, submitLabel }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal large">
        <header>
          <h3>{caseRecord ? 'Edit Case' : 'Create Case'}</h3>
        </header>

        <CaseForm
          caseRecord={caseRecord}
          clients={clients}
          staff={staff}
          loading={Boolean(loading)}
          onSubmit={async (data) => {
            await onSubmit(data);
            onClose();
          }}
          submitLabel={submitLabel}
        />

        <div className="modal-footer">
          <button type="button" className="secondary-action-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
