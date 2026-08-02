import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Gavel,
  MapPin,
  Save,
  UserRound,
  X,
} from 'lucide-react';
import type { Hearing, HearingInsert, HearingUpdate } from '../../types/hearing';
import { getCaseOptions, getStaffOptions } from '../../services/hearingService';
import './HearingFormModal.css';

type HearingFormModalProps = {
  hearing?: Hearing;
  preselectedCaseId?: string;
  preselectedClientId?: string;
  onClose: () => void;
  onSave: (data: HearingInsert | HearingUpdate) => Promise<void>;
};

type CaseOption = {
  id: string;
  case_number: string;
  client_id?: string;
  client_name: string;
};

type StaffOption = {
  id: string;
  full_name: string;
};

const DEFAULT_FORM: HearingInsert = {
  case_id: '',
  assigned_staff_id: null,
  title: 'Court Hearing',
  hearing_at: '',
  end_at: null,
  court: '',
  courtroom: null,
  location: null,
  hearing_type: 'Final Hearing',
  status: 'Scheduled',
  outcome: null,
  notes: null,
  reminder_minutes: 30,
  created_by: null,
};

function toLocalDateTimeValue(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function HearingFormModal({
  hearing,
  preselectedCaseId,
  preselectedClientId,
  onClose,
  onSave,
}: HearingFormModalProps) {
  const isEditing = Boolean(hearing);

  const [formData, setFormData] = useState<HearingInsert>(() => ({
    ...DEFAULT_FORM,
    ...(hearing
      ? {
          case_id: hearing.case_id,
          assigned_staff_id: hearing.assigned_staff_id,
          title: hearing.title,
          hearing_at: toLocalDateTimeValue(hearing.hearing_at),
          end_at: toLocalDateTimeValue(hearing.end_at) || null,
          court: hearing.court,
          courtroom: hearing.courtroom,
          location: hearing.location,
          hearing_type: hearing.hearing_type,
          status: hearing.status,
          outcome: hearing.outcome,
          notes: hearing.notes,
          reminder_minutes: hearing.reminder_minutes,
          created_by: hearing.created_by,
        }
      : {
          case_id: preselectedCaseId || '',
        }),
  }));

  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setError(null);

        const [cases, staff] = await Promise.all([
          getCaseOptions(),
          getStaffOptions(),
        ]);

        if (!active) return;
        setCaseOptions(cases);
        setStaffOptions(staff);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load form options.');
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    void loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, saving]);

  const visibleCaseOptions = useMemo(
    () => {
      if (
        hearing ||
        preselectedCaseId ||
        !preselectedClientId
      ) {
        return caseOptions;
      }

      return caseOptions.filter(
        (item) =>
          item.client_id ===
          preselectedClientId,
      );
    },
    [
      caseOptions,
      hearing,
      preselectedCaseId,
      preselectedClientId,
    ],
  );

  const selectedCase = useMemo(
    () => caseOptions.find((item) => item.id === formData.case_id),
    [caseOptions, formData.case_id]
  );

  const selectedStaff = useMemo(
    () => staffOptions.find((item) => item.id === formData.assigned_staff_id),
    [staffOptions, formData.assigned_staff_id]
  );

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.case_id) errors.case_id = 'Select the related matter.';
    if (!formData.title.trim()) errors.title = 'Enter a hearing title.';
    if (!formData.hearing_at) errors.hearing_at = 'Select the hearing date and time.';
    if (!formData.court.trim()) errors.court = 'Enter the court name.';

    if (formData.hearing_at && formData.end_at) {
      const start = new Date(formData.hearing_at).getTime();
      const end = new Date(formData.end_at).getTime();

      if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
        errors.end_at = 'End time must be after the hearing start time.';
      }
    }

    if (
      formData.reminder_minutes !== null &&
      formData.reminder_minutes !== undefined &&
      formData.reminder_minutes < 0
    ) {
      errors.reminder_minutes = 'Reminder cannot be a negative number.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearValidationError = (field: string) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateField = <K extends keyof HearingInsert>(
    field: K,
    value: HearingInsert[K]
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    clearValidationError(field);
  };

  const handleTextChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const field = event.target.name as keyof HearingInsert;
    updateField(field, event.target.value as HearingInsert[typeof field]);
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const field = event.target.name as keyof HearingInsert;
    const value = event.target.value || null;
    updateField(field, value as HearingInsert[typeof field]);
  };

  const handleReminderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateField('reminder_minutes', value === '' ? null : Number(value));
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as 'hearing_at' | 'end_at';
    updateField(field, (event.target.value || null) as HearingInsert[typeof field]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);

      const payload: HearingInsert = {
        ...formData,
        title: formData.title.trim(),
        court: formData.court.trim(),
        courtroom: formData.courtroom?.trim() || null,
        location: formData.location?.trim() || null,
        outcome: formData.outcome?.trim() || null,
        notes: formData.notes?.trim() || null,
        hearing_at: toIsoDateTime(formData.hearing_at) || '',
        end_at: toIsoDateTime(formData.end_at),
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hearing.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = loadingOptions || saving;

  return (
    <div
      className="hearing-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <div
        className="hearing-modal hearing-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hearing-form-title"
      >
        <div className="hearing-modal-header hearing-form-header">
          <div>
            <span className="hearing-form-eyebrow">
              {isEditing ? 'Update court schedule' : 'New court schedule'}
            </span>
            <h2 id="hearing-form-title">
              {isEditing ? 'Edit Hearing' : 'Schedule Hearing'}
            </h2>
            <p>
              Record the matter, court details, assigned professional, timing,
              reminder and hearing notes.
            </p>
          </div>

          <button
            type="button"
            className="hearing-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close hearing form"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="hearing-modal-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="hearing-form">
          <div className="hearing-form-content">
            <section className="hearing-form-section">
              <div className="hearing-form-section-heading">
                <div className="hearing-form-section-icon">
                  <BriefcaseBusiness size={18} />
                </div>
                <div>
                  <h3>Matter & Assignment</h3>
                  <p>Connect this hearing to the correct file and responsible staff member.</p>
                </div>
              </div>

              <div className="hearing-form-grid">
                <div className="hearing-form-group hearing-form-group-full">
                  <label htmlFor="case_id">
                    Matter <span className="hearing-required">*</span>
                  </label>
                  <select
                    id="case_id"
                    name="case_id"
                    value={formData.case_id}
                    onChange={handleSelectChange}
                    disabled={disabled || Boolean(preselectedCaseId)}
                    className={validationErrors.case_id ? 'is-invalid' : ''}
                  >
                    <option value="">
                      {loadingOptions ? 'Loading matters...' : 'Select a matter'}
                    </option>
                    {caseOptions.map((caseOption) => (
                      <option key={caseOption.id} value={caseOption.id}>
                        {caseOption.case_number} — {caseOption.client_name}
                      </option>
                    ))}
                  </select>
                  {selectedCase && (
                    <span className="hearing-field-hint">
                      Client: {selectedCase.client_name}
                    </span>
                  )}
                  {validationErrors.case_id && (
                    <span className="hearing-error">{validationErrors.case_id}</span>
                  )}
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="assigned_staff_id">
                    <UserRound size={15} />
                    Assigned Professional
                  </label>
                  <select
                    id="assigned_staff_id"
                    name="assigned_staff_id"
                    value={formData.assigned_staff_id || ''}
                    onChange={handleSelectChange}
                    disabled={disabled}
                  >
                    <option value="">
                      {loadingOptions ? 'Loading staff...' : 'Unassigned'}
                    </option>
                    {staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </option>
                    ))}
                  </select>
                  {selectedStaff && (
                    <span className="hearing-field-hint">
                      Responsible: {selectedStaff.full_name}
                    </span>
                  )}
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="title">
                    <FileText size={15} />
                    Hearing Title <span className="hearing-required">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleTextChange}
                    placeholder="e.g. First Instance Hearing"
                    disabled={disabled}
                    className={validationErrors.title ? 'is-invalid' : ''}
                  />
                  {validationErrors.title && (
                    <span className="hearing-error">{validationErrors.title}</span>
                  )}
                </div>
              </div>
            </section>

            <section className="hearing-form-section">
              <div className="hearing-form-section-heading">
                <div className="hearing-form-section-icon">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <h3>Schedule</h3>
                  <p>Set the hearing time, expected completion and reminder interval.</p>
                </div>
              </div>

              <div className="hearing-form-grid hearing-form-grid-three">
                <div className="hearing-form-group">
                  <label htmlFor="hearing_at">
                    <CalendarDays size={15} />
                    Start Date & Time <span className="hearing-required">*</span>
                  </label>
                  <input
                    id="hearing_at"
                    name="hearing_at"
                    type="datetime-local"
                    value={formData.hearing_at || ''}
                    onChange={handleDateChange}
                    disabled={disabled}
                    className={validationErrors.hearing_at ? 'is-invalid' : ''}
                  />
                  {validationErrors.hearing_at && (
                    <span className="hearing-error">{validationErrors.hearing_at}</span>
                  )}
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="end_at">
                    <Clock3 size={15} />
                    Expected End
                  </label>
                  <input
                    id="end_at"
                    name="end_at"
                    type="datetime-local"
                    value={formData.end_at || ''}
                    onChange={handleDateChange}
                    disabled={disabled}
                    className={validationErrors.end_at ? 'is-invalid' : ''}
                  />
                  {validationErrors.end_at && (
                    <span className="hearing-error">{validationErrors.end_at}</span>
                  )}
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="reminder_minutes">
                    <AlarmClock size={15} />
                    Reminder
                  </label>
                  <select
                    id="reminder_minutes"
                    name="reminder_minutes"
                    value={formData.reminder_minutes ?? ''}
                    onChange={handleReminderChange}
                    disabled={disabled}
                    className={validationErrors.reminder_minutes ? 'is-invalid' : ''}
                  >
                    <option value="">No reminder</option>
                    <option value="15">15 minutes before</option>
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="180">3 hours before</option>
                    <option value="720">12 hours before</option>
                    <option value="1440">1 day before</option>
                    <option value="2880">2 days before</option>
                    <option value="10080">1 week before</option>
                  </select>
                  {validationErrors.reminder_minutes && (
                    <span className="hearing-error">
                      {validationErrors.reminder_minutes}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="hearing-form-section">
              <div className="hearing-form-section-heading">
                <div className="hearing-form-section-icon">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3>Court & Venue</h3>
                  <p>Record the court, courtroom and physical or remote location.</p>
                </div>
              </div>

              <div className="hearing-form-grid">
                <div className="hearing-form-group hearing-form-group-full">
                  <label htmlFor="court">
                    <Gavel size={15} />
                    Court <span className="hearing-required">*</span>
                  </label>
                  <input
                    id="court"
                    name="court"
                    type="text"
                    value={formData.court}
                    onChange={handleTextChange}
                    placeholder="e.g. Dubai Courts — Commercial Court"
                    disabled={disabled}
                    className={validationErrors.court ? 'is-invalid' : ''}
                  />
                  {validationErrors.court && (
                    <span className="hearing-error">{validationErrors.court}</span>
                  )}
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="courtroom">
                    <Building2 size={15} />
                    Courtroom / Chamber
                  </label>
                  <input
                    id="courtroom"
                    name="courtroom"
                    type="text"
                    value={formData.courtroom || ''}
                    onChange={handleTextChange}
                    placeholder="e.g. Chamber 4, Room 101"
                    disabled={disabled}
                  />
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="location">
                    <MapPin size={15} />
                    Location / Remote Link
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={formData.location || ''}
                    onChange={handleTextChange}
                    placeholder="Court address or online hearing link"
                    disabled={disabled}
                  />
                </div>
              </div>
            </section>

            <section className="hearing-form-section">
              <div className="hearing-form-section-heading">
                <div className="hearing-form-section-icon">
                  <Gavel size={18} />
                </div>
                <div>
                  <h3>Classification & Result</h3>
                  <p>Classify the hearing and record its present status or result.</p>
                </div>
              </div>

              <div className="hearing-form-grid">
                <div className="hearing-form-group">
                  <label htmlFor="hearing_type">Hearing Type</label>
                  <select
                    id="hearing_type"
                    name="hearing_type"
                    value={formData.hearing_type}
                    onChange={handleSelectChange}
                    disabled={disabled}
                  >
                    <option value="Preliminary">Preliminary</option>
                    <option value="Case Management">Case Management</option>
                    <option value="Final Hearing">Final Hearing</option>
                    <option value="Appeal">Appeal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="hearing-form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleSelectChange}
                    disabled={disabled}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Adjourned">Adjourned</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="hearing-form-group hearing-form-group-full">
                  <label htmlFor="outcome">Outcome / Court Direction</label>
                  <input
                    id="outcome"
                    name="outcome"
                    type="text"
                    value={formData.outcome || ''}
                    onChange={handleTextChange}
                    placeholder="e.g. Adjourned for submission of reply memorandum"
                    disabled={disabled}
                  />
                </div>

                <div className="hearing-form-group hearing-form-group-full">
                  <label htmlFor="notes">Internal Hearing Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes || ''}
                    onChange={handleTextChange}
                    placeholder="Record attendance, oral submissions, judge directions, required documents and next actions..."
                    rows={6}
                    disabled={disabled}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="hearing-form-footer">
            <div className="hearing-form-footer-note">
              <AlarmClock size={16} />
              Reminder delivery will use the configured hearing notification workflow.
            </div>

            <div className="hearing-form-footer-actions">
              <button
                type="button"
                className="hearing-button-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hearing-button-submit"
                disabled={disabled}
              >
                <Save size={17} />
                {saving
                  ? 'Saving...'
                  : isEditing
                    ? 'Update Hearing'
                    : 'Schedule Hearing'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}