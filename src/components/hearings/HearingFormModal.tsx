import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Hearing, HearingInsert, HearingUpdate } from '../../types/hearing';
import { getCaseOptions, getStaffOptions } from '../../services/hearingService';
import './HearingFormModal.css';

type HearingFormModalProps = {
  hearing?: Hearing;
  preselectedCaseId?: string;
  onClose: () => void;
  onSave: (data: HearingInsert | HearingUpdate) => Promise<void>;
};

export function HearingFormModal({
  hearing,
  preselectedCaseId,
  onClose,
  onSave,
}: HearingFormModalProps) {
  const [formData, setFormData] = useState<HearingInsert | HearingUpdate>(
    hearing || {
      case_id: preselectedCaseId || '',
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
    }
  );

  const [caseOptions, setCaseOptions] = useState<Array<{ id: string; case_number: string; client_name: string }>>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadOptions() {
      try {
        setLoading(true);
        const [cases, staff] = await Promise.all([
          getCaseOptions(),
          getStaffOptions(),
        ]);
        setCaseOptions(cases);
        setStaffOptions(staff);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load options');
      } finally {
        setLoading(false);
      }
    }
    loadOptions();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.case_id) errors.case_id = 'Case is required';
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.hearing_at) errors.hearing_at = 'Hearing date and time is required';
    if (!formData.court) errors.court = 'Court is required';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.currentTarget;

    if (type === 'checkbox') {
      const checked = (e.currentTarget as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked ? value : null }));
    } else if (name === 'reminder_minutes') {
      setFormData((prev) => ({ ...prev, [name]: value ? parseInt(value) : null }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value || null }));
    }

    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hearing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hearing-modal-overlay" onClick={onClose}>
      <div className="hearing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hearing-modal-header">
          <h2>{hearing ? 'Edit Hearing' : 'Add Hearing'}</h2>
          <button
            type="button"
            className="hearing-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {error && <div className="hearing-modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="hearing-form">
          <div className="hearing-form-grid">
            {/* Case Selection */}
            <div className="hearing-form-group">
              <label htmlFor="case_id">
                Case <span className="hearing-required">*</span>
              </label>
              <select
                id="case_id"
                name="case_id"
                value={formData.case_id}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select a case...</option>
                {caseOptions.map((caseOpt) => (
                  <option key={caseOpt.id} value={caseOpt.id}>
                    {caseOpt.case_number} - {caseOpt.client_name}
                  </option>
                ))}
              </select>
              {validationErrors.case_id && (
                <span className="hearing-error">{validationErrors.case_id}</span>
              )}
            </div>

            {/* Assigned Staff */}
            <div className="hearing-form-group">
              <label htmlFor="assigned_staff_id">Assigned Staff</label>
              <select
                id="assigned_staff_id"
                name="assigned_staff_id"
                value={formData.assigned_staff_id || ''}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select staff...</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="hearing-form-group">
              <label htmlFor="title">
                Title <span className="hearing-required">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Court Hearing"
                disabled={loading}
              />
              {validationErrors.title && (
                <span className="hearing-error">{validationErrors.title}</span>
              )}
            </div>

            {/* Hearing Date and Time */}
            <div className="hearing-form-group">
              <label htmlFor="hearing_at">
                Hearing Date & Time <span className="hearing-required">*</span>
              </label>
              <input
                id="hearing_at"
                name="hearing_at"
                type="datetime-local"
                value={formData.hearing_at ? formData.hearing_at.slice(0, 16) : ''}
                onChange={handleChange}
                disabled={loading}
              />
              {validationErrors.hearing_at && (
                <span className="hearing-error">{validationErrors.hearing_at}</span>
              )}
            </div>

            {/* End Date and Time */}
            <div className="hearing-form-group">
              <label htmlFor="end_at">End Date & Time</label>
              <input
                id="end_at"
                name="end_at"
                type="datetime-local"
                value={formData.end_at ? formData.end_at.slice(0, 16) : ''}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Court */}
            <div className="hearing-form-group">
              <label htmlFor="court">
                Court <span className="hearing-required">*</span>
              </label>
              <input
                id="court"
                name="court"
                type="text"
                value={formData.court}
                onChange={handleChange}
                placeholder="e.g., Dubai Court"
                disabled={loading}
              />
              {validationErrors.court && (
                <span className="hearing-error">{validationErrors.court}</span>
              )}
            </div>

            {/* Courtroom */}
            <div className="hearing-form-group">
              <label htmlFor="courtroom">Courtroom</label>
              <input
                id="courtroom"
                name="courtroom"
                type="text"
                value={formData.courtroom || ''}
                onChange={handleChange}
                placeholder="e.g., Room 101"
                disabled={loading}
              />
            </div>

            {/* Location */}
            <div className="hearing-form-group">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                type="text"
                value={formData.location || ''}
                onChange={handleChange}
                placeholder="Address or coordinates"
                disabled={loading}
              />
            </div>

            {/* Hearing Type */}
            <div className="hearing-form-group">
              <label htmlFor="hearing_type">Hearing Type</label>
              <select
                id="hearing_type"
                name="hearing_type"
                value={formData.hearing_type}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Preliminary">Preliminary</option>
                <option value="Case Management">Case Management</option>
                <option value="Final Hearing">Final Hearing</option>
                <option value="Appeal">Appeal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Status */}
            <div className="hearing-form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Adjourned">Adjourned</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Reminder */}
            <div className="hearing-form-group">
              <label htmlFor="reminder_minutes">Reminder (minutes)</label>
              <input
                id="reminder_minutes"
                name="reminder_minutes"
                type="number"
                value={formData.reminder_minutes || ''}
                onChange={handleChange}
                placeholder="30"
                disabled={loading}
              />
            </div>

            {/* Outcome */}
            <div className="hearing-form-group">
              <label htmlFor="outcome">Outcome</label>
              <input
                id="outcome"
                name="outcome"
                type="text"
                value={formData.outcome || ''}
                onChange={handleChange}
                placeholder="e.g., Case dismissed"
                disabled={loading}
              />
            </div>

            {/* Notes - Full Width */}
            <div className="hearing-form-group hearing-form-group-full">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                placeholder="Additional notes..."
                rows={4}
                disabled={loading}
              />
            </div>
          </div>

          <div className="hearing-form-footer">
            <button
              type="button"
              className="hearing-button-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="hearing-button-submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Hearing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
