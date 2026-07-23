import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { Case, CaseInsert, CasePriority, CaseStatus, CaseUpdate } from '../../types/case';
import type { Client } from '../../types/client';
import type { Staff } from '../../types/staff';
import './CaseForm.css';

export type CaseFormProps = {
  caseRecord?: Case | null;
  clients: Array<Pick<Client, 'id' | 'full_name'>>;
  staff: Array<Pick<Staff, 'id' | 'full_name'>>;
  loading: boolean;
  onSubmit: (data: CaseInsert | CaseUpdate) => Promise<void>;
  submitLabel: string;
};

type FormState = {
  client_id: string;
  case_number: string;
  case_type: string;
  court: string;
  court_case_number: string;
  opponent_name: string;
  opponent_lawyer: string;
  assigned_staff_id: string;
  status: CaseStatus;
  priority: CasePriority;
  filing_date: string;
  next_hearing_at: string;
  case_value: string;
  currency: string;
  description: string;
  internal_notes: string;
};

const emptyFormState: FormState = {
  client_id: '',
  case_number: '',
  case_type: '',
  court: '',
  court_case_number: '',
  opponent_name: '',
  opponent_lawyer: '',
  assigned_staff_id: '',
  status: 'Open',
  priority: 'Medium',
  filing_date: '',
  next_hearing_at: '',
  case_value: '',
  currency: 'AED',
  description: '',
  internal_notes: '',
};

export function CaseForm({
  caseRecord,
  clients,
  staff,
  loading,
  onSubmit,
  submitLabel,
}: CaseFormProps) {
  const [formState, setFormState] = useState<FormState>(() => {
    if (!caseRecord) {
      return emptyFormState;
    }

    return {
      client_id: caseRecord.client_id,
      case_number: caseRecord.case_number,
      case_type: caseRecord.case_type,
      court: caseRecord.court,
      court_case_number: caseRecord.court_case_number ?? '',
      opponent_name: caseRecord.opponent_name ?? '',
      opponent_lawyer: caseRecord.opponent_lawyer ?? '',
      assigned_staff_id: caseRecord.assigned_staff_id ?? '',
      status: caseRecord.status,
      priority: caseRecord.priority,
      filing_date: caseRecord.filing_date,
      next_hearing_at: caseRecord.next_hearing_at ?? '',
      case_value: caseRecord.case_value?.toString() ?? '',
      currency: caseRecord.currency ?? 'AED',
      description: caseRecord.description ?? '',
      internal_notes: caseRecord.internal_notes ?? '',
    };
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseRecord) {
      setFormState(emptyFormState);
      return;
    }

    setFormState({
      client_id: caseRecord.client_id,
      case_number: caseRecord.case_number,
      case_type: caseRecord.case_type,
      court: caseRecord.court,
      court_case_number: caseRecord.court_case_number ?? '',
      opponent_name: caseRecord.opponent_name ?? '',
      opponent_lawyer: caseRecord.opponent_lawyer ?? '',
      assigned_staff_id: caseRecord.assigned_staff_id ?? '',
      status: caseRecord.status,
      priority: caseRecord.priority,
      filing_date: caseRecord.filing_date,
      next_hearing_at: caseRecord.next_hearing_at ?? '',
      case_value: caseRecord.case_value?.toString() ?? '',
      currency: caseRecord.currency ?? 'AED',
      description: caseRecord.description ?? '',
      internal_notes: caseRecord.internal_notes ?? '',
    });
  }, [caseRecord]);

  const clientOptions = useMemo(
    () => [{ id: '', full_name: 'Select client' }, ...clients],
    [clients],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!formState.client_id) {
      errors.push('Please assign a client to the case.');
    }

    if (!formState.case_number.trim()) {
      errors.push('Case number is required.');
    }

    if (!formState.case_type.trim()) {
      errors.push('Case type is required.');
    }

    if (!formState.court.trim()) {
      errors.push('Court name is required.');
    }

    if (!formState.assigned_staff_id.trim()) {
      errors.push('Assigned staff is required.');
    }

    if (!formState.filing_date.trim()) {
      errors.push('Filing date is required.');
    }

    return errors;
  }, [formState]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    const payload: CaseInsert | CaseUpdate = {
      client_id: formState.client_id,
      case_number: formState.case_number.trim(),
      case_type: formState.case_type.trim(),
      court: formState.court.trim(),
      court_case_number: formState.court_case_number.trim() || null,
      opponent_name: formState.opponent_name.trim() || null,
      opponent_lawyer: formState.opponent_lawyer.trim() || null,
      assigned_staff_id: formState.assigned_staff_id.trim() || null,
      status: formState.status,
      priority: formState.priority,
      filing_date: formState.filing_date,
      next_hearing_at: formState.next_hearing_at || null,
      case_value: formState.case_value
        ? Number(formState.case_value)
        : null,
      currency: formState.currency || null,
      description: formState.description.trim() || null,
      internal_notes: formState.internal_notes.trim() || null,
    };

    try {
      await onSubmit(payload);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError('Unable to save case.');
      }
    }
  };

  return (
    <form className="case-form" onSubmit={handleSubmit}>
      <div className="case-form-grid">
        <div className="case-form-field">
          <label htmlFor="client_id">Client</label>
          <select
            id="client_id"
            value={formState.client_id}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                client_id: event.target.value,
              }))
            }
          >
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="case-form-field">
          <label htmlFor="case_number">Case Number</label>
          <input
            id="case_number"
            value={formState.case_number}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                case_number: event.target.value,
              }))
            }
            placeholder="e.g. C-2026-001"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="case_type">Case Type</label>
          <input
            id="case_type"
            value={formState.case_type}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                case_type: event.target.value,
              }))
            }
            placeholder="e.g. Civil dispute"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="court">Court</label>
          <input
            id="court"
            value={formState.court}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                court: event.target.value,
              }))
            }
            placeholder="e.g. Dubai Court"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="court_case_number">Court Case Number</label>
          <input
            id="court_case_number"
            value={formState.court_case_number}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                court_case_number: event.target.value,
              }))
            }
            placeholder="Court file/reference number"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="opponent_name">Opponent</label>
          <input
            id="opponent_name"
            value={formState.opponent_name}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                opponent_name: event.target.value,
              }))
            }
            placeholder="Opponent name"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="opponent_lawyer">Opponent Lawyer</label>
          <input
            id="opponent_lawyer"
            value={formState.opponent_lawyer}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                opponent_lawyer: event.target.value,
              }))
            }
            placeholder="Opponent lawyer"
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="assigned_staff_id">Assigned Staff</label>
          <select
            id="assigned_staff_id"
            value={formState.assigned_staff_id}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                assigned_staff_id: event.target.value,
              }))
            }
          >
            {[{ id: '', full_name: 'Unassigned' }, ...staff].map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>

        <div className="case-form-field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={formState.status}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                status: event.target.value as CaseStatus,
              }))
            }
          >
            <option value="Open">Open</option>
            <option value="Pending">Pending</option>
            <option value="In Court">In Court</option>
            <option value="Closed">Closed</option>
            <option value="Appeal">Appeal</option>
          </select>
        </div>

        <div className="case-form-field">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            value={formState.priority}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                priority: event.target.value as CasePriority,
              }))
            }
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="case-form-field">
          <label htmlFor="filing_date">Filing Date</label>
          <input
            id="filing_date"
            type="date"
            value={formState.filing_date}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                filing_date: event.target.value,
              }))
            }
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="next_hearing_at">Next Hearing</label>
          <input
            id="next_hearing_at"
            type="datetime-local"
            value={formState.next_hearing_at}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                next_hearing_at: event.target.value,
              }))
            }
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="currency">Currency</label>
          <input
            id="currency"
            value={formState.currency}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                currency: event.target.value,
              }))
            }
          />
        </div>

        <div className="case-form-field">
          <label htmlFor="case_value">Case Value</label>
          <input
            id="case_value"
            type="number"
            min="0"
            step="0.01"
            value={formState.case_value}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                case_value: event.target.value,
              }))
            }
            placeholder="AED 0.00"
          />
        </div>

        <div className="case-form-field case-form-field-wide">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formState.description}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Case summary and key details"
          />
        </div>

        <div className="case-form-field case-form-field-wide">
          <label htmlFor="internal_notes">Internal Notes</label>
          <textarea
            id="internal_notes"
            value={formState.internal_notes}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                internal_notes: event.target.value,
              }))
            }
            placeholder="Internal notes for the legal team"
          />
        </div>
      </div>

      {error ? (
        <div className="case-form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="case-form-actions">
        <button
          type="submit"
          className="primary-action-button"
          disabled={loading}
        >
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
